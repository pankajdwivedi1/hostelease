"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import FastAvatar, { preloadFastImage } from "@/app/components/FastAvatar";

const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const getDaysAgoYMD = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return formatYMD(d);
};

const getMonthStartYMD = () => {
    const d = new Date();
    d.setDate(1);
    return formatYMD(d);
};

const getInitialDateFilters = () => {
    return {
        startDate: getDaysAgoYMD(7),
        endDate: getDaysAgoYMD(0)
    };
};

export default function OutingHistoryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1, leaveCount: 0, passCount: 0 });

    // Filters State - Default to last 7 days for bandwidth and performance optimization
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getInitialDateFilters();
        return {
            collegeName: "all",
            semester: "all",
            hostelName: "all",
            status: "all",
            type: "all",
            startDate,
            endDate,
            timeMode: "out" as "out" | "in",
            startTime: "",
            endTime: "",
            search: ""
        };
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
        { id: "sno", label: "S.No", width: 8 },
        { id: "name", label: "Student Name", width: 24 },
        { id: "phone", label: "Mobile", width: 15 },
        { id: "regId", label: "Reg. ID", width: 16 },
        { id: "erpId", label: "ERP ID", width: 16 },
        { id: "semester", label: "Semester", width: 12 },
        { id: "hostel", label: "Hostel", width: 22 },
        { id: "room", label: "Room", width: 10 },
        { id: "outDate", label: "Out Date", width: 14 },
        { id: "outTime", label: "Out Time", width: 14 },
        { id: "inDate", label: "In Date", width: 14 },
        { id: "inTime", label: "In Time", width: 14 },
        { id: "duration", label: "Duration", width: 12 },
        { id: "type", label: "Pass Type", width: 14 },
        { id: "status", label: "Status", width: 10 },
        { id: "reason", label: "Reason / Remarks", width: 24 },
        { id: "fatherName", label: "Father Name", width: 20 },
        { id: "fatherNumber", label: "Father Mobile", width: 15 },
        { id: "motherName", label: "Mother Name", width: 20 },
        { id: "motherNumber", label: "Mother Mobile", width: 15 }
    ];

    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set([
        "sno", "name", "phone", "regId", "erpId", "hostel", "room", "outDate", "outTime", "inDate", "inTime", "duration", "type", "status"
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
    const semesters = ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"];

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
                semester: filters.semester,
                hostelName: filters.hostelName,
                status: filters.status,
                type: filters.type,
                startDate: filters.startDate,
                endDate: filters.endDate,
                timeMode: filters.timeMode,
                startTime: filters.startTime,
                endTime: filters.endTime,
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
        } catch (error: any) {
            console.warn("History fetch warning:", error?.message || error);
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

    const setPresetRange = (preset: 'today' | '7days' | 'month' | 'all') => {
        const today = formatYMD(new Date());
        if (preset === 'today') {
            setFilters(prev => ({ ...prev, startDate: today, endDate: today }));
        } else if (preset === '7days') {
            setFilters(prev => ({ ...prev, startDate: getDaysAgoYMD(7), endDate: today }));
        } else if (preset === 'month') {
            setFilters(prev => ({ ...prev, startDate: getMonthStartYMD(), endDate: today }));
        } else if (preset === 'all') {
            setFilters(prev => ({ ...prev, startDate: "", endDate: "" }));
        }
    };

    const fetchStudentProfile = async (idOrObject: any, fallbackRecord?: any) => {
        const studentId = typeof idOrObject === 'object' ? idOrObject._id || idOrObject.id : idOrObject;
        if (!studentId || studentId === "[object Object]") return;

        setSelectedStudentId(studentId);

        let initialStudent: any = null;
        if (fallbackRecord) {
            const s = fallbackRecord.student || {};
            initialStudent = {
                _id: studentId,
                id: studentId,
                name: fallbackRecord.studentName || s.name || fallbackRecord.name || "Student",
                hostelName: fallbackRecord.hostelName || s.hostelName || "",
                roomNumber: fallbackRecord.roomNumber || s.roomNumber || "",
                registrationId: fallbackRecord.registrationId || s.registrationId || "",
                phoneNumber: fallbackRecord.phoneNumber || s.phoneNumber || "",
                fatherName: fallbackRecord.fatherName || s.fatherName || "",
                fatherNumber: fallbackRecord.fatherNumber || s.fatherNumber || "",
                motherName: fallbackRecord.motherName || s.motherName || "",
                motherNumber: fallbackRecord.motherNumber || s.motherNumber || "",
                erpInformation: fallbackRecord.erpInformation || fallbackRecord.erpId || s.erpInformation || s.erpId || "",
                erpId: fallbackRecord.erpId || s.erpId || fallbackRecord.erpInformation || "",
                studentStatus: fallbackRecord.status === "out" ? "out" : "in",
                collegeName: fallbackRecord.collegeName || s.collegeName || "",
                branch: fallbackRecord.branch || s.branch || "",
                year: fallbackRecord.year || s.year || "",
                semester: fallbackRecord.semester || s.semester || "",
                permanentAddress: fallbackRecord.permanentAddress || s.permanentAddress || "",
                homeState: fallbackRecord.homeState || s.homeState || "",
                homePinCode: fallbackRecord.homePinCode || s.homePinCode || "",
                email: fallbackRecord.email || s.email || "",
                profilePicture: fallbackRecord.profilePicture || s.profilePicture || fallbackRecord.photo || s.photo || "",
                photo: fallbackRecord.photo || s.photo || fallbackRecord.profilePicture || s.profilePicture || "",
                outingType: fallbackRecord.type || fallbackRecord.outingType || fallbackRecord.requestType || s.outingType || s.requestType || "",
                leaveFrom: fallbackRecord.fromDateTime || fallbackRecord.leaveFrom || s.leaveFrom || "",
                leaveTo: fallbackRecord.toDateTime || fallbackRecord.leaveTo || fallbackRecord.expectedReturnDate || fallbackRecord.expectedReturnIstDate || s.leaveTo || "",
                leaveReason: fallbackRecord.reason || fallbackRecord.leaveReason || s.leaveReason || "",
            };
            if (initialStudent.profilePicture) {
                preloadFastImage(initialStudent.profilePicture);
            }
            setSelectedStudent(initialStudent);
            if (fallbackRecord.checkOutISTDate || fallbackRecord.checkOutTime || fallbackRecord.fromDateTime) {
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
                if (data.student.profilePicture) {
                    preloadFastImage(data.student.profilePicture);
                }
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
                semester: filters.semester,
                hostelName: filters.hostelName,
                status: filters.status,
                type: filters.type,
                startDate: filters.startDate,
                endDate: filters.endDate,
                timeMode: filters.timeMode,
                startTime: filters.startTime,
                endTime: filters.endTime,
                search: filters.search
            });

            const response = await fetch(`/api/getpass/history?${params.toString()}`);
            const data = await response.json();

            if (data.success && data.records.length > 0) {
                setExportData(data.records);

                // Auto-detect if export belongs to a single student
                const isSingle = data.records.length > 0 && data.records.every((r: any) =>
                    (r.studentName || '').trim().toLowerCase() === (data.records[0].studentName || '').trim().toLowerCase() &&
                    (r.registrationId || '').trim().toLowerCase() === (data.records[0].registrationId || '').trim().toLowerCase()
                );

                if (isSingle) {
                    setSelectedColumns(new Set([
                        "sno", "outDate", "outTime", "inDate", "inTime", "duration", "type", "status", "reason"
                    ]));
                } else {
                    setSelectedColumns(new Set([
                        "sno", "name", "phone", "regId", "erpId", "hostel", "room", "outDate", "outTime", "inDate", "inTime", "duration", "type", "status"
                    ]));
                }

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

            const isSingleStudent = exportData.length > 0 && exportData.every((r: any) => 
                (r.studentName || '').trim().toLowerCase() === (exportData[0].studentName || '').trim().toLowerCase() && 
                (r.registrationId || '').trim().toLowerCase() === (exportData[0].registrationId || '').trim().toLowerCase()
            );

            // Active Columns dynamically based on order and selection
            const activeColumnObjects = columnOrder
                .map(id => availableColumnsData.find(c => c.id === id))
                .filter(col => col && selectedColumns.has(col.id));

            if (activeColumnObjects.length === 0) {
                alert("Please select at least one column to export");
                return;
            }

            const numCols = activeColumnObjects.length;

            // Define column widths without automatic header (headers are placed on row 5)
            worksheet.columns = activeColumnObjects.map(col => ({
                key: col!.id,
                width: col!.width || 15
            }));

            // Prepare Period & Date text
            const periodText = filters.startDate && filters.endDate 
                ? `${formatDateDDMMYYYY(filters.startDate)} TO ${formatDateDDMMYYYY(filters.endDate)}` 
                : filters.startDate 
                    ? `FROM ${formatDateDDMMYYYY(filters.startDate)}` 
                    : filters.endDate 
                        ? `UNTIL ${formatDateDDMMYYYY(filters.endDate)}` 
                        : "ALL TIME";

            const now = new Date();
            const generatedDateStr = `${formatDateDDMMYYYY(now)} ${formatISTTimeAMPM(undefined, now.toISOString())}`;
            const firstRec = exportData[0] || {};

            const thinBorder = {
                top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
            };

            const headerBorder = {
                top: { style: 'thin' as const, color: { argb: 'FF0F172A' } },
                left: { style: 'thin' as const, color: { argb: 'FF0F172A' } },
                bottom: { style: 'thin' as const, color: { argb: 'FF0F172A' } },
                right: { style: 'thin' as const, color: { argb: 'FF0F172A' } }
            };

            // ROW 1: Branded Title Banner
            const titleText = isSingleStudent 
                ? "HOSTELEAZE - INDIVIDUAL STUDENT OUTING & MOVEMENT REPORT"
                : "HOSTELEAZE - STUDENT OUTING & GATEPASS REGISTER";

            worksheet.addRow([]);
            if (numCols > 1) {
                worksheet.mergeCells(1, 1, 1, numCols);
            }
            const row1 = worksheet.getRow(1);
            row1.height = 30;
            for (let c = 1; c <= numCols; c++) {
                const cell = worksheet.getCell(1, c);
                cell.font = { name: 'Calibri', size: 12.5, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                cell.border = headerBorder;
            }
            worksheet.getCell(1, 1).value = titleText;

            // ROW 2: Scope / Info Row 1
            const infoText1 = isSingleStudent
                ? `STUDENT: ${(firstRec.studentName || 'STUDENT').toUpperCase()}   •   REG ID: ${firstRec.registrationId || '---'}   •   ERP ID: ${firstRec.erpId || '---'}   •   HOSTEL: ${formatHostelDisplay(firstRec.hostelName)} (ROOM ${firstRec.roomNumber || '---'})`
                : `HOSTEL SCOPE: ${filters.hostelName && filters.hostelName !== 'all' ? formatHostelDisplay(filters.hostelName) : 'ALL HOSTELS'}   •   COLLEGE: ${filters.collegeName && filters.collegeName !== 'all' ? filters.collegeName.toUpperCase() : 'ALL COLLEGES'}   •   TYPE: ${filters.type === 'outing' ? 'DAILY PASS' : filters.type === 'leave' ? 'LEAVE LOGS' : 'ALL MOVEMENTS'}`;

            worksheet.addRow([]);
            if (numCols > 1) {
                worksheet.mergeCells(2, 1, 2, numCols);
            }
            const row2 = worksheet.getRow(2);
            row2.height = 22;
            for (let c = 1; c <= numCols; c++) {
                const cell = worksheet.getCell(2, c);
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = thinBorder;
            }
            worksheet.getCell(2, 1).value = infoText1;

            // ROW 3: Scope / Info Row 2
            const infoText2 = isSingleStudent
                ? `MOBILE: ${firstRec.phoneNumber || firstRec.phone || '---'}   •   COLLEGE: ${firstRec.collegeName || 'ALL COLLEGES'}   •   TOTAL OUTINGS: ${exportData.length}   •   PERIOD: ${periodText}   •   GENERATED: ${generatedDateStr}`
                : `TOTAL RECORDS: ${exportData.length}   •   PERIOD: ${periodText}   •   GENERATED: ${generatedDateStr}   •   SYSTEM: SUPER ADMIN DASHBOARD`;

            worksheet.addRow([]);
            if (numCols > 1) {
                worksheet.mergeCells(3, 1, 3, numCols);
            }
            const row3 = worksheet.getRow(3);
            row3.height = 20;
            for (let c = 1; c <= numCols; c++) {
                const cell = worksheet.getCell(3, c);
                cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF334155' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = thinBorder;
            }
            worksheet.getCell(3, 1).value = infoText2;

            // ROW 4: Spacer row
            const row4 = worksheet.addRow([]);
            row4.height = 10;

            // ROW 5: Table Column Headers
            const headerRow = worksheet.addRow(activeColumnObjects.map(col => col!.label));
            headerRow.height = 26;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                cell.border = headerBorder;
            });

            // ROW 6+: Data Rows
            exportData.forEach((r: any, idx: number) => {
                const rowValues = activeColumnObjects.map(col => {
                    switch (col!.id) {
                        case "sno": return idx + 1;
                        case "name": return r.studentName || "";
                        case "phone": return r.phoneNumber || r.phone || "";
                        case "regId": return r.registrationId || "";
                        case "erpId": return r.erpId || "";
                        case "semester": return r.semester || "";
                        case "hostel": return formatHostelDisplay(r.hostelName);
                        case "room": return r.roomNumber || "";
                        case "outDate": return formatDateDDMMYYYY(r.checkOutISTDate || r.checkOutTime);
                        case "outTime": return formatISTTimeAMPM(r.checkOutISTTime, r.checkOutTime);
                        case "inDate": return (r.status === 'in' || r.status === 'auto-resolved') ? formatDateDDMMYYYY(r.checkInISTDate || r.checkInTime) : "---";
                        case "inTime": return (r.status === 'in' || r.status === 'auto-resolved') ? formatISTTimeAMPM(r.checkInISTTime, r.checkInTime) : "Still Outside";
                        case "duration": return formatDuration(r.durationMinutes);
                        case "type": return r.type === 'leave' ? 'LEAVE' : 'GATEPASS';
                        case "status": return r.status === 'out' ? "OUT" : "IN";
                        case "reason": return r.reason || r.leaveReason || "---";
                        case "fatherName": return r.fatherName || "";
                        case "fatherNumber": return r.fatherNumber || "";
                        case "motherName": return r.motherName || "";
                        case "motherNumber": return r.motherNumber || "";
                        default: return "";
                    }
                });

                const dataRow = worksheet.addRow(rowValues);
                dataRow.height = 20;

                const isEven = idx % 2 === 0;
                const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

                dataRow.eachCell((cell, colNumber) => {
                    cell.font = { name: 'Calibri', size: 9.5 };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                    cell.border = thinBorder;

                    const colObj = activeColumnObjects[colNumber - 1];
                    if (colObj?.id === 'status') {
                        if (cell.value === 'OUT') {
                            cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
                        } else {
                            cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF16A34A' } };
                        }
                    } else if (colObj?.id === 'inTime' && cell.value === 'Still Outside') {
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
                    } else if (colObj?.id === 'type') {
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: cell.value === 'LEAVE' ? 'FF2563EB' : 'FF059669' } };
                    }
                });
            });

            // File Name
            const dateStamp = new Date().toISOString().split('T')[0];
            const cleanStudentName = (firstRec.studentName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = isSingleStudent 
                ? `Outing_Report_${cleanStudentName}_${dateStamp}.xlsx`
                : `Outing_Register_${dateStamp}.xlsx`;

            // Generate Buffer and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
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
            <div className="sticky top-0 z-50 bg-[#0d1117]/80 backdrop-blur-xl border-b border-[rgba(255,255,255,0.05)] px-2.5 sm:px-6 py-1.5 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        onClick={() => router.push('/getpass')}
                        className="p-1 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                        title="Back"
                    >
                        <span className="text-sm sm:text-xl group-hover:-translate-x-1 transition-transform inline-block">←</span>
                    </button>
                    <div>
                        <h1 className="text-sm sm:text-xl font-black m-0 flex items-center gap-1.5 sm:gap-2">
                            <span className="text-sm sm:text-base">📜</span> Outing History
                            <span className="hidden md:inline-block text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-tighter">Database Archives</span>
                        </h1>
                        <p className="text-[8px] sm:text-[11px] text-white/40 m-0 mt-0.5 font-medium uppercase tracking-widest">Student Logs</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-10">
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
                        className={`flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg ${filters.type === 'outing' ? 'bg-[#00ff881a] border border-[#00ff884d] text-[#00ff88] hover:bg-[#00ff8826]' : filters.type === 'leave' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30' : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white'}`}
                    >
                        {isExporting ? (
                            <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 rounded-full animate-spin ${filters.type === 'outing' ? 'border-[#00ff88] border-t-transparent' : filters.type === 'leave' ? 'border-blue-400 border-t-transparent' : 'border-white/40 border-t-transparent'}`} />
                        ) : (
                            <span className="text-[10px] sm:text-xs">📥</span>
                        )}
                        Export {filters.type === 'outing' ? 'Passes' : filters.type === 'leave' ? 'Leaves' : 'All'}
                    </button>
                </div>
            </div>

            {/* ── Mobile-only Stats Bar (Daily Pass / Leave Logs / Total Logs - Compact Tab Size & Font) ── */}
            <div className="sm:hidden flex items-stretch w-full bg-[#0a0a0f] border-b border-white/5">
                <button
                    onClick={() => setFilters(f => ({ ...f, type: f.type === 'outing' ? 'all' : 'outing' }))}
                    className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-all ${filters.type === 'outing' ? 'bg-[#00ff8810] border-b-2 border-[#00ff88]' : 'border-b-2 border-transparent'}`}
                >
                    <span className={`text-[7px] font-black uppercase tracking-wider leading-none ${filters.type === 'outing' ? 'text-[#00ff88]' : 'text-white/30'}`}>Daily Pass</span>
                    <span className={`text-xs font-black tabular-nums leading-tight ${filters.type === 'outing' ? 'text-[#00ff88]' : 'text-white'}`}>{pagination.passCount}</span>
                </button>

                <div className="w-px bg-white/10 self-stretch" />

                <button
                    onClick={() => setFilters(f => ({ ...f, type: f.type === 'leave' ? 'all' : 'leave' }))}
                    className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-all ${filters.type === 'leave' ? 'bg-blue-500/10 border-b-2 border-blue-400' : 'border-b-2 border-transparent'}`}
                >
                    <span className={`text-[7px] font-black uppercase tracking-wider leading-none ${filters.type === 'leave' ? 'text-blue-400' : 'text-white/30'}`}>Leave Logs</span>
                    <span className={`text-xs font-black tabular-nums leading-tight ${filters.type === 'leave' ? 'text-blue-400' : 'text-white'}`}>{pagination.leaveCount}</span>
                </button>

                <div className="w-px bg-white/10 self-stretch" />

                <button
                    onClick={() => setFilters(f => ({ ...f, type: 'all' }))}
                    className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-all ${filters.type === 'all' ? 'bg-white/5 border-b-2 border-white/30' : 'border-b-2 border-transparent'}`}
                >
                    <span className={`text-[7px] font-black uppercase tracking-wider leading-none ${filters.type === 'all' ? 'text-white/60' : 'text-white/20'}`}>Total Logs</span>
                    <span className={`text-xs font-black tabular-nums leading-tight ${filters.type === 'all' ? 'text-white' : 'text-white/40'}`}>{pagination.total}</span>
                </button>
            </div>

            <div className="max-w-[1600px] mx-auto p-2 sm:p-6 flex flex-col gap-3 sm:gap-6">
                {/* Filters Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-4 p-2.5 sm:p-5 bg-[#0a0a0f] border border-white/5 rounded-xl sm:rounded-2xl shadow-2xl">
                    {/* 1. College */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            College
                        </label>
                        <select
                            name="collegeName"
                            value={filters.collegeName}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-1.5 sm:px-4 py-1 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer truncate"
                        >
                            <option value="all">All Colleges</option>
                            {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* 2. Select Semester (Blue Pen Marking) */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            <span className="sm:hidden">Sem</span>
                            <span className="hidden sm:inline">Select Semester</span>
                        </label>
                        <select
                            name="semester"
                            value={filters.semester}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-1.5 sm:px-4 py-1 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer truncate"
                        >
                            <option value="all">All Semesters</option>
                            {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* 3. Select Hostel */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            <span className="sm:hidden">Hostel</span>
                            <span className="hidden sm:inline">Select Hostel</span>
                        </label>
                        <select
                            name="hostelName"
                            value={filters.hostelName}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-1.5 sm:px-4 py-1 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer truncate"
                        >
                            <option value="all">All Hostels</option>
                            {hostelsList.map(h => <option key={h._id} value={h.name}>{formatHostelDisplay(h.name)}</option>)}
                        </select>
                    </div>

                    {/* 4. Status */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5 col-span-1">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            Status
                        </label>
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-1.5 sm:px-4 py-1 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer truncate"
                        >
                            <option value="all">All Moves</option>
                            <option value="out">Still Out</option>
                            <option value="in">Returned</option>
                        </select>
                    </div>

                    {/* 5. Out Since */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5 col-span-1">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            <span className="sm:hidden">Since</span>
                            <span className="hidden sm:inline">Out Since</span>
                        </label>
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-1 sm:px-4 py-1 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                    </div>

                    {/* 6. Out Until */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5 col-span-1">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            <span className="sm:hidden">Until</span>
                            <span className="hidden sm:inline">Out Until</span>
                        </label>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-1 sm:px-4 py-1 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                    </div>

                    {/* 7. Select Time (Compact col-span-1 with decreased size) */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-stretch gap-1 sm:gap-1.5 col-span-1">
                        {/* Mobile: Vertical Stack (OUT on top, IN directly below) */}
                        <div className="flex sm:hidden flex-col gap-0.5 shrink-0 w-[40px] ml-0.5">
                            <button
                                type="button"
                                onClick={() => setFilters(f => ({ ...f, timeMode: 'out' }))}
                                className={`w-full py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider transition-all leading-none text-center ${
                                    filters.timeMode !== 'in'
                                        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                                        : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
                                }`}
                                title="Out Time"
                            >
                                OUT
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilters(f => ({ ...f, timeMode: 'in', status: f.status === 'out' ? 'all' : f.status }))}
                                className={`w-full py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider transition-all leading-none text-center ${
                                    filters.timeMode === 'in'
                                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/50'
                                        : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
                                }`}
                                title="Return Time"
                            >
                                IN
                            </button>
                        </div>

                        {/* Desktop: Horizontal Header with Label + [Out] [In] Toggle + Clear Button */}
                        <div className="hidden sm:flex items-center justify-between ml-1 gap-1">
                            <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-white/40 font-black uppercase tracking-widest truncate">
                                    {filters.timeMode === 'in' ? 'Return Time' : 'Out Time'}
                                </label>
                                <div className="flex items-center bg-white/5 p-0.5 rounded border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setFilters(f => ({ ...f, timeMode: 'out' }))}
                                        className={`px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase transition-all ${
                                            filters.timeMode !== 'in' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
                                        }`}
                                        title="Out Time"
                                    >
                                        Out
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilters(f => ({ ...f, timeMode: 'in', status: f.status === 'out' ? 'all' : f.status }))}
                                        className={`px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase transition-all ${
                                            filters.timeMode === 'in' ? 'bg-emerald-600 text-white' : 'text-white/40 hover:text-white'
                                        }`}
                                        title="Return Time"
                                    >
                                        In
                                    </button>
                                </div>
                            </div>
                            {(filters.startTime || filters.endTime) && (
                                <button
                                    type="button"
                                    onClick={() => setFilters(f => ({ ...f, startTime: "", endTime: "" }))}
                                    className="text-[8.5px] text-red-400 hover:text-red-300 font-bold uppercase transition-colors px-1 py-0.5 rounded hover:bg-red-500/10"
                                    title="Clear time"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <div className={`flex-1 min-w-0 w-full h-[30px] sm:h-auto grid grid-cols-2 gap-0.5 bg-[#121421] border rounded-md sm:rounded-xl p-0.5 sm:p-1.5 transition-all ${
                            filters.timeMode === 'in' ? 'border-emerald-500/30 focus-within:border-emerald-500/60' : 'border-white/10 focus-within:border-blue-500/50'
                        }`}>
                            <div 
                                className="flex flex-col min-w-0 flex-1 cursor-pointer justify-center"
                                onClick={(e) => {
                                    const input = e.currentTarget.querySelector('input');
                                    try { input?.showPicker?.(); } catch (err) {}
                                }}
                            >
                                <span className={`text-[5.5px] sm:text-[7px] uppercase font-black px-0.5 leading-none ${filters.timeMode === 'in' ? 'text-emerald-400/70' : 'text-white/40'}`}>From</span>
                                <input
                                    type="time"
                                    name="startTime"
                                    value={filters.startTime || ""}
                                    onChange={handleFilterChange}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        try { e.currentTarget.showPicker?.(); } catch (err) {}
                                    }}
                                    aria-label="From Time"
                                    className="w-full bg-transparent text-[8.5px] sm:text-xs text-white focus:outline-none font-mono font-bold px-0.5 py-0 cursor-pointer min-w-0 leading-none"
                                />
                            </div>
                            <div 
                                className="flex flex-col min-w-0 flex-1 border-l border-white/10 pl-0.5 sm:pl-1 cursor-pointer justify-center"
                                onClick={(e) => {
                                    const input = e.currentTarget.querySelector('input');
                                    try { input?.showPicker?.(); } catch (err) {}
                                }}
                            >
                                <span className={`text-[5.5px] sm:text-[7px] uppercase font-black px-0.5 leading-none ${filters.timeMode === 'in' ? 'text-emerald-400/70' : 'text-white/40'}`}>To</span>
                                <input
                                    type="time"
                                    name="endTime"
                                    value={filters.endTime || ""}
                                    onChange={handleFilterChange}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        try { e.currentTarget.showPicker?.(); } catch (err) {}
                                    }}
                                    aria-label="To Time"
                                    className="w-full bg-transparent text-[8.5px] sm:text-xs text-white focus:outline-none font-mono font-bold px-0.5 py-0 cursor-pointer min-w-0 leading-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 8. Search ID (Box size matching FROM and TO box size) */}
                    <div className="flex flex-row items-center sm:flex-col sm:items-start gap-1 sm:gap-1.5 col-span-1">
                        <label className="text-[7.5px] sm:text-[10px] text-white/40 font-black uppercase tracking-wider sm:tracking-widest shrink-0 w-[40px] sm:w-auto whitespace-nowrap ml-0.5 sm:ml-1">
                            <span className="sm:hidden">Search</span>
                            <span className="hidden sm:inline">Search ID</span>
                        </label>
                        <input
                            type="text"
                            name="search"
                            placeholder="ERP / Reg"
                            value={filters.search}
                            onChange={handleFilterChange}
                            className="flex-1 min-w-0 w-full h-[30px] sm:h-auto bg-[#121421] border border-white/10 rounded-md sm:rounded-xl px-2 sm:px-4 py-0 sm:py-2.5 text-[9.5px] sm:text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20 truncate"
                        />
                    </div>

                    {/* Quick Date Presets & Filter Reset */}
                    <div className="col-span-2 md:col-span-4 xl:col-span-8 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider mr-1">Quick Range:</span>
                            <button
                                type="button"
                                onClick={() => setPresetRange('7days')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                                    filters.startDate === getDaysAgoYMD(7) && filters.endDate === formatYMD(new Date())
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                                }`}
                            >
                                Last 7 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setPresetRange('today')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                                    filters.startDate === formatYMD(new Date()) && filters.endDate === formatYMD(new Date())
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                                }`}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => setPresetRange('month')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                                    filters.startDate === getMonthStartYMD() && filters.endDate === formatYMD(new Date())
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                                }`}
                            >
                                This Month
                            </button>
                            <button
                                type="button"
                                onClick={() => setPresetRange('all')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                                    !filters.startDate && !filters.endDate
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                                }`}
                            >
                                All Time
                            </button>

                            {/* Reset Filters on Mobile (Directly right side of All Time) */}
                            {(filters.startDate || filters.endDate || filters.startTime || filters.endTime || filters.collegeName !== "all" || filters.semester !== "all" || filters.hostelName !== "all" || filters.status !== "all" || filters.type !== "all" || filters.search) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const { startDate, endDate } = getInitialDateFilters();
                                        setFilters({ collegeName: "all", semester: "all", hostelName: "all", status: "all", type: "all", startDate, endDate, timeMode: "out", startTime: "", endTime: "", search: "" });
                                    }}
                                    className="sm:hidden text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20"
                                >
                                    <span>✕</span> Reset Filters
                                </button>
                            )}
                        </div>

                        {/* Reset Filters on Desktop (Kept on far right) */}
                        {(filters.startDate || filters.endDate || filters.startTime || filters.endTime || filters.collegeName !== "all" || filters.semester !== "all" || filters.hostelName !== "all" || filters.status !== "all" || filters.type !== "all" || filters.search) && (
                            <button
                                type="button"
                                onClick={() => {
                                    const { startDate, endDate } = getInitialDateFilters();
                                    setFilters({ collegeName: "all", semester: "all", hostelName: "all", status: "all", type: "all", startDate, endDate, timeMode: "out", startTime: "", endTime: "", search: "" });
                                }}
                                className="hidden sm:flex text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider items-center gap-1 transition-colors px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20"
                            >
                                <span>✕</span> Reset Filters
                            </button>
                        )}
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
                                <div key={record._id} className="flex flex-col justify-between py-2.5 px-3 bg-[#121421]/90 rounded-2xl border border-white/5 transition-all hover:bg-[#161a29]/90 hover:border-blue-500/20 group gap-1.5">
                                    {/* Row 1: Full-width Student Name + GATE-PASS Badge (No Truncation) */}
                                    <div className="flex items-center gap-2 min-w-0 flex-nowrap w-full">
                                        <p
                                            onClick={() => fetchStudentProfile(record.studentId, record)}
                                            className="text-sm font-bold text-white m-0 cursor-pointer hover:text-blue-400 transition-colors leading-tight truncate min-w-0"
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

                                    {/* Rows 2 & 3: Left side has Hostel/Room and Reg/Sem; Right side has OUT line and IN line + Duration */}
                                    <div className="flex items-center justify-between w-full gap-1 sm:gap-2 pt-1 border-t border-white/5">
                                        {/* Left Side: Row 2 (Hostel • Room) and Row 3 (Reg • Sem) */}
                                        <div className="min-w-0 flex flex-col justify-center gap-0.5 flex-1 pr-1">
                                            <p className="text-[9px] sm:text-[10px] text-white/70 font-medium truncate uppercase tracking-tighter">
                                                {formatHostelDisplay(record.hostelName)} • Room {record.roomNumber}
                                            </p>
                                            <p className="text-[8px] sm:text-[9px] text-blue-400 font-medium truncate uppercase tracking-tighter flex items-center gap-1 sm:gap-1.5">
                                                <span>{record.registrationId}</span>
                                                {record.semester && (
                                                    <>
                                                        <span className="text-white/20">•</span>
                                                        <span className="text-white/60 font-semibold">{record.semester}</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        {/* Vertical Separator Line (same as blue mark pen) */}
                                        <div className="w-px h-5 sm:h-6 bg-white/10 shrink-0 mx-0.5" />

                                        {/* Right Side: Row 2 right (OUT line) and Row 3 right (IN line) + DURATION box */}
                                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                                            <div className="flex flex-col items-end gap-0.5">
                                                {/* OUT Line (Right of Hostel • Room) */}
                                                <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                                                    <span className="text-[7.5px] sm:text-[8px] text-white/70 font-black uppercase tracking-tighter">Out:</span>
                                                    <span className="text-[9px] sm:text-[10px] font-bold text-white tabular-nums">{formatISTTimeAMPM(record.checkOutISTTime, record.checkOutTime)}</span>
                                                    <span className="text-white/10 text-[9px] sm:text-[10px]">|</span>
                                                    <span className="text-[9px] sm:text-[10px] text-white/40 font-bold tabular-nums whitespace-nowrap">{formatDateDDMMYYYY(record.checkOutISTDate || record.checkOutTime)}</span>
                                                </div>

                                                {/* IN Line (Right of Reg • Sem) */}
                                                {record.status === 'in' || record.status === 'auto-resolved' ? (
                                                    <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                                                        <span className="text-[7.5px] sm:text-[8px] text-white/70 font-black uppercase tracking-tighter">In:</span>
                                                        <span className="text-[9px] sm:text-[10px] font-bold text-green-400 tabular-nums">{formatISTTimeAMPM(record.checkInISTTime || record.checkOutISTTime, record.checkInTime || record.checkOutTime)}</span>
                                                        <span className="text-white/10 text-[9px] sm:text-[10px]">|</span>
                                                        <span className="text-[9px] sm:text-[10px] text-white/40 font-bold tabular-nums whitespace-nowrap">{formatDateDDMMYYYY(record.checkInISTDate || record.checkInTime || record.checkOutISTDate)}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 sm:gap-1.5 animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        <span className="text-[7.5px] sm:text-[8px] text-red-400 font-bold uppercase tracking-widest">Currently Out</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* DURATION Box */}
                                            <div className="min-w-[48px] sm:min-w-[62px] flex flex-col items-center justify-center px-1 sm:px-2 py-0.5 sm:py-1 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                                                <span className="text-[6.5px] sm:text-[7px] text-white/70 font-black uppercase tracking-widest mb-0.5">Duration</span>
                                                <span className={`text-[8.5px] sm:text-[9px] font-black tabular-nums ${record.status === 'out' ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {formatDuration(record.durationMinutes)}
                                                </span>
                                            </div>
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
                                onClick={() => {
                                    const { startDate, endDate } = getInitialDateFilters();
                                    setFilters({ collegeName: "all", semester: "all", hostelName: "all", status: "all", type: "all", startDate, endDate, timeMode: "out", startTime: "", endTime: "", search: "" });
                                }}
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
                                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 lg:gap-4 mt-1 sm:mt-2">
                                            <div className="flex flex-col items-start group shrink-0">
                                                <p className="text-[7.5px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Registration ID</p>
                                                <p className="text-blue-600 font-extrabold text-[10px] sm:text-base md:text-lg lg:text-xl tracking-tight">{selectedStudent.registrationId || "N/A"}</p>
                                            </div>

                                            <div className="w-[1px] h-6 sm:h-8 bg-slate-200 shrink-0" />

                                            <div className="flex flex-col items-start group shrink-0">
                                                <p className="text-[7.5px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Hostel & Room</p>
                                                <p className="text-gray-900 font-extrabold text-[10px] sm:text-base md:text-lg lg:text-xl tracking-tight">{formatHostelDisplay(selectedStudent.hostelName)} • {selectedStudent.roomNumber}</p>
                                            </div>

                                            <div className="w-[1px] h-6 sm:h-8 bg-slate-200 shrink-0" />

                                            {/* Recent History — Side-by-Side OUT and IN/EXPECTED Timestamps */}
                                            {(() => {
                                                const rawType = String((lastOuting as any)?.type || (lastOuting as any)?.requestType || selectedStudent?.outingType || selectedStudent?.requestType || '').toLowerCase();
                                                const isHomeLeave = rawType.includes('leave') || rawType === 'hleave';
                                                const isReturned = lastOuting?.status === 'in' || !!lastOuting?.checkInISTTime || !!lastOuting?.checkInTime;
                                                const isCurrentlyOut = !isReturned && (lastOuting?.status === 'out' || selectedStudent?.studentStatus === 'out');

                                                const fromDateVal = lastOuting?.checkOutISTDate || lastOuting?.checkOutTime || (lastOuting as any)?.fromDateTime || selectedStudent?.leaveFrom;
                                                const fromTimeVal = lastOuting?.checkOutISTTime || lastOuting?.checkOutTime || (lastOuting as any)?.fromDateTime || selectedStudent?.leaveFrom;

                                                let expectedReturnVal = (lastOuting as any)?.expectedReturnDate || (lastOuting as any)?.toDateTime || (lastOuting as any)?.expectedReturnIstDate || selectedStudent?.leaveTo || selectedStudent?.toDateTime;
                                                if (isHomeLeave && !expectedReturnVal && fromDateVal) {
                                                    try {
                                                        const fromDateObj = new Date(fromDateVal);
                                                        if (!isNaN(fromDateObj.getTime())) {
                                                            expectedReturnVal = new Date(fromDateObj.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
                                                        }
                                                    } catch (e) {}
                                                }
                                                const expectedReturnTimeVal = (lastOuting as any)?.expectedReturnIstTime || expectedReturnVal;

                                                const isOverdue = isCurrentlyOut && isHomeLeave && expectedReturnVal && new Date(expectedReturnVal).getTime() < Date.now();

                                                return (
                                                    <div className="flex flex-col items-start px-2 py-1 sm:px-2.5 sm:py-1.5 bg-slate-50/90 rounded-lg sm:rounded-xl border border-slate-200/80 shrink-0 shadow-sm">
                                                        <div className="flex items-center justify-between w-full gap-1.5 mb-0.5">
                                                            <p className="text-[6.5px] sm:text-[8px] font-black text-gray-500 uppercase tracking-widest">
                                                                {isHomeLeave ? "🏠 Home-Leave" : "Recent Outing"}
                                                            </p>
                                                            {isHomeLeave && isCurrentlyOut && (
                                                                <span className={`text-[6px] sm:text-[7.5px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider ${isOverdue ? "bg-red-100 text-red-700 border border-red-200 animate-pulse" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                                                                    {isOverdue ? "🚨 OVERDUE" : "ON LEAVE"}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {lastOuting ? (
                                                            <div className="flex items-center gap-1 sm:gap-2">
                                                                {/* OUT / LEAVE FROM TIMESTAMP */}
                                                                <div className="flex flex-col px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-50/90 rounded-md sm:rounded-lg border border-red-100 min-w-[68px] sm:min-w-[80px]">
                                                                    <span className="text-[6.5px] sm:text-[7.5px] font-black text-red-500 uppercase tracking-tight">
                                                                        {isHomeLeave ? "LEAVE FROM 🚪" : "OUT 🚪"}
                                                                    </span>
                                                                    <span className="text-red-700 font-extrabold text-[8px] sm:text-[10px] md:text-[11px] leading-tight">
                                                                        {formatDateDDMMYYYY(fromDateVal)}
                                                                    </span>
                                                                    <span className="text-red-600 font-bold text-[7px] sm:text-[8.5px] md:text-[9px] tabular-nums">
                                                                        {formatISTTimeAMPM(lastOuting.checkOutISTTime, fromTimeVal)}
                                                                    </span>
                                                                </div>

                                                                {/* IN TIMESTAMP (IF RETURNED) */}
                                                                {isReturned ? (
                                                                    <div className="flex flex-col px-1.5 py-0.5 sm:px-2 sm:py-1 bg-green-50/90 rounded-md sm:rounded-lg border border-green-100 min-w-[68px] sm:min-w-[80px]">
                                                                        <span className="text-[6.5px] sm:text-[7.5px] font-black text-green-600 uppercase tracking-tight">
                                                                            {isHomeLeave ? "RETURNED IN 🏠" : "IN 🏠"}
                                                                        </span>
                                                                        <span className="text-green-700 font-extrabold text-[8px] sm:text-[10px] md:text-[11px] leading-tight">
                                                                            {formatDateDDMMYYYY(lastOuting.checkInISTDate || lastOuting.checkInTime || lastOuting.checkOutISTDate || lastOuting.checkOutTime)}
                                                                        </span>
                                                                        <span className="text-green-600 font-bold text-[7px] sm:text-[8.5px] md:text-[9px] tabular-nums">
                                                                            {formatISTTimeAMPM(lastOuting.checkInISTTime || lastOuting.checkOutISTTime, lastOuting.checkInTime || lastOuting.checkOutTime)}
                                                                        </span>
                                                                    </div>
                                                                ) : isHomeLeave ? (
                                                                    /* EXPECTED COMING DATE (IF ON LEAVE) */
                                                                    <div className={`flex flex-col px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg border min-w-[68px] sm:min-w-[80px] ${isOverdue ? "bg-red-50/90 border-red-200" : "bg-blue-50/90 border-blue-200"}`}>
                                                                        <span className={`text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-tight ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                                                                            COMING 🏠
                                                                        </span>
                                                                        <span className={`font-extrabold text-[8px] sm:text-[10px] md:text-[11px] leading-tight ${isOverdue ? "text-red-700" : "text-blue-900"}`}>
                                                                            {expectedReturnVal ? formatDateDDMMYYYY(expectedReturnVal) : "Pending Return"}
                                                                        </span>
                                                                        <span className={`font-bold text-[7px] sm:text-[8.5px] md:text-[9px] tabular-nums ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                                                                            {expectedReturnVal ? formatISTTimeAMPM((lastOuting as any).expectedReturnIstTime, expectedReturnTimeVal) : "On Leave"}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    /* FALLBACK STATUS BOX (REGULAR GATE-PASS) */
                                                                    <div className="flex flex-col px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-50 rounded-md sm:rounded-lg border border-amber-200 min-w-[68px] sm:min-w-[80px] justify-center">
                                                                        <span className="text-[6.5px] sm:text-[7.5px] font-black text-amber-600 uppercase tracking-tight">STATUS</span>
                                                                        <span className="text-amber-700 font-extrabold text-[8.5px] sm:text-[10.5px]">
                                                                            🔴 Outside
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[8px] sm:text-xs text-gray-400 font-semibold italic">No gate pass history yet</p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                    </div>

                                    {/* RIGHT: Profile Picture */}
                                    <div className="order-2 sm:order-1 shrink-0 mt-3 sm:-mt-8 z-10">
                                        <div className="w-24 h-24 sm:w-48 sm:h-48 rounded-2xl sm:rounded-[2rem] ring-[3px] ring-blue-500 shadow-[0_10px_30px_rgba(0,0,0,0.15)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden">
                                            <FastAvatar
                                                src={selectedStudent.profilePicture || selectedStudent.photo}
                                                name={selectedStudent.name}
                                                className="w-full h-full rounded-2xl sm:rounded-[2rem]"
                                                sizeClass="text-3xl sm:text-7xl"
                                            />
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
                                        ...(selectedStudent.leaveReason ? [{ label: "Leave Reason", value: selectedStudent.leaveReason, icon: "📝", fullWidth: true, valueClass: "text-amber-800 font-bold" }] : []),
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
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <p className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-widest m-0">Reviewing {exportData.length} records</p>
                                        {exportData.length > 0 && exportData.every((r: any) => 
                                            (r.studentName || '').trim().toLowerCase() === (exportData[0].studentName || '').trim().toLowerCase() && 
                                            (r.registrationId || '').trim().toLowerCase() === (exportData[0].registrationId || '').trim().toLowerCase()
                                        ) ? (
                                            <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                                                👤 Student Report: {exportData[0].studentName} ({exportData[0].registrationId})
                                            </span>
                                        ) : (
                                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                                👥 Outing Register (All Students)
                                            </span>
                                        )}
                                    </div>
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
                                        if (!col) return null;
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
                                            const col = availableColumnsData.find(c => c.id === colId);
                                            if (!col) return null;
                                            return selectedColumns.has(col.id) && (
                                                <th key={col.id} className="px-3 sm:px-6 py-2.5 sm:py-5 text-[8px] sm:text-[10px] font-black text-white/30 uppercase tracking-[0.2em] border-b border-white/5 bg-[#121421] text-center">{col.label}</th>
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
                                                    case "sno": return <td key="sno" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-xs font-mono font-bold text-white/50 border-b border-white/5 text-center">{i + 1}</td>;
                                                    case "name": return <td key="name" className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-xs font-bold text-white border-b border-white/5">{r.studentName}</td>;
                                                    case "phone": return <td key="phone" className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-xs font-medium text-blue-400 border-b border-white/5 font-mono">{r.phoneNumber || r.phone || "---"}</td>;
                                                    case "regId": return <td key="regId" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-white/40 border-b border-white/5 uppercase">{r.registrationId}</td>;
                                                    case "erpId": return <td key="erpId" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-indigo-400/80 border-b border-white/5 uppercase">{r.erpId || "---"}</td>;
                                                    case "hostel": return <td key="hostel" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-bold text-white/70 border-b border-white/5">{formatHostelDisplay(r.hostelName)}</td>;
                                                    case "room": return <td key="room" className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-xs font-bold text-white/90 border-b border-white/5 text-center">{r.roomNumber}</td>;
                                                    case "outDate": return <td key="outDate" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-xs font-semibold text-white/90 border-b border-white/5 text-center">{formatDateDDMMYYYY(r.checkOutISTDate || r.checkOutTime)}</td>;
                                                    case "outTime": return <td key="outTime" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-xs font-mono text-amber-400 border-b border-white/5 text-center">{formatISTTimeAMPM(r.checkOutISTTime, r.checkOutTime)}</td>;
                                                    case "inDate": return <td key="inDate" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-xs font-semibold text-white/70 border-b border-white/5 text-center">{(r.status === 'in' || r.status === 'auto-resolved') ? formatDateDDMMYYYY(r.checkInISTDate || r.checkInTime) : "---"}</td>;
                                                    case "inTime": return (
                                                        <td key="inTime" className="px-3 sm:px-6 py-2 sm:py-4 text-[9px] sm:text-xs font-mono border-b border-white/5 text-center">
                                                            {(r.status === 'in' || r.status === 'auto-resolved') ? (
                                                                <span className="text-green-400">{formatISTTimeAMPM(r.checkInISTTime, r.checkInTime)}</span>
                                                            ) : (
                                                                <span className="text-red-400 font-bold">Still Outside</span>
                                                            )}
                                                        </td>
                                                    );
                                                    case "duration": return (
                                                        <td key="duration" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] font-black border-b border-white/5 text-center">
                                                            <span className={r.status === 'out' ? 'text-red-400' : 'text-blue-400'}>{formatDuration(r.durationMinutes)}</span>
                                                        </td>
                                                    );
                                                    case "type": return (
                                                        <td key="type" className="px-3 sm:px-6 py-2 sm:py-4 border-b border-white/5 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase ${r.type === 'leave' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                                                                {r.type === 'leave' ? 'LEAVE' : 'GATEPASS'}
                                                            </span>
                                                        </td>
                                                    );
                                                    case "status": return (
                                                        <td key="status" className="px-3 sm:px-6 py-2 sm:py-4 border-b border-white/5 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-tighter ${r.status === 'out' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                                                {r.status === 'out' ? 'OUT' : 'IN'}
                                                            </span>
                                                        </td>
                                                    );
                                                    case "reason": return <td key="reason" className="px-3 sm:px-6 py-2 sm:py-4 text-[8px] sm:text-[10px] text-white/60 border-b border-white/5 max-w-[180px] truncate">{r.reason || r.leaveReason || "---"}</td>;
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
                input[type="date"]::-webkit-calendar-picker-indicator,
                input[type="time"]::-webkit-calendar-picker-indicator {
                    filter: invert(1) brightness(1.5) !important;
                    opacity: 0.9 !important;
                    cursor: pointer !important;
                    transition: opacity 0.2s ease;
                }
                input[type="date"]::-webkit-calendar-picker-indicator:hover,
                input[type="time"]::-webkit-calendar-picker-indicator:hover {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
}
