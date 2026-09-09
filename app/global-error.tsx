'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-100 shadow-xl">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-black">
            ⚡
          </div>
          <h2 className="text-xl font-bold text-slate-800">Application Error</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            An unexpected error occurred. Please reload to restore the session.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
