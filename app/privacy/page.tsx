"use client";

import Link from "next/link";
import { ArrowLeft, Shield, Eye, Lock, FileText, Globe } from "lucide-react";

export default function PrivacyPolicy() {
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
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Security & Protection</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter">Privacy Policy</h1>
          <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-widest font-bold">Last updated: June 20, 2026</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 sm:p-12 space-y-10 backdrop-blur-sm">
          
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Eye className="w-5 h-5 text-blue-500" />
              1. Information We Collect
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Hosteleaze is designed to manage and secure student accommodation ecosystems. In order to provide our services, we collect the following types of information:
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 pl-2">
              <li><strong className="text-white">Identity Details:</strong> Full name, institutional email address, phone number, hostel name, room number, and registration ID.</li>
              <li><strong className="text-white">Parent / Guardian Information:</strong> Mobile numbers of parents or local guardians for real-time leave notifications and security updates.</li>
              <li><strong className="text-white">Device Information:</strong> Unique hardware identifiers (Device ID) bound to your student profile to prevent attendance spoofing and proxy logging.</li>
              <li><strong className="text-white">Biometric Face Descriptors:</strong> Encrypted mathematical floating-point vectors generated during registration. <span className="text-blue-400 font-semibold">We do not store raw photos or images for biometrics;</span> only secure, irreversibly processed coordinate data.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Lock className="w-5 h-5 text-blue-500" />
              2. How We Use Your Data
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              We process personal information under strict tenant isolation protocols for the following operational workflows:
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 pl-2">
              <li>Verifying student identity at campus gates using secure on-device or server-side face matching.</li>
              <li>Validating check-in and check-out logs via dynamic, time-sensitive QR code keys.</li>
              <li>Sending automated leave requests, approvals, and emergency alerts to parents or local guardians.</li>
              <li>Providing Deans, Wardens, and Super Administrators with operational analytics and security audits.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              3. Data Security & Storage
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              We employ industry-leading encryption and infrastructure designs:
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 pl-2">
              <li><strong className="text-white">AES-256 Encryption:</strong> Applied to all personal and sensitive files in transition and at rest.</li>
              <li><strong className="text-white">Strict Tenant Isolation:</strong> Data for each university or campus is completely partitioned at the database level. No university can access the database records of another.</li>
              <li><strong className="text-white">No Shared Access:</strong> We do not sell, rent, or trade your personal information with third-party advertisers or external platforms.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-500" />
              4. Contact and Queries
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              If you have any questions about this Privacy Policy, your data rights, or data deletion requests, you may contact the development and security operations office:
            </p>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-sm space-y-2">
              <p><strong className="text-white">Operations Officer:</strong> Dr. Pankaj Dwivedi</p>
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
