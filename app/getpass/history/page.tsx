"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";

export default function OutingHistoryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1, leaveCount: 0, passCount: 0 });

    // Filters State
    const [filters, setFilters] = useState({
        collegeName: "all",
        hostelName: "all",
        status: "all",
        type: "all",
        startDate: "",
        endDate: "",
        search: ""
    });

    const [hostelsList, setHostelsList] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);

    // Profile Modal State
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [lastOuting, setLastOuting] = useState<any>(null);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportData, setExportData] = useState<any[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    // Dynamic Columns for Export
    const availableColumnsData = [
        { id: "name", label: "Student Name", width: 25 },
        { id: "phone", label: "Mobile", width: 15 },
        { id: "regId", label: "Reg. ID", width: 18 },
        { id: "erpId", label: "ERP ID", width: 18 },
        { id: "hostel", label: "Hostel", width: 25 },
        { id: "room", label: "Room", width: 10 },
        { id: "outTime", label: "Out Time", width: 25 },
        { id: "inTime", label: "In Time", width: 25 },
        { id: "duration", label: "Duration", width: 12 },
        { id: "status", label: "Status", width: 10 },
        { id: "fatherName", label: "Father Name", width: 20 },
        { id: "fatherNumber", label: "Father Mobile", width: 15 },
        { id: "motherName", label: "Mother Name", width: 20 },
        { id: "motherNumber", label: "Mother Mobile", width: 15 }
    ];

    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set([
        "name", "phone", "regId", "erpId", "hostel", "room", "outTime", "inTime", "duration", "status"
    ]));

    const [columnOrder, setColumnOrder] = useState<string[]>(availableColumnsData.map(c => c.id));
    const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

    const toggleColumn = (id: string) => {
        const newSet = new Set(selectedColumns);
        if (newSet.has(id)) {
            if (newSet.size > 1) newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedColumns(newSet);
    };

    const handleDragStart = (id: string) => {
        setDraggedColumnId(id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (id: string) => {
        if (!draggedColumnId || draggedColumnId === id) return;
        const oldIdx = columnOrder.indexOf(draggedColumnId);
        const newIdx = columnOrder.indexOf(id);
        const newOrder = [...columnOrder];
        newOrder.splice(oldIdx, 1);
        newOrder.splice(newIdx, 0, draggedColumnId);
        setColumnOrder(newOrder);
        setDraggedColumnId(null);
    };

    const colleges = ["OIST", "OCT", "OCP", "OPM", "OIPR"];

    const formatDateDDMMYYYY = (dateVal: any) => {
        if (!dateVal) return "--:--";
        const str = String(dateVal).trim();
        if (!str || str === 'undefined' || str === 'null') return "--:--";

        if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
            return str.replace(/\//g, '-');
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-');
            return `${d}-${m}-${y}`;
        }

        try {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, "0");
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const year = d.getFullYear();
                return `${day}-${month}-${year}`;
            }
        } catch (e) {}

        return str;
    };

    const formatISTTimeAMPM = (timeStr?: string, isoDateStr?: string) => {
        if (!timeStr && !isoDateStr) return "--:--";
        if (timeStr && (timeStr.toUpperCase().includes("AM") || timeStr.toUpperCase().includes("PM"))) {
            return timeStr.trim();
        }
        if (timeStr && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
            const parts = timeStr.trim().split(":");
            let hours = parseInt(parts[0], 10);
            const minutes = parts[1];
            const seconds = parts[2] ? `:${parts[2]}` : "";
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12;
            if (hours === 0) hours = 12;
            const formattedHours = String(hours).padStart(2, "0");
            return `${formattedHours}:${minutes}${seconds} ${ampm}`;
        }
        try {
            const target = isoDateStr || timeStr || "";
            const d = new Date(target);
            if (!isNaN(d.getTime())) {
                const raw = d.toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                });
                return raw.replace(/am/i, "AM").replace(/pm/i, "PM");
            }
        } catch (e) {}
        return timeStr || "--:--";
    };

    useEffect(() => {
        setMounted(true);
        const fetchHostelsList = async () => {
            try {
                const res = await fetch("/api/admin/hostels");
                const data = await res.json();
                if (data.success) {
                    setHostelsList(data.hostels || []);
                }
            } catch (error) {
                console.error("Error fetching hostels:", error);
            }
        };
        fetchHostelsList();
    }, []);

    const fetchHistory = useCallback(async (pageNo = 1) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: pageNo.toString(),
                limit: "50",
                collegeName: filters.collegeName,
                hostelName: filters.hostelName,
                status: filters.status,
                type: filters.type,
                startDate: filters.startDate,
                endDate: filters.endDate,
                search: filters.search
            });

            const response = await fetch(`/api/getpass/history?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setRecords(data.records);
                setPagination({
                    ...data.pagination,
                    leaveCount: data.summary?.leaveCount || 0,
                    passCount: data.summary?.passCount || 0
                });
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchHistory(1);
    }, [fetchHistory]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const fetchStudentProfile = async (idOrObject: any, fallbackRecord?: any) => {
        const studentId = typeof idOrObject === 'object' ? idOrObject._id || idOrObject.id : idOrObject;
        if (!studentId || studentId === "[object Object]") return;

        setSelectedStudentId(studentId);

        let initialStudent: any = null;
        if (fallbackRecord) {
            initialStudent = {
                _id: studentId,
                id: studentId,
                name: fallbackRecord.studentName || fallbackRecord.name || "Student",
                hostelName: fallbackRecord.hostelName || "",
                roomNumber: fallbackRecord.roomNumber || "",
                registrationId: fallbackRecord.registrationId || "",
                phoneNumber: fallbackRecord.phoneNumber || "",
                fatherName: fallbackRecord.fatherName || "",
                fatherNumber: fallbackRecord.fatherNumber || "",
                motherName: fallbackRecord.motherName || "",
                motherNumber: fallbackRecord.motherNumber || "",
                erpInformation: fallbackRecord.erpId || fallbackRecord.erpInformation || "",
                studentStatus: fallbackRecord.status === "out" ? "out" : "in",
            };
            setSelectedStudent(initialStudent);
            if (fallbackRecord.checkOutISTDate || fallbackRecord.checkOutTime) {
                setLastOuting(fallbackRecord);
            }
            setIsProfileModalOpen(true);
            setProfileError(null);
            setIsLoadingProfile(false);
        } else {
            setIsLoadingProfile(true);
            setIsProfileModalOpen(true);
            setProfileError(null);
            setSelectedStudent(null);
            setLastOuting(null);
        }

        try {
            const response = await fetch(`/api/students/${studentId}`);
            const data = await response.json();
            if (data.success && data.student) {
                setSelectedStudent(data.student);
                if (data.lastOuting) setLastOuting(data.lastOuting);
                setProfileError(null);
            } else if (!fallbackRecord) {
                setSelectedStudent(null);
                setProfileError(data.error || "Failed to load profile");
            }
        } catch (err: any) {
            console.error("Error fetching student profile:", err);
            if (!fallbackRecord) {
                setSelectedStudent(null);
                setProfileError(err.message || "Network error fetching profile");
            }
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleExportPreview = async () => {
        setIsExporting(true);
        try {
            const params = new URLSearchParams({
                limit: "10000",
                collegeName: filters.collegeName,
                hostelName: filters.hostelName,
                status: filters.status,
                type: filters.type,
                startDate: filters.startDate,
                endDate: filters.endDate,
                search: filters.search
            });

            const response = await fetch(`/api/getpass/history?${params.toString()}`);
            const data = await response.json();

            if (data.success && data.records.length > 0) {
                setExportData(data.records);
                setIsExportModalOpen(true);
            } else {
                alert("No records found to export");
            }
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to fetch export data");
        } finally {
            setIsExporting(false);
        }
    };

    const performDownload = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Outing History");

            // Define Columns dynamically based on order and selection
            const activeColumnObjects = columnOrder
                .map(id => availableColumnsData.find(c => c.id === id))
                .filter(col => col && selectedColumns.has(col.id));

            worksheet.columns = activeColumnObjects.map(col => ({
                header: col!.label,
                key: col!.id,
                width: col!.width
            }));

            // Add Data dynamically
            exportData.forEach((r: any) => {
                const row: any = {};
                if (selectedColumns.has("name")) row.name = r.studentName;
                if (selectedColumns.has("phone")) row.phone = r.phoneNumber || "";
                if (selectedColumns.has("regId")) row.regId = r.registrationId;
                if (selectedColumns.has("erpId")) row.erpId = r.erpId || "";
                if (selectedColumns.has("hostel")) row.hostel = formatHostelDisplay(r.hostelName);
                if (selectedColumns.has("room")) row.room = r.roomNumber;
                if (selectedColumns.has("outTime")) row.outTime = `${r.checkOutISTTime} ${r.checkOutISTDate}`;
                if (selectedColumns.has("inTime")) row.inTime = (r.status === 'in' || r.status === 'auto-resolved') ? `${r.checkInISTTime} ${r.checkInISTDate}` : "Still Outside";
                if (selectedColumns.has("duration")) row.duration = formatDuration(r.durationMinutes);
                if (selectedColumns.has("status")) row.status = r.status === 'out' ? "OUT" : "IN";
                if (selectedColumns.has("fatherName")) row.fatherName = r.fatherName || "";
                if (selectedColumns.has("fatherNumber")) row.fatherNumber = r.fatherNumber || "";
                if (selectedColumns.has("motherName")) row.motherName = r.motherName || "";
                if (selectedColumns.has("motherNumber")) row.motherNumber = r.motherNumber || "";

                worksheet.addRow(row);
            });

            // Styling
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Cambria', size: 10, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' } // Light Grey
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.eachCell((cell) => {
                        cell.font = { name: 'Cambria', size: 10 };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                }
            });

            // Generate Buffer and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Outing_History_${new Date().toISOString().split('T')[0]}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
            setIsExportModalOpen(false);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed. Please try again.");
        }
    };

    const formatDuration = (minutes: number) => {
        if (!minutes) return "---";
        if (minutes >= 1440) {
            const days = Math.floor(minutes / 1440);
            const hrs = Math.floor((minutes % 1440) / 60);
            const mins = minutes % 60;
            return `${days}d ${hrs}h ${mins}m`;
        }
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const formatHostelDisplay = (name: string) => {
        if (!name) return name;
        const n = name.toUpperCase().trim();
        if (n.includes("GUEST") || n.includes("GHB")) return "GHB HOSTEL";
        return n;
    };

    if (!mounted) return <div className="min-h-screen bg-[#0d1117]" />;

    return (
        <div className="min-h-screen bg-[#0d1117] text-white font-sans selection:bg-blue-500/30">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0d1117]/80 backdrop-blur-xl border-b border-[rgba(255,255,255,0.05)] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button
                        onClick={() => router.push('/getpass')}
                        className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                    >
                        <span className="text-lg sm:text-xl group-hover:-translate-x-1 transition-transform inline-block">←</span>
                    </button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black m-0 flex items-center gap-2">
                            <span className="inline">📜</span> Outing History
                            <span className="hidden md:inline-block text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-tighter">Database Archives</span>
                        </h1>
                        <p className="text-[10px] sm:text-[11px] text-white/40 m-0 mt-0.5 font-medium uppercase tracking-widest">Student Logs</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-10">
                    <div className="hidden sm:flex items-center gap-6 border-l border-white/5 pl-8">
                        <button 
                            onClick={() => setFilters(f => ({ ...f, type: f.type === 'outing' ? 'all' : 'outing' }))}
                            className={`flex flex-col items-center group transition-all p-2 rounded-xl border ${filters.type === 'outing' ? 'bg-[#00ff8808] border-[#00ff8833] scale-105 shadow-[0_0_20px_rgba(0,255,136,0.05)]' : 'border-transparent hover:bg-white/5'}`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 transition-colors ${filters.type === 'outing' ? 'text-[#00ff88]' : 'text-white/30 group-hover:text-[#00ff8888]'}`}>Daily Pass</span>
                            <span className={`text-xl font-black tabular-nums leading-none transition-all ${filters.type === 'outing' ? 'text-[#00ff88] drop-shadow-[0_0_10px_rgba(0,255,136,0.3)]' : 'text-white'}`}>{pagination.passCount}</span>
                        </button>
                        
                        <button 
                            onClick={() => setFilters(f => ({ ...f, type: f.type === 'leave' ? 'all' : 'leave' }))}
                            className={`flex flex-col items-center group transition-all p-2 rounded-xl border ${filters.type === 'leave' ? 'bg-blue-500/10 border-blue-500/30 scale-105 shadow-[0_0_20px_rgba(96,165,250,0.05)]' : 'border-transparent hover:bg-white/5'}`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 transition-colors ${filters.type === 'leave' ? 'text-blue-400' : 'text-white/30 group-hover:text-blue-400/60'}`}>Leave Logs</span>
                            <span className={`text-xl font-black tabular-nums leading-none transition-all ${filters.type === 'leave' ? 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]' : 'text-white'}`}>{pagination.leaveCount}</span>
                        </button>
                        
                        <button 
                            onClick={() => setFilters(f => ({ ...f, type: 'all' }))}
                            className={`flex flex-col items-end group transition-all p-2 rounded-xl border ${filters.type === 'all' ? 'bg-white/5 border-white/10' : 'border-transparent hover:bg-white/5'} ml-2`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 transition-colors ${filters.type === 'all' ? 'text-white/40' : 'text-white/20'}`}>Total Logs</span>
                            <span className={`text-sm font-black tabular-nums leading-none transition-all ${filters.type === 'all' ? 'text-white' : 'text-white/40'}`}>{pagination.total}</span>
                        </button>
                    </div>

                    <button
                        onClick={handleExportPreview}
                        disabled={isExporting}
                        className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg ${filters.type === 'outing' ? 'bg-[#00ff881a] border border-[#00ff884d] text-[#00ff88] hover:bg-[#00ff8826]' : filters.type === 'leave' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30' : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white'}`}
                    >
                        {isExporting ? (
                            <div className={`w-4 h-4 border-2 rounded-full animate-spin ${filters.type === 'outing' ? 'border-[#00ff88] border-t-transparent' : filters.type === 'leave' ? 'border-blue-400 border-t-transparent' : 'border-white/40 border-t-transparent'}`} />
                        ) : (
                            <span>📥</span>
                        )}
                        Export {filters.type === 'outing' ? 'Passes' : filters.type === 'leave' ? 'Leaves' : 'All'}
                    </button>
                </div>
            </div>

            {/* ── Mobile-only Stats Bar (Daily Pass / Leave Logs / Total Logs) ── */}
            <div className="sm:hidden flex items-stretch w-full bg-[#0a0a0f] border-b border-white/5">
                <button
                    onClick={() => setFilters(f => ({ ...f, type: f.type === 'outing' ? 'all' : 'outing' }))}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all ${filters.type === 'outing' ? 'bg-[#00ff8810] border-b-2 border-[#00ff88]' : 'border-b-2 border-transparent'}`}
                >
                    <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${filters.type === 'outing' ? 'text-[#00ff88]' : 'text-white/30'}`}>Daily Pass</span>
                    <span className={`text-sm font-black tabular-nums leading-tight ${filters.type === 'outing' ? 'text-[#00ff88]' : 'text-white'}`}>{pagination.passCount}</span>
                </button>

                <div className="w-px bg-white/10 self-stretch" />

                <button
                    onClick={() => setFilters(f => ({ ...f, type: f.type === 'leave' ? 'all' : 'leave' }))}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all ${filters.type === 'leave' ? 'bg-blue-500/10 border-b-2 border-blue-400' : 'border-b-2 border-transparent'}`}
                >
                    <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${filters.type === 'leave' ? 'text-blue-400' : 'text-white/30'}`}>Leave Logs</span>
                    <span className={`text-sm font-black tabular-nums leading-tight ${filters.type === 'leave' ? 'text-blue-400' : 'text-white'}`}>{pagination.leaveCount}</span>
                </button>

                <div className="w-px bg-white/10 self-stretch" />

                <button
                    onClick={() => setFilters(f => ({ ...f, type: 'all' }))}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all ${filters.type === 'all' ? 'bg-white/5 border-b-2 border-white/30' : 'border-b-2 border-transparent'}`}
                >
                    <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${filters.type === 'all' ? 'text-white/60' : 'text-white/20'}`}>Total Logs</span>
                    <span className={`text-sm font-black tabular-nums leading-tight ${filters.type === 'all' ? 'text-white' : 'text-white/40'}`}>{pagination.total}</span>
                </button>
            </div>

            <div className="max-w-[1600px] mx-auto p-4 sm:p-6 flex flex-col gap-6">
                {/* Filters Section */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 p-4 sm:p-5 bg-[#0a0a0f] border border-white/5 rounded-2xl shadow-2xl">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-1 truncate">College</label>
                        <select
                            name="collegeName"
                            value={filters.collegeName}
                            onChange={handleFilterChange}
                            className="bg-[#121421] border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 text-[12px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">All Colleges</option>
                            {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-1 truncate">Select Hostel</label>
                        <select
                            name="hostelName"
                            value={filters.hostelName}
                            onChange={handleFilterChange}
                            className="bg-[#121421] border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 text-[12px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">All Hostels</option>
                            {hostelsList.map(h => <option key={h._id} value={h.name}>{formatHostelDisplay(h.name)}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-1 truncate">Out Since</label>
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="bg-[#121421] border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 text-[12px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-1 truncate">Out Until</label>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="bg-[#121421] border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 text-[12px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-1 truncate">Search ID</label>
                        <input
                            type="text"
                            name="search"
                            placeholder="ERP / Reg. ID"
                            value={filters.search}
                            onChange={handleFilterChange}
                            className="bg-[#121421] border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 text-[12px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-1 truncate">Status</label>
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="bg-[#121421] border border-white/10 rounded-xl px-2.5 sm:px-4 py-2.5 text-[12px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">All Movements</option>
                            <option value="out">Still Outside</option>
                            <option value="in">Returned Back</option>
                        </select>
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
                            <p className="text-white/40 text-sm font-black uppercase tracking-widest">Searching Archives...</p>
                        </div>
                    ) : records.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 pb-8">
                            {records.map((record) => (
                                <div key={record._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 px-3 bg-[#121421]/90 rounded-2xl border border-white/5 transition-all hover:bg-[#161a29]/90 hover:border-blue-500/20 group gap-2.5">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p
                                                    onClick={() => fetchStudentProfile(record.studentId, record)}
                                                    className="text-sm font-bold text-white m-0 cursor-pointer hover:text-blue-400 transition-colors leading-tight truncate"
                                                >
                                                    {record.studentName}
                                                </p>
                                                {(() => {
                                                    const isLeaveRecord = String(record.type || '').toLowerCase().includes('leave') || String(record.type || '').toLowerCase() === 'hleave';
                                                    return (
                                                        <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all flex items-center gap-1 shrink-0 ${isLeaveRecord
                                                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                                            }`}>
                                                            <span className="text-[9px]">{isLeaveRecord ? "🏠" : "🎫"}</span>
                                                            <span>{isLeaveRecord ? "HOME-LEAVE" : "GATE-PASS"}</span>
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <p className="text-[10px] text-white/70 mt-1 font-medium truncate uppercase tracking-tighter">
                                                {formatHostelDisplay(record.hostelName)} • Room {record.roomNumber}
                                            </p>
                                            <p className="text-[9px] text-blue-400 font-medium truncate uppercase tracking-tighter mt-0.5">
                                                {record.registrationId}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center w-full sm:w-auto gap-3 sm:gap-5 pt-2.5 sm:pt-0 border-t border-white/5 sm:border-0">
                                        <div className="flex flex-col items-start sm:items-end gap-1 flex-1">
                                            <div className="flex flex-col items-start sm:items-end">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="text-[8px] text-white/70 font-black uppercase tracking-tighter">Out:</span>
                                                    <span className="text-[10px] font-bold text-white tabular-nums">{formatISTTimeAMPM(record.checkOutISTTime, record.checkOutTime)}</span>
                                                    <span className="text-white/10 text-[10px]">|</span>
                                                    <span className="text-[10px] text-white/40 font-bold tabular-nums whitespace-nowrap">{formatDateDDMMYYYY(record.checkOutISTDate || record.checkOutTime)}</span>
                                                </div>
                                            </div>

                                            {record.status === 'in' || record.status === 'auto-resolved' ? (
                                                <div className="flex flex-col items-start sm:items-end mt-0.5">
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="text-[8px] text-white/70 font-black uppercase tracking-tighter">In:</span>
                                                        <span className="text-[10px] font-bold text-green-400 tabular-nums">{formatISTTimeAMPM(record.checkInISTTime || record.checkOutISTTime, record.checkInTime || record.checkOutTime)}</span>
                                                        <span className="text-white/10 text-[10px]">|</span>
                                                        <span className="text-[10px] text-white/40 font-bold tabular-nums whitespace-nowrap">{formatDateDDMMYYYY(record.checkInISTDate || record.checkInTime || record.checkOutISTDate)}</span>
                                                    </div>
                                                    {(String(record.type || '').toLowerCase().includes('leave') || String(record.type || '').toLowerCase() === 'hleave') && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <span className="text-[7px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-black uppercase tracking-tighter">🏠 HOME-LEAVE</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 animate-pulse mt-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                    <span className="text-[8px] text-red-400 font-bold uppercase tracking-widest">Currently Out</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-[65px] flex flex-col items-center justify-center px-2 py-1 bg-white/5 rounded-xl border border-white/5">
                                            <span className="text-[7px] text-white/70 font-black uppercase tracking-widest mb-0.5">Duration</span>
                                            <span className={`text-[9px] font-black tabular-nums ${record.status === 'out' ? 'text-red-400' : 'text-blue-400'}`}>
                                                {formatDuration(record.durationMinutes)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 rounded-3xl border border-dashed border-white/10 bg-white/5">
                            <span className="text-6xl mb-6 grayscale opacity-50">📂</span>
                            <h3 className="text-xl font-bold text-white/80 m-0">No records found</h3>
                            <p className="text-white/40 mt-2">Adjust your filters to search deeper into the archives.</p>
                            <button
                                onClick={() => setFilters({ collegeName: "all", hostelName: "all", status: "all", type: "all", startDate: "", endDate: "", search: "" })}
                                className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 font-bold text-sm transition-all hover:bg-blue-500 active:scale-95"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 py-8">
                        <button
                            disabled={pagination.page <= 1}
                            onClick={() => fetchHistory(pagination.page - 1)}
                            className="px-6 py-2.5 rounded-xl bg-[#121421] border border-white/10 text-sm font-bold disabled:opacity-30 transition-all hover:bg-white/5"
                        >
                            Previous
                        </button>
                        <div className="text-sm font-black text-white/40 tabular-nums bg-white/5 px-4 py-2 rounded-lg">
                            Page <span className="text-white">{pagination.page}</span> of {pagination.totalPages}
                        </div>
                        <button
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => fetchHistory(pagination.page + 1)}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-bold disabled:opacity-30 transition-all hover:bg-blue-500"
                        >
                            Next Page
                        </button>
                    </div>
                )}
            </div>

            {/* Student Profile Modal */}
            {isProfileModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in transition-all cursor-pointer"
                    onClick={() => setIsProfileModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-none sm:rounded-3xl w-full h-full sm:h-auto max-w-5xl max-h-none sm:max-h-[95vh] overflow-y-auto shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col relative animate-in zoom-in-95 cursor-default text-gray-900 no-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isLoadingProfile ? (
                            <div className="h-full sm:h-[400px] flex flex-col items-center justify-center gap-4 p-8">
                                <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
                                <p className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Searching Profile...</p>
                            </div>
                        ) : profileError ? (
                            <div className="h-full sm:h-[400px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                                <span className="text-5xl">⚠️</span>
                                <p className="font-bold text-red-500 text-sm">Failed to Load Profile</p>
                                <p className="text-gray-400 text-xs max-w-xs">{profileError}</p>
                                <button
                                    onClick={() => selectedStudentId && fetchStudentProfile(selectedStudentId)}
                                    className="mt-2 px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : selectedStudent ? (
                            <div className="flex flex-col min-h-full sm:min-h-0">
                                {/* Header Banner */}
                                <div className="h-12 sm:h-14 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 shrink-0 relative">
                                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
                                    <button
                                        onClick={() => setIsProfileModalOpen(false)}
                                        className="absolute top-2.5 sm:top-4 right-3 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all z-[110] border border-white/10"
                                    >
                                        <span className="text-base sm:text-xl">✕</span>
                                    </button>
                                </div>

                                {/* Profile Section — Mobile: LEFT info | RIGHT photo */}
                                <div className="px-4 sm:px-10 pb-3 sm:pb-8 flex flex-row sm:flex-row items-start sm:items-end gap-4 sm:gap-10 relative">

                                    {/* LEFT: All text info */}
                                    <div className="flex-1 order-1 sm:order-2 pt-3 sm:pt-0 text-left">
                                        {/* Name + Status */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-4 mb-2 sm:mb-4">
                                            <h2 className="text-base sm:text-5xl font-black text-gray-900 tracking-tight leading-tight uppercase">{selectedStudent.name}</h2>
                                            <span className={`px-2.5 py-0.5 sm:px-4 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm ${selectedStudent.studentStatus === 'out' ? 'bg-red-500 text-white shadow-red-200' : 'bg-green-500 text-white shadow-green-200'}`}>
                                                {selectedStudent.studentStatus === 'out' ? 'Outside' : 'Inside Campus'}
                                            </span>
                                        </div>

                                        {/* Registration ID + Hostel & Room + Recent History in 1 Row (Mobile & Desktop) */}
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-6 mt-1 sm:mt-2">
                                            <div className="flex flex-col items-start group">
                                                <p className="text-[7.5px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Registration ID</p>
                                                <p className="text-blue-600 font-extrabold text-[10px] sm:text-2xl tracking-tight">{selectedStudent.registrationId || "N/A"}</p>
                                            </div>

                                            <div className="w-[1px] h-6 sm:h-10 bg-slate-200" />

                                            <div className="flex flex-col items-start group">
                                                <p className="text-[7.5px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Hostel & Room</p>
                                                <p className="text-gray-900 font-extrabold text-[10px] sm:text-2xl tracking-tight">{formatHostelDisplay(selectedStudent.hostelName)} • {selectedStudent.roomNumber}</p>
                                            </div>

                                            <div className="w-[1px] h-6 sm:h-10 bg-slate-200" />

                                            {/* Recent History — Side-by-Side OUT and IN Timestamps */}
                                            <div className="flex flex-col items-start px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50/90 rounded-lg sm:rounded-2xl border border-slate-200/80 shrink-0 shadow-sm">
                                                <p className="text-[7px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Recent Outing Record</p>
                                                {lastOuting ? (
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        {/* OUT TIMESTAMP */}
                                                        <div className="flex flex-col px-2 py-1 bg-red-50/90 rounded-lg border border-red-100 min-w-[75px] sm:min-w-[90px]">
                                                            <span className="text-[7px] sm:text-[8px] font-black text-red-500 uppercase tracking-tight">OUT 🚪</span>
                                                            <span className="text-red-700 font-extrabold text-[8.5px] sm:text-xs leading-tight">
                                                                {formatDateDDMMYYYY(lastOuting.checkOutISTDate || lastOuting.checkOutTime)}
                                                            </span>
                                                            <span className="text-red-600 font-bold text-[8px] sm:text-[10px] tabular-nums">
                                                                {formatISTTimeAMPM(lastOuting.checkOutISTTime, lastOuting.checkOutTime)}
                                                            </span>
                                                        </div>

                                                        {/* IN TIMESTAMP OR STILL OUTSIDE */}
                                                        {lastOuting.status === 'in' || lastOuting.checkInISTTime || lastOuting.checkInTime ? (
                                                            <div className="flex flex-col px-2 py-1 bg-green-50/90 rounded-lg border border-green-100 min-w-[75px] sm:min-w-[90px]">
                                                                <span className="text-[7px] sm:text-[8px] font-black text-green-600 uppercase tracking-tight">IN 🏠</span>
                                                                <span className="text-green-700 font-extrabold text-[8.5px] sm:text-xs leading-tight">
                                                                    {formatDateDDMMYYYY(lastOuting.checkInISTDate || lastOuting.checkInTime || lastOuting.checkOutISTDate || lastOuting.checkOutTime)}
                                                                </span>
                                                                <span className="text-green-600 font-bold text-[8px] sm:text-[10px] tabular-nums">
                                                                    {formatISTTimeAMPM(lastOuting.checkInISTTime || lastOuting.checkOutISTTime, lastOuting.checkInTime || lastOuting.checkOutTime)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col px-2 py-1 bg-amber-50 rounded-lg border border-amber-200 min-w-[75px] sm:min-w-[90px] justify-center">
                                                                <span className="text-[7px] sm:text-[8px] font-black text-amber-600 uppercase tracking-tight">STATUS</span>
                                                                <span className="text-amber-700 font-extrabold text-[9px] sm:text-xs">🔴 Outside</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[8px] sm:text-xs text-gray-400 font-semibold italic">No gate pass history yet</p>
                                                )}
                                            </div>
                                        </div>

                                    </div>

                                    {/* RIGHT: Profile Picture */}
                                    <div className="order-2 sm:order-1 shrink-0 mt-3 sm:-mt-8 z-10">
                                        <div className="w-24 h-24 sm:w-48 sm:h-48 rounded-2xl sm:rounded-[2rem] ring-[3px] ring-blue-500 shadow-[0_10px_30px_rgba(0,0,0,0.15)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                                            <div className="w-full h-full rounded-2xl sm:rounded-[2rem] bg-gray-50 flex items-center justify-center text-3xl sm:text-7xl font-black text-blue-600 overflow-hidden">
                                                {selectedStudent.profilePicture ? (
                                                    <img src={selectedStudent.profilePicture} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                                                        {selectedStudent.name?.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Cards Grid — 2 cols on mobile */}
                                <div className="flex-1 px-4 sm:px-10 pb-6 sm:pb-8 grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-x-12 sm:gap-y-8 bg-gray-50/50 pt-4 sm:pt-8 border-t border-gray-100">
                                    {[
                                        { label: "College Name", value: selectedStudent.collegeName || "N/A", icon: "🎓" },
                                        { label: "ERP ID", value: selectedStudent.erpId || selectedStudent.erpInformation || "N/A", icon: "🆔", valueClass: "text-blue-600" },
                                        { label: "Branch", value: selectedStudent.branch || "N/A", icon: "📚" },
                                        { label: "Year & Sem", value: `${selectedStudent.year || "N/A"} • ${selectedStudent.semester || "N/A"}`, icon: "📅" },
                                        { label: "Mobile", value: selectedStudent.phoneNumber || "N/A", icon: "📞" },
                                        { label: "Email", value: selectedStudent.email || "N/A", icon: <span className="text-[#FBBC05]">📧</span> },
                                        { label: "Father Name", value: selectedStudent.fatherName || "N/A", icon: "👨‍👦" },
                                        { label: "Father Mobile", value: selectedStudent.fatherNumber || "N/A", icon: "📱" },
                                        { label: "Mother Name", value: selectedStudent.motherName || "N/A", icon: "👩‍👦" },
                                        { label: "Mother Mobile", value: selectedStudent.motherNumber || "N/A", icon: "📱" },
                                        { label: "Permanent Address", value: `${selectedStudent.permanentAddress || "N/A"}${selectedStudent.homeState ? `, ${selectedStudent.homeState}` : ""}`, icon: "🏠", fullWidth: true },
                                    ].map((item: any, idx) => (
                                        <div key={idx} className={`flex gap-2 sm:gap-4 items-start bg-white p-2.5 sm:p-0 sm:bg-transparent rounded-xl sm:rounded-none border border-gray-100 sm:border-0 shadow-sm sm:shadow-none ${item.fullWidth ? 'col-span-2 lg:col-span-3' : ''}`}>
                                            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gray-50 sm:bg-white shadow-sm flex items-center justify-center text-sm sm:text-lg shrink-0 border border-gray-100">{item.icon}</div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                                                <p className={`text-[10px] sm:text-sm font-black m-0 break-words ${item.fullWidth ? '' : 'line-clamp-2'} ${item.valueClass || 'text-gray-900'}`}>
                                                    {item.value !== "N/A" && (item.label.toLowerCase().includes("mobile") || item.label.toLowerCase().includes("phone")) ? (
                                                        <a href={`tel:${item.value}`} className="hover:text-blue-600 transition-colors">
                                                            {item.value}
                                                        </a>
                                                    ) : item.value !== "N/A" && item.label.toLowerCase().includes("email") ? (
                                                        <a href={`mailto:${item.value}`} className="hover:text-blue-600 transition-colors">
                                                            {item.value}
                                                        </a>
                                                    ) : (
                                                        item.value
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center p-8 text-center">
                                <span className="text-4xl mb-4">🔍</span>
                                <h3 className="text-lg font-bold text-gray-800">Profile Not Found</h3>
                                <p className="text-gray-500 text-sm mt-1">Could not retrieve detailed information for this student ID.</p>
                                <button
                                    onClick={() => setIsProfileModalOpen(false)}
                                    className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs"
                                >
                                    Close Window
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Export Preview Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in transition-all">
                    <div className="bg-[#121421] rounded-2xl sm:rounded-3xl w-full max-w-6xl max-h-[92vh] sm:max-h-[85vh] h-auto sm:h-[85vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col relative animate-in zoom-in-95">
                        
                        {/* Close Button (top right) */}
                        <button
                            onClick={() => setIsExportModalOpen(false)}
                            className="absolute top-2.5 sm:top-5 right-2.5 sm:right-6 w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs sm:text-base transition-all z-30 border border-white/10"
                            title="Close"
                        >
                            ✕
                        </button>

                        <div className="p-3 sm:p-6 border-b border-white/10 bg-[#161a29] shrink-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-2.5 sm:mb-5 pr-8 sm:pr-12">
                                <div>
                                    <h2 className="text-sm sm:text-xl font-black text-white m-0 flex items-center gap-1.5">📥 Export Data Preview</h2>
                                    <p className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Reviewing {exportData.length} records before download</p>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-4">
                                    <button
                                        onClick={() => setIsExportModalOpen(false)}
                                        className="px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] sm:text-xs font-bold transition-all text-white/80"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={performDownload}
                                        className="px-4 sm:px-8 py-1.5 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-white"
                                    >
                                        🔥 Confirm & Download
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 p-2.5 sm:p-4 bg-black/40 rounded-xl sm:rounded-2xl border border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] sm:text-[10px] font-black text-white/50 uppercase tracking-widest">1. Select Columns & Drag to Reorder</span>
                                    <span className="hidden sm:inline text-[9px] text-blue-400/60 font-medium italic">Tip: Drag items left/right to change position in Excel</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-h-28 sm:max-h-none overflow-y-auto no-scrollbar">
                                    {columnOrder.map((colId) => {
                                        const col = availableColumnsData.find(c => c.id === colId)!;
                                        const isSelected = selectedColumns.has(col.id);
                                        return (
                                            <div
                                                key={col.id}
                                                draggable
                                                onDragStart={() => handleDragStart(col.id)}
                                                onDragOver={handleDragOver}
                                                onDrop={() => handleDrop(col.id)}
                                                className={`group flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border transition-all cursor-move select-none animate-in fade-in duration-300 ${isSelected
                                                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                                    : "bg-white/5 border-white/10 text-white/20 opacity-60 hover:opacity-100"
                                                    } ${draggedColumnId === col.id ? "opacity-30 scale-95 border-dashed border-blue-500" : ""}`}
                                            >
                                                <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-2 h-0.5 sm:w-2.5 sm:h-0.5 bg-current rounded-full" />
                                                    <div className="w-2 h-0.5 sm:w-2.5 sm:h-0.5 bg-current rounded-full" />
                                                    <div className="w-2 h-0.5 sm:w-2.5 sm:h-0.5 bg-current rounded-full" />
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => { e.stopPropagation(); toggleColumn(col.id); }}
                                                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border-white/20 bg-transparent text-blue-600 focus:ring-0 cursor-pointer"
                                                />
                                                <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-tight">{col.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto no-scrollbar p-0">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="sticky top-0 bg-[#121421] z-10">
                                    <tr>
                                        {columnOrder.map((colId) => {
                                            const col = availableColumnsData.find(c => c.id === colId)!;
                                            return selectedColumns.has(col.id) && (
                                                <th key={col.id} className="px-3 sm:px-6 py-2.5 sm:py-5 text-[8px] sm:text-[10px] font-black text-white/30 uppercase tracking-[0.2em] border-b border-white/5 bg-[#121421]">{col.label}</th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {exportData.map((r, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                            {columnOrder.map((colId) => {
                                                if (!selectedColumns.has(colId)) return null;

                                                switch (colId) {
                                                    case "name": return <td key="name" className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-xs font-bold text-white border-b border-white/5">{r.studentName}</td>;
                                                    case "phone": return <td key="phone" className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-xs font-medium text-blue-400 border-b border-white/5 font-mono">{r.phoneNumber || r.phone || "---"}</td>;
                                                    case "regId": return <td key="regId" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-white/40 border-b border-white/5 uppercase">{r.registrationId}</td>;
                                                    case "erpId": return <td key="erpId" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-indigo-400/80 border-b border-white/5 uppercase">{r.erpId || "---"}</td>;
                                                    case "hostel": return <td key="hostel" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-white/70 border-b border-white/5">{formatHostelDisplay(r.hostelName)}</td>;
                                                    case "room": return <td key="room" className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-xs font-bold text-white/90 border-b border-white/5">{r.roomNumber}</td>;
                                                    case "outTime": return (
                                                        <td key="outTime" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-[11px] font-medium text-white/40 border-b border-white/5">
                                                            <span className="text-white/80">{r.checkOutISTTime}</span> <br /> {r.checkOutISTDate}
                                                        </td>
                                                    );
                                                    case "inTime": return (
                                                        <td key="inTime" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-[11px] font-medium text-white/40 border-b border-white/5">
                                                             {r.status === 'in' || r.status === 'auto-resolved' ? (
                                                                <>
                                                                    <span className="text-green-400">{r.checkInISTTime}</span> <br /> {r.checkInISTDate}
                                                                </>
                                                            ) : "---"}
                                                        </td>
                                                    );
                                                    case "duration": return (
                                                        <td key="duration" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-black border-b border-white/5">
                                                            <span className={r.status === 'out' ? 'text-red-400' : 'text-blue-400'}>{formatDuration(r.durationMinutes)}</span>
                                                        </td>
                                                    );
                                                    case "status": return (
                                                        <td key="status" className="px-3 sm:px-6 py-2 sm:py-4 border-b border-white/5">
                                                            <span className={`px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-tighter ${r.status === 'out' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                                                {r.status === 'out' ? 'OUT' : 'IN'}
                                                            </span>
                                                        </td>
                                                    );
                                                    case "fatherName": return <td key="fatherName" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-white/60 border-b border-white/5">{r.fatherName || "---"}</td>;
                                                    case "fatherNumber": return <td key="fatherNumber" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-medium text-blue-400/70 border-b border-white/5 font-mono">{r.fatherNumber || "---"}</td>;
                                                    case "motherName": return <td key="motherName" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-white/60 border-b border-white/5">{r.motherName || "---"}</td>;
                                                    case "motherNumber": return <td key="motherNumber" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-medium text-blue-400/70 border-b border-white/5 font-mono">{r.motherNumber || "---"}</td>;
                                                    default: return null;
                                                }
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                    opacity: 0.5;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
