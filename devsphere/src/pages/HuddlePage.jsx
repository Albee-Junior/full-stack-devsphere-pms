import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useRealtime } from "../hooks/useRealtime.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState } from "../components/ui/AsyncState.jsx";

const ROOM = "product-team";

function VideoTile({ stream, name, local = false, audioMuted = false }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);
  return <div className={`huddle-person-tile ${local ? "huddle-host" : "huddle-remote"}`}><video ref={videoRef} autoPlay playsInline muted={local} /><span className="call-person-name">{name}{local && <small>You</small>}</span><span className="mic-indicator">{audioMuted ? <MicOff size={13} /> : <Mic size={13} />}</span></div>;
}

export default function HuddlePage() {
  const { user } = useAuth();
  const { socket, connected } = useRealtime();
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [callError, setCallError] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const peerConnections = useRef(new Map());
  const localStreamRef = useRef(null);

  const removePeer = useCallback((peerId) => {
    peerConnections.current.get(peerId)?.close();
    peerConnections.current.delete(peerId);
    setPeers((current) => current.filter((peer) => peer.id !== peerId));
  }, []);

  const createPeer = useCallback((peerId, initiator) => {
    if (peerConnections.current.has(peerId)) return peerConnections.current.get(peerId);
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    for (const track of localStreamRef.current?.getTracks() || []) connection.addTrack(track, localStreamRef.current);
    connection.ontrack = (event) => {
      setPeers((current) => {
        const existing = current.find((peer) => peer.id === peerId);
        const remote = { id: peerId, name: existing?.name || "Teammate", stream: event.streams[0] };
        return existing ? current.map((peer) => peer.id === peerId ? remote : peer) : [...current, remote];
      });
    };
    connection.onicecandidate = (event) => {
      if (event.candidate) socket?.emit("call:signal", { peerId, room: ROOM, signal: { candidate: event.candidate } });
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed" || connection.connectionState === "closed") removePeer(peerId);
    };
    connection.pendingCandidates = [];
    peerConnections.current.set(peerId, connection);
    if (initiator) {
      connection.createOffer()
        .then((offer) => connection.setLocalDescription(offer))
        .then(() => socket?.emit("call:signal", { peerId, room: ROOM, signal: { description: connection.localDescription } }))
        .catch((error) => setCallError(`Unable to connect to a teammate: ${error.message}`));
    }
    return connection;
  }, [removePeer, socket]);

  useEffect(() => {
    if (!socket || !localStream) return undefined;
    const connections = peerConnections.current;
    socket.emit("call:join", ROOM);
    const handlePeers = (peerIds) => peerIds.forEach((peerId) => createPeer(peerId, true));
    const handlePeerJoined = ({ peerId, name }) => {
      setPeers((current) => current.some((peer) => peer.id === peerId) ? current : [...current, { id: peerId, name, stream: null }]);
    };
    const handleSignal = async ({ peerId, signal, name, room }) => {
      if (room !== ROOM) return;
      const peer = createPeer(peerId, false);
      if (name) setPeers((current) => {
        const existing = current.find((item) => item.id === peerId);
        return existing
          ? current.map((item) => item.id === peerId ? { ...item, name } : item)
          : [...current, { id: peerId, name, stream: null }];
      });
      try {
        if (signal.description) {
          await peer.setRemoteDescription(signal.description);
          for (const candidate of peer.pendingCandidates.splice(0)) await peer.addIceCandidate(candidate);
          if (signal.description.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("call:signal", { peerId, room: ROOM, signal: { description: peer.localDescription } });
          }
        } else if (signal.candidate) {
          if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
          else peer.pendingCandidates.push(signal.candidate);
        }
      } catch (error) {
        setCallError(`A teammate connection could not be established: ${error.message}`);
      }
    };
    const handlePeerLeft = ({ peerId }) => removePeer(peerId);
    socket.on("call:peers", handlePeers);
    socket.on("call:peer-joined", handlePeerJoined);
    socket.on("call:signal", handleSignal);
    socket.on("call:peer-left", handlePeerLeft);
    return () => {
      socket.emit("call:leave", ROOM);
      socket.off("call:peers", handlePeers);
      socket.off("call:peer-joined", handlePeerJoined);
      socket.off("call:signal", handleSignal);
      socket.off("call:peer-left", handlePeerLeft);
      for (const connection of connections.values()) connection.close();
      connections.clear();
    };
  }, [socket, localStream, createPeer, removePeer]);

  useEffect(() => {
    const connections = peerConnections.current;
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      for (const connection of connections.values()) connection.close();
      connections.clear();
    };
  }, []);

  async function joinCall() {
    setCallError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError("Camera and microphone access is unavailable in this browser. Use HTTPS or localhost and try again.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraEnabled(true);
      setMicrophoneEnabled(true);
    } catch (error) {
      setCallError(error.name === "NotAllowedError"
        ? "Camera or microphone permission was denied. Allow access in your browser settings to join."
        : error.message || "Unable to access your camera or microphone.");
    }
  }

  function leaveCall() {
    socket?.emit("call:leave", ROOM);
    for (const connection of peerConnections.current.values()) connection.close();
    peerConnections.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPeers([]);
    setCallError("");
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraEnabled(next);
  }

  function toggleMicrophone() {
    const next = !microphoneEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicrophoneEnabled(next);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?huddle=${ROOM}`);
      setCallError("Invite link copied. Share it with a signed-in teammate.");
    } catch {
      setCallError("Clipboard access is unavailable. Share the workspace URL with your teammate instead.");
    }
  }

  return (
    <div className="page-content section-page huddle-page">
      <PageHeading eyebrow="BETTER TOGETHER, EVEN FROM HERE" title="Team huddle" description="Start a real-time video room with your workspace teammates." actions={<span className={`collab-live ${connected ? "" : "is-calling"}`}><i /> {connected ? "Signaling connected" : "Connecting…"}</span>} />
      <section className="huddle-stage panel">
        <div className="huddle-stage-top"><span className="huddle-room"><span className="huddle-room-icon">◉</span> # product-team</span><span className="huddle-duration"><i /> {localStream ? `You and ${peers.length} teammate${peers.length === 1 ? "" : "s"}` : "Camera starts only when you join"}</span></div>
        <div className="huddle-people">
          {localStream && <VideoTile stream={localStream} name={user?.name || "You"} local audioMuted={!microphoneEnabled} />}
          {peers.map((peer) => <VideoTile key={peer.id} stream={peer.stream} name={peer.name} />)}
          {!localStream && <div className="huddle-empty-state"><span className="huddle-empty-icon">◉</span><strong>Your room is ready.</strong><p>Join to turn on your camera and microphone. Your video is only shared with teammates in this huddle.</p></div>}
          {localStream && !peers.length && <div className="huddle-waiting"><span className="online-dot" /><strong>Waiting for a teammate</strong><p>Invite a teammate to join this room.</p></div>}
        </div>
        <div className="huddle-controls">{localStream ? <><button className={`huddle-control ${!microphoneEnabled ? "control-off" : ""}`} onClick={toggleMicrophone} aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}>{microphoneEnabled ? <Mic size={17} /> : <MicOff size={17} />}</button><button className={`huddle-control ${!cameraEnabled ? "control-off" : ""}`} onClick={toggleCamera} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}>{cameraEnabled ? <Video size={17} /> : <VideoOff size={17} />}</button><button className="huddle-leave" onClick={leaveCall}><VideoOff size={17} /> Leave huddle</button></> : <><button className="button button-secondary" onClick={copyInvite}><Copy size={15} /> Copy invite link</button><button className="button button-primary huddle-join" onClick={joinCall}><Video size={16} /> Join huddle</button></>}</div>
      </section>
      <ErrorState error={callError} />
      <p className="huddle-footnote">Peer-to-peer video uses WebRTC and an encrypted, authenticated signaling server. Network access may require a TURN relay on restrictive networks.</p>
    </div>
  );
}
