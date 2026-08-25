"use client";

import { useState, useEffect } from "react";
import { showConfirm, showPrompt, showToast } from "@/lib/toast";

interface HostelLogItem {
  id: string;
  hostelName: string;
  actionType: 'ADD' | 'DELETE' | 'UPDATE' | 'ONBOARD';
  studentName: string;
  erpId: string;
  operator: string;
  createdAt: string;
}

function HostelLogsButton({ hostelName, onClick }: { hostelName: string; onClick: () => void }) {
  const [logsCount, setLogsCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCount() {
      try {
        const res = await fetch(`/api/hostels/logs?hostelName=${encodeURIComponent(hostelName)}`);
        const data = await res.json();
        if (data.success && active) {
          setLogsCount(data.logs?.length || 0);
        }
      } catch (err) {
        console.error("Failed to load logs count for " + hostelName, err);
      }
    }
    loadCount();
    return () => {
      active = false;
    };
  }, [hostelName]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-slate-200/80 hover:border-indigo-200 hover:bg-slate-50/50 transition-colors p-2 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-700 shadow-sm shrink-0"
    >
      <span className="flex items-center gap-1 text-slate-700">
        📋 Activity Logs
      </span>
      {logsCount !== null && (
        <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-black border border-indigo-100">
          {logsCount}
        </span>
      )}
    </button>
  );
}

function HostelLogsModal({ hostelName, onClose }: { hostelName: string; onClose: () => void }) {
  const [logs, setLogs] = useState<HostelLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/hostels/logs?hostelName=${encodeURIComponent(hostelName)}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setSelectedLogIds(new Set());
      }
    } catch (err) {
      console.error("Failed to load logs for " + hostelName, err);
      showToast("Failed to load logs", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [hostelName]);

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${timeStr} on ${day}/${month}/${year}`;
    } catch {
      return "N/A";
    }
  };

  const handleSelectToggle = (id: string) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (selectedLogIds.size === logs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(logs.map(log => log.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogIds.size === 0) return;
    const confirmed = await showConfirm(`Are you sure you want to delete ${selectedLogIds.size} log entries?`);
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/hostels/logs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logIds: Array.from(selectedLogIds) })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`${selectedLogIds.size} log entries deleted successfully`, "success");
        await loadLogs();
      } else {
        showToast(data.error || "Failed to delete logs", "error");
      }
    } catch (err: any) {
      showToast("Network error: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 text-lg md:text-xl tracking-tight">📋 Activity Logs</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{hostelName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-bold"
          >
            ✕
          </button>
        </div>

        {/* Action Bar */}
        {!isLoading && logs.length > 0 && (
          <div className="px-4 py-3 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={logs.length > 0 && selectedLogIds.size === logs.length}
                onChange={handleSelectAllToggle}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer border-slate-300"
              />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select All ({selectedLogIds.size}/{logs.length})</span>
            </label>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedLogIds.size === 0 || isDeleting}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                selectedLogIds.size > 0 && !isDeleting
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isDeleting ? '⏳ Deleting...' : `🗑️ Delete Selected (${selectedLogIds.size})`}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 bg-white">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <span className="text-2xl animate-spin">⏳</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">Loading activity logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <span className="text-3xl mb-2">📭</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No recent logs found</span>
              <p className="text-xs text-slate-400 mt-1 max-w-[280px]">Any student add, edit, or delete actions for this hostel will be recorded here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isSelfOnboard = log.actionType === 'ONBOARD' || log.operator?.toLowerCase().includes('onboard') || log.operator?.toLowerCase() === 'student' || log.operator?.toLowerCase().includes('self');
                const emoji = isSelfOnboard ? '🟢' : log.actionType === 'ADD' ? '🟢' : log.actionType === 'DELETE' ? '🔴' : '🟡';
                const actionText = isSelfOnboard ? 'ONBOARDED' : log.actionType === 'ADD' ? 'ADDED' : log.actionType === 'DELETE' ? 'DELETED' : 'UPDATED';
                const isSelected = selectedLogIds.has(log.id);

                return (
                  <div
                    key={log.id}
                    onClick={() => handleSelectToggle(log.id)}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-red-200 bg-red-50/20 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer border-slate-300"
                    />


                    {/* Emoji */}
                    <span className="shrink-0 text-xs mt-0.5">{emoji}</span>

                    {/* Text */}
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        <span className={`font-extrabold uppercase tracking-wide ${isSelfOnboard ? 'text-emerald-700' : 'text-slate-900'}`}>{actionText}: </span>
                        <span>"{log.studentName.toUpperCase()}" </span>
                        {log.erpId && log.erpId !== 'N/A' && (
                          <span className="text-[10px] font-black text-slate-500">({log.erpId}) </span>
                        )}
                        {isSelfOnboard ? (
                          <span className="text-emerald-700 font-bold">student registered themselves by onboarding</span>
                        ) : (
                          <span>by <span className="font-black text-slate-800">{log.operator}</span></span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        ⏱️ {formatTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function HostelManagementModal({
  hostels,
  hostelsConfig,
  wardenAccounts,
  globalWardenPassword,
  onClose,
  updatingHostelId,
  formatHostelDisplay,
  handleCreateHostel,
  handleUpdateHostelConfig,
  handleDeleteHostelConfig,
  handleManageWardenAccount,
  handleUpdateHostelMode,
  handleSyncAllStudents,
  wifiWhitelist
}: any) {
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newAccountForm, setNewAccountForm] = useState({ username: "", password: "", hostels: [] as string[] });
  const [activeLogHostel, setActiveLogHostel] = useState<string | null>(null);


  return (
    <div className="fixed inset-0 z-[60] bg-black/50 lg:bg-slate-50 backdrop-blur-sm lg:backdrop-blur-none flex items-center justify-center p-1 sm:p-4 lg:p-0 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl lg:rounded-none w-full max-w-4xl lg:max-w-none max-h-[95vh] sm:max-h-[90vh] lg:max-h-none lg:h-screen lg:w-screen overflow-hidden flex flex-col shadow-2xl lg:shadow-none animate-in zoom-in-95 lg:animate-none duration-200">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b bg-gray-50/50 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-6xl xl:max-w-7xl mx-auto w-full">
            <div>
              <h3 className="font-black text-gray-800 text-lg md:text-2xl tracking-tight">🏢 Hostel Management</h3>
              <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wide">Configure Security & Access Per Campus</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleCreateHostel}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Add Hostel
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-all font-black shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2 sm:p-4 md:p-6 overflow-y-auto flex-1 bg-gray-50/30">
          <div className="max-w-6xl xl:max-w-7xl mx-auto w-full">
          
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 sm:p-4 mb-6">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-black rounded bg-[#0070F3] text-white flex items-center justify-center font-serif italic text-xs shrink-0 font-bold">
                i
              </div>
              <h4 className="text-[#1A365D] font-black text-xs sm:text-sm tracking-wide uppercase">HOW MODES WORK</h4>
            </div>
            <div className="space-y-1.5 text-[10px] sm:text-xs text-[#2A4365]">
              <p className="flex items-start gap-1.5">
                <span className="text-xs shrink-0">📸</span>
                <span><strong className="text-[#1E40AF]">CAMERA MODE:</strong> GPS + Live Camera Photo Match</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="text-xs shrink-0">📍</span>
                <span><strong className="text-[#1E40AF]">GPS ONLY:</strong> GPS check only. Fastest, no biometric/camera</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="text-xs shrink-0">👆</span>
                <span><strong className="text-[#1E40AF]">BIOMETRIC:</strong> GPS + Device Face/Fingerprint (WebAuthn)</span>
              </p>
            </div>
          </div>
          
          {hostelsConfig.length === 0 && (
            <div className="text-center py-12 text-gray-400 font-bold text-sm bg-white rounded-xl border border-dashed">
              No hostels found. Add hostels to begin configuration.
            </div>
          )}

          <div className="grid gap-6">
            {hostelsConfig.map((hostel: any) => {
              const matchedHostel = hostels.find((h: any) => h._id === hostel._id || h.name === hostel.name) || hostel;
              const isLoading = updatingHostelId === matchedHostel._id;

              return (
                <div key={hostel._id} className="bg-white border-2 border-slate-100 p-3 sm:p-6 rounded-2xl hover:border-indigo-100 hover:shadow-xl transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 blur-[50px] rounded-full group-hover:bg-indigo-50 transition-all" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2 mb-6">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded text-base sm:text-xl shrink-0">🏢</div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-800 text-xs sm:text-base md:text-lg uppercase tracking-tight leading-tight">{formatHostelDisplay(hostel.name)}</h4>
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {hostel._id.slice(-6)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            const newPass = await showPrompt("Enter new password for " + hostel.name + ":", (hostel.wardenPassword || "").trim());
                            if (newPass !== null) {
                              handleUpdateHostelConfig({ ...hostel, id: hostel._id, wardenPassword: newPass.trim() });
                              setVisiblePasswords(prev => {
                                const newSet = new Set(prev);
                                newSet.add(hostel._id);
                                return newSet;
                              });
                            }
                          }}
                          className="px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-100 text-indigo-600 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest hover:bg-indigo-50 transition-all text-center shrink-0"
                        >
                          Update Access
                        </button>
                        <button
                          onClick={() => handleDeleteHostelConfig(hostel._id, hostel.name)}
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors shrink-0"
                          title="Delete Hostel"
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
                      {/* Attendance Mode Configuration */}
                      <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance Mode</label>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                            matchedHostel.attendanceMode === 'gps-only' ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : matchedHostel.attendanceMode === 'biometric' ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-green-100 text-green-700 border-green-200'
                          }`}>
                            {matchedHostel.attendanceMode === 'gps-only' ? '📍 GPS ONLY' : matchedHostel.attendanceMode === 'biometric' ? '👆 BIOMETRIC' : '📸 CAMERA'}
                          </span>
                        </div>
                        <div className="flex bg-white p-1 rounded-lg border border-slate-200 w-full sm:w-auto mt-2">
                          <button
                            disabled={isLoading}
                            onClick={() => handleUpdateHostelMode(matchedHostel._id, 'gps-only')}
                            className={`flex-1 px-2 py-2 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 ${
                              matchedHostel.attendanceMode === 'gps-only' ? 'bg-slate-900 text-white shadow-sm scale-[1.02]' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {isLoading && matchedHostel.attendanceMode === 'gps-only' ? '⏳' : '📍'} GPS
                          </button>
                          <button
                            disabled={isLoading}
                            onClick={() => handleUpdateHostelMode(matchedHostel._id, 'biometric')}
                            className={`flex-1 px-2 py-2 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 ${
                              matchedHostel.attendanceMode === 'biometric' ? 'bg-slate-900 text-white shadow-sm scale-[1.02]' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {isLoading && matchedHostel.attendanceMode === 'biometric' ? '⏳' : '👆'} BIO
                          </button>
                          <button
                            disabled={isLoading}
                            onClick={() => handleUpdateHostelMode(matchedHostel._id, 'strict')}
                            className={`flex-1 px-2 py-2 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 ${
                              (!matchedHostel.attendanceMode || matchedHostel.attendanceMode === 'strict') ? 'bg-slate-900 text-white shadow-sm scale-[1.02]' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {isLoading && matchedHostel.attendanceMode === 'strict' ? '⏳' : '📸'} CAM
                          </button>
                        </div>
                        <button
                          onClick={() => handleSyncAllStudents(matchedHostel.name)}
                          disabled={updatingHostelId === 'syncing'}
                          className="mt-3 text-[9px] text-blue-600 font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                        >
                          🔄 Force Sync All Students to Current Mode
                        </button>

                        {/* 🏷️ REGISTRATION FORMAT SETTING */}
                        <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                              🏷️ Registration Format
                            </label>
                            <span className="text-[8px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              Preview: {(() => {
                                const fmt = matchedHostel.registrationFormat || (matchedHostel.name?.toUpperCase().includes("BOYS") ? "BOYS-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GANGOTRI") ? "GANGOTRI-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GAYTRI") ? "GAYTRI-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GHB") ? "GHB-{SEQ4}" : `${matchedHostel.name?.toUpperCase().replace(/[^A-Z]/g, "")}-{SEQ4}`);
                                let res = fmt;
                                res = res.replace(/{SEQ4}/gi, "0001").replace(/{SEQ3}/gi, "001").replace(/{SEQ}/gi, "0001").replace(/{YEAR}/gi, new Date().getFullYear().toString()).replace(/{YY}/gi, new Date().getFullYear().toString().slice(-2));
                                return !fmt.includes("{") ? `${fmt}-0001` : res;
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue={matchedHostel.registrationFormat || (matchedHostel.name?.toUpperCase().includes("BOYS") ? "BOYS-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GANGOTRI") ? "GANGOTRI-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GAYTRI") ? "GAYTRI-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GHB") ? "GHB-{SEQ4}" : `${matchedHostel.name?.toUpperCase().replace(/[^A-Z]/g, "")}-{SEQ4}`)}
                              placeholder="e.g. BOYS-{SEQ4}"
                              onBlur={(e) => {
                                const defaultFmt = matchedHostel.name?.toUpperCase().includes("BOYS") ? "BOYS-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GANGOTRI") ? "GANGOTRI-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GAYTRI") ? "GAYTRI-{SEQ4}" : matchedHostel.name?.toUpperCase().includes("GHB") ? "GHB-{SEQ4}" : `${matchedHostel.name?.toUpperCase().replace(/[^A-Z]/g, "")}-{SEQ4}`;
                                const newFormat = e.target.value.trim() || defaultFmt;
                                handleUpdateHostelConfig({ ...matchedHostel, id: matchedHostel._id, registrationFormat: newFormat });
                              }}
                              className="flex-1 text-[11px] font-mono font-black uppercase text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:outline-none shadow-sm"
                            />
                          </div>
                        </div>

                        {/* WiFi IP Badge & Activity Logs Row */}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          {(() => {
                             const wl = Array.isArray(wifiWhitelist) ? wifiWhitelist : [];
                             const ipEntry = wl.find((w: any) => {
                               if (!w || typeof w !== 'object' || !w.ip) return false;
                               if (w.hostelName && hostel.name && w.hostelName.toLowerCase() === hostel.name.toLowerCase()) {
                                 return true;
                               }
                               if (w.name && typeof w.name === 'string' && hostel.name) {
                                 const cleanWName = w.name.toLowerCase();
                                 const cleanHName = hostel.name.toLowerCase();
                                 return cleanWName.includes(cleanHName) || cleanHName.includes(cleanWName);
                               }
                               return false;
                             });
                            return ipEntry ? (
                              <div className="flex-1 flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 min-w-0">
                                <span className="text-green-500 text-xs shrink-0">🌐</span>
                                <span className="text-[9px] font-black text-green-700 uppercase tracking-widest shrink-0">WiFi IP:</span>
                                <span className="text-[10px] font-mono font-bold text-green-900 truncate">{ipEntry.ip}</span>
                                <span className="ml-auto px-1.5 py-0.5 bg-green-200 text-green-800 text-[8px] font-black rounded uppercase tracking-wider shrink-0">✅ SET</span>
                              </div>
                            ) : (
                              <div className="flex-1 flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 min-w-0">
                                <span className="text-orange-400 text-xs shrink-0">📡</span>
                                <span className="text-[9px] font-bold text-orange-700 truncate">No WiFi IP saved</span>
                                <span className="ml-auto px-1.5 py-0.5 bg-orange-200 text-orange-800 text-[8px] font-black rounded uppercase tracking-wider shrink-0">⚠️ MISSING</span>
                              </div>
                            );
                          })()}
                          <HostelLogsButton
                            hostelName={matchedHostel.name}
                            onClick={() => setActiveLogHostel(matchedHostel.name)}
                          />
                        </div>

                      </div>

                      {/* Credentials & Privileges Configuration */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3.5 bg-slate-50 p-2 sm:p-4 rounded-xl border border-slate-200/60">
                        {/* Credentials Details (Left Column) */}
                        <div className="space-y-2 sm:space-y-4">
                          <div>
                            <label className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block px-0.5">Warden Username</label>
                            <div className="flex items-center gap-1.5 sm:gap-3 bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <input
                                type="text"
                                defaultValue={hostel.wardenUsername || (hostel.name.toLowerCase().replace(/ /g, "_") + "_warden")}
                                onBlur={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, wardenUsername: e.target.value.trim() })}
                                className="font-bold sm:font-black text-slate-700 text-[10px] sm:text-sm bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block px-0.5">Warden Password</label>
                            <div className="flex items-center gap-1.5 sm:gap-3 bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 justify-between shadow-sm">
                              <div className="flex items-center gap-1.5 sm:gap-3 overflow-hidden">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                                <span className="font-bold sm:font-black text-slate-700 text-[10px] sm:text-sm tracking-wide sm:tracking-widest truncate">
                                  {visiblePasswords.has(hostel._id)
                                    ? (hostel.wardenPassword || globalWardenPassword || "Not Set")
                                    : ((hostel.wardenPassword || globalWardenPassword) ? "••••••••" : "Not Set")
                                  }
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setVisiblePasswords(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(hostel._id)) newSet.delete(hostel._id);
                                    else newSet.add(hostel._id);
                                    return newSet;
                                  });
                                }}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                              >
                                {visiblePasswords.has(hostel._id) ? (
                                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block px-0.5">Total Rooms (Capacity)</label>
                            <div className="flex items-center gap-1.5 sm:gap-3 bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <input
                                type="number"
                                defaultValue={hostel.totalRooms || 0}
                                placeholder="0"
                                onBlur={(e) => {
                                  const newVal = parseInt(e.target.value);
                                  if (!isNaN(newVal)) {
                                    handleUpdateHostelConfig({ ...hostel, id: hostel._id, totalRooms: newVal });
                                  }
                                }}
                                className="font-bold sm:font-black text-slate-700 text-[10px] sm:text-sm bg-transparent border-none outline-none focus:ring-0 p-0 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </div>

                          {/* Student Alerts */}
                          <div className="flex items-center justify-between bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                            <div className="min-w-0 pr-1">
                              <p className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase tracking-wider truncate flex items-center gap-1">
                                <span>📱</span> Student Alerts
                              </p>
                              <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold mt-0.5 uppercase truncate">Hostel student alerts</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={hostel.allowStudentNotification !== false}
                                onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowStudentNotification: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-4 sm:w-9 sm:h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 sm:after:h-4 sm:after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                        </div>

                        {/* Privileges Switches (Right Column) */}
                        <div className="flex flex-col border-l border-slate-200/60 pl-2 sm:pl-4 justify-between h-full">
                          <label className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 sm:mb-2.5 block px-0.5">Warden Privileges</label>
                          <div className="space-y-2 sm:space-y-2.5 flex-1 flex flex-col justify-center">
                            
                            {/* Allow Warden to Add Students */}
                            <div className="flex items-center justify-between bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="min-w-0 pr-1">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase tracking-wider truncate">Add Student</p>
                                <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold mt-0.5 uppercase truncate">Manual register</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={!!hostel.allowWardenAddStudent}
                                  onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenAddStudent: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-7 h-4 sm:w-9 sm:h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 sm:after:h-4 sm:after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                            </div>

                            {/* Allow Warden to Edit Profiles */}
                            <div className="flex items-center justify-between bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="min-w-0 pr-1">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase tracking-wider truncate">Edit Profile</p>
                                <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold mt-0.5 uppercase truncate">Details updates</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={!!hostel.allowWardenEditProfile}
                                  onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenEditProfile: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-7 h-4 sm:w-9 sm:h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 sm:after:h-4 sm:after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                            </div>

                            {/* Allow Warden to Remove Students */}
                            <div className="flex items-center justify-between bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="min-w-0 pr-1">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase tracking-wider truncate">Remove Student</p>
                                <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold mt-0.5 uppercase truncate">Permanent deletion</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={!!hostel.allowWardenRemoveStudent}
                                  onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenRemoveStudent: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-7 h-4 sm:w-9 sm:h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 sm:after:h-4 sm:after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                            </div>

                            {/* Warden Alerts */}
                            <div className="flex items-center justify-between bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="min-w-0 pr-1">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase tracking-wider truncate flex items-center gap-1">
                                  <span>🔔</span> Warden Alerts
                                </p>
                                <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold mt-0.5 uppercase truncate">Warden mobile alerts</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={hostel.allowWardenNotification !== false}
                                  onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenNotification: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-7 h-4 sm:w-9 sm:h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 sm:after:h-4 sm:after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MULTI-HOSTEL ACCOUNTS SECTION */}
          <div className="mt-8 pt-8 border-t-2 border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-xl font-black text-slate-800 tracking-tight truncate">Unified Campus Accounts</h3>
                <p className="text-[9px] sm:text-xs text-slate-500 font-bold uppercase tracking-wide mt-0.5 truncate">Manage cross-campus manager accounts</p>
              </div>
              <button
                onClick={() => {
                  setEditingAccountId(null);
                  setNewAccountForm({ username: "", password: "", hostels: [] });
                  setIsCreatingAccount(!isCreatingAccount);
                }}
                className="px-3 py-2 sm:px-6 sm:py-2.5 bg-slate-900 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md flex items-center gap-1.5 shrink-0"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Create Account
              </button>
            </div>

            {isCreatingAccount && (
              <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-lg mb-8">
                <h4 className="font-black text-indigo-900 uppercase tracking-widest mb-6">{editingAccountId ? "Edit Campus Account" : "New Campus Account"}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Username</label>
                    <input
                      type="text"
                      value={newAccountForm.username}
                      onChange={e => setNewAccountForm({ ...newAccountForm, username: e.target.value })}
                      className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-bold"
                      placeholder="e.g. super_warden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Password</label>
                    <input
                      type="text"
                      value={newAccountForm.password}
                      onChange={e => setNewAccountForm({ ...newAccountForm, password: e.target.value })}
                      className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-bold"
                      placeholder="******"
                    />
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">Assign Hostels</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {hostelsConfig.map((h: any) => (
                      <label key={h._id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${newAccountForm.hostels.includes(h.name) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={newAccountForm.hostels.includes(h.name)}
                          onChange={e => {
                            if (e.target.checked) setNewAccountForm({ ...newAccountForm, hostels: [...newAccountForm.hostels, h.name] });
                            else setNewAccountForm({ ...newAccountForm, hostels: newAccountForm.hostels.filter(hn => hn !== h.name) });
                          }}
                          className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-bold text-xs text-slate-700">{formatHostelDisplay(h.name)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsCreatingAccount(false);
                      setEditingAccountId(null);
                      setNewAccountForm({ username: "", password: "", hostels: [] });
                    }}
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newAccountForm.username || !newAccountForm.password || newAccountForm.hostels.length === 0) {
                        alert("Please fill all fields and select at least one hostel.");
                        return;
                      }
                      if (editingAccountId) handleManageWardenAccount("update", { ...newAccountForm, accountId: editingAccountId });
                      else handleManageWardenAccount("create", newAccountForm);
                    }}
                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                  >
                    {editingAccountId ? "Update Account" : "Save Account"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {wardenAccounts.length === 0 && !isCreatingAccount && (
                <div className="py-6 text-center text-slate-400 font-medium italic bg-white rounded-2xl border border-dashed border-slate-200">
                  No unified accounts created yet.
                </div>
              )}
              {wardenAccounts.map((acc: any, idx: number) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-2 w-2 rounded-full bg-indigo-500" />
                      <h4 className="text-base font-black text-slate-800">{acc.username}</h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {acc.hostels.map((h: string) => (
                        <span key={h} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider rounded-md">
                          {formatHostelDisplay(h)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start md:self-center">
                    <button
                      onClick={() => {
                        setNewAccountForm({ username: acc.username, password: acc.password || "", hostels: acc.hostels });
                        setEditingAccountId(acc._id || null);
                        setIsCreatingAccount(true);
                      }}
                      className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (await showConfirm("Delete this account?")) handleManageWardenAccount("delete", { username: acc.username });
                      }}
                      className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
      {activeLogHostel && (
        <HostelLogsModal
          hostelName={activeLogHostel}
          onClose={() => setActiveLogHostel(null)}
        />
      )}
    </div>
  );
}
