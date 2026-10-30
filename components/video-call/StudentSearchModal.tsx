'use client';
// ============================================================
// 📞 VIDEO CALL — Instant 0ms Student Search Modal
// Searches by mobile number (e.g. 7974704918), name, or ID
// Hybrid instant in-memory filtering + background server sync
// ============================================================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, Video, X, User, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface StudentResult {
  id: string;
  name: string;
  phoneNumber?: string;
  registrationId?: string;
  hostelName: string;
  roomNumber: string;
  profilePicture?: string;
}

interface StudentSearchModalProps {
  onClose: () => void;
  currentStudent?: any;
  onStartCall?: (callId: string, callType: 'voice' | 'video') => void;
}

export default function StudentSearchModal({ onClose, currentStudent, onStartCall }: StudentSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [serverStudents, setServerStudents] = useState<StudentResult[]>([]);
  const [allStudentsCache, setAllStudentsCache] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const [callError, setCallError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callerId = currentStudent?.id || currentStudent?._id || currentStudent?.registrationId || '';

  // ⚡ 1. Preload student directory in background on open (0ms instant cache)
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/video-call/search?q=__all__${callerId ? `&callerId=${encodeURIComponent(callerId)}` : ''}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.students && Array.isArray(data.students)) {
          setAllStudentsCache(data.students);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [callerId]);

  // ⚡ 2. Instant client-side memory search (0ms latency as user types)
  const instantFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const cleanDigits = q.replace(/\D/g, '');

    return allStudentsCache.filter((s) => {
      if (cleanDigits.length >= 2 && s.phoneNumber && s.phoneNumber.replace(/\D/g, '').includes(cleanDigits)) {
        return true;
      }
      if (s.name && s.name.toLowerCase().includes(q)) {
        return true;
      }
      if (s.registrationId && s.registrationId.toLowerCase().includes(q)) {
        return true;
      }
      return false;
    });
  }, [query, allStudentsCache]);

  // ⚡ 3. Fast server query for non-cached or exact matches
  const searchServer = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setServerStudents([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/video-call/search?q=${encodeURIComponent(trimmed)}${callerId ? `&callerId=${encodeURIComponent(callerId)}` : ''}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setServerStudents(data.students ?? []);
      }
    } catch {
      // keep instant results
    } finally {
      setLoading(false);
    }
  }, [callerId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setServerStudents([]);
      setLoading(false);
      return;
    }

    if (instantFiltered.length === 0) {
      setLoading(true);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchServer(trimmed), 120);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, instantFiltered.length, searchServer]);

  // ⚡ 4. Merge instant cache and server results (deduplicated)
  const displayStudents = useMemo(() => {
    const map = new Map<string, StudentResult>();

    instantFiltered.forEach((s) => map.set(s.id, s));
    serverStudents.forEach((s) => map.set(s.id, s));

    return Array.from(map.values());
  }, [instantFiltered, serverStudents]);

  const handleCall = async (student: StudentResult, callType: 'voice' | 'video' = 'video') => {
    setCallError('');
    setCalling(`${student.id}-${callType}`);

    try {
      const callerName = currentStudent?.name || 'Hostel Student';

      const res = await fetch('/api/video-call/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calleeId: student.id,
          callerId,
          callerName,
          callType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }

      onClose();

      // ⚡ 0-Millisecond In-App Fullscreen Overlay
      if (onStartCall) {
        onStartCall(data.callId, callType);
      } else {
        router.push(`/video-call/${data.callId}?role=caller&callType=${callType}`);
      }
    } catch (err: any) {
      setCallError(err.message || 'Could not place call. Please try again.');
      setCalling(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm text-sm">
              📹
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-800">Make Call</h2>
              <p className="text-[10px] text-gray-500 font-medium">Voice & HD Video Calling</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition-colors shadow-xs border border-gray-200 cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5 bg-slate-100/90 rounded-2xl px-3.5 py-2.5 border border-slate-200/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by mobile number (e.g. 7974704918)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Call Error Notification */}
        {callError && (
          <div className="mx-4 mt-3 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{callError}</span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 divide-y divide-gray-50">
          {loading && displayStudents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Searching students...</p>
            </div>
          )}

          {!loading && query.trim().length >= 2 && displayStudents.length === 0 && (
            <div className="text-center py-12 text-gray-400 px-4">
              <User className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-500" />
              <p className="text-xs font-bold text-gray-600">No student found for "{query}"</p>
              <p className="text-[11px] text-gray-400 mt-1">Try entering mobile number or full name</p>
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="text-center py-12 text-gray-400 px-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-2">
                <Phone className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-gray-700">Enter a 10-digit Mobile Number</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Or type a friend's name for instant search</p>
            </div>
          )}

          {displayStudents.map((student) => (
            <div
              key={student.id}
              className="flex items-center gap-3 p-3 hover:bg-slate-50/80 rounded-2xl transition-all"
            >
              {/* Profile Avatar */}
              {student.profilePicture ? (
                <img
                  src={student.profilePicture}
                  alt={student.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-slate-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-black text-base shadow-xs">
                  {student.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
              )}

              {/* Student Details */}
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-gray-900 text-xs sm:text-sm truncate">{student.name}</p>
                
                {student.phoneNumber && (
                  <p className="text-xs font-extrabold text-blue-600 flex items-center gap-1 mt-0.5">
                    <span>📱</span>
                    <span>{student.phoneNumber}</span>
                  </p>
                )}

                <p className="text-[10px] sm:text-[11px] text-gray-500 truncate mt-0.5">
                  {student.registrationId && <span className="font-semibold text-slate-600">{student.registrationId} · </span>}
                  <span>{student.hostelName || 'Hostel'}</span>
                  {student.roomNumber && <span> · Room #{student.roomNumber}</span>}
                </p>
              </div>

              {/* Call Action Buttons (Voice & Video) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 📞 Voice Call Button */}
                <button
                  type="button"
                  onClick={() => handleCall(student, 'voice')}
                  disabled={calling !== null}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs ${
                    calling === `${student.id}-voice`
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-200'
                  } disabled:opacity-60`}
                  title={`Voice call ${student.name}`}
                >
                  {calling === `${student.id}-voice` ? (
                    <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <Phone className="w-3 h-3 shrink-0" />
                  )}
                  <span>Voice</span>
                </button>

                {/* 📹 Video Call Button */}
                <button
                  type="button"
                  onClick={() => handleCall(student, 'video')}
                  disabled={calling !== null}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs ${
                    calling === `${student.id}-video`
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200'
                  } disabled:opacity-60`}
                  title={`Video call ${student.name}`}
                >
                  {calling === `${student.id}-video` ? (
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <Video className="w-3 h-3 shrink-0" />
                  )}
                  <span>Video</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-slate-50 text-center">
          <p className="text-[10px] text-gray-400 font-medium">
            🔒 High Definition Peer-to-Peer Encrypted Calling
          </p>
        </div>

      </div>
    </div>
  );
}
