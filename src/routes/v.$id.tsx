import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Video, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/v/$id")({
  ssr: false,
  component: SharePage,
  head: () => ({
    meta: [
      { title: "Recording — Orbital Connect" },
      { name: "description", content: "Watch this screen recording shared via Orbital Connect." },
    ],
  }),
});

type Recording = {
  id: string; title: string; storage_path: string;
  duration_seconds: number; created_at: string; upload_status: string;
};

function SharePage() {
  const { id } = Route.useParams();
  const [rec, setRec] = useState<Recording | null | undefined>(undefined);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("recordings")
        .select("id, title, storage_path, duration_seconds, created_at, upload_status, is_public")
        .eq("id", id).maybeSingle();
      if (error || !data || !data.is_public) { setRec(null); return; }
      setRec(data);
      if (data.upload_status === "ready") {
        const { data: signed } = await supabase.storage.from("recordings").createSignedUrl(data.storage_path, 60 * 60 * 24);
        setVideoUrl(signed?.signedUrl ?? null);
      }
    })();
  }, [id]);

  const copy = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  if (rec === undefined) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (rec === null) {
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-ink text-ink-foreground flex flex-col">
      <header className="h-16 border-b border-white/10 flex items-center px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand grid place-items-center">
            <Video className="w-4 h-4" />
          </div>
          <span className="font-semibold">Orbital Connect</span>
        </Link>
        <div className="ml-auto">
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={copy}>
            <Copy className="w-3.5 h-3.5" /> Copy link
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-5xl">
          <h1 className="text-xl font-semibold mb-1">{rec.title}</h1>
          <p className="text-sm text-ink-foreground/60 mb-4">
            Shared {formatDistanceToNow(new Date(rec.created_at), { addSuffix: true })}
          </p>
          <div className="aspect-video bg-ink rounded-xl overflow-hidden border border-ink-foreground/15">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay className="w-full h-full" />
            ) : (
              <div className="w-full h-full grid place-items-center text-ink-foreground/60 text-sm">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  {rec.upload_status === "uploading" ? "Upload in progress…" : rec.upload_status === "failed" ? "Upload failed" : "Preparing video…"}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
