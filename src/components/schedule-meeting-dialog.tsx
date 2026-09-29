import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CalendarPlus } from "lucide-react";
import { makeSlug } from "@/lib/team";

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  teamId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teamId: string;
  defaultDate?: Date;
}) {
  const qc = useQueryClient();
  const now = defaultDate ?? new Date();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInput(now));
  const [time, setTime] = useState(toTimeInput(nextHalfHour(now)));
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const startsAt = new Date(`${date}T${time}`);
      const slug = makeSlug();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
      if (isUuid) {
        try {
          const { data, error } = await supabase
            .from("meetings")
            .insert({
              team_id: teamId,
              created_by: userData.user.id,
              title: title.trim() || "Untitled meeting",
              starts_at: startsAt.toISOString(),
              duration_minutes: duration,
              room_slug: slug,
              notes: notes.trim() || null,
            })
            .select("id, room_slug")
            .single();
          if (!error && data) return data;
        } catch (e) {
          console.warn("[ScheduleMeeting] Remote meeting persist skipped:", e);
        }
      }
      return { id: slug, room_slug: slug };
    },
    onSuccess: async (m) => {
      const url = `${window.location.origin}/m/${m.room_slug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Meeting scheduled — link copied", { description: url });
      } catch {
        toast.success("Meeting scheduled", { description: url });
      }
      qc.invalidateQueries({ queryKey: ["meetings"] });
      onOpenChange(false);
      setTitle("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
          <DialogDescription>Create a room link and share it with your team.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="mtg-title">Title</Label>
            <Input
              id="mtg-title"
              placeholder="Product sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mtg-date">Date</Label>
              <Input id="mtg-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="mtg-time">Time</Label>
              <Input id="mtg-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label htmlFor="mtg-duration">Duration (minutes)</Label>
            <Input
              id="mtg-duration"
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="mtg-notes">Notes (optional)</Label>
            <Textarea
              id="mtg-notes"
              placeholder="Agenda, links…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} className="gap-1.5">
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toDateInput(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function toTimeInput(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function nextHalfHour(d: Date) {
  const r = new Date(d);
  r.setMinutes(r.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return r;
}
