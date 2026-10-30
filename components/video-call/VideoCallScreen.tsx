'use client';
// ============================================================
// 📞 VIDEO CALL — Ultra-HD Real-Time WebRTC Call Screen
// Instant Sub-Second Connection (< 1s via real-time SSE push signaling)
// Can be rendered in-app as full-screen modal OR on dedicated route
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Move, Volume2, Volume1 } from 'lucide-react';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const RING_TIMEOUT = 45000; // 45s

type CallRole = 'caller' | 'callee';
type CallPhase =
  | 'connecting'
  | 'ringing'
  | 'setting-up'
  | 'active'
  | 'ended'
  | 'rejected'
  | 'missed'
  | 'error';

// ⚡ Crystal Clear HD Quality Booster: 3.5 Mbps for sharp, unblurred video
function boostSdpQuality(sdp: string): string {
  let modified = sdp;
  if (modified.includes('b=AS:')) {
    modified = modified.replace(/b=AS:\d+/g, 'b=AS:3500');
  } else {
    modified = modified.replace(
      /m=video ([0-9]+) ([A-Z\/]+) ([0-9 ]+)/g,
      'm=video $1 $2 $3\r\nb=AS:3500\r\nb=TIAS:3500000'
    );
  }
  if (modified.includes('b=TIAS:')) {
    modified = modified.replace(/b=TIAS:\d+/g, 'b=TIAS:3500000');
  }
  return modified;
}

// 📱 Responsive High-Clarity Camera Constraints (Native Mobile Portrait & Desktop)
function getOptimalVideoConstraints(facing: 'user' | 'environment'): MediaTrackConstraints {
  const isPortrait = typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : true;
  return isPortrait
    ? {
        facingMode: facing,
        width: { ideal: 1080, min: 720 },
        height: { ideal: 1920, min: 720 },
        frameRate: { ideal: 30, min: 24 },
      }
    : {
        facingMode: facing,
        width: { ideal: 1920, min: 720 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30, min: 24 },
      };
}

interface VideoCallScreenProps {
  callId?: string;
  role?: 'caller' | 'callee';
  callType?: 'voice' | 'video';
  onClose?: () => void;
}

export default function VideoCallScreen({
  callId: propCallId,
  role: propRole,
  callType: propCallType,
  onClose,
}: VideoCallScreenProps = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const callId = propCallId || (params?.callId as string);
  const role = propRole || ((searchParams?.get('role') ?? 'caller') as CallRole);
  const initialCallType = propCallType || (searchParams?.get('callType') as 'voice' | 'video') || 'video';

  // ─── State ────────────────────────────────────────────────
  const [callType, setCallType] = useState<'voice' | 'video'>(initialCallType);
  const [phase, setPhase] = useState<CallPhase>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(initialCallType === 'voice');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [peerName, setPeerName] = useState('');
  const [peerPhoto, setPeerPhoto] = useState('');
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [isLoudspeaker, setIsLoudspeaker] = useState(true);
  const [speakerNotice, setSpeakerNotice] = useState<string | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Outgoing Ringback Tone (Caller Side) ──────────────────
  const ringbackCtxRef = useRef<AudioContext | null>(null);
  const ringbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRingbackTone = useCallback(() => {
    if (ringbackIntervalRef.current) {
      clearInterval(ringbackIntervalRef.current);
      ringbackIntervalRef.current = null;
    }
    if (ringbackCtxRef.current) {
      try {
        ringbackCtxRef.current.close().catch(() => {});
      } catch {}
      ringbackCtxRef.current = null;
    }
  }, []);

  const startRingbackTone = useCallback(() => {
    stopRingbackTone();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringbackCtxRef.current = ctx;

      const playRingBurst = () => {
        if (!ctx || ctx.state === 'closed') return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        const now = ctx.currentTime;
        // Standard telephone ringback dual-frequency sine tone (440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Gentle envelope for caller ear
        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.08);
        gainNode.gain.setValueAtTime(0.18, now + 1.2);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 1.3);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.35);
        osc2.stop(now + 1.35);
      };

      playRingBurst();
      ringbackIntervalRef.current = setInterval(playRingBurst, 3200);
    } catch (err) {
      console.warn('[video-call] Ringback audio note:', err);
    }
  }, [stopRingbackTone]);

  // ─── 🔊 Loudspeaker vs Ear Speaker Hardware Toggle ─────────
  const toggleSpeaker = useCallback(async () => {
    const nextMode = !isLoudspeaker;
    setIsLoudspeaker(nextMode);

    // 1. Adjust volume immediate attenuation/boost
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = nextMode ? 1.0 : 0.28;
    }

    // 2. Output Device routing via setSinkId if supported
    try {
      const el = remoteVideoRef.current as any;
      if (el && typeof el.setSinkId === 'function') {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

        if (audioOutputs.length > 0) {
          if (nextMode) {
            const speaker = audioOutputs.find((d) => {
              const lbl = (d.label || '').toLowerCase();
              return lbl.includes('speaker') || lbl.includes('loud') || lbl.includes('external');
            });
            await el.setSinkId(speaker?.deviceId || '');
          } else {
            const earpiece = audioOutputs.find((d) => {
              const lbl = (d.label || '').toLowerCase();
              return (
                lbl.includes('earpiece') ||
                lbl.includes('receiver') ||
                lbl.includes('phone') ||
                lbl.includes('internal')
              );
            });
            if (earpiece?.deviceId) {
              await el.setSinkId(earpiece.deviceId);
            } else if (audioOutputs[0]?.deviceId) {
              await el.setSinkId(audioOutputs[0].deviceId);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[video-call] Audio sink routing note:', err);
    }

    // 3. User feedback toast
    const label = nextMode ? '🔊 Loudspeaker ON (Loud)' : '🔈 Ear Speaker ON (Normal)';
    setSpeakerNotice(label);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setSpeakerNotice(null);
    }, 2200);
  }, [isLoudspeaker]);

  // ─── Moveable PiP Frame ───────────────────────────────────
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const pipRef = useRef<HTMLDivElement>(null);

  // ─── Refs ─────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCleanedUp = useRef(false);

  // Pending remote offer stored if arrived before PC ready
  const pendingOfferRef = useRef<any>(null);

  // ─── Apply Crystal HD Bitrate & Codec Parameters ─────────
  const applyHdBitrate = useCallback(async (pc: RTCPeerConnection) => {
    try {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && videoSender.getParameters) {
        const parameters = videoSender.getParameters();
        if (!parameters.encodings || parameters.encodings.length === 0) {
          parameters.encodings = [{}];
        }
        // 3.5 Mbps for crystal clear HD video transmission
        parameters.encodings[0].maxBitrate = 3500000;
        parameters.encodings[0].minBitrate = 800000;
        parameters.encodings[0].maxFramerate = 30;
        // CRITICAL: Prevents WebRTC GCC from downscaling resolution into blur
        (parameters as any).degradationPreference = 'maintain-resolution';
        await videoSender.setParameters(parameters);
      }

      // Codec Optimization: Prioritize H.264 & VP9 for hardware accelerated sharpness
      if ('getTransceivers' in pc && 'getCapabilities' in RTCRtpSender) {
        const transceivers = pc.getTransceivers();
        const videoTransceiver = transceivers.find((t) => t.sender.track && t.sender.track.kind === 'video');
        if (videoTransceiver && 'setCodecPreferences' in videoTransceiver) {
          const capabilities = RTCRtpSender.getCapabilities('video');
          if (capabilities && capabilities.codecs) {
            const preferred = ['video/H264', 'video/VP9', 'video/VP8'];
            const sortedCodecs = [...capabilities.codecs].sort((a, b) => {
              const aIdx = preferred.indexOf(a.mimeType);
              const bIdx = preferred.indexOf(b.mimeType);
              return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
            });
            try {
              videoTransceiver.setCodecPreferences(sortedCodecs);
            } catch {}
          }
        }
      }
    } catch {}
  }, []);

  // ─── HTTP Signaling Helper ────────────────────────────────
  const postSignal = useCallback(async (type: string, data: any) => {
    if (!callId) return;
    try {
      await fetch('/api/video-call/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, type, data }),
      });
    } catch {}
  }, [callId]);

  // ─── Cleanup ──────────────────────────────────────────────
  const cleanup = useCallback(
    (endPhase: CallPhase = 'ended') => {
      if (isCleanedUp.current) return;
      isCleanedUp.current = true;

      stopRingbackTone();
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);

      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (durationRef.current) clearInterval(durationRef.current);
      if (pollFallbackRef.current) clearInterval(pollFallbackRef.current);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }

      setPhase(endPhase);

      if (onClose) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    },
    [onClose]
  );

  const endCall = useCallback(async () => {
    try {
      await postSignal('end', null);
    } catch {}
    cleanup('ended');
  }, [postSignal, cleanup]);

  // ─── Start Camera or Microphone (Crystal HD or HD Voice) ────────────
  const startLocalStream = useCallback(async (facing: 'user' | 'environment' = 'user'): Promise<MediaStream | null> => {
    try {
      let stream: MediaStream | null = null;
      if (callType === 'voice') {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          },
          video: false,
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: getOptimalVideoConstraints(facing),
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 48000,
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1280 } },
            audio: true,
          });
        }
      }

      localStreamRef.current = stream;
      if (localVideoRef.current && stream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      return stream;
    } catch {
      setErrorMsg('Microphone or Camera access was denied. Please allow permissions and try again.');
      setPhase('error');
      return null;
    }
  }, [callType]);

  // ─── Flip Camera (Front <-> Back with Android Lock Release) ─
  const switchCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);

    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';

    try {
      const currentTrack = localStreamRef.current?.getVideoTracks()[0];
      if (currentTrack) {
        currentTrack.stop();
      }

      let constraints: MediaStreamConstraints = {
        video: getOptimalVideoConstraints(nextFacing),
        audio: false,
      };

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');

        const targetDevice = videoInputs.find((d) => {
          const lbl = (d.label || '').toLowerCase();
          return nextFacing === 'environment'
            ? lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment') || lbl.includes('0')
            : lbl.includes('front') || lbl.includes('user') || lbl.includes('selfie') || lbl.includes('1');
        });

        if (targetDevice?.deviceId) {
          constraints = {
            video: {
              deviceId: { exact: targetDevice.deviceId },
              ...getOptimalVideoConstraints(nextFacing),
            },
            audio: false,
          };
        }
      } catch {}

      let newStream: MediaStream | null = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
          audio: false,
        });
      }

      const newVideoTrack = newStream?.getVideoTracks()[0];
      if (!newVideoTrack) {
        setIsSwitchingCamera(false);
        return;
      }

      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
          await applyHdBitrate(pcRef.current);
        }
      }

      if (localStreamRef.current) {
        const oldTracks = localStreamRef.current.getVideoTracks();
        oldTracks.forEach((t) => localStreamRef.current?.removeTrack(t));
        localStreamRef.current.addTrack(newVideoTrack);
      } else {
        localStreamRef.current = newStream;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }

      setCameraFacing(nextFacing);
    } catch (err) {
      console.warn('[video-call] Error switching camera:', err);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  // ─── RTCPeerConnection Setup ──────────────────────────────
  const buildPeerConnection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.volume = isLoudspeaker ? 1.0 : 0.28;
          remoteVideoRef.current.play().catch(() => {});
          setRemoteConnected(true);
          setPhase('active');
          stopRingbackTone();

          if (!durationRef.current) {
            durationRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          postSignal(role === 'caller' ? 'ice-caller' : 'ice-callee', {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          cleanup('ended');
        }
      };

      return pc;
    },
    [role, postSignal, cleanup]
  );

  // ─── ⚡ Instant Real-Time SSE Stream Setup ─────────────────
  const setupInstantSignaling = useCallback(() => {
    if (typeof window === 'undefined' || !('EventSource' in window) || !callId) return;

    const es = new EventSource(`/api/video-call/stream?callId=${encodeURIComponent(callId)}`);
    sseRef.current = es;

    es.addEventListener('signal', async (event: any) => {
      if (isCleanedUp.current) return;
      try {
        const payload = JSON.parse(event.data);
        const pc = pcRef.current;

        // 1. Status change & Call Type
        if (payload.type === 'call_type' && payload.callType) {
          setCallType(payload.callType);
        }
        if (payload.type === 'status') {
          if (payload.status === 'rejected') {
            stopRingbackTone();
            cleanup('rejected');
          }
          if (payload.status === 'ended') {
            stopRingbackTone();
            cleanup('ended');
          }
          if (payload.status === 'accepted') {
            stopRingbackTone();
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          }
        }

        // 2. Incoming SDP Offer (for Callee)
        if (payload.type === 'offer' && role === 'callee') {
          if (pc && !pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            const answer = await pc.createAnswer();
            answer.sdp = boostSdpQuality(answer.sdp || '');
            await pc.setLocalDescription(answer);
            await postSignal('answer', { type: answer.type, sdp: answer.sdp });
            await applyHdBitrate(pc);
          } else {
            pendingOfferRef.current = payload.data;
          }
        }

        // 3. Incoming SDP Answer (for Caller)
        if (payload.type === 'answer' && role === 'caller' && pc && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          await applyHdBitrate(pc);
        }

        // 4. Instant ICE Candidates
        const targetIceType = role === 'caller' ? 'ice-callee' : 'ice-caller';
        if (payload.type === targetIceType && payload.data && pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.data));
          } catch {}
        }
      } catch {}
    });
  }, [callId, role, postSignal, cleanup, applyHdBitrate]);

  // ─── Flow: Caller Flow ────────────────────────────────────
  const runCallerFlow = useCallback(async () => {
    setPhase('ringing');
    startRingbackTone(); // ⚡ Play outgoing ringback tone for caller!

    // Start SSE stream immediately in background
    setupInstantSignaling();

    const stream = await startLocalStream(cameraFacing);
    if (!stream) {
      stopRingbackTone();
      return;
    }

    const pc = buildPeerConnection(stream);

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      offer.sdp = boostSdpQuality(offer.sdp || '');
      await pc.setLocalDescription(offer);
      await postSignal('offer', { type: offer.type, sdp: offer.sdp });
      await applyHdBitrate(pc);
    } catch (e) {
      console.warn('[video-call] Error creating offer:', e);
    }

    setPhase('setting-up');

    ringTimeoutRef.current = setTimeout(() => {
      if (!isCleanedUp.current && phase !== 'active') {
        stopRingbackTone();
        cleanup('missed');
      }
    }, RING_TIMEOUT);

    pollFallbackRef.current = setInterval(async () => {
      if (isCleanedUp.current) return;
      try {
        const res = await fetch(`/api/video-call/poll?callId=${encodeURIComponent(callId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const status = await res.json();
        if (status?.status === 'accepted') { stopRingbackTone(); }
        if (status?.status === 'rejected') { stopRingbackTone(); cleanup('rejected'); return; }
        if (status?.status === 'ended') { stopRingbackTone(); cleanup('ended'); return; }
        if (status?.calleeName) setPeerName(status.calleeName);
        if (status?.calleePhoto) setPeerPhoto(status.calleePhoto);
      } catch {}
    }, 1000);
  }, [startRingbackTone, stopRingbackTone, startLocalStream, cameraFacing, buildPeerConnection, setupInstantSignaling, postSignal, applyHdBitrate, callId, phase, cleanup]);

  // ─── Flow: Callee Flow ────────────────────────────────────
  const runCalleeFlow = useCallback(async () => {
    setPhase('setting-up');

    // Start SSE stream immediately
    setupInstantSignaling();

    const stream = await startLocalStream(cameraFacing);
    if (!stream) return;

    const pc = buildPeerConnection(stream);

    // If offer arrived while camera was spinning up, apply it immediately
    if (pendingOfferRef.current && !pc.remoteDescription) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        const answer = await pc.createAnswer();
        answer.sdp = boostSdpQuality(answer.sdp || '');
        await pc.setLocalDescription(answer);
        await postSignal('answer', { type: answer.type, sdp: answer.sdp });
        await applyHdBitrate(pc);
      } catch {}
    } else {
      // Fallback check if offer was already stored on server
      try {
        const res = await fetch(`/api/video-call/signal?callId=${encodeURIComponent(callId)}&type=offer`, { cache: 'no-store' });
        if (res.ok) {
          const offerResp = await res.json();
          if (offerResp?.data && !pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(offerResp.data));
            const answer = await pc.createAnswer();
            answer.sdp = boostSdpQuality(answer.sdp || '');
            await pc.setLocalDescription(answer);
            await postSignal('answer', { type: answer.type, sdp: answer.sdp });
            await applyHdBitrate(pc);
          }
        }
      } catch {}
    }

    pollFallbackRef.current = setInterval(async () => {
      if (isCleanedUp.current) return;
      try {
        const res = await fetch(`/api/video-call/poll?callId=${encodeURIComponent(callId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const status = await res.json();
        if (status?.status === 'ended') { cleanup('ended'); return; }
        if (status?.callerName) setPeerName(status.callerName);
        if (status?.callerPhoto) setPeerPhoto(status.callerPhoto);
      } catch {}
    }, 1000);
  }, [startLocalStream, cameraFacing, buildPeerConnection, setupInstantSignaling, callId, postSignal, applyHdBitrate, cleanup]);

  useEffect(() => {
    if (!callId) return;

    if (role === 'caller') {
      runCallerFlow();
    } else {
      runCalleeFlow();
    }

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, role]);

  // ─── Moveable PiP Handlers ────────────────────────────────
  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    if (pipRef.current) {
      const rect = pipRef.current.getBoundingClientRect();
      dragOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const maxX = window.innerWidth - 120;
    const maxY = window.innerHeight - 170;

    const newX = Math.max(10, Math.min(maxX, clientX - dragOffsetRef.current.x));
    const newY = Math.max(60, Math.min(maxY, clientY - dragOffsetRef.current.y));

    setPipPos({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted(!isMuted);
  };

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const existingVideo = stream.getVideoTracks()[0];
    if (!existingVideo) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: getOptimalVideoConstraints(cameraFacing),
        });
        const newTrack = videoStream.getVideoTracks()[0];
        if (newTrack) {
          stream.addTrack(newTrack);
          if (pcRef.current) {
            pcRef.current.addTrack(newTrack, stream);
            await applyHdBitrate(pcRef.current);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
          setIsCameraOff(false);
          setCallType('video');
        }
      } catch (e) {
        console.warn('[video-call] Unable to enable camera:', e);
      }
      return;
    }

    stream.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOff;
    });
    setIsCameraOff(!isCameraOff);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  if (phase === 'ended' || phase === 'rejected' || phase === 'missed' || phase === 'error') {
    const messages: Record<string, string> = {
      ended: 'Call ended',
      rejected: 'Call declined',
      missed: 'No response',
      error: errorMsg || 'Unable to connect video call',
    };

    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-6 z-[10000] p-6 animate-in fade-in">
        <div className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-xl">
          <PhoneOff className="w-9 h-9 text-rose-400" />
        </div>
        <div className="text-center">
          <h2 className="text-white text-xl font-extrabold">{messages[phase]}</h2>
          {phase === 'ended' && callDuration > 0 && (
            <p className="text-slate-400 text-sm mt-1.5 font-medium">Duration: {formatDuration(callDuration)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            else router.push('/');
          }}
          className="px-6 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/15 cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950 z-[10000] flex flex-col overflow-hidden select-none animate-in fade-in"
      onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
      onMouseUp={handleDragEnd}
      onTouchMove={(e) => {
        if (e.touches[0]) handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={handleDragEnd}
    >
      {/* Remote Video (Full Screen Background) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          remoteConnected && callType === 'video' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Voice Call Screen OR Video Call Ringing/Connecting Screen */}
      {(callType === 'voice' || !remoteConnected) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-900 to-slate-950 p-6 z-10">
          <div className="relative">
            {peerPhoto ? (
              <img
                src={peerPhoto}
                alt={peerName}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-500/40 shadow-2xl relative z-10"
              />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center border-4 border-white/20 shadow-2xl relative z-10">
                <span className="text-white text-4xl sm:text-5xl font-extrabold uppercase">
                  {peerName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <span className="absolute inset-0 rounded-full border-4 border-emerald-400/40 animate-ping opacity-60 pointer-events-none" />
            {phase === 'active' && (
              <span className="absolute -inset-3 rounded-full border-2 border-emerald-500/20 animate-pulse pointer-events-none" />
            )}
          </div>

          <div className="text-center">
            <h2 className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight">{peerName || 'Hostel Friend'}</h2>
            <p className="text-emerald-400 text-sm font-bold mt-2 flex items-center justify-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${phase === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-ping'}`} />
              {phase === 'active'
                ? callType === 'voice'
                  ? `Voice Call Connected (${formatDuration(callDuration)})`
                  : `HD Video Connected (${formatDuration(callDuration)})`
                : phase === 'ringing'
                ? "Ringing on friend's mobile..."
                : callType === 'voice'
                ? 'Connecting voice call...'
                : 'Connecting HD video...'}
            </p>
          </div>

          {/* 🔊 Loudspeaker / Ear Speaker Toggle Control (Red Circle in User Screenshot) */}
          <div className="mt-2 flex flex-col items-center gap-1.5 animate-in fade-in">
            <button
              type="button"
              onClick={toggleSpeaker}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer shadow-xl border ${
                isLoudspeaker
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/40 shadow-blue-950/40'
              }`}
              title={isLoudspeaker ? 'Currently Loudspeaker (Tap to switch to Ear Speaker)' : 'Currently Ear Speaker (Tap to switch to Loudspeaker)'}
            >
              {isLoudspeaker ? (
                <>
                  <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <span>🔊 Loudspeaker (Loud)</span>
                </>
              ) : (
                <>
                  <Volume1 className="w-5 h-5 text-blue-400" />
                  <span>🔈 Ear Speaker (Small)</span>
                </>
              )}
            </button>
            <span className="text-[10px] text-slate-400 font-medium">
              {isLoudspeaker ? 'Sound on Loudspeaker (Tap for Ear Speaker)' : 'Sound on Ear Speaker (Tap for Loudspeaker)'}
            </span>
          </div>

          {phase !== 'active' && (
            <div className="flex gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-blue-500/60 animate-bounce"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Header Information */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-12 pb-4 bg-gradient-to-b from-black/70 to-transparent">
        <div>
          <p className="text-white font-extrabold text-base tracking-wide drop-shadow-md">
            {peerName || 'Hostel Friend'}
          </p>
          <p className="text-emerald-400 text-xs font-bold tracking-wider drop-shadow-md flex items-center gap-1">
            {phase === 'active' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {formatDuration(callDuration)} {callType === 'voice' ? '(VOICE CALL)' : '(SMART HD 720p)'}
                </span>
              </>
            ) : phase === 'ringing' ? (
              'Ringing...'
            ) : (
              'Connecting...'
            )}
          </p>
        </div>
      </div>

      {/* 📱 Moveable Local Video Thumbnail (PiP) */}
      {(callType === 'video' || (!isCameraOff && localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0)) && (
        <div
          ref={pipRef}
          style={
            pipPos
              ? { left: `${pipPos.x}px`, top: `${pipPos.y}px` }
              : { right: '16px', top: '64px' }
          }
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
          }}
          className="fixed w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-blue-400/80 shadow-2xl z-30 bg-slate-900 cursor-grab active:cursor-grabbing touch-none select-none transition-shadow ring-2 ring-black/40"
          title="Touch and drag to move video preview anywhere"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover pointer-events-none"
            style={{ transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
          />

          {isCameraOff && (
            <div className="absolute inset-0 bg-slate-900/95 flex items-center justify-center">
              <VideoOff className="w-7 h-7 text-white/50" />
            </div>
          )}

          <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[8px] font-bold text-white/80 flex items-center gap-0.5 pointer-events-none">
            <Move className="w-2.5 h-2.5" />
            <span>Move</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-10 pt-6 px-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="flex items-center justify-center gap-5 sm:gap-6 max-w-sm mx-auto">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={toggleMute}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer ${
              isMuted
                ? 'bg-rose-600 text-white shadow-rose-900/50'
                : 'bg-white/20 backdrop-blur-lg text-white hover:bg-white/30 border border-white/20'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* 🔄 Switch Camera (if Video is ON) OR 🔊 Speaker Toggle (if Camera is OFF / Voice Call) */}
          {callType === 'video' && !isCameraOff ? (
            <button
              type="button"
              onClick={switchCamera}
              disabled={isSwitchingCamera}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer ${
                cameraFacing === 'environment'
                  ? 'bg-indigo-600 text-white border-2 border-indigo-400'
                  : 'bg-white/20 backdrop-blur-lg text-white hover:bg-white/30 border border-white/20'
              }`}
              title="Switch to Back/Front Camera"
            >
              <SwitchCamera className={`w-5 h-5 sm:w-6 sm:h-6 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSpeaker}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer ${
                isLoudspeaker
                  ? 'bg-emerald-600 text-white shadow-emerald-900/50 border-2 border-emerald-400'
                  : 'bg-blue-600 text-white shadow-blue-900/50 border-2 border-blue-400'
              }`}
              title={isLoudspeaker ? 'Loudspeaker is ON (Tap for Ear Speaker)' : 'Ear Speaker is ON (Tap for Loudspeaker)'}
            >
              {isLoudspeaker ? (
                <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Volume1 className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          )}

          {/* End Call Button */}
          <button
            type="button"
            onClick={endCall}
            className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-90 flex items-center justify-center shadow-2xl shadow-rose-900/60 transition-all cursor-pointer border-2 border-rose-400/40"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </button>

          {/* Toggle Camera On/Off */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer ${
              isCameraOff
                ? 'bg-rose-600 text-white shadow-rose-900/50'
                : 'bg-white/20 backdrop-blur-lg text-white hover:bg-white/30 border border-white/20'
            }`}
            title={isCameraOff ? 'Turn Video On' : 'Turn Video Off'}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* ⚡ Speaker Notice Toast */}
      {speakerNotice && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[10001] px-4 py-2 bg-slate-900/95 border border-white/25 text-white font-extrabold text-xs rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 flex items-center gap-1.5 pointer-events-none">
          <span>{speakerNotice}</span>
        </div>
      )}
    </div>
  );
}
