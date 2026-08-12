import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Copy, Loader2,
  MessageSquare, PenLine, Circle, Square, X, BarChart3, HelpCircle, StickyNote,
  DoorOpen, Highlighter, FileDown, Bookmark, Music,
} from "lucide-react";
import { toast } from "sonner";
import { MeetingChat } from "@/components/meeting-chat";
import { MeetingWhiteboard } from "@/components/meeting-whiteboard";
import { MeetingPolls, MeetingQA } from "@/components/meeting-engagement";
import { MeetingNotes } from "@/components/meeting-notes";
import { MeetingBreakouts, type Breakout } from "@/components/meeting-breakouts";
import { AnnotationLayer } from "@/components/annotation-layer";
import { ReactionOverlay, REACTIONS, SOUNDS, playSound } from "@/components/meeting-reactions";
import { exportMeetingPdf } from "@/lib/meeting-pdf";
import { CallRecorder } from "@/lib/call-recorder";
import { fetchCurrentTeam } from "@/lib/team";
import { useMeetingChat } from "@/hooks/use-meeting-chat";




type Peer = {
  id: string;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  polite: boolean;
  makingOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  remoteSet: boolean;
};

// STUN + free public TURN (openrelay) so peers on different networks can connect.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function MeetingRoom({
  slug,
  meetingId,
  meetingTitle,
  displayName,
  onLeave,
}: {
  slug: string;
  meetingId: string;
  meetingTitle: string;
  displayName: string;
  onLeave: () => void;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [errMsg, setErrMsg] = useState<string>("");
  const [panel, setPanel] = useState<"none" | "chat" | "board" | "notes" | "polls" | "qa" | "rooms">("none");
  const [unread, setUnread] = useState(0);
  const [recState, setRecState] = useState<"idle" | "recording" | "saving">("idle");
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [breakout, setBreakout] = useState<Breakout | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [clearSignal, setClearSignal] = useState(0);
  const [reaction, setReaction] = useState<{ emoji: string; name: string; key: number } | null>(null);
  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const notesBodyRef = useRef<string>("");
  const recStartRef = useRef(0);
  const recorderInstance = useRef<CallRecorder | null>(null);

  const chat = useMeetingChat(meetingId, displayName);
  const chatNoticeRef = useRef(chat.addNotice);
  chatNoticeRef.current = chat.addNotice;
  const panelRef = useRef(panel);
  panelRef.current = panel;




  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Record<string, Peer>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerIdRef = useRef<string>(crypto.randomUUID());
  const localStreamRef = useRef<MediaStream | null>(null);
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const updatePeers = () => setPeers({ ...peersRef.current });

  const createPeer = useCallback(
    (remoteId: string, remoteName: string, initiator: boolean) => {
      if (peersRef.current[remoteId]) return peersRef.current[remoteId];
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const stream = new MediaStream();
      // "Polite" peer yields on offer collisions. Use deterministic tie-break by id.
      const polite = peerIdRef.current > remoteId;
      const peer: Peer = {
        id: remoteId,
        name: remoteName,
        pc,
        stream,
        polite,
        makingOffer: false,
        pendingCandidates: [],
        remoteSet: false,
      };
      peersRef.current[remoteId] = peer;
      updatePeers();
      // Keep an in-progress recording's grid in sync with who is in the room.
      void recorderInstance.current?.addSource({ id: remoteId, stream, name: remoteName });
      chatNoticeRef.current(`${remoteName} joined the meeting`);

      localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));


      pc.ontrack = (e) => {
        stream.addTrack(e.track);
        updatePeers();
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send("ice", {
            from: peerIdRef.current,
            to: remoteId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[peer ${remoteId.slice(0, 6)}] connection:`, pc.connectionState);
        if (pc.connectionState === "failed") {
          try { pc.restartIce(); } catch { /* ignore */ }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[peer ${remoteId.slice(0, 6)}] ice:`, pc.iceConnectionState);
      };

      if (initiator) {
        (async () => {
          try {
            peer.makingOffer = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            send("offer", {
              from: peerIdRef.current,
              fromName: displayNameRef.current,
              to: remoteId,
              sdp: pc.localDescription,
            });
          } catch (err) {
            console.error("createOffer failed", err);
          } finally {
            peer.makingOffer = false;
          }
        })();
      }

      return peer;
    },
    [send],
  );

  const removePeer = useCallback((id: string) => {
    const p = peersRef.current[id];
    if (!p) return;
    try { p.pc.close(); } catch { /* ignore */ }
    delete peersRef.current[id];
    recorderInstance.current?.removeSource(id);
    chatNoticeRef.current(`${p.name} left the meeting`);
    updatePeers();
  }, []);


  const flushPendingIce = async (peer: Peer) => {
    while (peer.pendingCandidates.length) {
      const c = peer.pendingCandidates.shift()!;
      try { await peer.pc.addIceCandidate(c); } catch (e) { console.warn("ICE add failed (flush)", e); }
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Re-verify workspace access server-side (RLS) before touching the signalling bus,
        // so a guessed room slug can't reach other participants.
        const { data: allowed } = await supabase
          .from("meetings")
          .select("id")
          .eq("room_slug", slug)
          .maybeSingle();
        if (!allowed) throw new Error("You don't have access to this meeting.");

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const channel = supabase.channel(`room:${slug}${breakout ? `:b:${breakout.id}` : ""}`, {
          config: { broadcast: { self: false, ack: false } },
        });
        channelRef.current = channel;

        channel.on("broadcast", { event: "join" }, ({ payload }) => {
          const { from, fromName } = payload as { from: string; fromName: string };
          if (from === peerIdRef.current) return;
          // Existing peer initiates offer to newcomer
          createPeer(from, fromName, true);
          // Also greet the newcomer so they know our name
          send("hello", { from: peerIdRef.current, fromName: displayNameRef.current, to: from });
          // Tell the newcomer the room is being recorded.
          if (recorderInstance.current) send("rec", { from: peerIdRef.current, active: true });
        });

        channel.on("broadcast", { event: "rec" }, ({ payload }) => {
          const { active } = payload as { active: boolean };
          setRemoteRecording(active);
        });

        channel.on("broadcast", { event: "react" }, ({ payload }) => {
          const { emoji, name } = payload as { emoji: string; name: string };
          setReaction({ emoji, name, key: Date.now() + Math.random() });
        });

        channel.on("broadcast", { event: "sound" }, ({ payload }) => {
          playSound((payload as { id: string }).id);
        });




        channel.on("broadcast", { event: "hello" }, ({ payload }) => {
          const { from, fromName, to } = payload as { from: string; fromName: string; to: string };
          if (to !== peerIdRef.current) return;
          if (!peersRef.current[from]) createPeer(from, fromName, false);
        });

        channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
          const { from, fromName, to, sdp } = payload as {
            from: string; fromName: string; to: string; sdp: RTCSessionDescriptionInit;
          };
          if (to !== peerIdRef.current) return;
          const peer = peersRef.current[from] ?? createPeer(from, fromName, false);
          try {
            const offerCollision = peer.makingOffer || peer.pc.signalingState !== "stable";
            if (offerCollision && !peer.polite) {
              // Impolite peer ignores incoming offer during collision
              return;
            }
            await peer.pc.setRemoteDescription(sdp);
            peer.remoteSet = true;
            await flushPendingIce(peer);
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            send("answer", { from: peerIdRef.current, to: from, sdp: peer.pc.localDescription });
          } catch (err) {
            console.error("offer handling failed", err);
          }
        });

        channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
          const { from, to, sdp } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit };
          if (to !== peerIdRef.current) return;
          const peer = peersRef.current[from];
          if (!peer) return;
          try {
            await peer.pc.setRemoteDescription(sdp);
            peer.remoteSet = true;
            await flushPendingIce(peer);
          } catch (err) {
            console.error("answer handling failed", err);
          }
        });

        channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
          const { from, to, candidate } = payload as {
            from: string; to: string; candidate: RTCIceCandidateInit;
          };
          if (to !== peerIdRef.current) return;
          const peer = peersRef.current[from];
          if (!peer || !candidate) return;
          if (!peer.remoteSet) {
            peer.pendingCandidates.push(candidate);
            return;
          }
          try { await peer.pc.addIceCandidate(candidate); } catch (e) { console.warn("ICE add failed", e); }
        });

        channel.on("broadcast", { event: "leave" }, ({ payload }) => {
          const { from } = payload as { from: string };
          removePeer(from);
        });

        await channel.subscribe((state) => {
          if (state === "SUBSCRIBED") {
            send("join", { from: peerIdRef.current, fromName: displayNameRef.current });
            setStatus("ready");
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
            setErrMsg("Lost connection to the signaling server. Please refresh.");
            setStatus("error");
          }
        });
      } catch (err) {
        console.error(err);
        setErrMsg(err instanceof Error ? err.message : "Could not access camera or microphone");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try { send("leave", { from: peerIdRef.current }); } catch { /* ignore */ }
      Object.keys(peersRef.current).forEach(removePeer);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, breakout?.id]);

  const toggleMic = () => {
    if (!localStream) return;
    const next = !micOn;
    localStream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMicOn(next);
  };
  const toggleCam = () => {
    if (!localStream) return;
    const next = !camOn;
    localStream.getVideoTracks().forEach((t) => { t.enabled = next; });
    setCamOn(next);
  };
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Meeting link copied");
  };

  const toggleRecording = async () => {
    if (recState === "saving") return;
    if (recState === "recording") {
      setRecState("saving");
      const rec = recorderInstance.current;
      recorderInstance.current = null;
      send("rec", { from: peerIdRef.current, active: false });
      const res = await rec?.stop();
      setRecState("idle");
      if (res?.ok && res.id) {
        toast.success("Recording saved to your library", {
          description: `${window.location.origin}/v/${res.id}`,
        });
      } else {
        toast.error("Recording could not be saved");
      }
      return;
    }

    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user || !localStreamRef.current) return;
      const team = await fetchCurrentTeam();
      const rec = new CallRecorder({
        userId: user.id,
        teamId: team?.id ?? null,
        meetingId,
        title: `${meetingTitle} · ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      });
      await rec.start([
        { id: "self", stream: localStreamRef.current, name: `${displayName} (you)` },
        ...Object.values(peersRef.current).map((p) => ({ id: p.id, stream: p.stream, name: p.name })),
      ]);
      recorderInstance.current = rec;
      recStartRef.current = Date.now();
      setRecState("recording");
      send("rec", { from: peerIdRef.current, active: true });
      toast.success("Recording started — uploading live");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start recording");
      setRecState("idle");
    }
  };

  useEffect(() => {
    if (panel === "chat") setUnread(0);
  }, [panel]);

  // Count messages that arrive while the chat panel is closed.
  const seenCount = useRef(0);
  useEffect(() => {
    if (panelRef.current === "chat") {
      seenCount.current = chat.messages.length;
      setUnread(0);
      return;
    }
    const delta = chat.messages.length - seenCount.current;
    seenCount.current = chat.messages.length;
    if (delta > 0) setUnread((n) => n + delta);
  }, [chat.messages.length]);



  const tiles = [
    { id: "self", name: `${displayName} (you)`, stream: localStream, muted: true, mirror: true },
    ...Object.values(peers).map((p) => ({ id: p.id, name: p.name, stream: p.stream, muted: false, mirror: false })),
  ];
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : 3;

  if (status === "error") {
    return (
      <div className="w-full max-w-lg mx-auto text-center p-8 bg-card border rounded-xl">
        <div className="w-12 h-12 mx-auto rounded-full bg-secondary grid place-items-center mb-3">
          <VideoOff className="w-5 h-5 text-live" />
        </div>
        <h2 className="text-lg font-semibold">Can't start your call</h2>
        <p className="text-muted-foreground text-sm mt-2">{errMsg}</p>
        <p className="text-muted-foreground text-xs mt-2">Allow camera and microphone access, then try again.</p>
        <Button className="mt-4" variant="secondary" onClick={onLeave}>Back</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      {status === "connecting" && (
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Joining room…
        </div>
      )}

      {(recState !== "idle" || remoteRecording) && (
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          {recState === "saving" ? "Saving recording…" : "This meeting is being recorded"}
        </div>
      )}

      <div className={`grid gap-4 ${panel === "none" ? "" : "lg:grid-cols-[1fr_360px]"}`}>
        <div className="space-y-4 min-w-0">
          {/* The board stays mounted so strokes keep syncing when it isn't on screen. */}
          <div className={panel === "board" ? "" : "hidden"}>
            <MeetingWhiteboard
              meetingId={meetingId}
              displayName={displayName}
              canvasOut={boardCanvasRef}
            />
          </div>
          {panel !== "board" && (
            <div className="relative">
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {tiles.map((t) => (
                  <VideoTile
                    key={t.id}
                    name={t.name}
                    stream={t.stream}
                    muted={t.muted}
                    mirror={t.mirror}
                    isSelf={t.id === "self"}
                    micOn={t.id === "self" ? micOn : true}
                    camOn={t.id === "self" ? camOn : true}
                  />
                ))}
              </div>
              <AnnotationLayer
                meetingId={meetingId}
                active={annotating}
                clearSignal={clearSignal}
              />
              <ReactionOverlay incoming={reaction} />
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                aria-label={`React ${emoji}`}
                className="w-9 h-9 rounded-full border hover:bg-secondary text-lg leading-none"
                onClick={() => {
                  setReaction({ emoji, name: "You", key: Date.now() });
                  send("react", { emoji, name: displayName });
                }}
              >
                {emoji}
              </button>
            ))}
            <span className="w-px h-6 bg-border mx-1" />
            <Music className="w-3.5 h-3.5 text-muted-foreground" />
            {SOUNDS.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant="secondary"
                onClick={() => {
                  playSound(s.id);
                  send("sound", { id: s.id });
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {panel !== "none" && (
          <aside className="border rounded-xl bg-card overflow-hidden h-[520px] flex flex-col">
            <div className="flex items-center border-b overflow-x-auto">
              {([
                ["chat", "Chat"],
                ["board", "Board"],
                ["notes", "Notes"],
                ["polls", "Polls"],
                ["qa", "Q&A"],
                ["rooms", "Rooms"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPanel(id)}
                  className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap ${panel === id ? "bg-secondary" : ""}`}
                >
                  {label}
                </button>
              ))}
              <Button size="icon" variant="ghost" className="w-9 h-9 ml-auto mr-1 shrink-0" onClick={() => setPanel("none")} aria-label="Close panel">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              {panel === "chat" && (
                <MeetingChat
                  messages={chat.messages}
                  loading={chat.loading}
                  me={chat.me}
                  typing={chat.typing}
                  onSend={(body) => void chat.send(body)}
                  onRetry={(id) => void chat.retry(id)}
                  onTyping={chat.notifyTyping}
                />
              )}
              {panel === "notes" && <MeetingNotes meetingId={meetingId} bodyOut={notesBodyRef} />}
              {panel === "polls" && <MeetingPolls meetingId={meetingId} />}
              {panel === "qa" && <MeetingQA meetingId={meetingId} displayName={displayName} />}
              {panel === "rooms" && (
                <MeetingBreakouts
                  meetingId={meetingId}
                  activeId={breakout?.id ?? null}
                  onJoin={(b) => setBreakout(b)}
                />
              )}
              {panel === "board" && (
                <div className="p-3 space-y-3 overflow-y-auto h-full">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    In the room · {tiles.length}
                  </p>
                  <ul className="space-y-1.5">
                    {tiles.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 h-6 rounded-full bg-secondary grid place-items-center text-[11px] font-semibold">
                          {t.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{t.name}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    Pen, shapes, text, colours, eraser and undo are in the board toolbar. Everything
                    you draw appears live for everyone.
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {breakout && (
        <div className="mx-auto text-xs text-muted-foreground">
          You're in breakout room “{breakout.name}” — open Rooms to return.
        </div>
      )}




      <div className="flex items-center justify-center gap-2 py-2 flex-wrap">
        <Button size="lg" variant={micOn ? "secondary" : "destructive"} className="rounded-full h-12 w-12 p-0" onClick={toggleMic} aria-label="Toggle mic">
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>
        <Button size="lg" variant={camOn ? "secondary" : "destructive"} className="rounded-full h-12 w-12 p-0" onClick={toggleCam} aria-label="Toggle camera">
          {camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
        <Button
          size="lg"
          variant={panel === "chat" ? "default" : "secondary"}
          className="rounded-full h-12 w-12 p-0 relative"
          onClick={() => setPanel(panel === "chat" ? "none" : "chat")}
          aria-label="Toggle chat"
        >
          <MessageSquare className="w-5 h-5" />
          {unread > 0 && panel !== "chat" && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] grid place-items-center">
              {unread}
            </span>
          )}
        </Button>
        <Button
          size="lg"
          variant={panel === "board" ? "default" : "secondary"}
          className="rounded-full h-12 w-12 p-0"
          onClick={() => setPanel(panel === "board" ? "none" : "board")}
          aria-label="Toggle whiteboard"
        >
          <PenLine className="w-5 h-5" />
        </Button>
        <Button
          size="lg"
          variant={recState === "recording" ? "destructive" : "secondary"}
          className="rounded-full h-12 gap-1.5 px-4"
          onClick={() => void toggleRecording()}
          disabled={recState === "saving" || status !== "ready"}
        >
          {recState === "saving" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : recState === "recording" ? (
            <><Square className="w-4 h-4 fill-current" /> Stop recording</>
          ) : (
            <><Circle className="w-4 h-4 fill-current" /> Record</>
          )}
        </Button>
        <Button size="lg" variant="secondary" className="rounded-full h-12 gap-1.5 px-4" onClick={copyLink}>
          <Copy className="w-4 h-4" /> Copy link
        </Button>
        <Button size="lg" variant="destructive" className="rounded-full h-12 gap-1.5 px-5" onClick={onLeave}>
          <PhoneOff className="w-4 h-4" /> Leave
        </Button>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        {tiles.length} {tiles.length === 1 ? "person" : "people"} in the room
      </div>
    </div>
  );
}

function VideoTile({
  name,
  stream,
  muted,
  mirror,
  isSelf,
  micOn,
  camOn,
}: {
  name: string;
  stream: MediaStream | null;
  muted: boolean;
  mirror: boolean;
  isSelf: boolean;
  micOn: boolean;
  camOn: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      // Autoplay can be blocked; force a play attempt.
      ref.current.play().catch(() => { /* user gesture already happened on join */ });
    }
  }, [stream]);
  return (
    <div className="relative aspect-video bg-ink rounded-xl overflow-hidden border">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${mirror ? "scale-x-[-1]" : ""} ${!camOn ? "opacity-0" : ""}`}
      />
      {!camOn && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-16 h-16 rounded-full bg-ink-foreground/15 grid place-items-center text-ink-foreground font-semibold text-xl">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs">
        <span className="px-2 py-1 rounded-md bg-ink/70 text-ink-foreground truncate max-w-[80%]">{name}</span>
        {(!micOn && isSelf) && (
          <span className="px-1.5 py-1 rounded-md bg-live text-live-foreground">
            <MicOff className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}
