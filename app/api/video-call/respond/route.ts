// ============================================================
// 📞 VIDEO CALL — Respond to Call API
// POST /api/video-call/respond
// Body: { callId: string, action: 'accept' | 'reject' }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCallSession, updateCallSession } from '@/lib/video-call/callStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { callId, action } = body || {};

    if (!callId || !action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'callId and valid action (accept/reject) required' }, { status: 400 });
    }

    const callSession = getCallSession(callId);
    if (!callSession) {
      return NextResponse.json({ error: 'Call expired or no longer available' }, { status: 404 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    updateCallSession(callId, { status: newStatus });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error('[video-call/respond] Error:', err);
    return NextResponse.json({ error: 'Failed to update call status' }, { status: 500 });
  }
}
