// ============================================================
// 📞 VIDEO CALL — Poll API
// GET /api/video-call/poll?callId=X          → Poll active call status
// GET /api/video-call/poll?incoming=true&studentId=X → Poll for incoming call
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCallSession, findIncomingCall } from '@/lib/video-call/callStore';
import { getAuthSession } from '@/lib/authSession';

export async function GET(request: NextRequest) {
  try {
    const callId = request.nextUrl.searchParams.get('callId');
    const incoming = request.nextUrl.searchParams.get('incoming');
    const studentIdParam = request.nextUrl.searchParams.get('studentId');

    // ── Mode 1: Poll specific call status ───────────────────
    if (callId) {
      const callSession = getCallSession(callId);
      if (!callSession) {
        return NextResponse.json({ status: 'ended', callId });
      }

      return NextResponse.json({
        callId,
        callType: callSession.callType || 'video',
        status: callSession.status,
        callerName: callSession.callerName,
        calleeName: callSession.calleeName,
        callerPhoto: callSession.callerPhoto,
        calleePhoto: callSession.calleePhoto,
      });
    }

    // ── Mode 2: Poll for incoming calls ─────────────────────
    if (incoming === 'true') {
      const session = getAuthSession(request);
      const studentIdentifier = studentIdParam || session?.uid || '';

      if (!studentIdentifier) {
        return NextResponse.json({ incoming: false });
      }

      const incomingCall = findIncomingCall(studentIdentifier);
      if (!incomingCall) {
        return NextResponse.json({ incoming: false });
      }

      return NextResponse.json({
        incoming: true,
        callId: incomingCall.callId,
        callType: incomingCall.callType || 'video',
        callerName: incomingCall.callerName,
        callerPhoto: incomingCall.callerPhoto,
        callerRegistrationId: incomingCall.callerRegistrationId,
        callerPhone: incomingCall.callerPhone,
      });
    }

    return NextResponse.json({ error: 'callId or incoming=true required' }, { status: 400 });
  } catch (err: any) {
    console.error('[video-call/poll] Error:', err);
    return NextResponse.json({ error: 'Poll failed', details: err?.message }, { status: 500 });
  }
}
