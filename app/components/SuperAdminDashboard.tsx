"use client";

import { useState, useEffect } from "react";
import {
    Building2,
    Users,
    ShieldCheck,
    Plus,
    ArrowRight,
    Settings,
    Globe,
    CreditCard,
    MoreVertical,
    AlertCircle,
    CheckCircle2,
    Clock
} from "lucide-react";

interface Tenant {
    _id: string;
    name: string;
    slug: string;
    adminEmail: string;
    isActive: boolean;
    subscriptionStatus: "active" | "expired" | "trial" | "disabled";
    subscriptionEndDate?: string;
    primaryColor?: string;
    createdAt: string;
    studentCount?: number;
}

export default function SuperAdminDashboard() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [registrationSuccessData, setRegistrationSuccessData] = useState<any | null>(null);

    // Auth state
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState("");

    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

    const [newTenant, setNewTenant] = useState({
        name: "",
        slug: "",
        adminEmail: "",
        subscriptionStatus: "trial" as const,
        primaryColor: "#3b82f6"
    });

    const fetchTenants = async () => {
        try {
            const res = await fetch("/api/super-admin/tenants");
            const data = await res.json();
            if (data.success) setTenants(data.tenants);
        } catch (error) {
            console.error("Failed to fetch tenants", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) fetchTenants();
    }, [isAuthorized]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "pankaj-superadmin-2026") {
            setIsAuthorized(true);
            localStorage.setItem("superadmin_session", "true");
        } else {
            alert("Invalid SuperAdmin Password");
        }
    };

    const handleCreateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const res = await fetch("/api/super-admin/tenants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTenant)
            });
            const data = await res.json();
            if (data.success) {
                setTenants([data.tenant, ...tenants]);
                setShowAddModal(false);
                setRegistrationSuccessData({
                    ...data.tenant,
                    defaultAdminPass: "pankajdwivedi81",
                    defaultDevPass: "pankaj852"
                });
                setNewTenant({ name: "", slug: "", adminEmail: "", subscriptionStatus: "trial", primaryColor: "#3b82f6" });
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert("Registration failed");
        } finally {
            setIsCreating(false);
        }
    };

    const toggleTenantStatus = async (id: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'DEACTIVATE' : 'ACTIVATE'} this university?`)) return;

        try {
            const res = await fetch("/api/super-admin/tenants", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, is_active: !currentStatus })
            });
            const data = await res.json();
            if (data.success) {
                setTenants(tenants.map(t => t._id === id ? { ...t, isActive: !currentStatus } : t));
            }
        } catch (error) {
            alert("Status update failed");
        }
    };

    const handleUpdateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTenant) return;

        try {
            const res = await fetch("/api/super-admin/tenants", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingTenant._id,
                    subscriptionStatus: editingTenant.subscriptionStatus,
                    is_active: editingTenant.isActive
                })
            });
            const data = await res.json();
            if (data.success) {
                setTenants(tenants.map(t => t._id === editingTenant._id ? { ...t, ...editingTenant } : t));
                setEditingTenant(null);
                alert("University updated successfully!");
            }
        } catch (error) {
            alert("Update failed");
        }
    };

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#050510] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
                <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in duration-500">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30 mx-auto shadow-2xl shadow-blue-500/20">
                            <ShieldCheck className="w-10 h-10 text-blue-400" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-4 border-[#050510] animate-pulse">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                    </div>

                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Hostelease HQ</h1>
                        <p className="text-gray-400 text-sm font-bold tracking-widest uppercase">Global Multi-Tenant Hub</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold text-center tracking-[1em] focus:ring-2 focus:ring-blue-500/40 outline-none transition-all"
                            placeholder="••••••••"
                            autoFocus
                        />
                        <button className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-600/20 uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all">
                            Authorize Entry
                        </button>
                    </form>

                    <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Restricted Access • SuperAdmin Only</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Building2 className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Tenant Central</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Global HQ System Online</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-widest">New University</span>
                </button>
            </header>

            {/* Stats Summary */}
            <div className="px-8 py-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { icon: Building2, label: "Total Colleges", value: tenants.length, color: "blue" },
                    { icon: ShieldCheck, label: "Active Nodes", value: tenants.filter(t => t.isActive).length, color: "green" },
                    { icon: Users, label: "Users Proxied", value: tenants.reduce((acc, t) => acc + (t.studentCount || 0), 0), color: "purple" },
                    { icon: Globe, label: "Live Domains", value: tenants.length, color: "amber" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-gray-200 transition-all">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{stat.label}</p>
                            <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tenant List */}
            <main className="px-8 pb-12">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Global Infrastructure Inventory</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-bold italic">Auto-refreshing...</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-gray-50">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">College Identity</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Entry Subdomain</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Subscription Status</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Activity</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-4 text-gray-400">
                                                <div className="w-10 h-10 border-4 border-gray-100 border-t-blue-500 rounded-full animate-spin"></div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest">Querying Global Database...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : tenants.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center">
                                            <p className="text-gray-400 text-sm italic font-bold">No universities registered. Add your first client college.</p>
                                        </td>
                                    </tr>
                                ) : tenants.map((tenant) => (
                                    <tr key={tenant._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all uppercase">
                                                    {tenant.name.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-gray-900 leading-none mb-1 uppercase tracking-tight">{tenant.name}</p>
                                                    <p className="text-xs text-gray-400 font-bold italic">{tenant.adminEmail}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="bg-gray-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-2 group-hover:bg-gray-200 transition-all">
                                                <Globe className="w-3 h-3 text-gray-400" />
                                                <span className="text-[11px] font-black text-gray-600 uppercase tracking-tight">{tenant.slug}.hostelease.com</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${tenant.subscriptionStatus === 'active' ? 'bg-emerald-50 text-emerald-600' :
                                                    tenant.subscriptionStatus === 'trial' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                                                    }`}>
                                                    {tenant.subscriptionStatus === 'active' ? <CheckCircle2 className="w-3 h-3" /> :
                                                        tenant.subscriptionStatus === 'trial' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                    {tenant.subscriptionStatus}
                                                </span>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase italic tracking-tight">Expires: Oct 2026</p>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <button
                                                onClick={() => toggleTenantStatus(tenant._id, tenant.isActive)}
                                                className={`text-[10px] font-black uppercase tracking-widest ${tenant.isActive ? 'text-green-500' : 'text-gray-300'}`}
                                            >
                                                {tenant.isActive ? '⚡ ONLINE' : '🔒 SUSPENDED'}
                                            </button>
                                        </td>
                                        <td className="p-6">
                                            <button
                                                onClick={() => setEditingTenant(tenant)}
                                                className="p-2 text-gray-300 hover:text-gray-900 transition-colors"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white animate-in zoom-in slide-in-from-bottom duration-300">
                        <div className="bg-gray-900 p-8 text-white relative">
                            <Building2 className="w-12 h-12 text-blue-400 mb-4" />
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Deploy New University</h3>
                            <p className="text-blue-200/60 text-xs font-black uppercase tracking-widest mt-1">Infrastructure Provisioning</p>
                            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
                                <Plus className="w-8 h-8 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTenant} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">University Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newTenant.name}
                                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                        placeholder="e.g. Oxford University"
                                        className="w-full bg-gray-50 border-gray-100 p-4 rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subdomain Slug</label>
                                    <div className="flex items-center relative">
                                        <input
                                            type="text"
                                            required
                                            value={newTenant.slug}
                                            onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                            placeholder="oxford"
                                            className="w-full bg-gray-50 border-gray-100 p-4 rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300 lowercase"
                                        />
                                        <Globe className="absolute right-4 w-4 h-4 text-gray-300" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Admin Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={newTenant.adminEmail}
                                    onChange={(e) => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
                                    placeholder="admin@oxford.edu"
                                    className="w-full bg-gray-50 border-gray-100 p-4 rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="p-4 rounded-xl bg-gray-50 text-gray-500 font-black uppercase text-xs tracking-widest hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={isCreating}
                                    className="p-4 rounded-xl bg-gray-900 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {isCreating ? "Deploying..." : (
                                        <>Execute Provisioning <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingTenant && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="bg-gray-800 p-8 text-white">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Configure Node</h3>
                            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">{editingTenant.name}</p>
                        </div>

                        <form onSubmit={handleUpdateTenant} className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subscription Status</label>
                                <select
                                    value={editingTenant.subscriptionStatus}
                                    onChange={(e) => setEditingTenant({ ...editingTenant, subscriptionStatus: e.target.value as any })}
                                    className="w-full bg-gray-50 border-gray-100 p-4 rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                >
                                    <option value="active">Active (Full Access)</option>
                                    <option value="trial">Trial Mode</option>
                                    <option value="expired">Expired (Locked)</option>
                                </select>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingTenant(null)}
                                    className="flex-1 p-4 rounded-xl bg-gray-50 text-gray-500 font-black uppercase text-xs tracking-widest hover:bg-gray-100"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 p-4 rounded-xl bg-blue-600 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
                                >
                                    Commit Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Registration Success Modal */}
            {registrationSuccessData && (
                <div className="fixed inset-0 bg-[#050510]/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white animate-in zoom-in duration-500">
                        <div className="bg-emerald-600 p-10 text-white relative">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <CheckCircle2 className="w-32 h-32" />
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Registration Successful!</h3>
                            <p className="text-emerald-100/60 text-xs font-black uppercase tracking-widest">{registrationSuccessData.name} is now LIVE</p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                                        <Globe className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live Subdomain</p>
                                        <p className="text-lg font-black text-slate-800 tracking-tight lowercase">{registrationSuccessData.slug}.hostelease.com</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100/50">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Dean Portal</p>
                                    <div className="space-y-1">
                                        <p className="text-xs text-indigo-900 font-bold mb-1">User: <span className="text-indigo-600">{registrationSuccessData.adminEmail}</span></p>
                                        <p className="text-xs text-indigo-900 font-bold">Pass: <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-700 font-black">{registrationSuccessData.defaultAdminPass}</code></p>
                                    </div>
                                </div>

                                <div className="p-6 rounded-3xl bg-amber-50/50 border border-amber-100/50">
                                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">Developer Portal</p>
                                    <div className="space-y-1">
                                        <p className="text-xs text-amber-900 font-bold mb-1">User: <span className="text-amber-600">Logo Click</span></p>
                                        <p className="text-xs text-amber-900 font-bold">Pass: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-700 font-black">{registrationSuccessData.defaultDevPass}</code></p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
                                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Initial Setup Instructions
                                </h4>
                                <ul className="space-y-2">
                                    <li className="text-[11px] text-blue-800/70 font-bold leading-tight flex gap-2">
                                        <span className="text-blue-500">•</span>
                                        Log in as Developer first to customize Dean & Warden passwords.
                                    </li>
                                    <li className="text-[11px] text-blue-800/70 font-bold leading-tight flex gap-2">
                                        <span className="text-blue-500">•</span>
                                        Add your hostels in 'System Settings' to enable student registration.
                                    </li>
                                    <li className="text-[11px] text-blue-800/70 font-bold leading-tight flex gap-2">
                                        <span className="text-blue-500">•</span>
                                        Students can log in via Google once they are mapped to a room.
                                    </li>
                                </ul>
                            </div>

                            <button
                                onClick={() => setRegistrationSuccessData(null)}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-slate-200 active:scale-95 transition-all"
                            >
                                Done & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
