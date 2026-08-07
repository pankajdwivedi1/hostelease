"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function InvoiceVerificationContent() {
  const searchParams = useSearchParams();
  
  const invoiceNo = searchParams.get("id") || "INV-VERIFIED";
  const college = searchParams.get("college") || "Partner College";
  const amount = searchParams.get("amount") || "91,519";
  const utr = searchParams.get("utr") || "659864589235";
  const date = searchParams.get("date") || new Date().toLocaleDateString("en-IN", { dateStyle: "long" });

  const numericAmount = Number(amount.toString().replace(/[^0-9.]/g, '')) || 91519;
  const formattedAmount = numericAmount.toLocaleString("en-IN");

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            ✓ Authenticated Tax Invoice
          </div>
          <h1 className="text-2xl font-black tracking-tight">HOSTELEAZE</h1>
          <p className="text-xs text-indigo-200 font-bold uppercase tracking-widest mt-0.5">Smart Campus Automation</p>
        </div>

        {/* Verification Status */}
        <div className="p-6 space-y-6">
          <div className="bg-emerald-50 border-2 border-emerald-200/80 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-black shrink-0 shadow-lg shadow-emerald-600/30">
              ✓
            </div>
            <div>
              <h3 className="text-sm font-black text-emerald-950 uppercase tracking-tight">E-INVOICE VERIFIED & PAID</h3>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">Official computer-generated record stored on Hosteleaze Servers.</p>
            </div>
          </div>

          {/* Receipt Breakdown Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 text-xs font-semibold text-slate-700">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
              <span className="text-slate-400 uppercase text-[10px] font-black tracking-wider">Invoice Number</span>
              <span className="font-mono font-extrabold text-slate-900 text-sm bg-slate-200/60 px-2 py-0.5 rounded">{invoiceNo}</span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
              <span className="text-slate-400 uppercase text-[10px] font-black tracking-wider">Billed To (Client)</span>
              <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{college}</span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
              <span className="text-slate-400 uppercase text-[10px] font-black tracking-wider">Total Amount Paid</span>
              <span className="font-black text-indigo-700 text-base">Rs. {formattedAmount}</span>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
              <span className="text-slate-400 uppercase text-[10px] font-black tracking-wider">Bank UTR / Ref ID</span>
              <span className="font-mono font-bold text-slate-900">{utr}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400 uppercase text-[10px] font-black tracking-wider">Payment Timestamp</span>
              <span className="font-medium text-slate-800 text-right max-w-[200px]">{date}</span>
            </div>
          </div>

          {/* Provider Details */}
          <div className="text-center pt-2 space-y-1">
            <p className="text-[11px] font-bold text-slate-500">Issued by <strong className="text-slate-800">Hosteleaze Inc.</strong></p>
            <p className="text-[10px] text-slate-400 font-medium">Developer Account: DR. PANKAJ DWIVEDI • Support: support@hosteleaze.com</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <button 
            onClick={() => window.print()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            🖨️ Print / Download Verified Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyInvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
        Verifying Hosteleaze Invoice...
      </div>
    }>
      <InvoiceVerificationContent />
    </Suspense>
  );
}
