"use client";

import { useState, useEffect } from "react";
import { showToast, showConfirm, showPrompt } from "@/lib/toast";
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
    LogOut,
    Activity,
    X,
    TrendingUp,
    BarChart3,
    ArrowUpRight,
    Lock,
    Zap,
    Database,
    Loader2,
    Edit3,
    FileText
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
    storageQuotaMb?: number;
    contactName?: string;
    contactPhone?: string;
    isDeleted?: boolean;
    healthScore?: number;
}

// ⚡ LIVE SWITCH COMPONENT (SUPABASE ↔ RAILWAY)
const LiveDbSwitch = () => {
    const [source, setSource] = useState<'RAILWAY' | 'SUPABASE' | 'MONGODB' | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/admin/active-db')
            .then(res => {
                if (!res.ok) throw new Error("Server returned error");
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Server returned non-JSON response");
                }
                return res.json();
            })
            .then(data => setSource(data.source))
            .catch(err => {
                console.error("Failed to load active db source, falling back to SUPABASE:", err);
                setSource('SUPABASE');
            });
    }, []);

    const toggle = async () => {
        if (!source) return;
        const newSource = source === 'RAILWAY' ? 'SUPABASE' : 'RAILWAY';
        
        // ⚠️ Enforce Typed Affirmation
        const doubleCheck = await showPrompt(`⚠️ WARNING: YOU ARE ABOUT TO SWITCH GLOBAL ACTIVE DATABASE TO ${newSource} FOR ALL USERS.\n\nTo confirm, type the word "SWITCH" below:`);
        if (doubleCheck !== "SWITCH") {
            showToast("Database switch aborted.", "warning");
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
                showToast(`Switched active database to ${data.source}`, "success");
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast("Failed: " + data.error, "error");
            }
        } catch (e: any) {
            showToast("Error: " + e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    if (!source) return <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Loading DB...</span>;

    return (
        <button
            onClick={toggle}
            disabled={loading}
            title={`Current Active DB: ${source}. Click to switch to ${source === 'RAILWAY' ? 'SUPABASE' : 'RAILWAY'}`}
            className={`h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 flex items-center gap-1.5 justify-center w-full sm:w-auto ${
                source === 'RAILWAY'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
            }`}
        >
            {loading ? 'Switching...' : (
                <>
                    <span className={`w-2 h-2 rounded-full ${source === 'RAILWAY' ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500 animate-pulse'}`}></span>
                    {source === 'RAILWAY' ? 'RAILWAY' : 'SUPABASE'}
                </>
            )}
        </button>
    );
};

// ⚡ SYNC DATABASES COMPONENT (SUPABASE ↔ RAILWAY)
const SyncDbButton = () => {
    const [showModal, setShowModal] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [direction, setDirection] = useState<'TWO_WAY' | 'RAILWAY_TO_SUPABASE' | 'SUPABASE_TO_RAILWAY'>('TWO_WAY');

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/sync-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ direction })
            });
            const data = await res.json();

            if (data.success) {
                showToast(data.message || "Databases synced successfully!", "success");
                
                // Write Audit Log
                await fetch('/api/super-admin/audit-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: "SYNC_DATABASES",
                        details: `Executed database sync (${direction}) between Supabase and Railway`,
                        user: "Super Admin"
                    })
                });

                setShowModal(false);
            } else {
                showToast("Sync failed: " + (data.error || "Unknown error"), "error");
            }
        } catch (e: any) {
            showToast("Error executing sync: " + e.message, "error");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="relative inline-block text-left">
            <button
                onClick={() => setShowModal(!showModal)}
                disabled={syncing}
                title="Sync data between Railway and Supabase PostgreSQL"
                className="h-10 sm:h-11 px-3 sm:px-4 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5 justify-center w-full sm:w-auto"
            >
                <Zap className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span>{syncing ? 'Syncing...' : 'Sync DB'}</span>
            </button>

            {showModal && (
                <>
                    {/* Transparent Click-outside overlay (NO dark background screen) */}
                    <div 
                        className="fixed inset-0 z-40 bg-transparent" 
                        onClick={() => !syncing && setShowModal(false)}
                    />

                    {/* Floating Dropdown Card: centered inset-x-3 on mobile, absolute right-0 on desktop */}
                    <div className="fixed inset-x-3 top-24 sm:top-auto sm:inset-x-auto sm:absolute sm:right-0 sm:mt-2 z-50 bg-white rounded-2xl w-auto sm:w-96 max-w-md sm:max-w-none p-4 shadow-2xl border border-purple-200 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-purple-600 shrink-0" />
                                <h3 className="font-black text-gray-900 text-xs uppercase tracking-wide">Live Database Sync Tool</h3>
                            </div>
                            <button 
                                onClick={() => !syncing && setShowModal(false)} 
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-[11px] text-gray-600 font-medium leading-normal">
                            Sync live datasets (students, attendance, gate passes, settings) between <strong>Supabase</strong> and <strong>Railway PostgreSQL</strong>.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Select Sync Direction:</label>
                            <div className="grid grid-cols-1 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setDirection('TWO_WAY')}
                                    className={`p-2 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                                        direction === 'TWO_WAY'
                                            ? 'border-purple-500 bg-purple-50 text-purple-900 ring-1 ring-purple-300'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
                                    <div>
                                        <div className="font-extrabold text-[11px]">🔄 Two-Way Full Sync</div>
                                        <div className="text-[9px] text-gray-500 font-normal">Make both databases 100% equal.</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setDirection('RAILWAY_TO_SUPABASE')}
                                    className={`p-2 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                                        direction === 'RAILWAY_TO_SUPABASE'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                    <div>
                                        <div className="font-extrabold text-[11px]">🟢 Railway ➔ Supabase</div>
                                        <div className="text-[9px] text-gray-500 font-normal">Copy Railway records to Supabase.</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setDirection('SUPABASE_TO_RAILWAY')}
                                    className={`p-2 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                                        direction === 'SUPABASE_TO_RAILWAY'
                                            ? 'border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-300'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></span>
                                    <div>
                                        <div className="font-extrabold text-[11px]">🟠 Supabase ➔ Railway</div>
                                        <div className="text-[9px] text-gray-500 font-normal">Copy Supabase records to Railway.</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t">
                            <button
                                type="button"
                                disabled={syncing}
                                onClick={() => setShowModal(false)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={syncing}
                                onClick={handleSync}
                                className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                            >
                                {syncing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Syncing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-3.5 h-3.5" />
                                        <span>Start Sync</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ⚡ BULK FACE EMBEDDINGS GENERATOR COMPONENT (PRE-CALCULATE ALL VECTOR DESCRIPTORS)
const GenerateEmbeddingsButton = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressStatus, setProgressStatus] = useState("");
    const [processedCount, setProcessedCount] = useState(0);
    const [totalMissing, setTotalMissing] = useState(0);

    const handleGenerateEmbeddings = async () => {
        try {
            setIsGenerating(true);
            setProgressStatus("Checking student face vectors...");

            // 1. Fetch missing students list
            const checkRes = await fetch("/api/admin/generate-face-descriptors");
            const checkData = await checkRes.json();

            if (!checkData.success) {
                throw new Error(checkData.error || "Failed to query missing vectors");
            }

            const missing = checkData.missingStudents || [];
            if (missing.length === 0) {
                showToast("🎉 All student face vectors are 100% pre-calculated!", "success");
                setIsGenerating(false);
                return;
            }

            setTotalMissing(missing.length);
            setProgressStatus(`Found ${missing.length} missing vectors. Loading AI face model...`);

            // 2. Load face-api models dynamically
            const faceMatching = await import("@/lib/faceMatching");
            await faceMatching.loadFaceApiModels(true);

            // 3. Process missing students in batches
            let batchUpdates: any[] = [];
            let currentProcessed = 0;
            let totalSaved = 0;

            for (const student of missing) {
                currentProcessed++;
                setProcessedCount(currentProcessed);
                setProgressStatus(`Processing ${currentProcessed}/${missing.length}: ${student.name}`);

                if (student.profilePicture) {
                    try {
                        const img = await faceMatching.loadImage(student.profilePicture);
                        const res = await faceMatching.detectFace(img, true);
                        if (res && res.descriptor) {
                            batchUpdates.push({
                                studentId: student.id,
                                firebaseUID: student.firebaseUID,
                                faceDescriptor: Array.from(res.descriptor)
                            });
                        }
                    } catch (err) {
                        console.warn(`Could not extract face descriptor for ${student.name}`);
                    }
                }

                // Push updates in batches of 15
                if (batchUpdates.length >= 15 || currentProcessed === missing.length) {
                    if (batchUpdates.length > 0) {
                        setProgressStatus(`Saving ${batchUpdates.length} face vectors to Railway & Supabase...`);
                        const saveRes = await fetch("/api/admin/generate-face-descriptors", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ updates: batchUpdates })
                        });
                        const saveData = await saveRes.json();
                        if (saveData.success) {
                            totalSaved += saveData.updatedCount || batchUpdates.length;
                        }
                        batchUpdates = [];
                    }
                }
            }

            showToast(`🎉 Pre-calculated and saved ${totalSaved} face vectors! Instant <30ms verification ready.`, "success");
        } catch (error: any) {
            console.error("Error generating face embeddings:", error);
            showToast("Embedding generation error: " + (error.message || "Failed"), "error");
        } finally {
            setIsGenerating(false);
            setProgressStatus("");
            setProcessedCount(0);
            setTotalMissing(0);
        }
    };

    return (
        <button
            onClick={handleGenerateEmbeddings}
            disabled={isGenerating}
            title="Pre-calculate 128-D face embeddings for all students to enable instant <30ms verification"
            className="h-10 sm:h-11 px-3 sm:px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5 justify-center w-full sm:w-auto"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>{processedCount > 0 ? `${processedCount}/${totalMissing}` : "Loading AI..."}</span>
                </>
            ) : (
                <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>⚡ AI Face Vectors</span>
                </>
            )}
        </button>
    );
};

export default function SuperAdminDashboard() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [viewMode, setViewMode] = useState<"active" | "recycle" | "audit" | "billing" | "expired">("active");
    const [globalStats, setGlobalStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showExpiredAlert, setShowExpiredAlert] = useState(true);

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedAuditTimestamps, setSelectedAuditTimestamps] = useState<string[]>([]);
    const [isDeletingLogs, setIsDeletingLogs] = useState(false);

    const fetchAuditLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch("/api/super-admin/audit-logs");
            const data = await res.json();
            if (data.success) {
                setAuditLogs(data.logs);
                setSelectedAuditTimestamps([]);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleToggleAuditLog = (timestamp: string) => {
        setSelectedAuditTimestamps(prev => 
            prev.includes(timestamp) ? prev.filter(t => t !== timestamp) : [...prev, timestamp]
        );
    };

    const handleSelectAllAuditLogs = () => {
        if (selectedAuditTimestamps.length === auditLogs.length && auditLogs.length > 0) {
            setSelectedAuditTimestamps([]);
        } else {
            setSelectedAuditTimestamps(auditLogs.map(l => l.timestamp));
        }
    };

    const handleDeleteSelectedAuditLogs = async () => {
        if (selectedAuditTimestamps.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedAuditTimestamps.length} selected audit log(s) permanently from Supabase server?`)) return;

        setIsDeletingLogs(true);
        try {
            const res = await fetch("/api/super-admin/audit-logs", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timestamps: selectedAuditTimestamps })
            });
            const data = await res.json();
            if (data.success) {
                setAuditLogs(data.logs || []);
                setSelectedAuditTimestamps([]);
                alert(`Successfully deleted ${selectedAuditTimestamps.length} audit logs from Supabase server!`);
            } else {
                alert("Failed to delete logs: " + data.error);
            }
        } catch (e: any) {
            alert("Failed to delete selected audit logs");
        } finally {
            setIsDeletingLogs(false);
        }
    };

    const handleClearAllAuditLogs = async () => {
        if (auditLogs.length === 0) return;
        if (!confirm("⚠️ WARNING: Are you sure you want to PERMANENTLY PURGE ALL audit logs from Supabase server? This will free up memory and cannot be undone.")) return;

        setIsDeletingLogs(true);
        try {
            const res = await fetch("/api/super-admin/audit-logs", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clearAll: true })
            });
            const data = await res.json();
            if (data.success) {
                setAuditLogs([]);
                setSelectedAuditTimestamps([]);
                alert("All audit logs successfully purged from Supabase server!");
            } else {
                alert("Failed to clear logs: " + data.error);
            }
        } catch (e: any) {
            alert("Failed to clear audit logs");
        } finally {
            setIsDeletingLogs(false);
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
    const [softDeletingTenant, setSoftDeletingTenant] = useState<Tenant | null>(null);
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
        discount1Month: 0,
        discount3Month: 5,
        discount6Month: 10,
        discount12Month: 20,
        bankTransferDiscount: 2.5,
        supportWhatsappNumber: "8269418956",
        customQrCodeUrl: "",
        globalPushEnabled: true,
        parentCurfewAbsentEnabled: true,
        parentGateScanInOutEnabled: true,
        wardenLeaveRequestEnabled: true,
        deanLeaveRequestEnabled: true,
        studentLeaveDecisionEnabled: true,
        curfewStart: "21:30",
        curfewEnd: "22:30",
        gracePeriodMinutes: 15,
        parentConsentVideoUploadedEnabled: true,
        outingOverdueEnabled: true,
        paymentVerifiedEnabled: true,
        leaveDecisionEnabled: true,
        outingGracePeriod: 30,
        absoluteOutingCutoff: "20:30",
        enforceMandatoryPush: false
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

    const [billingLogs, setBillingLogs] = useState<any[]>([]);
    const [loadingBilling, setLoadingBilling] = useState(false);
    const [dnsStatus, setDnsStatus] = useState<Record<string, 'resolved' | 'pending' | 'checking'>>({});

    // Billing details states in edit modal
    const [modalBillingType, setModalBillingType] = useState<"Verified Payment" | "Complimentary" | "Deferred Billing (On Credit)">("Verified Payment");
    const [modalAmount, setModalAmount] = useState<string>("");
    const [modalUtr, setModalUtr] = useState<string>("");
    const [modalBillingPeriod, setModalBillingPeriod] = useState<string>("1 Year");
    const [modalRemarks, setModalRemarks] = useState<string>("");
    const [recordBillingEntry, setRecordBillingEntry] = useState<boolean>(true);

    const fetchBillingLedger = async () => {
        setLoadingBilling(true);
        try {
            const res = await fetch("/api/super-admin/billing-ledger");
            const data = await res.json();
            if (data.success) {
                setBillingLogs(data.logs);
            }
        } catch (error) {
            console.error("Failed to fetch billing ledger", error);
        } finally {
            setLoadingBilling(false);
        }
    };

    // Manual Invoice Generation & Editing State (Boss Control)
    const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);
    const [invoiceModalMode, setInvoiceModalMode] = useState<"create" | "edit">("create");
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [invoiceTenantId, setInvoiceTenantId] = useState<string>("");
    const [invoiceTenantName, setInvoiceTenantName] = useState<string>("");
    const [invoiceAmount, setInvoiceAmount] = useState<string>("");
    const [invoiceUtr, setInvoiceUtr] = useState<string>("");
    const [invoiceDate, setInvoiceDate] = useState<string>("");
    const [invoiceBillingType, setInvoiceBillingType] = useState<"Verified Payment" | "Complimentary" | "Deferred Billing (On Credit)">("Verified Payment");
    const [invoicePaymentSource, setInvoicePaymentSource] = useState<string>("Direct Bank / UPI Transfer (UTR Verified)");
    const [invoiceBillingPeriod, setInvoiceBillingPeriod] = useState<string>("1 Year");
    const [invoiceRemarks, setInvoiceRemarks] = useState<string>("");
    const [invoiceExtraDiscountType, setInvoiceExtraDiscountType] = useState<"percent" | "amount">("amount");
    const [invoiceExtraDiscountValue, setInvoiceExtraDiscountValue] = useState<string>("");
    const [isSavingInvoice, setIsSavingInvoice] = useState<boolean>(false);
    const [isDeletingInvoiceId, setIsDeletingInvoiceId] = useState<string | null>(null);

    const handleOpenCreateInvoiceModal = () => {
        setInvoiceModalMode("create");
        setSelectedInvoiceId(null);
        if (tenants.length > 0) {
            const firstT = tenants[0];
            setInvoiceTenantId((firstT as any)._id || (firstT as any).id || firstT.slug);
            setInvoiceTenantName(firstT.name);
        } else {
            setInvoiceTenantId("");
            setInvoiceTenantName("");
        }
        setInvoiceAmount("");
        setInvoiceExtraDiscountType("amount");
        setInvoiceExtraDiscountValue("");
        setInvoiceUtr("");
        setInvoiceDate(new Date().toISOString().split("T")[0]);
        setInvoiceBillingType("Verified Payment");
        setInvoicePaymentSource("Direct Bank / UPI Transfer (UTR Verified)");
        setInvoiceBillingPeriod("1 Year");
        setInvoiceRemarks("");
        setInvoiceModalOpen(true);
    };

    const handleOpenEditInvoiceModal = (log: any) => {
        setInvoiceModalMode("edit");
        setSelectedInvoiceId(log.id);
        setInvoiceTenantId(log.tenantId || "");
        setInvoiceTenantName(log.tenantName || "");
        setInvoiceAmount(log.amount !== undefined ? String(log.amount) : "");
        if (log.extraDiscountType === "amount" || (log.extraDiscountAmount && Number(log.extraDiscountAmount) > 0)) {
            setInvoiceExtraDiscountType("amount");
            setInvoiceExtraDiscountValue(String(log.extraDiscountAmount || log.extraDiscountValue || ""));
        } else if (log.extraDiscountPercent && Number(log.extraDiscountPercent) > 0) {
            setInvoiceExtraDiscountType("percent");
            setInvoiceExtraDiscountValue(String(log.extraDiscountPercent));
        } else {
            setInvoiceExtraDiscountType("amount");
            setInvoiceExtraDiscountValue("");
        }
        setInvoiceUtr(log.utr || "");
        setInvoiceDate(log.date ? new Date(log.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
        setInvoiceBillingType(log.billingType || "Verified Payment");
        setInvoicePaymentSource(log.paymentSource || "Direct Bank / UPI Transfer (UTR Verified)");
        setInvoiceBillingPeriod(log.billingPeriod || "1 Year");
        setInvoiceRemarks(log.remarks || "");
        setInvoiceModalOpen(true);
    };

    const handleSaveInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoiceTenantId) {
            showToast("Please select a college / tenant", "error");
            return;
        }

        setIsSavingInvoice(true);
        try {
            const discountNum = Number(invoiceExtraDiscountValue) || 0;
            const payload = {
                id: selectedInvoiceId,
                tenantId: invoiceTenantId,
                tenantName: invoiceTenantName,
                amount: Number(invoiceAmount) || 0,
                extraDiscountType: invoiceExtraDiscountType,
                extraDiscountValue: discountNum,
                extraDiscountPercent: invoiceExtraDiscountType === "percent" ? discountNum : 0,
                extraDiscountAmount: invoiceExtraDiscountType === "amount" ? discountNum : 0,
                utr: invoiceUtr,
                date: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
                billingType: invoiceBillingType,
                paymentSource: invoicePaymentSource,
                billingPeriod: invoiceBillingPeriod,
                remarks: invoiceRemarks
            };

            const method = invoiceModalMode === "create" ? "POST" : "PUT";
            const res = await fetch("/api/super-admin/billing-ledger", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                setBillingLogs(data.logs);
                showToast(
                    invoiceModalMode === "create"
                        ? "New invoice generated and published to tenant!"
                        : "Invoice successfully updated!",
                    "success"
                );
                setInvoiceModalOpen(false);
            } else {
                showToast(data.error || "Failed to save invoice", "error");
            }
        } catch (error: any) {
            showToast(error.message || "Failed to save invoice", "error");
        } finally {
            setIsSavingInvoice(false);
        }
    };

    const handleDeleteInvoice = async (id: string, tenantName: string) => {
        if (!confirm(`Are you sure you want to permanently delete this invoice for ${tenantName}? It will immediately be removed from the tenant portal.`)) {
            return;
        }

        setIsDeletingInvoiceId(id);
        try {
            const res = await fetch(`/api/super-admin/billing-ledger?id=${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                setBillingLogs(data.logs);
                showToast("Invoice permanently removed from ledger & tenant view", "success");
            } else {
                showToast(data.error || "Failed to delete invoice", "error");
            }
        } catch (error: any) {
            showToast(error.message || "Failed to delete invoice", "error");
        } finally {
            setIsDeletingInvoiceId(null);
        }
    };

    const checkTenantDns = async (slug: string, isManual = false) => {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : "hosteleaze.com";
        const domain = currentHost.includes("localhost") ? "localhost" : "hosteleaze.com";
        setDnsStatus(prev => ({ ...prev, [slug]: 'checking' }));
        try {
            const res = await fetch("/api/super-admin/tenants/dns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain })
            });
            const data = await res.json();
            if (data.resolved) {
                setDnsStatus(prev => ({ ...prev, [slug]: 'resolved' }));
                if (isManual) {
                    showToast(`Domain & Node operational for ${slug} (${getTenantDisplayUrl(slug)})`, "success");
                }
            } else {
                setDnsStatus(prev => ({ ...prev, [slug]: 'pending' }));
                if (isManual) {
                    showToast(`DNS check failed for ${slug}`, "error");
                }
            }
        } catch (error: any) {
            setDnsStatus(prev => ({ ...prev, [slug]: 'pending' }));
            if (isManual) {
                showToast(`DNS check error: ${error?.message || "Unknown error"}`, "error");
            }
        }
    };

    useEffect(() => {
        if (tenants.length > 0) {
            tenants.forEach(tenant => {
                if (!dnsStatus[tenant.slug]) {
                    checkTenantDns(tenant.slug);
                }
            });
        }
    }, [tenants]);

    useEffect(() => {
        if (editingTenant) {
            const count = editingTenant.studentCount || 0;
            const price = paymentSettings.pricePerStudentPerMonth || 30;
            const calculatedYearly = count * price * 12;

            setModalBillingType("Verified Payment");
            setModalAmount(calculatedYearly > 0 ? String(calculatedYearly) : "");
            setModalUtr(editingTenant.renewalUtr || "");
            setModalBillingPeriod("1 Year");
            setModalRemarks("");
            setRecordBillingEntry(editingTenant.subscriptionStatus !== 'active');
        }
    }, [editingTenant, paymentSettings]);

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
            const isExpiredView = viewMode === 'expired';
            const isRecycleView = viewMode === 'recycle';
            const res = await fetch(`/api/super-admin/tenants${isRecycleView ? '?deleted=true' : ''}`);
            const data = await res.json();
            if (data.success) {
                // Compute a health score (0–100) per tenant
                const tenantsWithHealth = data.tenants.map((t: any) => {
                    let score = 0;
                    // 30pts: subscription active
                    if (t.subscriptionStatus === 'active') score += 30;
                    else if (t.subscriptionStatus === 'trial') score += 15;
                    // 30pts: has students registered
                    if ((t.studentCount || 0) > 50) score += 30;
                    else if ((t.studentCount || 0) > 0) score += 15;
                    // 20pts: has contact details
                    if (t.contactName && t.contactPhone) score += 20;
                    // 10pts: is active/online
                    if (t.isActive) score += 10;
                    // 10pts: storage not critical (< 80% of 100MB)
                    if (!t.storageBytes || t.storageBytes < 80 * 1024 * 1024) score += 10;
                    return { ...t, healthScore: score };
                });
                // Filter for expired view
                const filtered = isExpiredView
                    ? tenantsWithHealth.filter((t: any) => t.subscriptionStatus === 'expired' && !t.isDeleted)
                    : tenantsWithHealth;
                setTenants(filtered);
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
                    customQrCodeUrl: data.settings.customQrCodeUrl || "",
                    globalPushEnabled: data.settings.globalPushEnabled !== false,
                    parentCurfewAbsentEnabled: data.settings.parentCurfewAbsentEnabled !== false,
                    parentGateScanInOutEnabled: data.settings.parentGateScanInOutEnabled !== false,
                    wardenLeaveRequestEnabled: data.settings.wardenLeaveRequestEnabled !== false,
                    deanLeaveRequestEnabled: data.settings.deanLeaveRequestEnabled !== false,
                    studentLeaveDecisionEnabled: data.settings.studentLeaveDecisionEnabled !== false,
                    curfewStart: data.settings.curfewStart || "21:30",
                    curfewEnd: data.settings.curfewEnd || "22:30",
                    gracePeriodMinutes: data.settings.gracePeriodMinutes ?? 15,
                    parentConsentVideoUploadedEnabled: data.settings.parentConsentVideoUploadedEnabled !== false,
                    outingOverdueEnabled: data.settings.outingOverdueEnabled !== false,
                    paymentVerifiedEnabled: data.settings.paymentVerifiedEnabled !== false,
                    leaveDecisionEnabled: data.settings.leaveDecisionEnabled !== false,
                    outingGracePeriod: data.settings.outingGracePeriod ?? 30,
                    absoluteOutingCutoff: data.settings.absoluteOutingCutoff || "20:30",
                    enforceMandatoryPush: data.settings.enforceMandatoryPush === true
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
            fetchBillingLedger();
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
                alert(`University Node successfully ${!currentStatus ? 'activated' : 'deactivated'}.`);
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
        try {
            const res = await fetch(`/api/super-admin/tenants?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                const t = tenants.find(x => x._id === id);
                logAdminAction("SOFT_DELETE_NODE", `Moved university node '${t?.slug || id}' to Recycle Bin`);
                setTenants(tenants.filter(t => t._id !== id));
                alert("University Node successfully moved to the Recycle Bin.");
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
                    createdAt: editingTenant.createdAt || null,
                    contactName: editingTenant.contactName,
                    contactPhone: editingTenant.contactPhone,
                    totalHostelars: editingTenant.totalHostelars,
                    features: editingTenant.features,
                    storageQuotaMb: editingTenant.storageQuotaMb || 100
                })
            });
            const data = await res.json();
            if (data.success) {
                logAdminAction("CONFIGURE_NODE", `Updated settings and details for university node '${editingTenant.slug}'`);
                
                if (recordBillingEntry && editingTenant.subscriptionStatus === 'active') {
                    await fetch("/api/super-admin/billing-ledger", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            tenantId: editingTenant._id,
                            tenantName: editingTenant.name,
                            amount: modalBillingType === 'Verified Payment' ? Number(modalAmount) || 0 : 0,
                            utr: modalBillingType === 'Verified Payment' ? modalUtr : "",
                            billingType: modalBillingType,
                            billingPeriod: modalBillingPeriod,
                            remarks: modalRemarks || `Subscription Activated (${modalBillingType})`
                        })
                    });
                    fetchBillingLedger();
                }

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
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200 shrink-0 overflow-hidden border border-gray-100">
                        <img src="/logo.jpeg" alt="Hosteleaze Logo" className="w-full h-full object-cover" />
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

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
                    <div className="h-10 sm:h-11 px-3 sm:px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-sm justify-center w-full sm:w-auto">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                        <span>Pulse: {globalStats?.totalActiveTraffic || 0} <span className="text-[8px] font-bold opacity-60 italic">Att/M</span></span>
                    </div>

                    <LiveDbSwitch />
                    <SyncDbButton />
                    <GenerateEmbeddingsButton />

                    <button
                        onClick={async () => {
                            const doubleCheck = await showPrompt("⚠️ WARNING: This will trigger a full database migration from MongoDB to Supabase. This should ONLY be run once.\n\nTo confirm, type the word \"MIGRATE\" below:");
                            if (doubleCheck !== "MIGRATE") {
                                showToast("Migration aborted.", "warning");
                                return;
                            }

                            try {
                                const res = await fetch('/api/admin/migrate-db', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    showToast(data.message || "Migration completed successfully!", "success");
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
                                    showToast("Migration breakdown: " + data.error, "error");
                                }
                            } catch (e: any) {
                                showToast("Critical Error: " + e.message, "error");
                            }
                        }}
                        className="h-10 sm:h-11 px-3 sm:px-4 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-purple-100 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 justify-center w-full sm:w-auto"
                    >
                        🚀 Migration
                    </button>

                    <button
                        onClick={() => {
                            localStorage.removeItem("superadmin_session");
                            setIsAuthorized(false);
                        }}
                        className="h-10 sm:h-11 px-3 sm:px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 rounded-xl font-black flex items-center gap-1.5 transition-all active:scale-95 text-[10px] sm:text-xs uppercase tracking-widest justify-center w-full sm:w-auto"
                    >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>Log Out</span>
                    </button>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="h-10 sm:h-11 col-span-2 sm:col-auto px-4 sm:px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-[10px] sm:text-xs uppercase tracking-widest justify-center w-full sm:w-auto"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="whitespace-nowrap">Provision Node</span>
                    </button>
                </div>
            </header>

            {/* ⚠️ EXPIRED TENANTS ALERT BANNER */}
            {showExpiredAlert && (() => {
                const expiredCount = tenants.filter(t => t.subscriptionStatus === 'expired' && !t.isDeleted).length;
                if (expiredCount === 0) return null;
                return (
                    <div className="mx-4 sm:mx-8 mt-4 bg-gradient-to-r from-rose-500 to-red-600 text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-rose-200 animate-in slide-in-from-top">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest">
                                    ⚠️ {expiredCount} Tenant{expiredCount > 1 ? 's' : ''} with Expired Subscription
                                </p>
                                <p className="text-[10px] text-rose-100 font-medium">
                                    These institutions may have lost access. Review and renew their subscriptions.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setViewMode('expired')}
                                className="px-3 py-1.5 bg-white text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                            >
                                View All
                            </button>
                            <button
                                onClick={() => setShowExpiredAlert(false)}
                                className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs font-black transition-all"
                            >✕</button>
                        </div>
                    </div>
                );
            })()}

            <div className="px-4 sm:px-8 pt-6 sm:pt-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
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
                    ].map((stat, i, arr) => (
                        <div key={i} className={`bg-white p-2.5 sm:p-7 rounded-[16px] sm:rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/40 transition-all duration-500 group ${
                            i === arr.length - 1 ? 'col-span-2 sm:col-span-1' : ''
                        }`}>
                            <div className="flex justify-between items-center mb-2 sm:mb-4">
                                <div className={`w-6 h-6 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600 group-hover:bg-${stat.color}-600 group-hover:text-white transition-colors`}>
                                    <stat.icon className="w-3 h-3 sm:w-6 sm:h-6" />
                                </div>
                                <div className={`text-[6px] sm:text-[10px] font-black px-1 py-0.5 sm:px-2 sm:py-1 rounded sm:rounded-lg bg-${stat.color}-50 text-${stat.color}-600 uppercase tracking-tighter leading-none`}>
                                    {stat.trend}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-3xl font-black text-gray-900 leading-none tracking-tighter">{stat.value}</h3>
                                <p className="text-[7px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{stat.label}</p>
                                <p className="hidden sm:block text-[8px] sm:text-[9px] text-gray-300 font-medium italic mt-2 truncate">{stat.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <main className="px-4 sm:px-8 py-2 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                
                {/* View Switcher & Header */}
                <div className="lg:col-span-12 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 sm:mb-8 mt-2 sm:mt-12 border-t border-gray-100 pt-4 sm:pt-12">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-tighter">Infrastructure Control</h2>
                    </div>

                    <div className="flex items-center gap-0.5 bg-gray-100 p-1 rounded-xl sm:rounded-2xl border border-gray-200 w-full sm:w-auto">
                        <button 
                            onClick={() => setShowPaymentSettingsModal(true)}
                            className="flex-1 min-w-0 px-0.5 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[6px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-all bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-1 whitespace-normal leading-tight text-center"
                        >
                            <CreditCard className="w-2 h-2 shrink-0 sm:w-3.5 sm:h-3.5" />
                            <span>Payment Config</span>
                        </button>
                        <div className="w-px h-5 bg-gray-300 shrink-0"></div>
                        <button 
                            onClick={() => setViewMode('active')}
                            className={`flex-1 min-w-0 px-0.5 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[6px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-all text-center whitespace-normal leading-tight ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Active Nodes
                        </button>
                        <button 
                            onClick={() => setViewMode('recycle')}
                            className={`flex-1 min-w-0 px-0.5 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[6px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-all text-center whitespace-normal leading-tight ${viewMode === 'recycle' ? 'bg-white text-red-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-red-400'}`}
                        >
                            Recycle Bin
                        </button>
                        <button 
                            onClick={() => setViewMode('audit')}
                            className={`flex-1 min-w-0 px-0.5 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[6px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-all text-center whitespace-normal leading-tight ${viewMode === 'audit' ? 'bg-white text-purple-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-purple-400'}`}
                        >
                            Audit Logs
                        </button>
                        <button 
                            onClick={() => setViewMode('billing')}
                            className={`flex-1 min-w-0 px-0.5 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[6px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-all text-center whitespace-normal leading-tight ${viewMode === 'billing' ? 'bg-white text-emerald-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-emerald-400'}`}
                        >
                            Billing Ledger
                        </button>
                        <button 
                            onClick={() => setViewMode('expired')}
                            className={`flex-1 min-w-0 px-0.5 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[6px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-all text-center whitespace-normal leading-tight flex items-center justify-center gap-1 ${viewMode === 'expired' ? 'bg-white text-rose-600 shadow-md border border-gray-200' : 'text-gray-400 hover:text-rose-400'}`}
                        >
                            {globalStats?.revenueSummary?.expired > 0 && viewMode !== 'expired' && (
                                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[7px] font-black flex items-center justify-center shrink-0">{globalStats.revenueSummary.expired}</span>
                            )}
                            Expired
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-12 space-y-6">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                {viewMode === 'active' ? 'Operational Hub' : viewMode === 'recycle' ? 'Trash Registry' : viewMode === 'audit' ? 'HQ Security Logs' : viewMode === 'expired' ? '⚠️ Expired Subscriptions' : 'Subscription Billing Ledger'}
                            </p>
                         </div>
                         <div className="flex gap-2">
                             <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                {viewMode === 'active' ? `Total Active Nodes: ${tenants.length}` : viewMode === 'recycle' ? `Deleted Nodes: ${tenants.length}` : viewMode === 'audit' ? `Audit Records: ${auditLogs.length}` : viewMode === 'expired' ? `Expired Nodes: ${tenants.length}` : `Ledger Transactions: ${billingLogs.length}`}
                             </div>
                         </div>
                    </div>
                    <div className="bg-white sm:bg-transparent rounded-[32px] sm:rounded-none overflow-hidden">
                        {viewMode === 'billing' ? (
                            <div className="bg-white p-6 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Subscription Billing Ledger</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Logs of all approved payments, complimentary setups, and deferred credits</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button 
                                            onClick={handleOpenCreateInvoiceModal}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Generate New Invoice
                                        </button>
                                        <button 
                                            onClick={fetchBillingLedger}
                                            disabled={loadingBilling}
                                            className="bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {loadingBilling ? 'Syncing...' : '🔄 Refresh Ledger'}
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[8px]">
                                                <th className="py-3 px-4">Date</th>
                                                <th className="py-3 px-4">College/University</th>
                                                <th className="py-3 px-4">Billing Type</th>
                                                <th className="py-3 px-4">Billing Period</th>
                                                <th className="py-3 px-4">UTR Number</th>
                                                <th className="py-3 px-4">Amount</th>
                                                <th className="py-3 px-4">Extra Disc</th>
                                                <th className="py-3 px-4">Remarks</th>
                                                <th className="py-3 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-bold">
                                            {billingLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="py-12 text-center text-slate-400 italic">No billing records found.</td>
                                                </tr>
                                            ) : billingLogs.map((log: any, idx: number) => (
                                                <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(log.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                                                    <td className="py-3 px-4 text-slate-900 font-extrabold">{log.tenantName}</td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter ${
                                                            log.billingType === 'Verified Payment' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                            log.billingType === 'Complimentary' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                            'bg-amber-50 text-amber-600 border border-amber-100'
                                                        }`}>
                                                            {log.billingType}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600">{log.billingPeriod}</td>
                                                    <td className="py-3 px-4 text-slate-700 font-mono select-all">{log.utr || "N/A"}</td>
                                                    <td className="py-3 px-4 text-slate-900 font-black">
                                                        {log.amount > 0 ? `₹${log.amount.toLocaleString("en-IN")}` : "₹0"}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {(log.extraDiscountType === "amount" || (log.extraDiscountAmount && Number(log.extraDiscountAmount) > 0)) ? (
                                                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-black border border-purple-200 text-[8px] whitespace-nowrap">
                                                                -₹{(Number(log.extraDiscountAmount) || Number(log.extraDiscountValue) || 0).toLocaleString("en-IN")}
                                                            </span>
                                                        ) : (log.extraDiscountPercent && Number(log.extraDiscountPercent) > 0) ? (
                                                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-black border border-purple-200 text-[8px] whitespace-nowrap">
                                                                +{log.extraDiscountPercent}% OFF
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 font-bold">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 leading-normal max-w-xs truncate" title={log.remarks}>{log.remarks || "-"}</td>
                                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => handleOpenEditInvoiceModal(log)}
                                                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                                                                title="Edit this invoice"
                                                            >
                                                                <Edit3 className="w-3 h-3" /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteInvoice(log.id, log.tenantName)}
                                                                disabled={isDeletingInvoiceId === log.id}
                                                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 active:scale-95 shadow-2xs"
                                                                title="Delete this invoice"
                                                            >
                                                                {isDeletingInvoiceId === log.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-3 h-3" />
                                                                )}
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : viewMode === 'audit' ? (
                            <div className="bg-white p-6 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Security Audit Trail</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                            Real-time log of administrative and infrastructure events • Stored in Supabase
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {selectedAuditTimestamps.length > 0 ? (
                                            <button
                                                onClick={handleDeleteSelectedAuditLogs}
                                                disabled={isDeletingLogs}
                                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center gap-1.5 animate-in fade-in"
                                            >
                                                🗑️ Delete Selected ({selectedAuditTimestamps.length})
                                            </button>
                                        ) : auditLogs.length > 0 ? (
                                            <button
                                                onClick={handleClearAllAuditLogs}
                                                disabled={isDeletingLogs}
                                                className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                🧹 Clear All Logs
                                            </button>
                                        ) : null}

                                        <button 
                                            onClick={fetchAuditLogs}
                                            disabled={loadingLogs}
                                            className="bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            {loadingLogs ? 'Syncing...' : '🔄 Refresh Logs'}
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[8px] bg-slate-50/50">
                                                <th className="py-3 px-4 w-10 text-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={auditLogs.length > 0 && selectedAuditTimestamps.length === auditLogs.length}
                                                        onChange={handleSelectAllAuditLogs}
                                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="py-3 px-4">Timestamp</th>
                                                <th className="py-3 px-4">Operator</th>
                                                <th className="py-3 px-4">Event Type</th>
                                                <th className="py-3 px-4">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-bold">
                                            {auditLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">No audit records found on Supabase server.</td>
                                                </tr>
                                            ) : auditLogs.map((log: any, idx: number) => {
                                                const isSelected = selectedAuditTimestamps.includes(log.timestamp);
                                                return (
                                                    <tr key={log.timestamp || idx} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                                                        <td className="py-3 px-4 text-center">
                                                            <input 
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleToggleAuditLog(log.timestamp)}
                                                                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </td>
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
                                                );
                                            })}
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
                                                <div className="flex items-center flex-wrap gap-1.5">
                                                    <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm leading-tight break-words">{tenant.name}</h3>
                                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border select-none leading-none ${
                                                        tenant.subscriptionStatus === 'trial' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                        tenant.subscriptionStatus === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        tenant.subscriptionStatus === 'expired' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        'bg-slate-50 text-slate-500 border-slate-150'
                                                    }`}>
                                                        {tenant.subscriptionStatus}
                                                    </span>
                                                    {viewMode === 'active' && tenant.liveTraffic && tenant.liveTraffic > 0 ? (
                                                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                                    ) : null}
                                                </div>
                                                <p className="text-[9px] text-slate-400 font-bold italic opacity-70 break-all mt-0.5">{tenant.adminEmail}</p>
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

                                        <div className="mt-3 flex flex-col gap-2.5 border-t border-slate-100 pt-3 w-full">
                                            {/* Badges Row (Students, Healthy, Subscription) */}
                                            <div className={`grid ${tenant.subscriptionEndDate ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5 w-full`}>
                                                <div className="flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 border border-blue-100 rounded-lg w-full">
                                                    <Users className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                                    <span className="text-[9px] font-black text-blue-700">{(tenant.studentCount || 0).toLocaleString()} Students</span>
                                                </div>
                                                {/* Health Score */}
                                                {(() => {
                                                    const score = tenant.healthScore ?? 0;
                                                    const color = score >= 70 ? 'emerald' : score >= 40 ? 'amber' : 'rose';
                                                    const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Fair' : 'Critical';
                                                    return (
                                                        <div className={`flex items-center justify-center gap-1 px-2 py-1 bg-${color}-50 border border-${color}-100 rounded-lg w-full`}>
                                                            <span className={`text-[9px] font-black text-${color}-700`}>{label} {score}%</span>
                                                        </div>
                                                    );
                                                })()}
                                                {/* Subscription Period Badge */}
                                                {tenant.subscriptionEndDate && (() => {
                                                    const now = new Date();
                                                    const rawEnd = new Date(tenant.subscriptionEndDate);
                                                    const istDateStr = !isNaN(rawEnd.getTime()) ? rawEnd.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
                                                    const endOfDay = istDateStr ? new Date(`${istDateStr}T23:59:59.999+05:30`) : rawEnd;
                                                    const diffTime = endOfDay.getTime() - now.getTime();
                                                    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    
                                                    if (daysRemaining < 0) {
                                                        return (
                                                            <div className="flex items-center justify-center gap-1 px-2 py-1 bg-rose-50 border border-rose-100 rounded-lg w-full">
                                                                <Clock className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                                                <span className="text-[9px] font-black text-rose-700">Expired ({Math.abs(daysRemaining)}d ago)</span>
                                                            </div>
                                                        );
                                                    } else if (daysRemaining <= 7) {
                                                        return (
                                                            <div className="flex items-center justify-center gap-1 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg animate-pulse w-full">
                                                                <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                                                <span className="text-[9px] font-black text-amber-700">{daysRemaining} Days Left</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <div className="flex items-center justify-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg w-full">
                                                                <Clock className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                                                <span className="text-[9px] font-black text-emerald-700">{daysRemaining} Days Left</span>
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                            </div>

                                            {/* Contact Details */}
                                            <div className="flex flex-col gap-1 min-w-0">
                                                {tenant.contactName && <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1.5"><span className="text-slate-400 uppercase tracking-widest text-[7px] w-12 inline-block">Contact:</span> {tenant.contactName}</p>}
                                                {tenant.contactPhone && <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1.5"><span className="text-slate-400 uppercase tracking-widest text-[7px] w-12 inline-block">Phone:</span> {tenant.contactPhone}</p>}
                                                {tenant.totalHostelars && <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1.5"><span className="text-slate-400 uppercase tracking-widest text-[7px] w-12 inline-block">Hostelars:</span> {tenant.totalHostelars}</p>}
                                                {!tenant.contactName && !tenant.contactPhone && !tenant.totalHostelars && (
                                                    <p className="text-[9px] text-slate-400 italic">No college details provided.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Start Date & End Date (Full Width Row) */}
                                        <div className="mt-3 flex justify-between items-center text-xs font-bold text-gray-700 border-t border-slate-100 pt-3 w-full">
                                            <div>
                                                <p className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest">Start Date</p>
                                                <p className="text-[10px] font-extrabold text-left">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) : "N/A"}</p>
                                            </div>
                                            <div className="h-4 w-px bg-slate-200" />
                                            <div className="text-right">
                                                <p className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest">End Date</p>
                                                <p className="text-[10px] font-extrabold text-right">{tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) : "Unlimited"}</p>
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
                                                    {(() => {
                                                        const status = dnsStatus[tenant.slug];
                                                        if (status === 'checking') {
                                                            return (
                                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded-lg text-amber-400 animate-pulse animate-duration-1000" title="Resolving DNS...">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                </div>
                                                            );
                                                        } else if (status === 'resolved') {
                                                            return (
                                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/30" title="🟢 DNS Resolved">
                                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <button 
                                                                    onClick={() => checkTenantDns(tenant.slug, true)}
                                                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 rounded-lg text-red-400 border border-red-500/30 cursor-pointer hover:bg-red-500/30 transition-all" 
                                                                    title="🔴 DNS Unresolved (Click to retry)"
                                                                >
                                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                                </button>
                                                            );
                                                        }
                                                    })()}
                                                    <button 
                                                        onClick={() => handleCalculateStorage(tenant._id)}
                                                        disabled={calculatingStorageFor === tenant._id}
                                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 hover:bg-white/20 transition-all rounded-lg cursor-pointer disabled:opacity-50" 
                                                        title="Click to calculate exact storage from database"
                                                    >
                                                        {calculatingStorageFor === tenant._id ? (
                                                            <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin" />
                                                        ) : (
                                                            <Database className="w-2.5 h-2.5 text-indigo-400" />
                                                        )}
                                                        <span className="text-[8px] font-black">
                                                            {tenant.storageBytes !== null && tenant.storageBytes !== undefined ? `${(tenant.storageBytes / (1024 * 1024)).toFixed(2)}MB` : "CALCULATE"}
                                                        </span>
                                                    </button>
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded-lg" title="Active Connections">
                                                        <Activity className="w-2.5 h-2.5 text-emerald-400" />
                                                        <span className="text-[8px] font-black">{tenant.liveTraffic || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Storage Quota Progress Bar */}
                                            {tenant.storageBytes !== null && tenant.storageBytes !== undefined && (() => {
                                                const quotaMb = tenant.storageQuotaMb || 100;
                                                const quotaBytes = quotaMb * 1024 * 1024;
                                                const percent = ((tenant.storageBytes / quotaBytes) * 100);
                                                return (
                                                    <div className="px-1 space-y-1">
                                                        <div className="flex justify-between items-center text-[7px] font-black uppercase text-slate-400 tracking-wider">
                                                            <span>Storage Quota</span>
                                                            <span>{percent.toFixed(1)}% of {quotaMb}MB</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${
                                                                    (tenant.storageBytes / quotaBytes) > 0.8 ? 'bg-red-500 animate-pulse' :
                                                                    (tenant.storageBytes / quotaBytes) > 0.5 ? 'bg-amber-500' :
                                                                    'bg-blue-500'
                                                                }`}
                                                                style={{ width: `${Math.min(100, percent)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="flex gap-2">
                                                {viewMode === 'active' ? (
                                                    <>
                                                        <button onClick={() => handleImpersonateAdmin(tenant.slug)} className="flex-1 bg-blue-600 text-white h-9 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-500/10">
                                                            <LogIn className="w-3.5 h-3.5" /> Sign In
                                                        </button>
                                                        <button onClick={() => setEditingTenant(tenant)} className="w-9 h-9 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                                                            <Settings className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => setSoftDeletingTenant(tenant)} className="w-9 h-9 bg-red-50 text-red-500/60 border border-red-100 rounded-xl flex items-center justify-center active:scale-95 transition-all">
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
                     <div className="bg-slate-900 rounded-[32px] sm:rounded-[48px] px-4 py-6 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-900/40">
                        {/* Decorative background circle */}
                        <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-blue-600/10 rounded-full blur-[60px] sm:blur-[100px] -mr-32 -mt-32 sm:-mr-48 sm:-mt-48"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 sm:w-96 sm:h-96 bg-indigo-600/10 rounded-full blur-[60px] sm:blur-[100px] -ml-32 -mb-32 sm:-ml-48 -mb-48"></div>

                        <div className="relative z-10 flex flex-col xl:flex-row items-start sm:items-center justify-between gap-8 sm:gap-12">
                            <div className="w-full xl:max-w-2xl">
                                <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6 sm:mb-8">
                                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                                    <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-400">Boss Overrides Management</span>
                                </div>
                                <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase mb-4 sm:mb-6 leading-tight lg:leading-none">Global Network <br className="hidden sm:inline" /> <span className="text-blue-500">Infrastructure.</span></h3>
                                <p className="text-slate-400 font-medium text-xs sm:text-base mb-6 sm:mb-10 leading-relaxed max-w-xl">
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
                                <div className="bg-white/5 border border-white/10 px-4 py-6 sm:p-8 rounded-[32px] sm:rounded-[40px] backdrop-blur-xl">
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
                    <div className="bg-white w-full max-w-lg rounded-[32px] sm:rounded-[48px] shadow-2xl overflow-hidden border border-white animate-in zoom-in slide-in-from-bottom-12 duration-500 max-h-[90vh] sm:max-h-[85vh] flex flex-col">
                        <div className="bg-gray-900 p-6 sm:p-10 text-white relative shrink-0">
                            <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-5 scale-150">
                                <Building2 className="w-16 h-16 sm:w-24 sm:h-24" />
                            </div>
                            <h3 className="text-xl sm:text-3xl font-black uppercase tracking-tighter">Provision New Node</h3>
                            <p className="text-blue-200/60 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-1">Establishing Virtual Infrastructure</p>
                            <button onClick={() => setShowAddModal(false)} className="absolute top-6 sm:top-10 right-6 sm:right-10 text-gray-500 hover:text-white transition-colors bg-white/10 h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center hover:rotate-90">
                                <X className="w-4 h-4 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTenant} className="p-6 sm:p-10 space-y-6 sm:space-y-8 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">University Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newTenant.name}
                                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                        placeholder="e.g. Oxford University"
                                        className="w-full bg-slate-50 border-transparent p-4 sm:p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
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
                                            className="w-full bg-slate-50 border-transparent p-4 sm:p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300 lowercase px-4 sm:px-5"
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
                                        className="w-full bg-slate-50 border-transparent p-4 sm:p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subscription Plan</label>
                                    <select
                                        value={newTenant.subscriptionStatus}
                                        onChange={(e) => setNewTenant({ ...newTenant, subscriptionStatus: e.target.value as any })}
                                        className="w-full bg-slate-50 border-transparent p-4 sm:p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-700"
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
                                        className="w-full bg-slate-50 border-transparent p-4 sm:p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
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
                                        className="w-full bg-slate-50 border-transparent p-4 sm:p-5 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={isCreating}
                                    className="p-4 sm:p-5 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
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
                    <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white max-h-[90vh] flex flex-col">
                        <div className="bg-slate-800 px-6 py-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tighter">Configure Node</h3>
                                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-0.5">{editingTenant?.name}</p>
                            </div>
                            <X className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer transition-colors" onClick={() => setEditingTenant(null)} />
                        </div>

                        <form onSubmit={handleUpdateTenant} className="p-5 sm:p-6 space-y-4 animate-in fade-in duration-300 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                            {editingTenant.renewalStatus === 'pending' && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2.5 shadow-sm animate-pulse shrink-0">
                                    <div className="flex items-center gap-2 text-amber-800">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Pending Subscription Renewal</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-950">
                                        <div className="flex justify-between items-center bg-white/60 px-2.5 py-1.5 rounded-xl border border-amber-100/50">
                                            <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest">UTR:</span>
                                            <span className="font-mono font-black select-all bg-amber-100 px-1.5 py-0.5 rounded">{editingTenant.renewalUtr}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/60 px-2.5 py-1.5 rounded-xl border border-amber-100/50">
                                            <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest">At:</span>
                                            <span className="font-extrabold text-amber-900">
                                                {editingTenant.renewalSubmittedAt ? new Date(editingTenant.renewalSubmittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "N/A"}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-amber-700 leading-relaxed font-semibold bg-white/60 p-2.5 rounded-xl border border-amber-100/50">
                                        💡 To approve, update entitlement/expiration below, and save.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/50">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-0.5">Subscription</label>
                                        <select
                                            value={editingTenant?.subscriptionStatus || 'trial'}
                                            onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, subscriptionStatus: e.target.value as any })}
                                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                        >
                                            <option value="active">Active (Premium)</option>
                                            <option value="trial">Trial (Restricted)</option>
                                            <option value="expired">Expired (Locked)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-0.5">Start Date</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={(() => {
                                                    if (!editingTenant?.createdAt) return "";
                                                    try {
                                                        const d = new Date(editingTenant.createdAt);
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
                                                            createdAt: val ? new Date(val).toISOString() : editingTenant.createdAt
                                                        });
                                                    }
                                                }}
                                                className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-0.5">End Date</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={(() => {
                                                    if (!editingTenant?.subscriptionEndDate) return "";
                                                    try {
                                                        const d = new Date(editingTenant.subscriptionEndDate);
                                                        if (isNaN(d.getTime())) return "";
                                                        return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                                                    } catch {
                                                        return "";
                                                    }
                                                })()}
                                                onChange={(e) => {
                                                    if (editingTenant) {
                                                        const val = e.target.value;
                                                        setEditingTenant({
                                                            ...editingTenant,
                                                            subscriptionEndDate: val ? `${val}T00:00:00.000Z` : undefined
                                                        });
                                                    }
                                                }}
                                                className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs cursor-pointer"
                                            />
                                            {editingTenant?.subscriptionEndDate && (
                                                <button
                                                    type="button"
                                                    onClick={() => editingTenant && setEditingTenant({ ...editingTenant, subscriptionEndDate: undefined })}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-rose-500 uppercase tracking-wider hover:underline"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {editingTenant.subscriptionStatus === 'active' && (
                                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Record Billing Entry</label>
                                        <input 
                                            type="checkbox"
                                            checked={recordBillingEntry}
                                            onChange={(e) => setRecordBillingEntry(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </div>
                                    {recordBillingEntry && (
                                        <div className="space-y-3 border-t border-slate-200/50 pt-3 animate-in fade-in">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Billing Type</label>
                                                <select
                                                    value={modalBillingType}
                                                    onChange={(e) => {
                                                        const val = e.target.value as any;
                                                        setModalBillingType(val);
                                                        if (val !== 'Verified Payment') {
                                                            setModalAmount("0");
                                                            setModalUtr("");
                                                        } else {
                                                            const count = editingTenant.studentCount || 0;
                                                            const price = paymentSettings.pricePerStudentPerMonth || 30;
                                                            setModalAmount(String(count * price * 12));
                                                            setModalUtr(editingTenant.renewalUtr || "");
                                                        }
                                                    }}
                                                    className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                                >
                                                    <option value="Verified Payment">Verified Payment</option>
                                                    <option value="Complimentary">Complimentary</option>
                                                    <option value="Deferred Billing (On Credit)">Deferred/On Credit</option>
                                                </select>
                                            </div>

                                            {modalBillingType === 'Verified Payment' && (
                                                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-1">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Amount Paid (₹)</label>
                                                        <input
                                                            type="number"
                                                            value={modalAmount}
                                                            onChange={(e) => setModalAmount(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                                            placeholder="Amount in ₹"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">UTR / Tx Number</label>
                                                        <input
                                                            type="text"
                                                            value={modalUtr}
                                                            onChange={(e) => setModalUtr(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-mono font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                                            placeholder="UTR Log"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Billing Period</label>
                                                    <select
                                                        value={modalBillingPeriod}
                                                        onChange={(e) => setModalBillingPeriod(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                                    >
                                                        <option value="1 Month">1 Month</option>
                                                        <option value="3 Months">3 Months</option>
                                                        <option value="6 Months">6 Months</option>
                                                        <option value="1 Year">1 Year</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</label>
                                                    <input
                                                        type="date"
                                                        defaultValue={new Date().toISOString().split('T')[0]}
                                                        className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Remarks</label>
                                                <input
                                                    type="text"
                                                    value={modalRemarks}
                                                    onChange={(e) => setModalRemarks(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs"
                                                    placeholder="Remarks / Notes"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-0.5">Contact Name</label>
                                    <input
                                        type="text"
                                        value={editingTenant?.contactName || ""}
                                        onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, contactName: e.target.value })}
                                        placeholder="Name"
                                        className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-0.5">Contact Phone</label>
                                    <input
                                        type="tel"
                                        value={editingTenant?.contactPhone || ""}
                                        onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, contactPhone: e.target.value })}
                                        placeholder="Phone"
                                        className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2.5 pt-3 border-t border-gray-100">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-0.5">Feature Flags (Premium Modules)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${editingTenant?.features?.smsEnabled !== false ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">SMS Alerts</span>
                                        <input type="checkbox" checked={editingTenant?.features?.smsEnabled !== false} onChange={(e) => editingTenant && setEditingTenant({...editingTenant, features: {...(editingTenant.features || {}), smsEnabled: e.target.checked}})} className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500" />
                                    </label>
                                    <label className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${editingTenant?.features?.biometricEnabled !== false ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">Biometrics</span>
                                        <input type="checkbox" checked={editingTenant?.features?.biometricEnabled !== false} onChange={(e) => editingTenant && setEditingTenant({...editingTenant, features: {...(editingTenant.features || {}), biometricEnabled: e.target.checked}})} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500" />
                                    </label>
                                    <label className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${editingTenant?.features?.advancedAnalytics === true ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">Analytics+</span>
                                        <input type="checkbox" checked={editingTenant?.features?.advancedAnalytics === true} onChange={(e) => editingTenant && setEditingTenant({...editingTenant, features: {...(editingTenant.features || {}), advancedAnalytics: e.target.checked}})} className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500" />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-0.5">Total Hostelars</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingTenant?.totalHostelars || ""}
                                        onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, totalHostelars: Number(e.target.value) || 0 })}
                                        placeholder="e.g. 500"
                                        className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs placeholder:text-gray-300"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-0.5 flex items-center justify-between">
                                        <span>Storage Quota (MB)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="10"
                                        value={editingTenant?.storageQuotaMb || 100}
                                        onChange={(e) => editingTenant && setEditingTenant({ ...editingTenant, storageQuotaMb: Number(e.target.value) || 100 })}
                                        placeholder="100"
                                        className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-bold focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 text-xs placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setEditingTenant(null)}
                                    className="flex-1 py-3 rounded-xl bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors"
                                >
                                    Abort
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] hover:bg-blue-700 transition-all"
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
                                    This will permanently delete <span className="font-black underline">{deletingTenant?.name || 'this node'}</span> along with all <span className="font-black underline">{deletingTenant?.studentCount || 0} registered students</span> and every single record associated with it, including attendance history and gatepasses.
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
            
            {/* Soft Delete Confirmation Modal */}
            {softDeletingTenant && (
                <div className="fixed inset-0 bg-[#7c2d12]/20 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden border border-amber-100 animate-in zoom-in duration-500">
                        <div className="bg-amber-500 p-10 text-white relative">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <Trash2 className="w-24 h-24" />
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">Deactivate Node</h3>
                            <p className="text-amber-100/60 text-[10px] font-black uppercase tracking-widest mt-1 italic">Move to Recycle Bin</p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="bg-amber-50 border border-amber-100 p-6 rounded-[28px] space-y-3">
                                <div className="flex items-center gap-3 text-amber-600">
                                    <AlertCircle className="w-5 h-5" />
                                    <p className="text-xs font-black uppercase tracking-tight">Warning: Temporary Suspension</p>
                                </div>
                                <p className="text-xs text-amber-850 font-medium leading-relaxed">
                                    Are you sure you want to move <span className="font-black underline">{softDeletingTenant.name}</span> to the Recycle Bin? All students and admins will lose access immediately.
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setSoftDeletingTenant(null)}
                                    className="flex-1 p-5 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const id = softDeletingTenant._id;
                                        setSoftDeletingTenant(null);
                                        handleSoftDelete(id);
                                    }}
                                    className="flex-1 p-5 rounded-2xl bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
                                >
                                    Move to Recycle Bin
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
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={paymentSettings.enableRazorpay}
                                                onChange={e => setPaymentSettings({...paymentSettings, enableRazorpay: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
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

                                            {/* Discount Percentages Controls */}
                                            <div className="pt-4 border-t border-indigo-100">
                                                <label className="block text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">
                                                    🏷️ Global Subscription Plan Discount Controls (%)
                                                </label>
                                                <p className="text-[10px] text-indigo-600 mb-3 font-medium">
                                                    Set discount percentages for each subscription duration. Changes update instantly across all campus portals.
                                                </p>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-indigo-100">
                                                        <label className="block text-[7.5px] sm:text-[8.5px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">1 Month Discount</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={paymentSettings.discount1Month ?? 0}
                                                                onChange={e => setPaymentSettings({...paymentSettings, discount1Month: Number(e.target.value)})}
                                                                className="w-full border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-black outline-none bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-500 pr-6"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-indigo-100">
                                                        <label className="block text-[7.5px] sm:text-[8.5px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">3 Months Discount</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={paymentSettings.discount3Month ?? 5}
                                                                onChange={e => setPaymentSettings({...paymentSettings, discount3Month: Number(e.target.value)})}
                                                                className="w-full border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-black outline-none bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-500 pr-6"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-indigo-100">
                                                        <label className="block text-[7.5px] sm:text-[8.5px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">6 Months Discount</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={paymentSettings.discount6Month ?? 10}
                                                                onChange={e => setPaymentSettings({...paymentSettings, discount6Month: Number(e.target.value)})}
                                                                className="w-full border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-black outline-none bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-500 pr-6"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-indigo-100">
                                                        <label className="block text-[7.5px] sm:text-[8.5px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">1 Year Discount</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={paymentSettings.discount12Month ?? 20}
                                                                onChange={e => setPaymentSettings({...paymentSettings, discount12Month: Number(e.target.value)})}
                                                                className="w-full border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-black outline-none bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-500 pr-6"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Live Rate Preview Card */}
                                                <div className="mt-3 p-3 bg-indigo-900 text-white rounded-xl text-[10px] font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                                                    <span className="font-sans font-bold text-indigo-200">Live Sample Calculation (500 Students @ ₹{paymentSettings.pricePerStudentPerMonth || 30}/mo):</span>
                                                    <span className="font-bold text-emerald-300">
                                                        1 Mo: ₹{(500 * (paymentSettings.pricePerStudentPerMonth || 30) * 1 * (100 - (paymentSettings.discount1Month ?? 0)) / 100).toLocaleString('en-IN')} | 
                                                        1 Yr: ₹{(500 * (paymentSettings.pricePerStudentPerMonth || 30) * 12 * (100 - (paymentSettings.discount12Month ?? 20)) / 100).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Global Notification & Scheduler Rules Section */}
                                <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-6 relative overflow-hidden space-y-4">
                                    <div>
                                        <h4 className="font-black text-amber-900 text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                                            🔔 Global Notification & Scheduler Rules
                                        </h4>
                                        <p className="text-xs text-amber-850/70 font-medium">Configure global push notification rules and curfew scheduling options.</p>
                                    </div>

                                    {/* Master Push Toggle */}
                                    <div className="flex items-center justify-between border-b border-amber-100/50 pb-4">
                                        <div>
                                            <p className="text-xs font-black text-amber-950 uppercase tracking-wide">Master Push Notifications</p>
                                            <p className="text-[10px] text-amber-700 font-medium">Turn ON/OFF all Web Push alerts across the entire system.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={paymentSettings.globalPushEnabled}
                                                onChange={e => setPaymentSettings({...paymentSettings, globalPushEnabled: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 shadow-inner"></div>
                                        </label>
                                    </div>

                                    {/* Mandatory Student Push Notification Enforcement */}
                                    <div className="flex items-center justify-between border-b border-amber-100/50 pb-4 bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black text-amber-950 uppercase tracking-wide">Mandatory Student Notification Lock</p>
                                                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">Boss Control</span>
                                            </div>
                                            <p className="text-[10px] text-amber-800 font-medium mt-0.5">When enabled, students cannot use their dashboard until phone/browser notifications are switched ON.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={paymentSettings.enforceMandatoryPush}
                                                onChange={e => setPaymentSettings({...paymentSettings, enforceMandatoryPush: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 shadow-inner"></div>
                                        </label>
                                    </div>

                                    {paymentSettings.globalPushEnabled && (
                                        <div className="space-y-4 pt-2 animate-in fade-in">
                                            {/* Curfew Timer Configuration */}
                                            <div className="bg-white p-4 rounded-xl border border-amber-200/50 space-y-4">
                                                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Curfew Scheduler Timings</p>
                                                <div className="grid grid-cols-3 gap-2.5">
                                                    <div>
                                                        <div className="min-h-[22px] flex items-end mb-1.5">
                                                            <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Curfew Start</label>
                                                        </div>
                                                        <input 
                                                            type="time" 
                                                            value={paymentSettings.curfewStart}
                                                            onChange={e => setPaymentSettings({...paymentSettings, curfewStart: e.target.value})}
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold outline-none bg-white text-slate-800"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="min-h-[22px] flex items-end mb-1.5">
                                                            <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Curfew End</label>
                                                        </div>
                                                        <input 
                                                            type="time" 
                                                            value={paymentSettings.curfewEnd}
                                                            onChange={e => setPaymentSettings({...paymentSettings, curfewEnd: e.target.value})}
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold outline-none bg-white text-slate-800"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="min-h-[22px] flex items-end mb-1.5">
                                                            <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Grace Mins</label>
                                                        </div>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            value={paymentSettings.gracePeriodMinutes}
                                                            onChange={e => setPaymentSettings({...paymentSettings, gracePeriodMinutes: Number(e.target.value) || 0})}
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold outline-none bg-white text-slate-800"
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-amber-700 font-medium">The system automatically calculates the alert time as <strong>Curfew End + Grace Period</strong> (e.g., {paymentSettings.curfewEnd} + {paymentSettings.gracePeriodMinutes} mins).</p>
                                            </div>

                                            {/* Sub Toggles */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {/* Parent Curfew Absent */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Parent Curfew Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Send auto push to parents at cutoff</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.parentCurfewAbsentEnabled} onChange={e => setPaymentSettings({...paymentSettings, parentCurfewAbsentEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Parent Gate Scan */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Parent Gate Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify parents on gate pass scan</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.parentGateScanInOutEnabled} onChange={e => setPaymentSettings({...paymentSettings, parentGateScanInOutEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Warden Leave Request */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Warden Leave Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify wardens on leave request</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.wardenLeaveRequestEnabled} onChange={e => setPaymentSettings({...paymentSettings, wardenLeaveRequestEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Dean Leave Request */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Dean Leave Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify deans on leave request</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.deanLeaveRequestEnabled} onChange={e => setPaymentSettings({...paymentSettings, deanLeaveRequestEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Student Leave Decision */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Leave Decision Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify students/parents when leave is decided</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.leaveDecisionEnabled} onChange={e => setPaymentSettings({...paymentSettings, leaveDecisionEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Parent Consent Video Uploaded */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Parent Video Consent Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify warden/dean on video upload</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.parentConsentVideoUploadedEnabled} onChange={e => setPaymentSettings({...paymentSettings, parentConsentVideoUploadedEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Outing Overdue Alerts */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Outing Overdue Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify when student is late returning</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.outingOverdueEnabled} onChange={e => setPaymentSettings({...paymentSettings, outingOverdueEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>

                                                {/* Payment Verification Alerts */}
                                                <label className="flex items-center justify-between p-3 rounded-xl border border-solid border-amber-200/50 bg-white cursor-pointer hover:bg-amber-50/20 transition-all">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide block">Payment Verified Alerts</span>
                                                        <span className="text-[8px] text-slate-500 font-medium block">Notify student when fee is verified</span>
                                                    </div>
                                                    <input type="checkbox" checked={paymentSettings.paymentVerifiedEnabled} onChange={e => setPaymentSettings({...paymentSettings, paymentVerifiedEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500" />
                                                </label>
                                            </div>

                                            {/* Outing Overdue Timings */}
                                            {paymentSettings.outingOverdueEnabled && (
                                                <div className="bg-white p-4 rounded-xl border border-amber-200/50 space-y-4 animate-in slide-in-from-top-2">
                                                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Outing Overdue Config</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <div className="min-h-[22px] flex items-end mb-1.5">
                                                                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Grace Mins</label>
                                                            </div>
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                value={paymentSettings.outingGracePeriod}
                                                                onChange={e => setPaymentSettings({...paymentSettings, outingGracePeriod: Number(e.target.value) || 0})}
                                                                className="w-full h-9 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold outline-none bg-white text-slate-800"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="min-h-[22px] flex items-end mb-1.5">
                                                                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Cutoff Time</label>
                                                            </div>
                                                            <input 
                                                                type="time" 
                                                                value={paymentSettings.absoluteOutingCutoff}
                                                                onChange={e => setPaymentSettings({...paymentSettings, absoluteOutingCutoff: e.target.value})}
                                                                className="w-full h-9 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold outline-none bg-white text-slate-800"
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] text-amber-700 font-medium">Outing alert triggers if student is overdue by more than <strong>{paymentSettings.outingGracePeriod} mins</strong> or is out past <strong>{paymentSettings.absoluteOutingCutoff}</strong> (IST).</p>
                                                </div>
                                            )}
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
                                        <div>
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
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Support WhatsApp Mobile Number</label>
                                            <input
                                                type="text"
                                                required
                                                value={paymentSettings.supportWhatsappNumber || "8269418956"}
                                                onChange={e => setPaymentSettings({...paymentSettings, supportWhatsappNumber: e.target.value})}
                                                className="w-full border-2 border-emerald-100 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-emerald-800"
                                                placeholder="8269418956"
                                            />
                                        </div>
                                        <div className="sm:col-span-2 bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl">
                                            <label className="block text-xs font-black text-emerald-950 uppercase tracking-widest mb-1 flex items-center justify-between">
                                                <span>🎁 Direct Bank Transfer Extra Cash Discount (%)</span>
                                                <span className="text-[9px] px-2.5 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-bold">UTR Cash Offer</span>
                                            </label>
                                            <p className="text-[10px] text-emerald-700 font-medium mb-2">
                                                Give colleges an additional instant discount percentage when paying directly to your bank account / QR code.
                                            </p>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="50"
                                                    value={paymentSettings.bankTransferDiscount ?? 2.5}
                                                    onChange={e => setPaymentSettings({...paymentSettings, bankTransferDiscount: Number(e.target.value)})}
                                                    className="w-full border-2 border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-black outline-none bg-white text-emerald-950 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 pr-8"
                                                    placeholder="2.5"
                                                />
                                                <span className="absolute right-3 top-2.5 text-sm font-black text-emerald-600">%</span>
                                            </div>
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

                        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowPaymentSettingsModal(false)}
                                className="px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="payment-settings-form"
                                disabled={isSavingPaymentSettings}
                                className="px-5 py-2.5 sm:px-8 sm:py-3 rounded-xl bg-blue-600 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                            >
                                {isSavingPaymentSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Boss Manual Invoice Generation & Edit Modal */}
            {invoiceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[28px] sm:rounded-[32px] w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-sans border border-slate-100">
                        {/* Modal Header */}
                        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-white to-blue-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight uppercase">
                                        {invoiceModalMode === "create" ? "Generate Tenant Invoice" : "Edit Tenant Invoice"}
                                    </h3>
                                    <p className="text-[10px] sm:text-xs text-gray-500 font-bold">
                                        {invoiceModalMode === "create" 
                                            ? "Publish an official invoice to the college's portal" 
                                            : `Editing invoice: ${selectedInvoiceId}`}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setInvoiceModalOpen(false)} 
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-100 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <div className="overflow-y-auto p-5 sm:p-7 flex-1 custom-scrollbar">
                            <form id="boss-invoice-form" onSubmit={handleSaveInvoice} className="space-y-4">
                                {/* College / Tenant Selection */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                        College / University (Client) *
                                    </label>
                                    <select
                                        required
                                        value={invoiceTenantId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setInvoiceTenantId(val);
                                            const matched = tenants.find((t: any) => (t._id || t.id || t.slug) === val);
                                            if (matched) {
                                                setInvoiceTenantName(matched.name);
                                            }
                                        }}
                                        className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2.5 text-xs font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="" disabled>-- Select Tenant --</option>
                                        {tenants.map((t: any) => {
                                            const tid = t._id || t.id || t.slug;
                                            return (
                                                <option key={tid} value={tid}>
                                                    {t.name} ({t.slug})
                                                </option>
                                            );
                                        })}
                                        {/* If editing an invoice whose tenantId is not in active tenants list, provide it as an option */}
                                        {invoiceTenantId && !tenants.some((t: any) => (t._id || t.id || t.slug) === invoiceTenantId) && (
                                            <option value={invoiceTenantId}>
                                                {invoiceTenantName || invoiceTenantId} (Current)
                                            </option>
                                        )}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {/* Amount */}
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Amount (₹) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-2.5 text-sm font-black text-gray-400">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                required
                                                placeholder="e.g. 23130"
                                                value={invoiceAmount}
                                                onChange={(e) => setInvoiceAmount(e.target.value)}
                                                className="w-full border-2 border-gray-100 rounded-xl pl-8 pr-4 py-2 text-xs font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Extra / Special Discount Selector (% or Direct ₹) */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                Extra Discount ({invoiceExtraDiscountType === "amount" ? "Direct ₹" : "% Wise"})
                                            </label>
                                            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setInvoiceExtraDiscountType("amount")}
                                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                        invoiceExtraDiscountType === "amount"
                                                            ? "bg-purple-600 text-white shadow-xs"
                                                            : "text-slate-500 hover:text-slate-800"
                                                    }`}
                                                >
                                                    Direct ₹
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setInvoiceExtraDiscountType("percent")}
                                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                        invoiceExtraDiscountType === "percent"
                                                            ? "bg-purple-600 text-white shadow-xs"
                                                            : "text-slate-500 hover:text-slate-800"
                                                    }`}
                                                >
                                                    % Wise
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            {invoiceExtraDiscountType === "amount" ? (
                                                <>
                                                    <span className="absolute left-3.5 top-2 text-xs font-black text-purple-700">₹</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="e.g. 11526"
                                                        value={invoiceExtraDiscountValue}
                                                        onChange={(e) => setInvoiceExtraDiscountValue(e.target.value)}
                                                        className="w-full border-2 border-gray-100 rounded-xl pl-8 pr-4 py-2 text-xs font-black text-purple-900 bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        placeholder="e.g. 10"
                                                        value={invoiceExtraDiscountValue}
                                                        onChange={(e) => setInvoiceExtraDiscountValue(e.target.value)}
                                                        className="w-full border-2 border-gray-100 rounded-xl pl-3.5 pr-8 py-2 text-xs font-black text-purple-900 bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                                                    />
                                                    <span className="absolute right-3.5 top-2 text-xs font-black text-purple-700">%</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {/* Date */}
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Payment Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={invoiceDate}
                                            onChange={(e) => setInvoiceDate(e.target.value)}
                                            className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2 text-xs font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Billing Period */}
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Subscription Period *
                                        </label>
                                        <select
                                            value={invoiceBillingPeriod}
                                            onChange={(e) => setInvoiceBillingPeriod(e.target.value)}
                                            className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2 text-xs font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="1 Month">1 Month</option>
                                            <option value="3 Months">3 Months</option>
                                            <option value="6 Months">6 Months</option>
                                            <option value="1 Year">1 Year</option>
                                            <option value="2 Years">2 Years</option>
                                            <option value="3 Years">3 Years</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {/* UTR / Ref ID */}
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            UTR / Transaction Ref ID
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 659864589235"
                                            value={invoiceUtr}
                                            onChange={(e) => setInvoiceUtr(e.target.value)}
                                            className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2 text-xs font-mono font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all uppercase"
                                        />
                                    </div>

                                    {/* Billing Type */}
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Billing Classification
                                        </label>
                                        <select
                                            value={invoiceBillingType}
                                            onChange={(e) => setInvoiceBillingType(e.target.value as any)}
                                            className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2 text-xs font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="Verified Payment">Verified Payment</option>
                                            <option value="Complimentary">Complimentary</option>
                                            <option value="Deferred Billing (On Credit)">Deferred Billing (On Credit)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Payment Source */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                        Payment Method / Source
                                    </label>
                                    <select
                                        value={invoicePaymentSource}
                                        onChange={(e) => setInvoicePaymentSource(e.target.value)}
                                        className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2 text-xs font-black text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="Direct Bank / UPI Transfer (UTR Verified)">Direct Bank / UPI Transfer (UTR Verified)</option>
                                        <option value="Online Payment Gateway (Razorpay)">Online Payment Gateway (Razorpay)</option>
                                        <option value="Direct Bank Transfer">Direct Bank Transfer</option>
                                        <option value="Complimentary License">Complimentary License</option>
                                        <option value="Offline Cheque / Cash">Offline Cheque / Cash</option>
                                    </select>
                                </div>

                                {/* Remarks */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                        Remarks & Invoice Notes
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Annual renewal payment for 482 students"
                                        value={invoiceRemarks}
                                        onChange={(e) => setInvoiceRemarks(e.target.value)}
                                        className="w-full border-2 border-gray-100 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 bg-white focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setInvoiceModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-wider hover:bg-gray-100 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="boss-invoice-form"
                                disabled={isSavingInvoice}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                            >
                                {isSavingInvoice ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Saving...
                                    </>
                                ) : invoiceModalMode === "create" ? (
                                    <>
                                        <Plus className="w-3.5 h-3.5" />
                                        Generate Invoice
                                    </>
                                ) : (
                                    <>
                                        <Edit3 className="w-3.5 h-3.5" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
