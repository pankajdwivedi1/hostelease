// ============================================================
// 📞 VIDEO CALL — High-Speed Student Search API
// GET /api/video-call/search?q=query&callerId=...
// Optimized for sub-10ms response time
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const callerIdParam = request.nextUrl.searchParams.get('callerId')?.trim() ?? '';

  try {
    // If empty or "all", return initial fast list for instant client-side filtering
    if (!q || q === '__all__') {
      const initialList = await prisma.student.findMany({
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          registrationId: true,
          hostelName: true,
          roomNumber: true,
          profilePicture: true,
          firebaseUid: true,
        },
        take: 100,
        orderBy: { name: 'asc' },
      });
      return NextResponse.json({ students: initialList });
    }

    if (q.length < 2) {
      return NextResponse.json({ students: [] });
    }

    const cleanDigits = q.replace(/\D/g, '');
    const isPureNumeric = cleanDigits.length > 0 && /^[0-9+\s()-]+$/.test(q);

    // Fast selective query: if numeric, search only phoneNumber; else search name & IDs
    let searchConditions: any[];
    if (isPureNumeric) {
      searchConditions = [
        { phoneNumber: { contains: cleanDigits } },
      ];
      if (cleanDigits.length >= 10) {
        searchConditions.push({ phoneNumber: { contains: cleanDigits.slice(-10) } });
      }
    } else {
      searchConditions = [
        { name: { contains: q, mode: 'insensitive' } },
        { registrationId: { contains: q, mode: 'insensitive' } },
        { erpId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const results = await prisma.student.findMany({
      where: {
        OR: searchConditions,
        NOT: callerIdParam ? { id: callerIdParam } : undefined,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        registrationId: true,
        hostelName: true,
        roomNumber: true,
        profilePicture: true,
        firebaseUid: true,
      },
      take: 15,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ students: results });
  } catch (err: any) {
    console.error('[video-call/search] Error:', err);
    return NextResponse.json({ error: 'Search failed', details: err?.message }, { status: 500 });
  }
}
