// ============================================================
// 📞 VIDEO CALL — High-Speed In-Memory Call Store & Real-Time EventEmitter
// All calls are ephemeral (max 10 min). Zero DB mutations.
// Supports instant 0ms SSE push events for sub-second call setup
// ============================================================

import { EventEmitter } from 'events';

export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';

export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface CallSession {
  callId: string;
  callType?: 'voice' | 'video';
  tenantId?: string;

  // Caller info
  callerId: string;
  callerFirebaseUid?: string;
  callerName: string;
  callerPhone?: string;
  callerPhoto?: string;
  callerRegistrationId?: string;

  // Callee info
  calleeId: string;
  calleeFirebaseUid?: string;
  calleeName: string;
  calleePhone?: string;
  calleePhoto?: string;
  calleeRegistrationId?: string;

  // WebRTC Signaling
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerIceCandidates: IceCandidate[];
  calleeIceCandidates: IceCandidate[];

  status: CallStatus;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __videoCallStore: Map<string, CallSession> | undefined;
  // eslint-disable-next-line no-var
  var __callEventEmitter: EventEmitter | undefined;
}

function getStore(): Map<string, CallSession> {
  if (!global.__videoCallStore) {
    global.__videoCallStore = new Map();
  }
  return global.__videoCallStore;
}

export const callEventEmitter: EventEmitter = global.__callEventEmitter || new EventEmitter();
callEventEmitter.setMaxListeners(500);
global.__callEventEmitter = callEventEmitter;

function cleanup() {
  const store = getStore();
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [callId, session] of store.entries()) {
    if (session.createdAt < cutoff) {
      store.delete(callId);
    }
  }
}

export function createCallSession(
  data: Omit<CallSession, 'callId' | 'callerIceCandidates' | 'calleeIceCandidates' | 'createdAt' | 'status'>
): CallSession {
  cleanup();
  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session: CallSession = {
    ...data,
    callId,
    callType: data.callType || 'video',
    status: 'ringing',
    callerIceCandidates: [],
    calleeIceCandidates: [],
    createdAt: Date.now(),
  };
  getStore().set(callId, session);

  // ⚡ INSTANT NOTIFICATION: Broadcast incoming call event immediately
  try {
    callEventEmitter.emit('incoming_call', session);
  } catch (e) {
    console.warn('[callStore] broadcast error:', e);
  }

  return session;
}

export function getCallSession(callId: string): CallSession | null {
  return getStore().get(callId) ?? null;
}

export function updateCallSession(callId: string, updates: Partial<CallSession>): CallSession | null {
  const store = getStore();
  const session = store.get(callId);
  if (!session) return null;
  const updated = { ...session, ...updates };
  store.set(callId, updated);

  // ⚡ Broadcast updates (answer, offer, status changes) to listening call peers
  try {
    if (updates.status) {
      callEventEmitter.emit(`call_${callId}`, { type: 'status', status: updates.status });
    }
    if (updates.offer) {
      callEventEmitter.emit(`call_${callId}`, { type: 'offer', data: updates.offer });
    }
    if (updates.answer) {
      callEventEmitter.emit(`call_${callId}`, { type: 'answer', data: updates.answer });
    }
  } catch (e) {
    console.warn('[callStore] emit note:', e);
  }

  return updated;
}

export function deleteCallSession(callId: string): void {
  getStore().delete(callId);
  try {
    callEventEmitter.emit(`call_${callId}`, { type: 'status', status: 'ended' });
  } catch {}
}

export function findIncomingCall(calleeIdentifier: string): CallSession | null {
  if (!calleeIdentifier) return null;
  const store = getStore();
  const cleanId = calleeIdentifier.trim().toLowerCase();
  const cleanPhone = cleanId.replace(/\D/g, '').slice(-10);

  for (const session of store.values()) {
    if (session.status !== 'ringing') continue;

    const matchesId = session.calleeId?.toLowerCase() === cleanId;
    const matchesReg = session.calleeRegistrationId?.toLowerCase() === cleanId;
    const matchesUid = session.calleeFirebaseUid?.toLowerCase() === cleanId;
    const matchesPhone = Boolean(
      cleanPhone.length >= 7 &&
      session.calleePhone &&
      session.calleePhone.replace(/\D/g, '').includes(cleanPhone)
    );

    if (matchesId || matchesReg || matchesUid || matchesPhone) {
      return session;
    }
  }
  return null;
}

export function addCallerIce(callId: string, candidate: IceCandidate): void {
  const session = getCallSession(callId);
  if (session) {
    session.callerIceCandidates.push(candidate);
    try {
      callEventEmitter.emit(`call_${callId}`, { type: 'ice-caller', data: candidate });
    } catch {}
  }
}

export function addCalleeIce(callId: string, candidate: IceCandidate): void {
  const session = getCallSession(callId);
  if (session) {
    session.calleeIceCandidates.push(candidate);
    try {
      callEventEmitter.emit(`call_${callId}`, { type: 'ice-callee', data: candidate });
    } catch {}
  }
}
