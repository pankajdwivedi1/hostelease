"use client";

import { useState } from "react";
import { showConfirm, showPrompt, showToast } from "@/lib/toast";

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

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 relative">
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

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-gray-50/30">
          
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 border-2 border-black rounded bg-[#0070F3] text-white flex items-center justify-center font-serif italic text-lg shrink-0">
                i
              </div>
              <div className="flex-1">
                <h4 className="text-[#1A365D] font-bold text-sm tracking-wide mb-3 uppercase">HOW MODES WORK</h4>
                <div className="space-y-2 text-[13px] text-[#2A4365]">
                  <p className="flex items-start gap-2">
                    <span className="text-base">📸</span>
                    <span><strong className="text-[#1E40AF]">CAMERA MODE:</strong> GPS + Live Camera Photo Match.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-base">📍</span>
                    <span><strong className="text-[#1E40AF]">GPS ONLY:</strong> GPS check only. Fastest, no biometric/camera.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-base">👆</span>
                    <span><strong className="text-[#1E40AF]">BIOMETRIC (New):</strong> GPS + Device Face/Fingerprint (WebAuthn). Most Secure.</span>
                  </p>
                </div>
              </div>
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
                <div key={hostel._id} className="bg-white border-2 border-slate-100 p-6 rounded-2xl hover:border-indigo-100 hover:shadow-xl transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 blur-[50px] rounded-full group-hover:bg-indigo-50 transition-all" />
                  
                  <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xl">🏢</div>
                        <div>
                          <h4 className="font-black text-slate-800 text-xl uppercase tracking-tight">{formatHostelDisplay(hostel.name)}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hostel ID: {hostel._id.slice(-6)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
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
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all text-center"
                        >
                          Update Access
                        </button>
                        <button
                          onClick={() => handleDeleteHostelConfig(hostel._id, hostel.name)}
                          className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-colors shrink-0"
                          title="Delete Hostel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Attendance Mode Configuration */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
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

                        {/* WiFi IP Badge */}
                        {(() => {
                          const wl = Array.isArray(wifiWhitelist) ? wifiWhitelist : [];
                          const ipEntry = wl.find((w: any) =>
                            w.ip && w.name?.toLowerCase().includes(hostel.name?.toLowerCase())
                          );
                          return ipEntry ? (
                            <div className="mt-3 flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                              <span className="text-green-500 text-xs">🌐</span>
                              <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">WiFi IP:</span>
                              <span className="text-[10px] font-mono font-bold text-green-900">{ipEntry.ip}</span>
                              <span className="ml-auto px-1.5 py-0.5 bg-green-200 text-green-800 text-[8px] font-black rounded uppercase tracking-wider">✅ SET</span>
                            </div>
                          ) : (
                            <div className="mt-3 flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                              <span className="text-orange-400 text-xs">📡</span>
                              <span className="text-[9px] font-bold text-orange-700">No WiFi IP saved yet — warden must sync from WiFi Network tab</span>
                              <span className="ml-auto px-1.5 py-0.5 bg-orange-200 text-orange-800 text-[8px] font-black rounded uppercase tracking-wider">⚠️ MISSING</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Credentials Configuration */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block px-1">Warden Username</label>
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            <input
                              type="text"
                              defaultValue={hostel.wardenUsername || (hostel.name.toLowerCase().replace(/ /g, "_") + "_warden")}
                              onBlur={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, wardenUsername: e.target.value.trim() })}
                              className="font-black text-slate-700 text-sm bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block px-1">Warden Password</label>
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200 justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-black text-slate-700 text-sm tracking-widest truncate">
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
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              {visiblePasswords.has(hostel._id) ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block px-1">Total Rooms (Capacity)</label>
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
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
                              className="font-black text-slate-700 text-sm bg-transparent border-none outline-none focus:ring-0 p-0 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Warden Dashboard Privileges */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 mt-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block px-1">Warden Dashboard Privileges</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-slate-200">
                        {/* Allow Warden to Add Students */}
                        <div className="flex items-center justify-between border-b sm:border-b-0 sm:border-r border-slate-100 pb-3 sm:pb-0 sm:pr-4">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Add Student</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">Allow manual register</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!hostel.allowWardenAddStudent}
                              onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenAddStudent: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        {/* Allow Warden to Edit Profiles */}
                        <div className="flex items-center justify-between border-b sm:border-b-0 sm:border-r border-slate-100 py-3 sm:py-0 sm:px-4">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Edit Profile</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">Allow details updates</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!hostel.allowWardenEditProfile}
                              onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenEditProfile: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        {/* Allow Warden to Remove Students */}
                        <div className="flex items-center justify-between pt-3 sm:pt-0 sm:pl-4">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Remove Student</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">Allow permanent deletion</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!hostel.allowWardenRemoveStudent}
                              onChange={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, allowWardenRemoveStudent: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-800">Unified Campus Accounts</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Manage cross-campus manager accounts</p>
              </div>
              <button
                onClick={() => {
                  setEditingAccountId(null);
                  setNewAccountForm({ username: "", password: "", hostels: [] });
                  setIsCreatingAccount(!isCreatingAccount);
                }}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
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
  );
}
