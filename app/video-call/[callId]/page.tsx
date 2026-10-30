// ============================================================
// 📞 VIDEO CALL — Call Page
// Route: /video-call/[callId]
// ============================================================

import { Suspense } from 'react';
import VideoCallScreen from '@/components/video-call/VideoCallScreen';

interface PageProps {
  params: Promise<{ callId: string }>;
}

export default async function VideoCallPage({ params }: PageProps) {
  await params; // resolve params
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <VideoCallScreen />
    </Suspense>
  );
}

export const metadata = {
  title: 'Video Call — HostelEaze',
};
