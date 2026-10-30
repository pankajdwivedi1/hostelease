// ============================================================
// 📞 VIDEO CALL — WebRTC Signaling API
// GET  /api/video-call/signal?callId=X&type=offer|answer|ice-caller|ice-callee
// POST /api/video-call/signal  Body: { callId, type, data }
// Real-time exchange of SDP and ICE candidates between mobile peers
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getCallSession,
  updateCallSession,
  addCallerIce,
  addCalleeIce,
} from '@/lib/video-call/callStore';

type SignalType = 'offer' | 'answer' | 'ice-caller' | 'ice-callee' | 'end';

export async function GET(request: NextRequest) {
  try {
    const callId = request.nextUrl.searchParams.get('callId');
    const type = request.nextUrl.searchParams.get('type') as SignalType;

    if (!callId || !type) {
      return NextResponse.json({ error: 'callId and type are required' }, { status: 400 });
    }

    const callSession = getCallSession(callId);
    if (!callSession) {
      return NextResponse.json({ data: null, status: 'ended' });
    }

    switch (type) {
      case 'offer':
        return NextResponse.json({ data: callSession.offer ?? null, status: callSession.status });
      case 'answer':
        return NextResponse.json({ data: callSession.answer ?? null, status: callSession.status });
      case 'ice-caller':
        return NextResponse.json({ data: callSession.callerIceCandidates, status: callSession.status });
      case 'ice-callee':
        return NextResponse.json({ data: callSession.calleeIceCandidates, status: callSession.status });
      default:
        return NextResponse.json({ error: 'Invalid signal type' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[video-call/signal GET] Error:', err);
    return NextResponse.json({ data: null, error: err?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { callId, type, data } = body || {};

    if (!callId || !type) {
      return NextResponse.json({ error: 'callId and type are required' }, { status: 400 });
    }

    const callSession = getCallSession(callId);
    if (!callSession) {
      return NextResponse.json({ error: 'Call session not found' }, { status: 404 });
    }

    switch (type as SignalType) {
      case 'offer':
        updateCallSession(callId, { offer: data });
        break;
      case 'answer':
        updateCallSession(callId, { answer: data });
        break;
      case 'ice-caller':
        addCallerIce(callId, data);
        break;
      case 'ice-callee':
        addCalleeIce(callId, data);
        break;
      case 'end':
        updateCallSession(callId, { status: 'ended' });
        break;
      default:
        return NextResponse.json({ error: 'Invalid signal type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[video-call/signal POST] Error:', err);
    return NextResponse.json({ error: 'Failed to record signal' }, { status: 500 });
  }
}
