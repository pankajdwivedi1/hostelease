"use client";

import React, { useState, useEffect } from "react";
import { showToast, showConfirm } from "@/lib/toast";

export interface CampusGate {
    id: string;
    name: string;
    mode: "qr" | "camera";
    password: string;
    qrSeconds?: number;
    standbyMinutes?: number;
    cooldownMinutes?: number;
    allowEmergencyExit?: boolean;
    createdAt?: string;
}

interface GatepassManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGatesUpdated?: (gates: CampusGate[]) => void;
}

export default function GatepassManagementModal({
    isOpen,
    onClose,
    onGatesUpdated,
}: GatepassManagementModalProps) {
    const [gates, setGates] = useState<CampusGate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newGateName, setNewGateName] = useState("");
    const [newGatePassword, setNewGatePassword] = useState("");
    const [newGateMode, setNewGateMode] = useState<"qr" | "camera">("qr");
    const [showAddForm, setShowAddForm] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [editingGateId, setEditingGateId] = useState<string | null>(null);
    const [editingGateName, setEditingGateName] = useState<string>("");

    // Fetch gates configuration from settings
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const loadGates = async () => {
            try {
                setIsLoading(true);
                const res = await fetch("/api/admin/settings");
                const data = await res.json();

                if (isMounted && data?.success) {
                    const loadedGates: CampusGate[] =
                        data.gatepassGates && data.gatepassGates.length > 0
                            ? data.gatepassGates
                            : [
                                  {
                                      id: "main-gate",
                                      name: "MAIN GATE",
                                      mode: data.enableGateCameraScan ? "camera" : "qr",
                                      password: data.getpassPassword && data.getpassPassword !== "••••••••" ? data.getpassPassword : "GATE789",
                                      qrSeconds: 15,
                                      standbyMinutes: 3,
            standbyMinutes: 3,
                                      cooldownMinutes: data.qrScanCooldownMinutes ?? 3,
                                      allowEmergencyExit: data.allowEmergencyExitWithoutCooldown ?? true,
                                  },
                              ];
                    setGates(loadedGates);
                }
            } catch (err) {
                console.error("Failed to load gates:", err);
                showToast("Failed to load gatepass settings", "error");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadGates();
        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    // Save full gates array to server settings
    const saveGatesToServer = async (updatedGates: CampusGate[], successMsg?: string) => {
        try {
            setIsSaving(true);
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gatepassGates: updatedGates,
                    // Keep primary gate password synced with legacy getpassPassword
                    getpassPassword: updatedGates[0]?.password || "GATE789",
                    enableGateCameraScan: updatedGates.some((g) => g.mode === "camera"),
                }),
            });

            const data = await res.json();
            if (data.success) {
                setGates(updatedGates);
                if (onGatesUpdated) onGatesUpdated(updatedGates);
                if (successMsg) showToast(successMsg, "success");
            } else {
                throw new Error(data.error || "Failed to update settings");
            }
        } catch (err: any) {
            console.error("Save gates error:", err);
            showToast(err.message || "Failed to save gatepass settings", "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Save updated Gate Name
    const handleSaveGateName = async (gateId: string) => {
        if (!editingGateName.trim()) {
            showToast("Gate name cannot be empty", "warning");
            return;
        }
        const normalized = editingGateName.trim().toUpperCase();
        const updated = gates.map((g) => (g.id === gateId ? { ...g, name: normalized } : g));
        setGates(updated);
        setEditingGateId(null);

        if (typeof window !== "undefined") {
            const currentActiveId = localStorage.getItem("activeGateId");
            if (!currentActiveId || currentActiveId === gateId || updated.length === 1) {
                localStorage.setItem("activeGateName", normalized);
                window.dispatchEvent(new Event("storage"));
            }
        }

        await saveGatesToServer(updated, `Gate name updated to "${normalized}"`);
    };

    // Update Camera Standby / Sleep mode minutes (1 to 10 min)
    const handleUpdateStandbyMinutes = async (gateId: string, minutes: number) => {
        const safeMinutes = Math.max(1, Math.min(60, Number(minutes) || 3));
        const updated = gates.map((g) => (g.id === gateId ? { ...g, standbyMinutes: safeMinutes } : g));
        setGates(updated);

        if (typeof window !== "undefined") {
            const currentActiveId = localStorage.getItem("activeGateId");
            if (!currentActiveId || currentActiveId === gateId || updated.length === 1) {
                localStorage.setItem("activeGateStandbyMinutes", String(safeMinutes));
                window.dispatchEvent(new Event("storage"));
            }
        }

        const gateName = gates.find((g) => g.id === gateId)?.name || "Gate";
        await saveGatesToServer(updated, `Camera standby timer set to ${safeMinutes}m for ${gateName}`);
    };

    // Update QR Code rotation seconds (e.g. 5, 10, 15, 20, 30, 45, 60s)
    const handleUpdateQrSeconds = async (gateId: string, seconds: number) => {
        const safeSeconds = Math.max(3, Math.min(120, Number(seconds) || 15));
        const updated = gates.map((g) => (g.id === gateId ? { ...g, qrSeconds: safeSeconds } : g));
        setGates(updated);

        if (typeof window !== "undefined") {
            const currentActiveId = localStorage.getItem("activeGateId");
            if (!currentActiveId || currentActiveId === gateId || updated.length === 1) {
                localStorage.setItem("activeGateQrSeconds", String(safeSeconds));
                window.dispatchEvent(new Event("storage"));
            }
        }

        const gateName = gates.find((g) => g.id === gateId)?.name || "Gate";
        await saveGatesToServer(updated, `QR rotation duration set to ${safeSeconds}s for ${gateName}`);
    };

    // Toggle Operating Mode for a specific gate (QR vs Face Cam)
    const handleToggleMode = async (gateId: string, newMode: "qr" | "camera") => {
        const updated = gates.map((g) => (g.id === gateId ? { ...g, mode: newMode } : g));
        setGates(updated);

        // Instantly sync active browser mode and notify any open gate screens
        if (typeof window !== "undefined") {
            const currentActiveId = localStorage.getItem("activeGateId");
            if (!currentActiveId || currentActiveId === gateId || updated.length === 1) {
                localStorage.setItem("activeGateMode", newMode);
                const activeGate = updated.find((g) => g.id === gateId);
                if (activeGate) localStorage.setItem("activeGateName", activeGate.name);
                window.dispatchEvent(new Event("storage"));
            }
        }

        await saveGatesToServer(
            updated,
            `Operating Mode updated to ${newMode === "camera" ? "FACE CAMERA" : "QR CODE"} for ${gates.find((g) => g.id === gateId)?.name}`
        );
    };

    // Update password for a specific gate
    const handleUpdatePassword = async (gateId: string, passwordValue: string) => {
        if (!passwordValue.trim()) {
            showToast("Password cannot be empty", "warning");
            return;
        }
        const updated = gates.map((g) => (g.id === gateId ? { ...g, password: passwordValue.trim() } : g));
        await saveGatesToServer(
            updated,
            `Password updated for ${gates.find((g) => g.id === gateId)?.name}`
        );
    };

    // Add a new Campus Gate
    const handleAddGate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGateName.trim()) {
            showToast("Please enter a gate name", "warning");
            return;
        }
        if (!newGatePassword.trim()) {
            showToast("Please enter an independent gate password", "warning");
            return;
        }

        const normalizedName = newGateName.trim().toUpperCase();
        if (gates.some((g) => g.name.toUpperCase() === normalizedName)) {
            showToast("A gate with this name already exists", "warning");
            return;
        }

        const newGate: CampusGate = {
            id: `gate-${Date.now()}`,
            name: normalizedName,
            mode: newGateMode,
            password: newGatePassword.trim(),
            qrSeconds: 15,
            cooldownMinutes: 3,
            allowEmergencyExit: true,
            createdAt: new Date().toISOString(),
        };

        const updated = [...gates, newGate];
        await saveGatesToServer(updated, `Gate "${normalizedName}" created successfully!`);
        setNewGateName("");
        setNewGatePassword("");
        setNewGateMode("qr");
        setShowAddForm(false);
    };

    // Delete a gate
    const handleDeleteGate = async (gate: CampusGate) => {
        if (gates.length <= 1) {
            showToast("At least one campus gate must remain active", "warning");
            return;
        }

        const confirmed = await showConfirm(
            `Are you sure you want to delete "${gate.name}"? Gatekeepers using this gate credentials will no longer be able to log in.`
        );
        if (!confirmed) return;

        const updated = gates.filter((g) => g.id !== gate.id);
        await saveGatesToServer(updated, `Gate "${gate.name}" deleted`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/75 sm:bg-black/60 sm:backdrop-blur-md flex items-center justify-center p-1.5 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header (Matching Hostel Management Modal Style) */}
                <div className="px-3.5 py-2 sm:px-5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-50 via-white to-slate-50">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-base sm:text-xl shadow-sm shrink-0">
                            🚪
                        </div>
                        <div>
                            <h2 className="text-xs sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Gatepass Management
                            </h2>
                            <p className="text-[8.5px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Configure Security & Access Per Campus Gate
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs sm:text-sm font-bold transition-colors shrink-0"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="p-2 sm:p-6 overflow-y-auto space-y-2 sm:space-y-4 touch-pan-y">
                    {/* Top Action Row: [+ ADD GATE] */}
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                            Configured Campus Gates ({gates.length})
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowAddForm((prev) => !prev)}
                            className="px-2.5 py-1 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                        >
                            <span>{showAddForm ? "✕ Cancel" : "+ Add Gate"}</span>
                        </button>
                    </div>

                    {/* Add Gate Form Collapsible */}
                    {showAddForm && (
                        <form
                            onSubmit={handleAddGate}
                            className="p-3 sm:p-4 bg-indigo-50/60 rounded-xl sm:rounded-2xl border-2 border-indigo-100 space-y-2 sm:space-y-3 animate-in slide-in-from-top-2 duration-200"
                        >
                            <h3 className="text-[10px] sm:text-xs font-black text-indigo-950 uppercase tracking-wider">
                                Add New Campus Gate
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                <div>
                                    <label className="block text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5 sm:mb-1">
                                        Gate Name (e.g. GATE 1, GATE 2)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. GATE 1"
                                        value={newGateName}
                                        onChange={(e) => setNewGateName(e.target.value)}
                                        className="w-full px-2.5 py-1 sm:px-3 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5 sm:mb-1">
                                        Independent Access Password
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. GATE123"
                                        value={newGatePassword}
                                        onChange={(e) => setNewGatePassword(e.target.value)}
                                        className="w-full px-2.5 py-1 sm:px-3 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-600">Default Mode:</span>
                                    <button
                                        type="button"
                                        onClick={() => setNewGateMode("qr")}
                                        className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold ${
                                            newGateMode === "qr"
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "bg-white text-slate-600 border border-slate-200"
                                        }`}
                                    >
                                        📱 QR Code
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewGateMode("camera")}
                                        className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold ${
                                            newGateMode === "camera"
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "bg-white text-slate-600 border border-slate-200"
                                        }`}
                                    >
                                        📸 Face Camera
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-3 py-1 sm:px-4 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl shadow-md active:scale-95 transition-all"
                                >
                                    {isSaving ? "Saving..." : "Save Gate"}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Blue Info Card: "HOW MODES WORK" (Exact Match to Screenshot 3) */}
                    <div className="p-2 sm:p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-black text-blue-950 uppercase tracking-wider">
                            <span>ℹ️</span>
                            <span>HOW GATEPASS MODES WORK</span>
                        </div>
                        <div className="space-y-0.5 sm:space-y-1 text-[8.5px] sm:text-[11px] text-blue-900 font-medium leading-tight">
                            <p className="flex items-center gap-1.5">
                                <span className="font-bold">📸 CAMERA MODE:</span>
                                <span>Real-time 1:N Biometric Face Recognition at gate kiosk.</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                                <span className="font-bold">📱 QR MODE:</span>
                                <span>Dynamic rotating anti-spoof QR code pass for student app scan.</span>
                            </p>
                        </div>
                    </div>

                    {/* Loading State */}
                    {isLoading ? (
                        <div className="py-8 sm:py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 sm:border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                            <span className="text-[10px] sm:text-xs font-bold">Loading campus gates...</span>
                        </div>
                    ) : (
                        <div className="space-y-2 sm:space-y-4">
                            {gates.map((gate, index) => {
                                const isPasswordVisible = Boolean(visiblePasswords[gate.id]);
                                return (
                                    <div
                                        key={gate.id}
                                        className="p-2 sm:p-5 rounded-xl sm:rounded-3xl border border-slate-200 sm:border-2 sm:border-slate-100 bg-white shadow-2xs hover:border-indigo-100 transition-all space-y-2 sm:space-y-3.5"
                                    >
                                        {/* Gate Card Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-black text-xs sm:text-base shadow-2xs shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    {editingGateId === gate.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={editingGateName}
                                                                onChange={(e) => setEditingGateName(e.target.value)}
                                                                className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-black uppercase bg-white border-2 border-indigo-500 rounded-md sm:rounded-lg text-slate-900 focus:outline-none shadow-2xs"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") handleSaveGateName(gate.id);
                                                                    if (e.key === "Escape") setEditingGateId(null);
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveGateName(gate.id)}
                                                                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition-all shadow-2xs"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingGateId(null)}
                                                                className="px-1 py-0.5 text-slate-400 hover:text-slate-600 text-[9px] sm:text-[10px] font-bold"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase leading-snug">
                                                            {gate.name}
                                                        </h3>
                                                    )}
                                                    <p className="text-[8.5px] sm:text-[10px] text-slate-400 font-mono">
                                                        ID: {gate.id}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 2x2 Grid Layout for Controls (Red marked layout) */}
                                            <div className="grid grid-cols-2 gap-1 sm:gap-2 shrink-0 items-center">
                                                {/* Row 1, Col 1: Edit Gate Name button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingGateId(gate.id);
                                                        setEditingGateName(gate.name);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-md sm:rounded-xl text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider border border-slate-200 transition-all shadow-2xs whitespace-nowrap"
                                                    title="Edit Gate Name"
                                                >
                                                    <span className="text-[10px]">✏️</span>
                                                    <span>EDIT NAME</span>
                                                </button>

                                                {/* Row 1, Col 2: QR Duration / Seconds setting */}
                                                <div className="w-full flex items-center justify-between gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200/80 rounded-md sm:rounded-xl border border-slate-200 text-slate-700 shadow-2xs transition-all">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px]">⏱️</span>
                                                        <span className="text-[8.5px] sm:text-[10px] uppercase font-black text-slate-500">QR:</span>
                                                    </div>
                                                    <select
                                                        value={gate.qrSeconds || 15}
                                                        onChange={(e) => handleUpdateQrSeconds(gate.id, Number(e.target.value))}
                                                        className="bg-transparent font-black text-indigo-700 text-[9.5px] sm:text-[11px] focus:outline-none cursor-pointer py-0"
                                                        title="Configure QR Rotation Interval"
                                                    >
                                                        <option value={5}>5s</option>
                                                        <option value={10}>10s</option>
                                                        <option value={15}>15s</option>
                                                        <option value={20}>20s</option>
                                                        <option value={30}>30s</option>
                                                        <option value={45}>45s</option>
                                                        <option value={60}>60s</option>
                                                    </select>
                                                </div>

                                                {/* Row 2, Col 1: Camera Standby / Sleep Mode Timeout (1 to 10 min) */}
                                                <div className="w-full flex items-center justify-between gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200/80 rounded-md sm:rounded-xl border border-slate-200 text-slate-700 shadow-2xs transition-all">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px]">💤</span>
                                                        <span className="text-[8.5px] sm:text-[10px] uppercase font-black text-slate-500">STANDBY:</span>
                                                    </div>
                                                    <select
                                                        value={gate.standbyMinutes || 3}
                                                        onChange={(e) => handleUpdateStandbyMinutes(gate.id, Number(e.target.value))}
                                                        className="bg-transparent font-black text-indigo-700 text-[9.5px] sm:text-[11px] focus:outline-none cursor-pointer py-0"
                                                        title="Camera Standby / Sleep Mode timeout when idle (1 to 10 minutes)"
                                                    >
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => (
                                                            <option key={m} value={m}>
                                                                {m} {m === 1 ? "Min" : "Mins"}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Row 2, Col 2: Mode Status Badge & Delete button */}
                                                <div className="flex items-center gap-1 w-full justify-end">
                                                    <span
                                                        className={`w-full text-center px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider border truncate ${
                                                            gate.mode === "camera"
                                                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                                                : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                        }`}
                                                    >
                                                        {gate.mode === "camera" ? "📸 CAMERA" : "📱 QR MODE"}
                                                    </span>

                                                    {gates.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteGate(gate)}
                                                            className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center text-[10px] sm:text-xs transition-colors shrink-0"
                                                            title="Delete Gate"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Gate Mode Switcher */}
                                        <div className="p-1.5 sm:p-3 bg-slate-50/80 rounded-lg sm:rounded-2xl border border-slate-100 flex flex-row items-center justify-between gap-1.5 sm:gap-2.5">
                                            <div>
                                                <span className="block text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none">
                                                    OPERATING GATE MODE
                                                </span>
                                                <span className="hidden sm:block text-[11px] text-slate-700 font-medium mt-0.5">
                                                    Select how this gate terminal verifies students
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-white rounded-md sm:rounded-xl border border-slate-200 shadow-2xs shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleMode(gate.id, "qr")}
                                                    className={`px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                                                        gate.mode === "qr"
                                                            ? "bg-indigo-600 text-white shadow-2xs font-black"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    }`}
                                                >
                                                    <span>📱</span>
                                                    <span>QR CODE</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleMode(gate.id, "camera")}
                                                    className={`px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                                                        gate.mode === "camera"
                                                            ? "bg-indigo-600 text-white shadow-2xs font-black"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    }`}
                                                >
                                                    <span>📸</span>
                                                    <span>FACE CAMERA</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Gatepass Credentials */}
                                        <div className="p-1.5 sm:p-4 rounded-lg sm:rounded-2xl border border-emerald-100 bg-emerald-50/30 space-y-1 sm:space-y-2">
                                            <div className="flex items-baseline flex-wrap gap-1">
                                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-[8.5px] sm:text-xs">
                                                    GATEPASS CREDENTIALS :
                                                </h4>
                                                <span className="hidden sm:inline text-[10.5px] text-slate-500 font-medium font-sans">
                                                    Set an independent access password for {gate.name}
                                                </span>
                                            </div>

                                            <div className="flex flex-row items-center gap-1.5 sm:gap-2">
                                                <div className="flex-1 relative">
                                                    <input
                                                        type={isPasswordVisible ? "text" : "password"}
                                                        defaultValue={gate.password}
                                                        id={`gate-pwd-${gate.id}`}
                                                        className="w-full px-2.5 py-1 sm:px-3 sm:py-2 bg-white border border-slate-200 rounded-md sm:rounded-xl text-[11px] sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setVisiblePasswords((prev) => ({
                                                                ...prev,
                                                                [gate.id]: !prev[gate.id],
                                                            }))
                                                        }
                                                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-[10px] sm:text-xs"
                                                    >
                                                        {isPasswordVisible ? "🙈" : "👁️"}
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const input = document.getElementById(
                                                            `gate-pwd-${gate.id}`
                                                        ) as HTMLInputElement;
                                                        if (input) {
                                                            handleUpdatePassword(gate.id, input.value);
                                                        }
                                                    }}
                                                    disabled={isSaving}
                                                    className="px-2.5 py-1 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md sm:rounded-xl text-[8.5px] sm:text-xs font-black uppercase tracking-wider shadow-2xs active:scale-95 transition-all shrink-0"
                                                >
                                                    Update Password
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-3.5 py-1.5 sm:px-5 sm:py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <span className="text-[8.5px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Configured in Hosteleaze Super Admin
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 sm:px-4 sm:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md sm:rounded-xl transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
