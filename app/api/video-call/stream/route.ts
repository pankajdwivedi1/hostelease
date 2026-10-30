// ============================================================
// 📞 VIDEO CALL — Real-Time Server-Sent Events (SSE) Stream
// Route: /api/video-call/stream?studentId=... OR ?callId=...
// Instant millisecond dispatch (like Rapido/WhatsApp ride dispatch)
// Replays current session state (offer, answer, ICE candidates) on connect
// ============================================================

import { NextRequest } from 'next/server';
import { callEventEmitter, findIncomingCall, getCallSession } from '@/lib/video-call/callStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId')?.trim() || '';
  const callId = searchParams.get('callId')?.trim() || '';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      // ─── Mode A: Real-Time Incoming Call Listener (for Dashboard) ───
      let incomingCallHandler: ((session: any) => void) | null = null;
      if (studentId) {
        // Send initial connection heartbeat
        sendEvent('connected', { ok: true, timestamp: Date.now() });

        // Check if there is already an active ringing call waiting for this student
        const currentIncoming = findIncomingCall(studentId);
        if (currentIncoming) {
          sendEvent('incoming_call', {
            callId: currentIncoming.callId,
            callType: currentIncoming.callType || 'video',
            callerName: currentIncoming.callerName,
            callerPhoto: currentIncoming.callerPhoto,
            callerRegistrationId: currentIncoming.callerRegistrationId,
            callerPhone: currentIncoming.callerPhone,
          });
        }

        const cleanId = studentId.toLowerCase();
        const cleanPhone = cleanId.replace(/\D/g, '').slice(-10);

        incomingCallHandler = (session: any) => {
          if (!session) return;
          const matchesId = session.calleeId?.toLowerCase() === cleanId;
          const matchesReg = session.calleeRegistrationId?.toLowerCase() === cleanId;
          const matchesUid = session.calleeFirebaseUid?.toLowerCase() === cleanId;
          const matchesPhone = Boolean(
            cleanPhone.length >= 7 &&
            session.calleePhone &&
            session.calleePhone.replace(/\D/g, '').includes(cleanPhone)
          );

          if (matchesId || matchesReg || matchesUid || matchesPhone) {
            sendEvent('incoming_call', {
              callId: session.callId,
              callType: session.callType || 'video',
              callerName: session.callerName,
              callerPhoto: session.callerPhoto,
              callerRegistrationId: session.callerRegistrationId,
              callerPhone: session.callerPhone,
            });
          }
        };

        callEventEmitter.on('incoming_call', incomingCallHandler);
      }

      // ─── Mode B: Real-Time Active Call WebRTC Stream ─────────
      let callEventHandler: ((eventPayload: any) => void) | null = null;
      if (callId) {
        // ⚡ INSTANT REPLAY: Deliver existing offer/answer/ICE candidates immediately on connection
        const session = getCallSession(callId);
        if (session) {
          sendEvent('signal', { type: 'call_type', callType: session.callType || 'video' });
          if (session.status) {
            sendEvent('signal', { type: 'status', status: session.status });
          }
          if (session.offer) {
            sendEvent('signal', { type: 'offer', data: session.offer });
          }
          if (session.answer) {
            sendEvent('signal', { type: 'answer', data: session.answer });
          }
          if (Array.isArray(session.callerIceCandidates) && session.callerIceCandidates.length > 0) {
            for (const cand of session.callerIceCandidates) {
              sendEvent('signal', { type: 'ice-caller', data: cand });
            }
          }
          if (Array.isArray(session.calleeIceCandidates) && session.calleeIceCandidates.length > 0) {
            for (const cand of session.calleeIceCandidates) {
              sendEvent('signal', { type: 'ice-callee', data: cand });
            }
          }
        }

        callEventHandler = (eventPayload: any) => {
          if (!eventPayload) return;
          sendEvent('signal', eventPayload);
        };

        callEventEmitter.on(`call_${callId}`, callEventHandler);
      }

      // Keepalive ping every 12s
      const pingInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(pingInterval);
          return;
        }
        sendEvent('ping', { t: Date.now() });
      }, 12000);

      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(pingInterval);
        if (incomingCallHandler) {
          callEventEmitter.off('incoming_call', incomingCallHandler);
        }
        if (callEventHandler && callId) {
          callEventEmitter.off(`call_${callId}`, callEventHandler);
        }
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
