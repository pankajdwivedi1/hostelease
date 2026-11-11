import React, { Suspense } from "react";
import GooglePromptPhoneScreen from "@/app/components/GooglePromptPhoneScreen";

export const dynamic = "force-dynamic";

function SecurityPromptContent({ searchParams }: { searchParams: Promise<{ challengeId?: string }> }) {
  return (
    <SecurityPromptInner searchParams={searchParams} />
  );
}

async function SecurityPromptInner({ searchParams }: { searchParams: Promise<{ challengeId?: string }> }) {
  const params = await searchParams;
  const challengeId = params?.challengeId || "";

  if (!challengeId) {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">No Active Security Challenge</h2>
        <p className="text-xs text-gray-400">
          This URL requires a valid challenge ID from an active sign-in attempt.
        </p>
      </div>
    );
  }

  return <GooglePromptPhoneScreen challengeId={challengeId} />;
}

export default function SecurityPromptPage(props: { searchParams: Promise<{ challengeId?: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b12] text-white flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SecurityPromptContent searchParams={props.searchParams} />
    </Suspense>
  );
}
