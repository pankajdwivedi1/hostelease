'use client';
// ============================================================
// 📞 VIDEO CALL — Dashboard Button Widget & Instant In-App Calling Engine
// Instant 0ms transition on Call and Accept (no page routing delay)
// Real-time SSE push stream for instant sub-second delivery
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const StudentSearchModal = dynamic(() => import('./StudentSearchModal'), { ssr: false });
const IncomingCallModal = dynamic(() => import('./IncomingCallModal'), { ssr: false });
const VideoCallScreen = dynamic(() => import('./VideoCallScreen'), { ssr: false });

interface IncomingCallData {
  callId: string;
  callType?: 'voice' | 'video';
  callerName: string;
  callerPhoto?: string;
  callerRegistrationId?: string;
  callerPhone?: string;
}

interface ActiveCallSession {
  callId: string;
  callType?: 'voice' | 'video';
  role: 'caller' | 'callee';
}

export default function VideoCallButton({ currentStudent }: { currentStudent?: any }) {
  const [openSearch, setOpenSearch] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<ActiveCallSession | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
    activeCallIdRef.current = null;
  }, []);

  const studentId =
    currentStudent?.id ||
    currentStudent?._id ||
    currentStudent?.registrationId ||
    currentStudent?.phoneNumber ||
    '';

  // ⚡ INSTANT SSE STREAM: Listens for incoming call notifications in real-time
  useEffect(() => {
    if (!studentId) return;

    let eventSource: EventSource | null = null;
    let pollFallbackInterval: any = null;

    const onIncoming = (data: IncomingCallData) => {
      // Don't pop up incoming modal if already on a call
      if (activeCallSession) return;

      if (data?.callId && data.callId !== activeCallIdRef.current) {
        activeCallIdRef.current = data.callId;
        setIncomingCall({
          callId: data.callId,
          callType: data.callType || 'video',
          callerName: data.callerName || 'Hostel Friend',
          callerPhoto: data.callerPhoto,
          callerRegistrationId: data.callerRegistrationId,
          callerPhone: data.callerPhone,
        });
      }
    };

    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        eventSource = new EventSource(`/api/video-call/stream?studentId=${encodeURIComponent(studentId)}`);

        eventSource.addEventListener('incoming_call', (e) => {
          try {
            const data = JSON.parse(e.data);
            onIncoming(data);
          } catch {}
        });

        eventSource.onerror = () => {
          // Silent reconnect
        };
      }
    } catch {}

    const pollFallback = async () => {
      if (activeCallIdRef.current || activeCallSession) return;
      try {
        const res = await fetch(
          `/api/video-call/poll?incoming=true&studentId=${encodeURIComponent(studentId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.incoming && data.callId) {
          onIncoming(data);
        }
      } catch {}
    };

    pollFallbackInterval = setInterval(pollFallback, 1500);

    return () => {
      if (eventSource) eventSource.close();
      if (pollFallbackInterval) clearInterval(pollFallbackInterval);
    };
  }, [studentId, activeCallSession]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenSearch(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] group cursor-pointer"
        title="Start a real-time call with a hostel friend"
      >
        <span className="text-base sm:text-lg group-hover:scale-110 transition-transform">📹</span>
        <span className="tracking-wide uppercase text-[11px] sm:text-xs">Make Call</span>
      </button>

      {/* 🔍 Instant Search Modal */}
      {openSearch && (
        <StudentSearchModal
          onClose={() => setOpenSearch(false)}
          currentStudent={currentStudent}
          onStartCall={(callId, callType) => {
            setOpenSearch(false);
            setActiveCallSession({ callId, callType, role: 'caller' });
          }}
        />
      )}

      {/* 📞 Ringing Incoming Call Modal */}
      {incomingCall && !activeCallSession && (
        <IncomingCallModal
          callId={incomingCall.callId}
          callType={incomingCall.callType}
          callerName={incomingCall.callerName}
          callerPhoto={incomingCall.callerPhoto}
          callerRegistrationId={incomingCall.callerRegistrationId}
          callerPhone={incomingCall.callerPhone}
          onDismiss={dismissIncomingCall}
          onAccept={(callId, callType) => {
            dismissIncomingCall();
            setActiveCallSession({
              callId,
              callType: callType || incomingCall.callType || 'video',
              role: 'callee',
            });
          }}
        />
      )}

      {/* ⚡ 0-Millisecond In-App Fullscreen Call (Rapido/WhatsApp style) */}
      {activeCallSession && (
        <VideoCallScreen
          callId={activeCallSession.callId}
          role={activeCallSession.role}
          callType={activeCallSession.callType}
          onClose={() => {
            setActiveCallSession(null);
            activeCallIdRef.current = null;
          }}
        />
      )}
    </>
  );
}
