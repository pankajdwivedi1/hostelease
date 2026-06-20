"use client";

import Link from "next/link";
import { ArrowLeft, Scale, BookOpen, AlertOctagon, HelpCircle, HardDrive } from "lucide-react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#050510] text-white selection:bg-blue-500/30 overflow-x-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px]"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[150px]"></div>

      {/* Header / Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-6 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden">
            <img src="/uvw_logo.jpg" alt="UVW Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-black tracking-tighter uppercase">Hosteleaze</span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pt-16 sm:pt-24 space-y-12 relative z-10">
        <div className="space-y-4 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
            <Scale className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Legal Agreement</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter">Terms & Conditions</h1>
          <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-widest font-bold">Last updated: June 20, 2026</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 sm:p-12 space-y-10 backdrop-blur-sm">
          
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-blue-500" />
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              By accessing, registering for, or using the Hosteleaze platform (including its Web apps, Warden Portals, and Deans' Dashboards), you agree to be bound by these Terms and Conditions. If you represent an educational institution, you warrant that you have the authority to bind the institution to these terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-blue-500" />
              2. User Obligations & Device Lock policy
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Hosteleaze implements strict hardware security to maintain absolute campus integrity:
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 pl-2">
              <li><strong className="text-white">Device Binding:</strong> Each student account is locked to a single physical device upon verification. You may not attempt to spoof, clone, or simulate device attributes.</li>
              <li><strong className="text-white">Device Reset Limits:</strong> Resetting your bound device requires verification and approval from the campus warden or system administrator to prevent attendance proxies.</li>
              <li><strong className="text-white">True Identity:</strong> You must provide accurate, up-to-date academic details (ERP ID, room assignments, correct contact phone numbers) at all times.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-blue-500" />
              3. Intellectual Property
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              The Hosteleaze core source code, user interfaces, branding, layout design, database adapter configurations, and proprietary face-matching queues are intellectual properties protected by law:
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Developed meticulously by <strong className="text-white">Dr. Pankaj Dwivedi</strong>. Unauthorized copying, reverse engineering, publishing, modification, redistribution, or commercial resale of the platform without an explicit, active enterprise license agreement is strictly prohibited.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              4. Governing Law and Support
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              These terms are governed by the laws of India. For billing inquiries, campus provisioning setup, or administrative disputes, please reach out to our support channel:
            </p>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-sm space-y-2">
              <p><strong className="text-white">Operations Support:</strong> Dr. Pankaj Dwivedi</p>
              <p><strong className="text-white">Address:</strong> Hosteleaze Solutions, Bhopal, Madhya Pradesh, India - 462021</p>
              <p><strong className="text-white">Email:</strong> support@hosteleaze.com</p>
              <p><strong className="text-white">Contact Phone:</strong> +91 8269418956</p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
