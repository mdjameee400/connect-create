import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, Loader2, Copy, Calendar, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { MeetingRoom } from "@/components/meeting-room";

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
  const [displayName, setDisplayName] = useState("");
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (user) {
        const { data: p } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        const name = p?.display_name || (user.email ? user.email.split("@")[0] : "") || "Guest";
        setDisplayName(name);
        setNameDraft(name);
      } else {
        const saved = typeof window !== "undefined" ? localStorage.getItem("orbital.guestName") : null;
        if (saved) { setDisplayName(saved); setNameDraft(saved); }
      }
    })();
  }, []);


  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, starts_at, duration_minutes, notes, created_by")
        .eq("room_slug", slug)
        .maybeSingle();
      if (error || !data) { setMeeting(null); return; }
      let host: string | null = null;
      if (data.created_by) {
        const { data: p } = await supabase
          .from("profiles").select("display_name").eq("id", data.created_by).maybeSingle();
        host = p?.display_name ?? null;
      }
      setMeeting({
        id: data.id,
        title: data.title,
        starts_at: data.starts_at,
        duration_minutes: data.duration_minutes,
        notes: data.notes,
        host_name: host,
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
          <MeetingRoom slug={slug} displayName={displayName || "Guest"} onLeave={() => setInRoom(false)} />
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
