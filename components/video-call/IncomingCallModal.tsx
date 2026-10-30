'use client';
// ============================================================
// 📞 VIDEO CALL — Incoming Call Ringing Modal
// Displays on callee's device with ring sound and Instant Accept/Decline
// ============================================================

import { useEffect, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface IncomingCallModalProps {
  callId: string;
  callType?: 'voice' | 'video';
  callerName: string;
  callerPhoto?: string;
  callerRegistrationId?: string;
  callerPhone?: string;
  onDismiss: () => void;
  onAccept?: (callId: string, callType?: 'voice' | 'video') => void;
}

export default function IncomingCallModal({
  callId,
  callType = 'video',
  callerName,
  callerPhoto,
  callerRegistrationId,
  callerPhone,
  onDismiss,
  onAccept,
}: IncomingCallModalProps) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AudioContext ringtone
  useEffect(() => {
    let interval: any = null;
    let ctx: AudioContext | null = null;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        const playTone = () => {
          if (!ctx || ctx.state === 'closed') return;
          if (ctx.state === 'suspended') ctx.resume();

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.45);
        };

        playTone();
        interval = setInterval(playTone, 1400);
      }
    } catch {}

    return () => {
      if (interval) clearInterval(interval);
      if (ctx) ctx.close().catch(() => {});
    };
  }, []);

  // 40 seconds auto-missed timeout
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      onDismiss();
    }, 40000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onDismiss]);

  const handleAccept = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // 1. Notify server immediately
    fetch('/api/video-call/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, action: 'accept' }),
    }).catch(() => {});

    // 2. ⚡ 0-Millisecond Instant Overlay Transition (Rapido style)
    if (onAccept) {
      onAccept(callId, callType);
      onDismiss();
    } else {
      onDismiss();
      router.push(`/video-call/${callId}?role=callee&callType=${callType}`);
    }
  };

  const handleReject = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    fetch('/api/video-call/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, action: 'reject' }),
    }).catch(() => {});

    onDismiss();
  };

  const isVoice = callType === 'voice';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-xs flex flex-col items-center gap-5 border border-slate-100">
        
        {/* Caller Avatar with Ring Animation */}
        <div className="relative mt-2">
          {callerPhoto ? (
            <img
              src={callerPhoto}
              alt={callerName}
              className="w-24 h-24 rounded-full object-cover border-4 border-emerald-400 shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border-4 border-emerald-400 shadow-xl">
              <span className="text-white text-3xl font-extrabold uppercase">
                {callerName?.charAt(0) || 'U'}
              </span>
            </div>
          )}
          <span className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-60 pointer-events-none" />
        </div>

        {/* Caller Information */}
        <div className="text-center">
          <p className="text-[11px] font-black uppercase text-emerald-600 tracking-widest flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isVoice ? '📞 Incoming Voice Call' : '📹 Incoming Video Call'}
          </p>
          <h3 className="text-xl font-extrabold text-slate-800 mt-1">{callerName}</h3>
          {callerRegistrationId && (
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{callerRegistrationId}</p>
          )}
          {callerPhone && (
            <p className="text-xs text-blue-600 font-bold mt-0.5">📱 {callerPhone}</p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-10 mt-2 w-full pt-2">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleReject}
              className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 flex items-center justify-center shadow-lg shadow-rose-200 transition-all cursor-pointer"
              title="Decline Call"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-90 flex items-center justify-center shadow-lg shadow-emerald-200 transition-all cursor-pointer animate-pulse"
              title={isVoice ? 'Accept Voice Call' : 'Accept Video Call'}
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Accept</span>
          </div>
        </div>

      </div>
    </div>
  );
}
