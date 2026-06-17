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
    Clock,
    Trash2,
    LogIn,
    Activity,
    X,
    TrendingUp,
    BarChart3,
    ArrowUpRight,
    Lock,
    Zap,
    Database,
    Loader2
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
    liveTraffic?: number;
    renewalUtr?: string | null;
    renewalStatus?: string | null;
    renewalSubmittedAt?: string | null;
    totalHostelars?: number;
    features?: {
        smsEnabled?: boolean;
        biometricEnabled?: boolean;
        advancedAnalytics?: boolean;
    };
    storageBytes?: number;
}

// ⚡ LIVE SWITCH COMPONENT
const LiveDbSwitch = () => {
    const [source, setSource] = useState<'MONGODB' | 'SUPABASE' | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/admin/active-db').then(res => res.json()).then(data => setSource(data.source));
    }, []);

    const toggle = async () => {
        if (!source) return;
        const newSource = source === 'MONGODB' ? 'SUPABASE' : 'MONGODB';
        
        // ⚠️ Enforce Typed Affirmation
        const doubleCheck = prompt(`⚠️ WARNING: YOU ARE ABOUT TO SWITCH DATABASE TO ${newSource} FOR ALL USERS.\n\nTo confirm, type the word "SWITCH" below:`);
        if (doubleCheck !== "SWITCH") {
            alert("Database switch aborted.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/active-db', {
                method: 'POST',
                body: JSON.stringify({ source: newSource }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                setSource(data.source);
                
                // Write Audit Log
                await fetch('/api/super-admin/audit-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: "SWITCH_ACTIVE_DB",
                        details: `Switched global active database source to ${newSource}`,
                        user: "Super Admin"
                    })
                });

                localStorage.clear();
                alert(`✅ Switched to ${data.source}`);
                window.location.reload();
            } else {
                alert("Failed: " + data.error);
            }
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!source) return <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Loading DB...</span>;

    return (
        <button
            onClick={toggle}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                source === 'SUPABASE'
                    ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
            }`}
        >
            {loading ? 'Switching...' : (
                <>
                    <span className={`w-2.5 h-2.5 rounded-full ${source === 'SUPABASE' ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
                    {source === 'SUPABASE' ? '⚡ SUPABASE (LIVE)' : '🍃 MONGODB (LEGACY)'}
                </>
            )}
        </button>
    );
};

export default function SuperAdminDashboard() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [viewMode, setViewMode] = useState<"active" | "recycle" | "audit">("active");
    const [globalStats, setGlobalStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const fetchAuditLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch("/api/super-admin/audit-logs");
            const data = await res.json();
            if (data.success) {
                setAuditLogs(data.logs);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const logAdminAction = async (action: string, details: string) => {
        try {
            const res = await fetch("/api/super-admin/audit-logs", {
                method: "POST",
                body: JSON.stringify({
                    action,
                    details,
                    user: "Super Admin"
                }),
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.success) {
                setAuditLogs(data.logs);
            }
        } catch (error) {
            console.error("Failed to write audit log", error);
        }
    };
    const [showAddModal, setShowAddModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [registrationSuccessData, setRegistrationSuccessData] = useState<any | null>(null);

    // Auth state
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [password, setPassword] = useState("");

    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [calculatingStorageFor, setCalculatingStorageFor] = useState<string | null>(null);

    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [broadcastType, setBroadcastType] = useState<"info"|"warning"|"alert">("info");
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const [showPaymentSettingsModal, setShowPaymentSettingsModal] = useState(false);
    const [isSavingPaymentSettings, setIsSavingPaymentSettings] = useState(false);
    const [paymentSettings, setPaymentSettings] = useState({
        bankName: "PNB Bank",
        accountName: "DR. PANKAJ DWIVEDI",
        accountNumber: "06102413001048",
        ifsc: "PUNB0061010",
        upiId: "pankaj86.dwivedi-1@okicici",
        enableRazorpay: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        pricePerStudentPerMonth: 30,
        customQrCodeUrl: ""
    });

    const [newTenant, setNewTenant] = useState({
        name: "",
        slug: "",
        adminEmail: "",
        contactName: "",
        contactPhone: "",
        subscriptionStatus: "trial" as const,
        primaryColor: "#3b82f6"
    });

    useEffect(() => {
        setIsMounted(true);
        // Check if already authorized
        if (localStorage.getItem("superadmin_session") === "true") {
            setIsAuthorized(true);
        }
    }, []);

    const getTenantDisplayUrl = (slug: string) => {
        if (!isMounted) return `www.hosteleaze.com?tenant=${slug}`;
        const hostname = window.location.hostname;
        if (hostname === "localhost") {
            return `localhost:3000?tenant=${slug}`;
        } else if (hostname.includes("hosteleaze.com")) {
            return `www.hosteleaze.com?tenant=${slug}`;
        } else {
            return `${window.location.host}/?tenant=${slug}`;
        }
    };

    const getTenantUrl = (slug: string) => {
        if (!isMounted) return `https://www.hosteleaze.com?tenant=${slug}`;
        const hostname = window.location.hostname;
        if (hostname === "localhost") {
            return `http://localhost:3000?tenant=${slug}`;
        } else if (hostname.includes("hosteleaze.com")) {
            return `https://www.hosteleaze.com?tenant=${slug}`;
        } else {
            return `${window.location.protocol}//${window.location.host}/?tenant=${slug}`;
        }
    };

    const fetchTenants = async () => {
        try {
            const res = await fetch(`/api/super-admin/tenants${viewMode === 'recycle' ? '?deleted=true' : ''}`);
            const data = await res.json();
            if (data.success) {
                setTenants(data.tenants);
                setGlobalStats(data.globalStats);
            }
        } catch (error) {
            console.error("Failed to fetch tenants", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPaymentSettings = async () => {
        try {
            const res = await fetch('/api/super-admin/settings');
            const data = await res.json();
            if (data.success) {
                setPaymentSettings(prev => ({
                    ...prev,
                    ...data.settings,
                    razorpayKeyId: data.settings.razorpayKeyId || "",
                    razorpayKeySecret: data.settings.razorpayKeySecret || "",
                    pricePerStudentPerMonth: data.settings.pricePerStudentPerMonth || 30,
                    customQrCodeUrl: data.settings.customQrCodeUrl || ""
                }));
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const savePaymentSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingPaymentSettings(true);
        try {
            const res = await fetch('/api/super-admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentSettings)
            });
            const data = await res.json();
            if (data.success) {
                logAdminAction("UPDATE_PAYMENT_CONFIG", `Updated global payment configuration (Price/Student: $${paymentSettings.pricePerStudentPerMonth}, Razorpay: ${paymentSettings.enableRazorpay ? 'ENABLED' : 'DISABLED'})`);
                alert("Payment Settings updated successfully!");
                setShowPaymentSettingsModal(false);
            } else {
                alert("Failed to save settings: " + data.error);
            }
        } catch (error) {
            alert("Error saving settings");
        } finally {
            setIsSavingPaymentSettings(false);
        }
    };

    useEffect(() => {
        if (isAuthorized && isMounted) {
            fetchTenants();
            fetchPaymentSettings();
            fetchAuditLogs();
        }
        
        // Auto-refresh stats every 30 seconds for live traffic
        const interval = setInterval(() => {
            // ⚡ OPTIMIZATION: Only refresh if tab is visible to save bandwidth
            if (isAuthorized && isMounted && viewMode === 'active' && document.visibilityState === 'visible') {
                fetchTenants();
            }
        }, 30000);
        
        return () => clearInterval(interval);
    }, [isAuthorized, isMounted, viewMode]);

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
                logAdminAction("PROVISION_NODE", `Provisioned new university node '${data.tenant.slug}' (${data.tenant.name})`);
                setTenants([data.tenant, ...tenants]);
                setShowAddModal(false);
                setRegistrationSuccessData({
                    ...data.tenant,
                    defaultAdminPass: "pankajdwivedi81",
                    defaultDevPass: "Pankaj852963"
                });
                setNewTenant({ name: "", slug: "", adminEmail: "", contactName: "", contactPhone: "", subscriptionStatus: "trial", primaryColor: "#3b82f6" });
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
                logAdminAction("TOGGLE_STATUS", `Toggled active state of university node ID: ${id} to ${!currentStatus ? 'ACTIVE' : 'DEACTIVE'}`);
                setTenants(tenants.map(t => t._id === id ? { ...t, isActive: !currentStatus } : t));
            }
        } catch (error) {
            alert("Status update failed");
        }
    };

    const handleDeletePurge = async () => {
        if (!deletingTenant) return;
        
        const normalizedExpected = `DELETE ${deletingTenant.name.toUpperCase()}`.trim().replace(/\s+/g, ' ');
        const normalizedInput = deleteConfirmText.trim().toUpperCase().replace(/\s+/g, ' ');

        if (normalizedInput !== normalizedExpected) {
            alert("Confirmation text mismatch. Please type the name exactly as shown.");
            return;
        }

        // Final safety check with student count
        const studentCount = deletingTenant.studentCount || 0;
        const finalConfirm = window.confirm(
            `⚠️ FINAL WARNING: ${studentCount} students are registered in ${deletingTenant.name}.\n\nAre you absolutely sure you want to delete all student records and this university node permanently?`
        );

        if (!finalConfirm) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/super-admin/tenants?id=${deletingTenant._id}&purge=true`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                logAdminAction("DESTROY_PURGE_NODE", `Permanently destroyed university node '${deletingTenant.slug}' (${deletingTenant.name})`);
                setTenants(tenants.filter(t => t._id !== deletingTenant._id));
                setDeletingTenant(null);
                setDeleteConfirmText("");
                alert("University Node permanently destroyed and purged from disk.");
            } else {
                alert(`Purge failed: ${data.error || "Unknown error"}`);
            }
        } catch (error: any) {
            alert(`Purge failed: ${error.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSoftDelete = async (id: string) => {
        if (!confirm("Move this university to the Recycle Bin? All students and admins will lose access immediately.")) return;
        
        try {
            const res = await fetch(`/api/super-admin/tenants?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                const t = tenants.find(x => x._id === id);
                logAdminAction("SOFT_DELETE_NODE", `Moved university node '${t?.slug || id}' to Recycle Bin`);
                setTenants(tenants.filter(t => t._id !== id));
                alert("University successfully moved to Recycle Bin.");
            }
        } catch (error) {
            alert("Soft-delete failed.");
        }
    };

    const handleRestore = async (id: string) => {
        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "restore", id })
            });
            const data = await res.json();
            if (data.success) {
                logAdminAction("RESTORE_NODE", `Restored university node ID: ${id} to active network`);
                alert("University Node successfully restored to the network.");
                fetchTenants();
            }
        } catch (error) {
            alert("Restoration failed.");
        }
    };

    const handleImpersonateAdmin = (slug: string) => {
        logAdminAction("IMPERSONATE_ADMIN", `Logged in to proxy console for tenant '${slug}'`);
        const hostname = window.location.hostname;
        let impersonateUrl = "";
        
        if (hostname === "localhost") {
            impersonateUrl = `http://localhost:3000/auth/impersonate?type=admin&token=BOSS_PROXY_${Date.now()}&tenant=${slug}`;
        } else if (hostname.includes("hosteleaze.com")) {
            impersonateUrl = `https://www.hosteleaze.com/auth/impersonate?type=admin&token=BOSS_PROXY_${Date.now()}&tenant=${slug}`;
        } else {
            // For vercel.app domains, codespaces, IPs, etc. -> Use query param which middleware will convert to cookie
            impersonateUrl = `${window.location.protocol}//${window.location.host}/auth/impersonate?type=admin&token=BOSS_PROXY_${Date.now()}&tenant=${slug}`;
        }

        window.open(impersonateUrl, "_blank");
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
                    is_active: editingTenant.isActive,
                    subscriptionEndDate: editingTenant.subscriptionEndDate || null,
                    contactName: editingTenant.contactName,
                    contactPhone: editingTenant.contactPhone,
                    totalHostelars: editingTenant.totalHostelars,
                    features: editingTenant.features
                })
            });
            const data = await res.json();
            if (data.success) {
                logAdminAction("CONFIGURE_NODE", `Updated settings and details for university node '${editingTenant.slug}'`);
                setTenants(tenants.map(t => t._id === editingTenant._id ? { ...t, ...data.tenant } : t));
                setEditingTenant(null);
                alert("University Node successfully configured.");
            }
        } catch (error) {
            alert("Update failed.");
        }
    };

    const handleCalculateStorage = async (tenantId: string) => {
        setCalculatingStorageFor(tenantId);
        try {
            const res = await fetch("/api/super-admin/tenants/storage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId })
            });
            const data = await res.json();
            if (data.success) {
                const t = tenants.find(x => x._id === tenantId);
                logAdminAction("CALCULATE_STORAGE", `Recalculated exact storage sizes for '${t?.slug || tenantId}'`);
                setTenants(tenants.map(t => t._id === tenantId ? { ...t, storageBytes: data.storageBytes } : t));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setCalculatingStorageFor(null);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBroadcasting(true);
        try {
            const res = await fetch("/api/super-admin/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: broadcastMessage, type: broadcastType })
            });
            const data = await res.json();
            if (data.success) {
                logAdminAction("BROADCAST", broadcastMessage ? `Dispatched global platform broadcast alert (${broadcastType}): "${broadcastMessage}"` : "Cleared active global platform broadcast");
                alert(broadcastMessage ? "Broadcast sent successfully!" : "Broadcast cleared.");
                setShowBroadcastModal(false);
                setBroadcastMessage("");
            }
        } catch (error) {
            alert("Failed to send broadcast.");
        } finally {
            setIsBroadcasting(false);
        }
    };

    if (!isMounted) return null;

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
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Hosteleaze HQ</h1>
                        <p className="text-gray-400 text-sm font-bold tracking-widest uppercase">Global Multi-Tenant Hub</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            suppressHydrationWarning
                            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold text-center tracking-[0.4em] focus:ring-2 focus:ring-blue-500/40 outline-none transition-all placeholder:tracking-normal placeholder:font-medium placeholder:text-gray-600"
                            placeholder="HQ AUTH KEY"
                            autoFocus
                        />
                        <button 
                            suppressHydrationWarning
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-600/20 uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            Authorize Entry
                        </button>
                    </form>

                    <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Restricted Access • Boss Portal</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fcfcfd] flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 py-4 sm:py-5 sticky top-0 z-40 transition-shadow gap-4 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200 shrink-0">
                        <Building2 className="text-blue-400 w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-tighter truncate">Hosteleaze Boss Control</h2>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-0.5 shrink-0">
                                <span className="w-1 h-2 sm:w-1 sm:h-3 bg-blue-500 rounded-full animate-bounce"></span>
                                <span className="w-1 h-2 sm:w-1 sm:h-3 bg-blue-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-1 h-2 sm:w-1 sm:h-3 bg-blue-300 rounded-full animate-bounce delay-150"></span>
                            </div>
                            <span className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest truncate">SuperAdmin Authorization Active</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                     <div className="flex flex-col items-end px-3 py-1 sm:px-4 sm:py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-[8px] sm:text-[9px] text-emerald-600 font-black uppercase tracking-widest">Live Pulse</p>
                        <p className="text-xs sm:text-sm font-black text-emerald-900">
                            {globalStats?.totalActiveTraffic || 0} 
                            <span className="text-[8px] ml-1 font-bold text-emerald-700 opacity-60 italic">Att/Min</span>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const doubleCheck = prompt("⚠️ WARNING: This will trigger a full database migration from MongoDB to Supabase. This should ONLY be run once.\n\nTo confirm, type the word \"MIGRATE\" below:");
                            if (doubleCheck !== "MIGRATE") {
                                alert("Migration aborted.");
                                return;
                            }

                            try {
                                const res = await fetch('/api/admin/migrate-db', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    alert(data.message);
                                    await fetch('/api/super-admin/audit-logs', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            action: "DATABASE_MIGRATION",
                                            details: "Triggered database data migration to Supabase successfully",
                                            user: "Super Admin"
                                        })
                                    });
                                } else {
                                    alert("Migration breakdown: " + data.error);
                                }
                            } catch (e: any) {
                                alert("Critical Error: " + e.message);
                            }
                        }}
                        className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 justify-center"
                    >
                        🚀 Migration
                    </button>

                    <LiveDbSwitch />

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-[10px] sm:text-xs uppercase tracking-widest flex-1 sm:flex-none justify-center"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="whitespace-nowrap">Provision Node</span>
                    </button>
                </div>
            </header>

            <div className="px-4 sm:px-8 pt-6 sm:pt-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 no-scrollbar">
                    {[
                        { icon: Users, label: "Total Students", value: tenants.reduce((acc, t) => acc + (t.studentCount || 0), 0), sub: "Across nodes", trend: "+12.4%", color: "blue" },
                        { icon: Zap, label: "Active Nodes", value: globalStats?.revenueSummary?.active || 0, sub: "Subscribed", trend: "Stable", color: "amber" },
                        { icon: TrendingUp, label: "Trial Nodes", value: globalStats?.revenueSummary?.trial || 0, sub: "Evaluation", trend: "Future", color: "indigo" },
                        { 
                            icon: CreditCard, 
                            label: "Projected MRR", 
                            value: `₹${(tenants.filter(t => t.subscriptionStatus === 'active' && !t.isDeleted).reduce((acc, t) => acc + (t.studentCount || 0), 0) * (paymentSettings.pricePerStudentPerMonth || 30)).toLocaleString("en-IN")}`, 
                            sub: `₹${paymentSettings.pricePerStudentPerMonth || 30}/student monthly rate`, 
                            trend: "Expected", 
                            color: "emerald" 
                        },
                        {
                            icon: Database,
                            label: "Total Storage",
                            value: `${(tenants.reduce((acc, t) => acc + (t.storageBytes || 0), 0) / (1024 * 1024)).toFixed(2)} MB`,
                            sub: "Global disk usage",
                            trend: `${((tenants.reduce((acc, t) => acc + (t.storageBytes || 0), 0) / (10 * 1024 * 1024 * 1024)) * 100).toFixed(2)}% of 10GB`,
                            color: "purple"
                        }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-3 sm:p-7 rounded-[20px] sm:rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/40 transition-all duration-500 group">
                            <div className="flex justify-between items-center mb-2 sm:mb-4">
                                <div className={`w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600 group-hover:bg-${stat.color}-600 group-hover:text-white transition-colors`}>
                                    <stat.icon className="w-3.5 h-3.5 sm:w-6 sm:h-6" />
                                </div>
                                <div className={`text-[6px] sm:text-[10px] font-black px-1 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg bg-${stat.color}-50 text-${stat.color}-600 uppercase tracking-tighter`}>
                                    {stat.trend}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-3xl font-black text-gray-900 leading-none tracking-tighter">{stat.value}</h3>
                                <p className="text-[7px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                                <p className="hidden sm:block text-[8px] sm:text-[9px] text-gray-300 font-medium italic mt-2 truncate">{stat.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <main className="px-4 sm:px-8 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                
                {/* View Switcher & Header */}
                <div className="lg:col-span-12 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4 sm:mb-8 mt-6 sm:mt-12 border-t border-gray-100 pt-8 sm:pt-12">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-tighter">Infrastructure Control</h2>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl sm:rounded-2xl border border-gray-200 w-full sm:w-auto overflow-hidden">
                        <button 
                            onClick={() => setShowPaymentSettingsModal(true)}
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-2"
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            Payment Config
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button 
                            onClick={() => setViewMode('active')}
                            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Active Nodes
                        </button>
                        <button 
                            onClick={() => setViewMode('recycle')}
                            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'recycle' ? 'bg-white text-red-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-red-400'}`}
                        >
                            Recycle Bin
                        </button>
                        <button 
                            onClick={() => setViewMode('audit')}
                            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'audit' ? 'bg-white text-purple-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-purple-400'}`}
                        >
                            Audit Logs
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-12 space-y-6">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                {viewMode === 'active' ? 'Operational Hub' : viewMode === 'recycle' ? 'Trash Registry' : 'HQ Security Logs'}
                            </p>
                         </div>
                         <div className="flex gap-2">
                             <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                {viewMode === 'active' ? `Total Active Nodes: ${tenants.length}` : viewMode === 'recycle' ? `Deleted Nodes: ${tenants.length}` : `Audit Records: ${auditLogs.length}`}
                             </div>
                         </div>
                    </div>
                    <div className="bg-white sm:bg-transparent rounded-[32px] sm:rounded-none overflow-hidden">
                        {viewMode === 'audit' ? (
                            <div className="bg-white p-6 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Security Audit Trail</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Real-time log of administrative and infrastructure events</p>
                                    </div>
                                    <button 
                                        onClick={fetchAuditLogs}
                                        disabled={loadingLogs}
                                        className="bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-2"
                                    >
                                        {loadingLogs ? 'Syncing...' : '🔄 Refresh Logs'}
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[8px]">
                                                <th className="py-3 px-4">Timestamp</th>
                                                <th className="py-3 px-4">Operator</th>
                                                <th className="py-3 px-4">Event Type</th>
                                                <th className="py-3 px-4">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-bold">
                                            {auditLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-12 text-center text-slate-400 italic">No audit records found.</td>
                                                </tr>
                                            ) : auditLogs.map((log: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                                    <td className="py-3 px-4 text-blue-600 font-black">{log.user}</td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter ${
                                                            log.action?.includes('DESTROY') || log.action?.includes('DELETE') ? 'bg-red-50 text-red-600 border border-red-100' :
                                                            log.action?.includes('PROVISION') || log.action?.includes('RESTORE') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                            log.action?.includes('SWITCH') ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                            'bg-slate-50 text-slate-600 border border-slate-100'
                                                        }`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700 leading-normal">{log.details}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {loading ? (
                                    <div className="col-span-full bg-white p-12 rounded-[32px] border border-gray-100 text-center flex flex-col items-center gap-4">
                                         <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
                                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Syncing Nodes...</p>
                                    </div>
                                ) : tenants.length === 0 ? (
                                    <div className="col-span-full bg-white p-8 rounded-[32px] border border-gray-100 text-center flex flex-col items-center gap-3">
                                        <Globe className="w-8 h-8 text-gray-200 mx-auto" />
                                        <p className="text-gray-400 text-[10px] italic font-bold">No global nodes provisioned yet.</p>
                                    </div>
                                ) : tenants.map((tenant) => (
                                    <div key={tenant._id} className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col group">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm leading-tight break-words">{tenant.name}</h3>
                                                    {viewMode === 'active' && tenant.liveTraffic && tenant.liveTraffic > 0 ? (
                                                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                                    ) : null}
                                                </div>
                                                <p className="text-[9px] text-slate-400 font-bold italic opacity-70 break-all mt-0.5">{tenant.adminEmail}</p>
                                                
                                                {(tenant.contactName || tenant.contactPhone || tenant.totalHostelars) && (
                                                    <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                                                        {tenant.contactName && <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1"><span className="text-slate-400 uppercase tracking-widest text-[7px] w-12 inline-block">Contact:</span> {tenant.contactName}</p>}
                                                        {tenant.contactPhone && <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1"><span className="text-slate-400 uppercase tracking-widest text-[7px] w-12 inline-block">Phone:</span> {tenant.contactPhone}</p>}
                                                        {tenant.totalHostelars && <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1"><span className="text-slate-400 uppercase tracking-widest text-[7px] w-12 inline-block">Hostelars:</span> {tenant.totalHostelars}</p>}
                                                    </div>
                                                )}
                                            </div>
                                            {viewMode === 'active' ? (
                                                <button
                                                    onClick={() => toggleTenantStatus(tenant._id, tenant.isActive)}
                                                    className={`shrink-0 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${tenant.isActive ? 'text-emerald-600 border-emerald-100 bg-emerald-50 hover:bg-emerald-100' : 'text-red-500 border-red-100 bg-red-50 hover:bg-red-100'}`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${tenant.isActive ? 'bg-emerald-500 shadow-emerald-500 shadow-sm' : 'bg-red-500 animate-pulse'}`}></div>
                                                    {tenant.isActive ? 'OPERATIONAL' : 'OFFLINE'}
                                                </button>
                                            ) : (
                                                <div className="shrink-0 text-[8px] font-black text-red-500/60 uppercase tracking-widest px-2 py-1 bg-red-50/50 rounded-lg border border-red-100/50">
                                                    Deleted
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Subscription Period</span>
                                                {tenant.subscriptionEndDate && (() => {
                                                    const now = new Date();
                                                    const end = new Date(tenant.subscriptionEndDate);
                                                    const diffTime = end.getTime() - now.getTime();
                                                    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    
                                                    if (daysRemaining < 0) {
                                                        return (
                                                            <span className="text-[7px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 leading-none">
                                                                Expired ({Math.abs(daysRemaining)}d ago)
                                                            </span>
                                                        );
                                                    } else if (daysRemaining <= 7) {
                                                        return (
                                                            <span className="text-[7px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 leading-none animate-pulse">
                                                                Expiring ({daysRemaining}d left)
                                                            </span>
                                                        );
                                                    } else {
                                                        return (
                                                            <span className="text-[7px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 leading-none">
                                                                {daysRemaining} days left
                                                            </span>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                                                <div>
                                                    <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Start Date</p>
                                                    <p className="text-[10px] font-extrabold">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}</p>
                                                </div>
                                                <div className="h-4 w-px bg-slate-200" />
                                                <div className="text-right">
                                                    <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">End Date</p>
                                                    <p className="text-[10px] font-extrabold">{tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Unlimited"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-auto flex flex-col gap-4">
                                            {tenant.renewalStatus === 'pending' && (
                                                <div className="glowing-border-blue p-3 text-[10px] font-bold text-amber-900 space-y-0.5">
                                                    <div className="relative z-10 space-y-0.5">
                                                        <span className="uppercase text-[8px] tracking-wider font-black text-amber-700 block">Renewal Requested</span>
                                                        <div className="flex justify-between items-center font-mono">
                                                            <span className="select-all font-extrabold">UTR: {tenant.renewalUtr}</span>
                                                            <span className="text-[8px] text-amber-600 font-sans">
                                                                {tenant.renewalSubmittedAt ? new Date(tenant.renewalSubmittedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 bg-slate-900 text-white p-2 rounded-xl">
                                                <Globe className="w-3 h-3 text-blue-400 shrink-0" />
                                                <a 
                                                    href={getTenantUrl(tenant.slug)} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-[10px] font-bold tracking-tight truncate flex-1 hover:text-blue-400 hover:underline transition-colors"
                                                >
                                                    {getTenantDisplayUrl(tenant.slug)}
                                                </a>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button 
                                                        onClick={() => handleCalculateStorage(tenant._id)}
                                                        disabled={calculatingStorageFor === tenant._id}
                                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 hover:bg-white/20 transition-all rounded-lg cursor-pointer disabled:opacity-50" 
                                                        title="Click to calculate exact storage from database"
                                                    >
                                                        {calculatingStorageFor === tenant._id ? (
                                                            <Loader2 className="w-2 h-2 text-indigo-400 animate-spin" />
                                                        ) : (
                                                            <Database className="w-2 h-2 text-indigo-400" />
                                                        )}
                                                        <span className="text-[8px] font-black">
                                                            {tenant.storageBytes !== null && tenant.storageBytes !== undefined ? `${(tenant.storageBytes / (1024 * 1024)).toFixed(2)}MB` : "CALCULATE"}
                                                        </span>
                                                    </button>
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded-lg" title="Active Connections">
                                                        <Activity className="w-2 h-2 text-emerald-400" />
                                                        <span className="text-[8px] font-black">{tenant.liveTraffic || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Storage Quota Progress Bar */}
                                            {tenant.storageBytes !== null && tenant.storageBytes !== undefined && (
                                                <div className="px-1 space-y-1">
                                                    <div className="flex justify-between items-center text-[7px] font-black uppercase text-slate-400 tracking-wider">
                                                        <span>Storage Quota</span>
                                                        <span>{((tenant.storageBytes / (100 * 1024 * 1024)) * 100).toFixed(1)}% of 100MB</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                (tenant.storageBytes / (100 * 1024 * 1024)) > 0.8 ? 'bg-red-500 animate-pulse' :
                                                                (tenant.storageBytes / (100 * 1024 * 1024)) > 0.5 ? 'bg-amber-500' :
                                                                'bg-blue-500'
                                                            }`}
                                                            style={{ width: `${Math.min(100, (tenant.storageBytes / (100 * 1024 * 1024)) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                {viewMode === 'active' ? (
                                                    <>
                                                        <button onClick={() => handleImpersonateAdmin(tenant.slug)} className="flex-1 bg-blue-600 text-white h-9 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-500/10">
                                                            <LogIn className="w-3.5 h-3.5" /> Sign In
                                                        </button>
                                                        <button onClick={() => setEditingTenant(tenant)} className="w-9 h-9 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                                                            <Settings className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleSoftDelete(tenant._id)} className="w-9 h-9 bg-red-50 text-red-500/60 border border-red-100 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleRestore(tenant._id)} className="flex-1 bg-blue-600 text-white h-9 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/10">
                                                            Restore Node
                                                        </button>
                                                        <button onClick={() => setDeletingTenant(tenant)} className="w-9 h-9 bg-red-50 text-red-600 border border-red-100 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        </div>
                    </div>
                

                {/* Boss Overrides Section */}
                <div className="lg:col-span-12 mt-8 sm:mt-12">
                     <div className="bg-slate-900 rounded-[32px] sm:rounded-[48px] p-6 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-900/40">
                        {/* Decorative background circle */}
                        <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-blue-600/10 rounded-full blur-[60px] sm:blur-[100px] -mr-32 -mt-32 sm:-mr-48 sm:-mt-48"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 sm:w-96 sm:h-96 bg-indigo-600/10 rounded-full blur-[60px] sm:blur-[100px] -ml-32 -mb-32 sm:-ml-48 -mb-48"></div>

                        <div className="relative z-10 flex flex-col xl:flex-row items-start sm:items-center justify-between gap-8 sm:gap-12">
                            <div className="w-full xl:max-w-2xl">
                                <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6 sm:mb-8">
                                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                                    <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-400">Boss Overrides Management</span>
                                </div>
                                <h3 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase mb-4 sm:mb-6 leading-tight sm:leading-none">Global Network <br/><span className="text-blue-500">Infrastructure.</span></h3>
                                <p className="text-slate-400 font-medium text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed max-w-xl">
                                    Maintain total control over the registration ecosystem. Force system-wide updates, push core maintenance flags, and broadcast alerts across all university nodes simultaneously.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                                     <button className="flex items-center justify-start sm:justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] transition-all group w-full">
                                         <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400 group-hover:scale-110 transition-transform shrink-0" />
                                         <div className="text-left">
                                             <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">Secure Mode</p>
                                             <p className="font-black text-xs sm:text-sm whitespace-nowrap">Force Password Reset</p>
                                         </div>
                                     </button>
                                     <button onClick={() => setShowBroadcastModal(true)} className="flex items-center justify-start sm:justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] transition-all group w-full">
                                         <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
                                         <div className="text-left">
                                             <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">System Comms</p>
                                             <p className="font-black text-xs sm:text-sm whitespace-nowrap">Broadcast Global Alert</p>
                                         </div>
                                     </button>
                                </div>
                            </div>

                            <div className="w-full xl:w-auto grid grid-cols-1 gap-4">
                                <div className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] backdrop-blur-xl">
                                    <h4 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-400 mb-6 flex items-center gap-2">
                                        <Activity className="w-4 h-4" />
                                        Infrastructure Capacity
                                    </h4>
                                    <div className="space-y-6">
                                        {[
                                            { label: "Total Network Nodes", val: `${tenants.length}`, color: "blue", percent: Math.min((tenants.length / 50) * 100, 100) },
                                            { label: "Active Connections", val: `${tenants.reduce((acc, t) => acc + (t.liveTraffic || 0), 0)}`, color: "emerald", percent: 80 },
                                            { label: "Database Persistence", val: `${tenants.reduce((acc, t) => acc + (t.studentCount || 0) + (t.liveTraffic || 0) * 15, 0).toLocaleString()} Rows`, color: "blue", percent: 60 },
                                        ].map((stat, i) => (
                                            <div key={i} className="flex flex-col gap-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                                                    <span className="text-[10px] sm:text-[11px] font-black text-white">{stat.val}</span>
                                                </div>
                                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${stat.color === 'blue' ? 'bg-blue-500' : 'bg-emerald-400'} transition-all duration-1000 ease-out`} 
                                                        style={{ width: `${stat.percent}%` }} 
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="mt-8 sm:mt-10 w-full py-4 sm:py-5 bg-blue-600 hover:bg-blue-700 rounded-2xl sm:rounded-3xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-500/20 active:scale-95 text-[10px] sm:text-xs">
                                        Deploy Platform Wide Update
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-all animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden border border-white animate-in zoom-in slide-in-from-bottom-12 duration-500">
                        <div className="bg-gray-900 p-10 text-white relative">
                            <div className="absolute top-0 right-0 p-12 opacity-5 scale-150">
                                <Building2 className="w-24 h-24" />
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">Provision New Node</h3>
                            <p className="text-blue-200/60 text-[10px] font-black uppercase tracking-widest mt-1">Establishing Virtual Infrastructure</p>
                            <button onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white transition-colors bg-white/10 h-10 w-10 rounded-full flex items-center justify-center hover:rotate-90">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTenant} className="p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">University Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newTenant.name}
                                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                        placeholder="e.g. Oxford University"
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subdomain Slug</label>
                                    <div className="flex items-center relative">
                                        <input
                                            type="text"
                                            required
                                            value={newTenant.slug}
                                            onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                            placeholder="oxford"
                                            className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300 lowercase px-5"
                                        />
                                        <Globe className="absolute right-5 w-4 h-4 text-gray-300" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Global Admin Contact</label>
                                    <input
                                        type="email"
                                        required
                                        value={newTenant.adminEmail}
                                        onChange={(e) => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
                                        placeholder="admin@oxford.edu"
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subscription Plan</label>
                                    <select
                                        value={newTenant.subscriptionStatus}
                                        onChange={(e) => setNewTenant({ ...newTenant, subscriptionStatus: e.target.value as any })}
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-700"
                                    >
                                        <option value="trial">14-Day Free Trial</option>
                                        <option value="active">Active (Paid)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contact Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newTenant.contactName}
                                        onChange={(e) => setNewTenant({ ...newTenant, contactName: e.target.value })}
                                        placeholder="e.g. John Doe"
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contact Phone</label>
                                    <input
                                        type="tel"
                                        required
                                        value={newTenant.contactPhone}
                                        onChange={(e) => setNewTenant({ ...newTenant, contactPhone: e.target.value })}
                                        placeholder="+91 9876543210"
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="p-5 rounded-2xl bg-slate-50 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={isCreating}
                                    className="p-5 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {isCreating ? "Deploying..." : (
                                        <>Deploy Node <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {editingTenant && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white">
                        <div className="bg-slate-800 p-10 text-white flex justify-between items-start">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tighter">Configure Node</h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">{editingTenant?.name}</p>
                            </div>
                            <X className="w-6 h-6 text-slate-500 cursor-pointer" onClick={() => setEditingTenant(null)} />
                        </div>

                        <form onSubmit={handleUpdateTenant} className="p-10 space-y-8 animate-in fade-in duration-300">
                            {editingTenant.renewalStatus === 'pending' && (
                                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[28px] space-y-4 shadow-sm animate-pulse">
                                    <div className="flex items-center gap-2.5 text-amber-800">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <span className="text-[11px] font-black uppercase tracking-wider">Pending Subscription Renewal Submission</span>
                                    </div>
                                    <div className="space-y-2 text-xs text-amber-950">
                                        <div className="flex justify-between items-center border-b border-amber-100 pb-1.5">
                                            <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Submitted UTR:</span>
                                            <span className="font-mono font-black select-all bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg">{editingTenant.renewalUtr}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Submitted At:</span>
                                            <span className="font-extrabold text-amber-900">
                                                {editingTenant.renewalSubmittedAt ? new Date(editingTenant.renewalSubmittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "N/A"}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[9.5px] text-amber-700 leading-relaxed font-semibold bg-white/60 p-3.5 rounded-2xl border border-amber-100">
                                        💡 To approve, update the subscription entitlement and/or expiration date below, and save. This will clear the pending request automatically.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subscription Entitlement</label>
                                <select
                                    value={editingTenant?.subscriptionStatus || 'trial'}
                                    onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, subscriptionStatus: e.target.value as any })}
                                    className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none transition-all"
                                >
                                    <option value="active">Active (Premium Full Access)</option>
                                    <option value="trial">Standard Trial (Restricted)</option>
                                    <option value="expired">Expired (Node Locked)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subscription End Date</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={(() => {
                                            if (!editingTenant?.subscriptionEndDate) return "";
                                            try {
                                                const d = new Date(editingTenant.subscriptionEndDate);
                                                if (isNaN(d.getTime())) return "";
                                                return d.toISOString().split('T')[0];
                                            } catch {
                                                return "";
                                            }
                                        })()}
                                        onChange={(e) => {
                                            if (editingTenant) {
                                                const val = e.target.value;
                                                setEditingTenant({
                                                    ...editingTenant,
                                                    subscriptionEndDate: val ? new Date(val).toISOString() : undefined
                                                });
                                            }
                                        }}
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer text-slate-700"
                                    />
                                    {editingTenant?.subscriptionEndDate && (
                                        <button
                                            type="button"
                                            onClick={() => editingTenant && setEditingTenant({ ...editingTenant, subscriptionEndDate: undefined })}
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-500 uppercase tracking-wider hover:underline"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <p className="text-[9px] text-gray-400 px-1 font-medium">Leave blank for unlimited/perpetual access.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contact Name</label>
                                    <input
                                        type="text"
                                        value={editingTenant?.contactName || ""}
                                        onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, contactName: e.target.value })}
                                        placeholder="e.g. John Doe"
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300 text-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contact Phone</label>
                                    <input
                                        type="tel"
                                        value={editingTenant?.contactPhone || ""}
                                        onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, contactPhone: e.target.value })}
                                        placeholder="Phone Number"
                                        className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300 text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Feature Flags (Premium Modules)</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${editingTenant?.features?.smsEnabled !== false ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">SMS Alerts</span>
                                            <input type="checkbox" checked={editingTenant?.features?.smsEnabled !== false} onChange={(e) => editingTenant && setEditingTenant({...editingTenant, features: {...(editingTenant.features || {}), smsEnabled: e.target.checked}})} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                                        </div>
                                    </label>
                                    <label className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${editingTenant?.features?.biometricEnabled !== false ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Biometrics</span>
                                            <input type="checkbox" checked={editingTenant?.features?.biometricEnabled !== false} onChange={(e) => editingTenant && setEditingTenant({...editingTenant, features: {...(editingTenant.features || {}), biometricEnabled: e.target.checked}})} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                        </div>
                                    </label>
                                    <label className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${editingTenant?.features?.advancedAnalytics === true ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Analytics+</span>
                                            <input type="checkbox" checked={editingTenant?.features?.advancedAnalytics === true} onChange={(e) => editingTenant && setEditingTenant({...editingTenant, features: {...(editingTenant.features || {}), advancedAnalytics: e.target.checked}})} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Total Hostelars</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editingTenant?.totalHostelars || ""}
                                    onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, totalHostelars: e.target.value })}
                                    placeholder="e.g. 500"
                                    className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300 text-slate-700"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingTenant(null)}
                                    className="flex-1 p-5 rounded-2xl bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100"
                                >
                                    Abort
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 p-5 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-500/20 active:scale-95 transition-all"
                                >
                                    Commit Sync
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Registration Success (Boss Style) */}
            {registrationSuccessData && (
                <div className="fixed inset-0 bg-[#050510]/98 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-700">
                    <div className="bg-white w-full max-w-2xl rounded-[56px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in slide-in-from-bottom-24 duration-700">
                        <div className="bg-emerald-500 p-14 text-white relative">
                            <div className="absolute top-0 right-0 p-16 opacity-10">
                                <Zap className="w-48 h-48 rotate-12" />
                            </div>
                            <h3 className="text-5xl font-black uppercase tracking-tighter mb-4 leading-none">Node is Online.</h3>
                            <p className="text-emerald-100/60 text-xs font-black uppercase tracking-[0.4em]">{registrationSuccessData.name} Established</p>
                        </div>

                        <div className="p-14 space-y-12">
                            <div className="flex items-center gap-6 p-8 rounded-[40px] bg-slate-50 border border-slate-100">
                                <div className="w-16 h-16 bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 flex items-center justify-center">
                                    <Globe className="w-8 h-8 text-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Endpoint</p>
                                    <p className="text-2xl font-black text-slate-900 tracking-tight lowercase">
                                        {window.location.hostname.includes("hosteleaze.com") 
                                            ? `www.hosteleaze.com?tenant=${registrationSuccessData.slug}` 
                                            : `${window.location.host}?tenant=${registrationSuccessData.slug}`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => {
                                        const hostname = window.location.hostname;
                                        let url = "";
                                        if (hostname.includes("hosteleaze.com")) {
                                            url = `https://www.hosteleaze.com?tenant=${registrationSuccessData.slug}`;
                                        } else {
                                            url = `${window.location.protocol}//${window.location.host}/?tenant=${registrationSuccessData.slug}`;
                                        }
                                        window.open(url, '_blank');
                                    }} 
                                    className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-900 hover:text-white transition-all"
                                >
                                    <ArrowUpRight className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-8 rounded-[40px] bg-blue-50/50 border border-blue-100/50">
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Master Proxy Creds</p>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] text-blue-900/40 font-black uppercase mb-1">Login</p>
                                            <p className="text-sm font-black text-blue-900">{registrationSuccessData.adminEmail}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-900/40 font-black uppercase mb-1">Key</p>
                                            <code className="bg-blue-600 text-white px-3 py-1.5 rounded-xl font-black text-xs">{registrationSuccessData.defaultAdminPass}</code>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 rounded-[40px] bg-slate-900 border border-slate-800 shadow-2xl shadow-blue-900/20">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Boss Integration</p>
                                    <button 
                                        onClick={() => handleImpersonateAdmin(registrationSuccessData.slug)} 
                                        className="w-full py-5 bg-blue-600 rounded-3xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-blue-500 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Zap className="w-3.5 h-3.5 fill-current" />
                                        Launch Instant Proxy
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setRegistrationSuccessData(null)}
                                className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl transition-all hover:bg-black active:scale-[0.98]"
                            >
                                Confirm & Terminate Sync
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Deletion Confirmation Modal */}
            {deletingTenant && (
                <div className="fixed inset-0 bg-red-900/20 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden border border-red-100 animate-in zoom-in duration-500">
                        <div className="bg-red-600 p-10 text-white relative">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <Trash2 className="w-24 h-24" />
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">Critical Purge</h3>
                            <p className="text-red-100/60 text-[10px] font-black uppercase tracking-widest mt-1 italic">Permanent Database Destruction</p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="bg-red-50 border border-red-100 p-6 rounded-[28px] space-y-3">
                                <div className="flex items-center gap-3 text-red-600">
                                    <AlertCircle className="w-5 h-5" />
                                    <p className="text-xs font-black uppercase tracking-tight">Warning: Irreversible Action</p>
                                </div>
                                <p className="text-xs text-red-800 font-medium leading-relaxed">
                                    This will permanently delete <span className="font-black underline">{deletingTenant?.name || 'this node'}</span> and every single record associated with it, including students, attendance history, and gatepasses.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                        Type the following to confirm (You can copy this text):
                                    </label>
                                    <div className="bg-slate-100 p-4 rounded-2xl select-all cursor-text font-black text-slate-600 text-[11px] uppercase tracking-wider text-center border border-slate-200">
                                        DELETE {deletingTenant?.name?.toUpperCase()}
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="Type confirmation here..."
                                    className="w-full bg-slate-50 border-slate-100 p-5 rounded-2xl font-black text-center focus:ring-4 focus:ring-red-500/10 focus:bg-white outline-none transition-all uppercase tracking-widest text-xs"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setDeletingTenant(null);
                                        setDeleteConfirmText("");
                                    }}
                                    className="flex-1 p-5 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Abort
                                </button>
                                <button
                                    onClick={handleDeletePurge}
                                    disabled={
                                        isDeleting || 
                                        !deletingTenant ||
                                        deleteConfirmText.trim().toUpperCase().replace(/\s+/g, ' ') !== `DELETE ${deletingTenant?.name?.toUpperCase()}`.trim().replace(/\s+/g, ' ')
                                    }
                                    className="flex-1 p-5 rounded-2xl bg-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-30 disabled:grayscale transition-all"
                                >
                                    {isDeleting ? "Purging..." : "Confirm Purge"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Broadcast Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden border border-white animate-in zoom-in duration-500">
                        <div className="bg-indigo-600 p-10 text-white relative">
                            <h3 className="text-3xl font-black uppercase tracking-tighter">Global Broadcast</h3>
                            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-1">Push Alert to All Nodes</p>
                            <button onClick={() => setShowBroadcastModal(false)} className="absolute top-10 right-10 text-indigo-300 hover:text-white transition-colors bg-white/10 h-10 w-10 rounded-full flex items-center justify-center hover:rotate-90">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleBroadcast} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Broadcast Type</label>
                                <select 
                                    value={broadcastType} 
                                    onChange={(e) => setBroadcastType(e.target.value as any)}
                                    className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all text-slate-700"
                                >
                                    <option value="info">Information (Blue)</option>
                                    <option value="warning">Warning (Yellow)</option>
                                    <option value="alert">Critical Alert (Red)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Message Content (Leave empty to clear)</label>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    placeholder="System will be undergoing maintenance..."
                                    className="w-full bg-slate-50 border-transparent p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-gray-300 min-h-[120px] text-slate-700"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isBroadcasting}
                                className="w-full p-5 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all"
                            >
                                {isBroadcasting ? "Transmitting..." : "Send Broadcast"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Boss Payment Settings Modal */}
            {showPaymentSettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-sans">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Payment Configuration</h3>
                                <p className="text-xs text-gray-500 font-medium">Control what colleges see when they renew subscriptions</p>
                            </div>
                            <button onClick={() => setShowPaymentSettingsModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-100">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 sm:p-8 flex-1 custom-scrollbar">
                            <form id="payment-settings-form" onSubmit={savePaymentSettings} className="space-y-8">
                                {/* Razorpay Toggle Section */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 relative overflow-hidden">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div>
                                            <h4 className="font-black text-indigo-900 text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                                                <CreditCard className="w-4 h-4" /> Razorpay Integration
                                            </h4>
                                            <p className="text-xs text-indigo-700/70 font-medium">Enable to allow colleges to pay instantly via Razorpay.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={paymentSettings.enableRazorpay}
                                                onChange={e => setPaymentSettings({...paymentSettings, enableRazorpay: e.target.checked})}
                                            />
                                            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                                        </label>
                                    </div>
                                    
                                    {paymentSettings.enableRazorpay && (
                                        <div className="mt-4 pt-4 border-t border-indigo-100/50 animate-in slide-in-from-top-2 relative z-10 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-black text-indigo-900 uppercase tracking-widest mb-2">Razorpay Key ID</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={paymentSettings.razorpayKeyId || ""}
                                                        onChange={e => setPaymentSettings({...paymentSettings, razorpayKeyId: e.target.value})}
                                                        className="w-full border-2 border-indigo-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono font-bold bg-white text-indigo-900"
                                                        placeholder="rzp_test_..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-indigo-900 uppercase tracking-widest mb-2">Razorpay Key Secret</label>
                                                    <input
                                                        type="password"
                                                        required
                                                        value={paymentSettings.razorpayKeySecret || ""}
                                                        onChange={e => setPaymentSettings({...paymentSettings, razorpayKeySecret: e.target.value})}
                                                        className="w-full border-2 border-indigo-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono font-bold bg-white text-indigo-900"
                                                        placeholder="••••••••••••••••••••••••"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-black text-indigo-900 uppercase tracking-widest mb-2">Subscription Price per Student per Month (INR)</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <span className="text-indigo-500 font-bold">₹</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="1"
                                                        value={paymentSettings.pricePerStudentPerMonth || 30}
                                                        onChange={e => setPaymentSettings({...paymentSettings, pricePerStudentPerMonth: Number(e.target.value)})}
                                                        className="w-full border-2 border-indigo-100 rounded-xl pl-9 pr-4 py-3 text-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-black bg-white text-indigo-900"
                                                        placeholder="30"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-indigo-600 mt-2 font-medium">This will be multiplied by the college's student count and automatically billed via Razorpay Orders.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Direct Bank Transfer Section */}
                                <div>
                                    <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Direct Bank Transfer Details</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Bank Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={paymentSettings.bankName}
                                                onChange={e => setPaymentSettings({...paymentSettings, bankName: e.target.value})}
                                                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold"
                                                placeholder="e.g. PNB Bank"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Account Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={paymentSettings.accountName}
                                                onChange={e => setPaymentSettings({...paymentSettings, accountName: e.target.value})}
                                                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold"
                                                placeholder="e.g. DR. PANKAJ DWIVEDI"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Account Number</label>
                                            <input
                                                type="text"
                                                required
                                                value={paymentSettings.accountNumber}
                                                onChange={e => setPaymentSettings({...paymentSettings, accountNumber: e.target.value})}
                                                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold font-mono tracking-wider"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">IFSC Code</label>
                                            <input
                                                type="text"
                                                required
                                                value={paymentSettings.ifsc}
                                                onChange={e => setPaymentSettings({...paymentSettings, ifsc: e.target.value})}
                                                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold uppercase font-mono tracking-wider"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">UPI ID</label>
                                            <input
                                                type="text"
                                                required
                                                value={paymentSettings.upiId}
                                                onChange={e => setPaymentSettings({...paymentSettings, upiId: e.target.value})}
                                                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-blue-600"
                                                placeholder="username@bank"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Custom QR Code Image (Optional)</label>
                                            <div className="flex items-center gap-4">
                                                {paymentSettings.customQrCodeUrl && paymentSettings.customQrCodeUrl.startsWith('data:image') && (
                                                    <div className="w-16 h-16 rounded-xl border-2 border-gray-100 overflow-hidden shrink-0 shadow-sm">
                                                        <img src={paymentSettings.customQrCodeUrl} alt="QR Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    setPaymentSettings({ ...paymentSettings, customQrCodeUrl: reader.result as string });
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="w-full border-2 border-gray-100 rounded-xl px-2 py-1.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:uppercase file:tracking-wider file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                                    />
                                                    <p className="text-[10px] text-gray-400 mt-2 font-medium leading-relaxed">Upload a QR code image directly from your gallery or computer. If provided, this will override the auto-generated UPI QR code.</p>
                                                </div>
                                                {paymentSettings.customQrCodeUrl && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setPaymentSettings({ ...paymentSettings, customQrCodeUrl: "" })}
                                                        className="text-[10px] text-red-600 hover:text-red-700 font-black uppercase tracking-widest px-4 py-3 border-2 border-red-100 hover:border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowPaymentSettingsModal(false)}
                                className="px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="payment-settings-form"
                                disabled={isSavingPaymentSettings}
                                className="px-8 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                            >
                                {isSavingPaymentSettings ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
