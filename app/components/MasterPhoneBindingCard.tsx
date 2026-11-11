"use client";

import React, { useState, useEffect } from "react";
import { Smartphone, ShieldCheck, CheckCircle2, Trash2, RefreshCw, AlertCircle } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface MasterPhoneBindingCardProps {
  tenantId?: string | null;
  tenantName?: string;
  onStatusChange?: (isBound: boolean) => void;
}

export default function MasterPhoneBindingCard({
  tenantId,
  tenantName,
  onStatusChange
}: MasterPhoneBindingCardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState<{
    isBound: boolean;
    boundAt: string | null;
    deviceName: string | null;
  }>({
    isBound: false,
    boundAt: null,
    deviceName: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const url = `/api/super-admin/auth/google-prompt/device${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setDeviceStatus(data);
      onStatusChange?.(Boolean(data?.isBound));
    } catch (e) {
      console.warn("Failed to load device binding status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [tenantId]);

  // Register current phone as master security device
  const handleRegisterPhone = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID public key not configured on server.");
      }

      // 1. Register Service Worker
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;

      // 2. Request permission
      let permission = Notification.permission;
      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        throw new Error("Notification permission denied. Please allow notifications in browser settings.");
      }

      // 3. Subscribe to push
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // 4. Determine device name
      const ua = navigator.userAgent;
      let deviceName = "Personal Mobile Phone";
      if (/android/i.test(ua)) deviceName = "Android Smartphone";
      else if (/iphone|ipad/i.test(ua)) deviceName = "Apple iPhone";

      // 5. Save binding to database
      const res = await fetch("/api/super-admin/auth/google-prompt/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bind",
          subscription,
          deviceName,
          tenantId: tenantId || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to bind device.");
      }

      setMessage({ type: "success", text: "This phone is now your Master Security Phone!" });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to register phone." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Unbind Master Phone
  const handleUnbind = async () => {
    if (!confirm("Are you sure you want to unbind your Master Security Phone?")) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/super-admin/auth/google-prompt/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unbind",
          tenantId: tenantId || null
        })
      });

      if (!res.ok) throw new Error("Failed to unbind phone.");

      setMessage({ type: "success", text: "Master Security Phone removed." });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to unbind." });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 bg-gradient-to-br from-[#0c1322] to-[#070b12] border border-blue-500/20 rounded-2xl shadow-lg shadow-black/40">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              {tenantName ? `${tenantName} Super Admin Phone` : "Instant Security Phone Prompt"}
            </h4>
            <p className="text-[11px] text-gray-400 font-medium">
              Zero-SMS Instant Login Approval via Internet Push
            </p>
          </div>
        </div>

        {deviceStatus.isBound && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active</span>
          </span>
        )}
      </div>

      <p className="text-xs text-gray-300 leading-relaxed mb-4">
        When someone tries to log into Super Admin on a computer, your paired phone will pop up with a matching number prompt (e.g. <strong>Tap 64</strong>) to approve or block the attempt instantly over Wi-Fi/4G.
      </p>

      {/* Messages */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Device Info if Bound */}
      {deviceStatus.isBound ? (
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white">
              {deviceStatus.deviceName || "Personal Mobile Phone"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Paired: {deviceStatus.boundAt ? new Date(deviceStatus.boundAt).toLocaleDateString() : "Active"}
            </p>
          </div>
          <button
            onClick={handleUnbind}
            disabled={isProcessing}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Unbind Phone"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleRegisterPhone}
          disabled={isProcessing}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          <span>{isProcessing ? "Registering Phone..." : "Register This Phone as Master Security Device"}</span>
        </button>
      )}
    </div>
  );
}
