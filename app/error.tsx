'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js Page Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-100 shadow-xl">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-black">
          ⚡
        </div>
        <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          The page encountered an unexpected issue. You can try refreshing or returning to the home portal.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => {
              try {
                reset();
              } catch (e) {
                window.location.reload();
              }
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Try Again / Reload
          </button>
          
          <a
            href="/"
            onClick={() => {
              try {
                localStorage.removeItem("lastTenantSlug");
              } catch (e) {}
            }}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all inline-block"
          >
            Go to Home Page
          </a>
        </div>
      </div>
    </div>
  );
}
