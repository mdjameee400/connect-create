import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Trash2, Loader2, UserPlus } from "lucide-react";
import type { TeamInvite } from "@/lib/team";

export function InviteTeammateDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  invites,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teamId: string;
  teamName: string;
  invites: TeamInvite[];
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: async (emailAddr: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("team_invites")
        .insert({
          team_id: teamId,
          email: emailAddr.trim().toLowerCase(),
          invited_by: userData.user.id,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: async (token) => {
      setEmail("");
      const url = `${window.location.origin}/invite/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied", { description: url });
      } catch {
        toast.success("Invite created", { description: url });
      }
      qc.invalidateQueries({ queryKey: ["teammates", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_invites").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite revoked");
      qc.invalidateQueries({ queryKey: ["teammates", teamId] });
    },
  });

  const copy = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite to {teamName}</DialogTitle>
          <DialogDescription>
            Create an invite link and share it. Anyone with the link can join the team.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate(email);
          }}
          className="flex gap-2"
        >
          <div className="flex-1">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={invite.isPending} className="gap-1.5">
            {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Create link
          </Button>
        </form>

        {invites.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">
              PENDING INVITES
            </div>
            <div className="divide-y border rounded-lg">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{i.email}</div>
                    <div className="text-xs text-muted-foreground">
                      /invite/{i.token.slice(0, 8)}…
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(i.token)}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-8 h-8"
                    onClick={() => revoke.mutate(i.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
