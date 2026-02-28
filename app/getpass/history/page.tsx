"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";

export default function OutingHistoryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

    // Filters State
    const [filters, setFilters] = useState({
        collegeName: "all",
        hostelName: "all",
        status: "all",
        startDate: "",
        endDate: "",
        search: ""
    });

    const [hostelsList, setHostelsList] = useState<any[]>([]);

    // Profile Modal State
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);

    const colleges = ["OIST", "OCT", "OCP", "OPM", "OIPR"];

    useEffect(() => {
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
                startDate: filters.startDate,
                endDate: filters.endDate,
                search: filters.search
            });

            const response = await fetch(`/api/getpass/history?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setRecords(data.records);
                setPagination(data.pagination);
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

    const fetchStudentProfile = async (studentId: string) => {
        if (!studentId) return;
        setIsLoadingProfile(true);
        setIsProfileModalOpen(true);
        try {
            const response = await fetch(`/api/students/${studentId}`);
            const data = await response.json();
            if (data.success && data.student) {
                setSelectedStudent(data.student);
            } else {
                setSelectedStudent(null);
            }
        } catch (err) {
            console.error("Error fetching student profile:", err);
            setSelectedStudent(null);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams({
                limit: "10000",
                collegeName: filters.collegeName,
                hostelName: filters.hostelName,
                status: filters.status,
                startDate: filters.startDate,
                endDate: filters.endDate,
                search: filters.search
            });

            const response = await fetch(`/api/getpass/history?${params.toString()}`);
            const data = await response.json();

            if (data.success && data.records.length > 0) {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet("Outing History");

                // Define Columns
                worksheet.columns = [
                    { header: "Student Name", key: "name", width: 25 },
                    { header: "Mobile number", key: "phone", width: 15 },
                    { header: "Registration ID", key: "regId", width: 18 },
                    { header: "Hostel", key: "hostel", width: 25 },
                    { header: "Room", key: "room", width: 10 },
                    { header: "Out Time", key: "outTime", width: 22 },
                    { header: "In Time", key: "inTime", width: 22 },
                    { header: "Duration", key: "duration", width: 12 },
                    { header: "Status", key: "status", width: 10 }
                ];

                // Add Data
                data.records.forEach((r: any) => {
                    worksheet.addRow({
                        name: r.studentName,
                        phone: r.phoneNumber || "",
                        regId: r.registrationId,
                        hostel: r.hostelName,
                        room: r.roomNumber,
                        outTime: `${r.checkOutISTTime} ${r.checkOutISTDate}`,
                        inTime: r.status === 'in' ? `${r.checkInISTTime} ${r.checkInISTDate}` : "Still Outside",
                        duration: formatDuration(r.durationMinutes),
                        status: r.status === 'out' ? "OUT" : "IN"
                    });
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
            } else {
                alert("No records found to export");
            }
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

                <div className="flex items-center gap-3 sm:gap-6">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all active:scale-95"
                    >
                        <span className="hidden sm:inline">📥</span> Export
                    </button>
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">Total Logs</span>
                        <span className="text-lg font-black text-white tabular-nums">{pagination.total}</span>
                    </div>
                </div>
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
                            {hostelsList.map(h => <option key={h._id} value={h.name}>{h.name}</option>)}
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
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-8">
                            {records.map((record) => (
                                <div key={record._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 px-3 bg-[#121421]/90 rounded-2xl border border-white/5 transition-all hover:bg-[#161a29]/90 hover:border-blue-500/20 group gap-2.5">
                                    <div className="flex items-center gap-3 w-full">
                                        <div
                                            onClick={() => fetchStudentProfile(record.studentId)}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base text-white cursor-pointer transition-all hover:scale-105 shadow-xl shrink-0 ${record.status === 'out' ? 'bg-[#ff6b6b] shadow-red-500/20' : 'bg-[#00ff88] shadow-green-500/20'}`}
                                        >
                                            {record.studentName?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                onClick={() => fetchStudentProfile(record.studentId)}
                                                className="text-sm font-bold text-white m-0 cursor-pointer hover:text-blue-400 transition-colors leading-tight truncate"
                                            >
                                                {record.studentName}
                                            </p>
                                            <p className="text-[10px] text-white/70 mt-1 font-medium truncate uppercase tracking-tighter">
                                                {record.hostelName} • Room {record.roomNumber}
                                            </p>
                                            <p className="text-[9px] text-blue-400 font-medium truncate uppercase tracking-tighter mt-0.5">
                                                {record.registrationId}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center w-full sm:w-auto gap-3 sm:gap-5 pt-2.5 sm:pt-0 border-t border-white/5 sm:border-0">
                                        <div className="flex flex-col items-start sm:items-end gap-1 flex-1">
                                            <div className="flex flex-col items-start sm:items-end">
                                                <span className="text-[7px] text-white/50 font-medium uppercase tracking-tighter leading-none mb-0.5">{record.checkOutISTDate}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[8px] text-white/70 font-black uppercase tracking-tighter">Out:</span>
                                                    <span className="text-[10px] font-bold text-white tabular-nums">{record.checkOutISTTime}</span>
                                                </div>
                                            </div>

                                            {record.status === 'in' ? (
                                                <div className="flex flex-col items-start sm:items-end mt-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[8px] text-white/70 font-black uppercase tracking-tighter">In:</span>
                                                        <span className="text-[10px] font-bold text-green-400 tabular-nums">{record.checkInISTTime}</span>
                                                    </div>
                                                    <span className="text-[7px] text-white/50 font-medium uppercase tracking-tighter leading-none mt-0.5">{record.checkInISTDate}</span>
                                                    {record.type === 'leave' && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <span className="text-[7px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-black uppercase tracking-tighter">🏠 Home Leave</span>
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
                                onClick={() => setFilters({ collegeName: "all", hostelName: "all", status: "all", startDate: "", endDate: "", search: "" })}
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

            {/* Profile Modal - Reusing logic but styled for dark mode */}
            {isProfileModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in transition-all cursor-pointer"
                    onClick={() => setIsProfileModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col relative animate-in zoom-in-95 cursor-default text-gray-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isLoadingProfile ? (
                            <div className="h-[400px] flex flex-col items-center justify-center gap-4 p-8">
                                <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
                                <p className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Searching Profile...</p>
                            </div>
                        ) : selectedStudent ? (
                            <div className="flex flex-col h-full">
                                {/* Header Banner */}
                                <div className="h-14 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 shrink-0 relative">
                                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />

                                    {/* Sticky Close Button inside scrollable area */}
                                    <button
                                        onClick={() => setIsProfileModalOpen(false)}
                                        className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all z-[110] border border-white/10"
                                    >
                                        <span className="text-xl">✕</span>
                                    </button>
                                </div>

                                {/* Profile Section */}
                                <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-10 relative">
                                    {/* Profile Picture Box */}
                                    <div className="w-32 h-32 sm:w-48 sm:h-48 rounded-[2rem] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.2)] -mt-8 shrink-0 z-10 border border-white/50">
                                        <div className="w-full h-full rounded-[1.6rem] bg-gray-50 flex items-center justify-center text-4xl sm:text-7xl font-black text-blue-600 overflow-hidden shadow-inner ring-1 ring-black/5">
                                            {selectedStudent.profilePicture ? (
                                                <img src={selectedStudent.profilePicture} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                                                    {selectedStudent.name?.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 text-center sm:text-left pt-2 sm:pt-0">
                                        <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-4 mb-3 sm:mb-4">
                                            <h2 className="text-2xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">{selectedStudent.name}</h2>
                                            <span className={`px-4 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm ${selectedStudent.studentStatus === 'out' ? 'bg-red-500 text-white shadow-red-200' : 'bg-green-500 text-white shadow-green-200'}`}>
                                                {selectedStudent.studentStatus === 'out' ? 'Outside' : 'Inside Campus'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
                                            <div className="flex flex-col items-center sm:items-start group">
                                                <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1 group-hover:text-blue-500 transition-colors">Registration ID</p>
                                                <p className="text-blue-600 font-extrabold text-lg sm:text-2xl tracking-tight">{selectedStudent.registrationId || "N/A"}</p>
                                            </div>
                                            <div className="hidden sm:block w-px h-10 sm:h-12 bg-gray-100/80" />
                                            <div className="flex flex-col items-center sm:items-start group">
                                                <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1 group-hover:text-blue-500 transition-colors">Hostel & Room</p>
                                                <p className="text-gray-900 font-extrabold text-lg sm:text-2xl tracking-tight">{selectedStudent.hostelName} • {selectedStudent.roomNumber}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4 sm:px-10 pb-8 grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-12 gap-y-4 sm:gap-y-8 bg-gray-50/50 pt-6 sm:pt-8 border-t border-gray-100 flex-1">
                                    {[
                                        { label: "College Name", value: selectedStudent.collegeName || "N/A", icon: "🎓" },
                                        { label: "ERP ID", value: selectedStudent.erpInformation || "N/A", icon: "🆔", valueClass: "text-blue-600" },
                                        { label: "Branch", value: selectedStudent.branch || "N/A", icon: "📚" },
                                        { label: "Year & Sem", value: `${selectedStudent.year || "N/A"} • ${selectedStudent.semester || "N/A"}`, icon: "📅" },
                                        { label: "Mobile", value: selectedStudent.phoneNumber || "N/A", icon: "📞" },
                                        { label: "Email", value: selectedStudent.email || "N/A", icon: "📧" },
                                        { label: "Father Name", value: selectedStudent.fatherName || "N/A", icon: "👨‍👦" },
                                        { label: "Father Mobile", value: selectedStudent.fatherNumber || "N/A", icon: "📱" },
                                        { label: "Mother Name", value: selectedStudent.motherName || "N/A", icon: "👩‍👦" },
                                        { label: "Mother Mobile", value: selectedStudent.motherNumber || "N/A", icon: "📱" },
                                        { label: "Permanent Address", value: `${selectedStudent.permanentAddress || "N/A"}${selectedStudent.homeState ? `, ${selectedStudent.homeState}` : ""}`, icon: "🏠", fullWidth: true },
                                    ].map((item: any, idx) => (
                                        <div key={idx} className={`flex gap-3 sm:gap-4 items-start bg-white/60 p-2.5 sm:p-0 rounded-xl sm:bg-transparent border border-white sm:border-0 shadow-sm sm:shadow-none ${item.fullWidth ? 'col-span-2 lg:col-span-3' : ''}`}>
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white shadow-sm flex items-center justify-center text-base sm:text-lg shrink-0 border border-gray-50">{item.icon}</div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[7px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">{item.label}</p>
                                                <p className={`text-[10px] sm:text-sm font-bold m-0 break-words ${item.fullWidth ? '' : 'line-clamp-2'} ${item.valueClass || 'text-gray-900'}`}>{item.value}</p>
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
