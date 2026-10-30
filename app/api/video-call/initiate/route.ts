// ============================================================
// 📞 VIDEO CALL — Initiate Call API
// POST /api/video-call/initiate
// Body: { calleeId: string, callerId?: string, callerName?: string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { db } from '@/lib/dbAdapter';
import { getAuthSession } from '@/lib/authSession';
import { createCallSession } from '@/lib/video-call/callStore';
import { sendPushNotification } from '@/lib/pushNotification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { calleeId, callerId, callerName: clientCallerName, callType: clientCallType } = body || {};
    const callType: 'voice' | 'video' = clientCallType === 'voice' ? 'voice' : 'video';

    if (!calleeId) {
      return NextResponse.json({ error: 'calleeId is required' }, { status: 400 });
    }

    // 0. Super Admin Master Toggle Safeguard
    const adminSettings = await db.settings.get();
    const isCallEnabled = (adminSettings?.notificationSettings as any)?.enableVideoVoiceCall !== false && (adminSettings as any)?.enableVideoVoiceCall !== false;
    if (!isCallEnabled) {
      return NextResponse.json(
        { error: 'Video and voice calling is currently disabled by administrator.' },
        { status: 403 }
      );
    }

    const session = getAuthSession(request);
    const resolvedCallerId = callerId || session?.uid || '';

    // 1. Fetch caller info from database
    let caller: any = null;
    if (resolvedCallerId) {
      caller = await prisma.student.findFirst({
        where: {
          OR: [
            { id: resolvedCallerId },
            { registrationId: resolvedCallerId },
            { firebaseUid: resolvedCallerId },
            { phoneNumber: resolvedCallerId },
          ],
        },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          profilePicture: true,
          registrationId: true,
          tenantId: true,
          firebaseUid: true,
        },
      });
    }

    const callerName = caller?.name || clientCallerName || 'Hostel Student';

    // 2. Fetch callee info from database
    const callee = await prisma.student.findFirst({
      where: {
        OR: [
          { id: calleeId },
          { registrationId: calleeId },
          { phoneNumber: calleeId },
          { firebaseUid: calleeId },
        ],
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        profilePicture: true,
        registrationId: true,
        firebaseUid: true,
      },
    });

    if (!callee) {
      return NextResponse.json({ error: 'Selected student was not found' }, { status: 404 });
    }

    // 3. Create active call session
    const callSession = createCallSession({
      tenantId: caller?.tenantId,
      callType,
      callerId: caller?.id || resolvedCallerId || 'caller',
      callerFirebaseUid: caller?.firebaseUid,
      callerName,
      callerPhone: caller?.phoneNumber,
      callerPhoto: caller?.profilePicture ?? undefined,
      callerRegistrationId: caller?.registrationId ?? undefined,
      calleeId: callee.id,
      calleeFirebaseUid: callee.firebaseUid,
      calleeName: callee.name,
      calleePhone: callee.phoneNumber,
      calleePhoto: callee.profilePicture ?? undefined,
      calleeRegistrationId: callee.registrationId ?? undefined,
    });

    // 4. Send web push notification to Callee (so phone rings even if screen was locked)
    const isVoice = callType === 'voice';
    sendPushNotification(
      callee.id,
      'student',
      'videoCall',
      {
        title: isVoice ? `📞 Incoming Voice Call` : `📹 Incoming Video Call`,
        body: `${callerName} is ${isVoice ? 'calling' : 'video calling'} you on HostelEaze`,
        url: `/video-call/${callSession.callId}?role=callee&callType=${callType}`,
        tag: `call-${callSession.callId}`,
      }
    ).catch((err) => {
      console.warn('[video-call] Push alert delivery note:', err?.message);
    });

    return NextResponse.json({
      success: true,
      callId: callSession.callId,
      callType: callSession.callType,
      callee: {
        id: callee.id,
        name: callee.name,
        photo: callee.profilePicture,
        registrationId: callee.registrationId,
        phone: callee.phoneNumber,
      },
      caller: {
        name: callerName,
      },
    });
  } catch (err: any) {
    console.error('[video-call/initiate] Error:', err);
    return NextResponse.json({ error: 'Failed to initiate call', details: err?.message }, { status: 500 });
  }
}
