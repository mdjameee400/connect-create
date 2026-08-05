import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  displayName,
  onLeave,
}: {
  slug: string;
  displayName: string;
  onLeave: () => void;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [errMsg, setErrMsg] = useState<string>("");

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

        const channel = supabase.channel(`room:${slug}`, {
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
  }, [slug]);

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
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-4">
      {status === "connecting" && (
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Joining room…
        </div>
      )}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
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
      <div className="flex items-center justify-center gap-2 py-2">
        <Button size="lg" variant={micOn ? "secondary" : "destructive"} className="rounded-full h-12 w-12 p-0" onClick={toggleMic} aria-label="Toggle mic">
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>
        <Button size="lg" variant={camOn ? "secondary" : "destructive"} className="rounded-full h-12 w-12 p-0" onClick={toggleCam} aria-label="Toggle camera">
          {camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
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
