import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Copy, Calendar, Clock, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meeting — Orbital Connect" },
      { name: "description", content: "Join a meeting on Orbital Connect." },
    ],
  }),
  component: MeetingPage,
});

type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  notes: string | null;
  host_name: string | null;
};

function MeetingPage() {
  const { slug } = Route.useParams();
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [inRoom, setInRoom] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, starts_at, duration_minutes, notes, profiles:created_by(display_name)")
        .eq("room_slug", slug)
        .maybeSingle();
      if (error || !data) { setMeeting(null); return; }
      const p = data.profiles as unknown as { display_name: string | null } | null;
      setMeeting({
        id: data.id,
        title: data.title,
        starts_at: data.starts_at,
        duration_minutes: data.duration_minutes,
        notes: data.notes,
        host_name: p?.display_name ?? null,
      });
    })();
  }, [slug]);

  const copy = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Meeting link copied");
  };

  if (meeting === undefined) {
    return <div className="min-h-screen grid place-items-center bg-slate-950"><Loader2 className="w-6 h-6 animate-spin text-white/60" /></div>;
  }
  if (meeting === null) throw notFound();

  const dt = new Date(meeting.starts_at);
  const endMs = dt.getTime() + meeting.duration_minutes * 60_000;
  const status: "upcoming" | "live" | "ended" =
    Date.now() < dt.getTime() ? "upcoming" : Date.now() < endMs ? "live" : "ended";

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
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

      <main className="flex-1 grid place-items-center px-4 py-8">
        {inRoom ? (
          <div className="w-full max-w-4xl">
            <div className="aspect-video bg-slate-900 rounded-xl border border-white/10 grid place-items-center text-center px-6">
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-brand/20 grid place-items-center mb-4">
                  <Video className="w-7 h-7 text-brand" />
                </div>
                <h2 className="text-xl font-semibold">You're in the room</h2>
                <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
                  Live video and audio are coming in the next release. Share this link so your teammates can join the same room when it goes live.
                </p>
                <Button variant="secondary" size="sm" className="mt-6 gap-1.5" onClick={copy}>
                  <Copy className="w-3.5 h-3.5" /> Copy join link
                </Button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-white/70">
                <span className="font-medium text-white">{meeting.title}</span>
                {meeting.host_name && <> · hosted by {meeting.host_name}</>}
              </div>
              <Button variant="ghost" className="text-white/70 hover:text-white" onClick={() => setInRoom(false)}>
                Leave
              </Button>
            </div>
          </div>
        ) : (
          <Card className="w-full max-w-lg p-8 bg-slate-900 border-white/10 text-white">
            <div className="text-[11px] font-semibold tracking-wider text-brand mb-2">
              {status === "live" ? "LIVE NOW" : status === "upcoming" ? "UPCOMING" : "ENDED"}
            </div>
            <h1 className="text-2xl font-semibold">{meeting.title}</h1>
            {meeting.host_name && (
              <p className="text-sm text-white/60 mt-1">Hosted by {meeting.host_name}</p>
            )}
            <div className="mt-5 space-y-2 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white/50" />
                {dt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/50" />
                {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {meeting.duration_minutes}m
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/50" />
                Team meeting
              </div>
            </div>
            {meeting.notes && (
              <div className="mt-4 p-3 bg-white/5 rounded-lg text-sm text-white/80 whitespace-pre-wrap">
                {meeting.notes}
              </div>
            )}
            <Button
              size="lg"
              className="w-full mt-6 gap-2"
              onClick={() => setInRoom(true)}
              disabled={status === "ended"}
            >
              <Video className="w-4 h-4" />
              {status === "ended" ? "Meeting ended" : "Join room"}
            </Button>
            <Button variant="ghost" className="w-full mt-2 text-white/70 hover:text-white gap-1.5" onClick={copy}>
              <Copy className="w-3.5 h-3.5" /> Copy join link
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
