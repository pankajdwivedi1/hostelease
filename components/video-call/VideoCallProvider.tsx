'use client';
// ============================================================
// 📞 VIDEO CALL — Global Incoming Call Provider
// Polls every 2s for incoming calls while student is logged in.
// Wrap this around the student layout (without touching it).
// Usage: Add <VideoCallProvider> in student layout (optional).
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const IncomingCallModal = dynamic(() => import('./IncomingCallModal'), { ssr: false });

interface IncomingCall {
  callId: string;
  callerName: string;
  callerPhoto?: string;
  callerRegistrationId?: string;
}

interface VideoCallContextType {
  incomingCall: IncomingCall | null;
  dismissIncomingCall: () => void;
}

const VideoCallContext = createContext<VideoCallContextType>({
  incomingCall: null,
  dismissIncomingCall: () => {},
});

export function useVideoCallContext() {
  return useContext(VideoCallContext);
}

interface VideoCallProviderProps {
  children: React.ReactNode;
  /** Set to false to disable polling (e.g., on the call screen itself) */
  enabled?: boolean;
}

export default function VideoCallProvider({ children, enabled = true }: VideoCallProviderProps) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
    activeCallIdRef.current = null;
  }, []);

  const pollIncoming = useCallback(async () => {
    if (activeCallIdRef.current) return; // Already showing a call
    try {
      const res = await fetch('/api/video-call/poll?incoming=true', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.incoming && data.callId && data.callId !== activeCallIdRef.current) {
        activeCallIdRef.current = data.callId;
        setIncomingCall({
          callId: data.callId,
          callerName: data.callerName,
          callerPhoto: data.callerPhoto,
          callerRegistrationId: data.callerRegistrationId,
        });
      }
    } catch {
      // Network error — silently ignore, try again next interval
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Start polling every 2 seconds
    pollIntervalRef.current = setInterval(pollIncoming, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, pollIncoming]);

  return (
    <VideoCallContext.Provider value={{ incomingCall, dismissIncomingCall }}>
      {children}
      {incomingCall && (
        <IncomingCallModal
          callId={incomingCall.callId}
          callerName={incomingCall.callerName}
          callerPhoto={incomingCall.callerPhoto}
          callerRegistrationId={incomingCall.callerRegistrationId}
          onDismiss={dismissIncomingCall}
        />
      )}
    </VideoCallContext.Provider>
  );
}
