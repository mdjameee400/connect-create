import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, ExternalLink, PlaySquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { finalizeInterrupted } from "@/lib/chunked-recording";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

function Library() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const myId = userData.user?.id ?? null;
      const { data: rows, error } = await supabase.from("recordings")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const otherIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter((id) => id !== myId)));
      let names: Record<string, string> = {};
      if (otherIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", otherIds);
        names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name ?? "Teammate"]));
      }
      return { rows: rows ?? [], myId, names };
    },
  });

  const del = useMutation({
    mutationFn: async (r: { id: string; storage_path: string }) => {
      await supabase.storage.from("recordings").remove([r.storage_path]);
      await supabase.from("recordings").delete().eq("id", r.id);
    },
    onSuccess: () => {
      toast.success("Recording deleted");
      qc.invalidateQueries({ queryKey: ["recordings"] });
    },
  });

  const recover = useMutation({
    mutationFn: async (r: {
      id: string; user_id: string; parts_count: number; mime_type: string; storage_path: string;
    }) => finalizeInterrupted(r),
    onSuccess: () => {
      toast.success("Recording recovered");
      qc.invalidateQueries({ queryKey: ["recordings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't recover recording"),
  });


  const copy = (id: string) => {
    const url = `${window.location.origin}/v/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: url });
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <PlaySquare className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-semibold">Library</h1>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !data?.rows.length ? (
        <Card className="p-12 text-center">
          <PlaySquare className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="font-medium">No recordings yet</p>
          <p className="text-sm text-muted-foreground mt-1">Start a recording from the dashboard to see it here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.rows.map((r) => (
            <Card key={r.id} className="overflow-hidden group p-0">
              <Link to="/v/$id" params={{ id: r.id }} className="block aspect-video bg-ink relative">
                <div className="absolute inset-0 grid place-items-center text-ink-foreground/50">
                  <PlaySquare className="w-10 h-10" />
                </div>
                <div className="absolute bottom-2 right-2 bg-ink/70 text-ink-foreground text-xs px-2 py-0.5 rounded">
                  {fmtDur(r.duration_seconds)}
                </div>
                {r.upload_status === "uploading" && (
                  <div className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                  </div>
                )}
                {r.upload_status === "failed" && (
                  <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded">Failed</div>
                )}
              </Link>
              <div className="p-4">
                <div className="font-medium text-sm truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })} · {fmtSize(r.size_bytes)}
                  {r.user_id !== data.myId && <> · by {data.names[r.user_id] ?? "Teammate"}</>}
                </div>
                <div className="mt-3 flex gap-1">
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => copy(r.id)}>
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5" asChild>
                    <Link to="/v/$id" params={{ id: r.id }}>
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </Link>
                  </Button>
                  {r.user_id === data.myId && (
                    <Button size="icon" variant="ghost" className="ml-auto w-8 h-8"
                      onClick={() => { if (confirm("Delete this recording?")) del.mutate({ id: r.id, storage_path: r.storage_path }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}
function fmtSize(b: number) {
  if (!b) return "—";
  const mb = b / (1024 * 1024);
  return mb < 1 ? `${(b / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
}
