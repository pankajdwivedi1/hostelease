"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface StudentInfo {
    name: string;
    email: string;
    phoneNumber: string;
    collegeName: string;
    branch: string;
    section: string;
    hostelName: string;
    roomNumber: string;
    erpInformation: string;
    registrationId: string;
    profilePicture?: string;
    studentStatus?: "in" | "out";
}

export default function PublicStudentProfile() {
    const params = useParams();
    const registrationId = params.registrationId as string;

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStudentInfo = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/public/student/${registrationId}`);
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || "Student not found");
                }

                setStudent(data.student);
            } catch (err: any) {
                console.error("Error fetching student:", err);
                setError(err.message || "Failed to load student information");
            } finally {
                setLoading(false);
            }
        };

        if (registrationId) {
            fetchStudentInfo();
        }
    }, [registrationId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-lg font-bold text-gray-700">Loading student information...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Student Not Found</h2>
                    <p className="text-gray-600">{error || "Unable to load student information"}</p>
                    <p className="text-sm text-gray-500 mt-4">Registration ID: {registrationId}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-t-3xl shadow-xl p-6 text-center border-b-4 border-blue-600">
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-1">
                        Student Information
                    </h1>
                    <p className="text-sm text-gray-500 font-medium">Hostel Management System</p>
                </div>

                {/* Profile Picture and Name */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center">
                    <div className="inline-block relative">
                        {student.profilePicture ? (
                            <img
                                src={student.profilePicture}
                                alt={student.name}
                                className="w-32 h-32 rounded-full border-4 border-white shadow-2xl object-cover"
                            />
                        ) : (
                            <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl bg-white flex items-center justify-center">
                                <span className="text-4xl font-black text-blue-600">
                                    {student.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </span>
                            </div>
                        )}
                        {student.studentStatus && (
                            <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center font-black text-xs ${student.studentStatus === "in" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                                }`}>
                                {student.studentStatus === "in" ? "IN" : "OUT"}
                            </div>
                        )}
                    </div>
                    <h2 className="text-3xl font-black text-white mt-4 mb-1">{student.name}</h2>
                    <p className="text-blue-100 text-sm font-medium">{student.email}</p>
                </div>

                {/* Student Information Cards */}
                <div className="bg-white shadow-xl p-6 space-y-4">

                    {/* Registration & ERP */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                            <p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-1">Registration ID</p>
                            <p className="text-lg font-black text-gray-900">{student.registrationId}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-200">
                            <p className="text-xs font-black text-purple-600 uppercase tracking-wider mb-1">ERP ID</p>
                            <p className="text-lg font-black text-gray-900">{student.erpInformation || "N/A"}</p>
                        </div>
                    </div>

                    {/* Academic Information */}
                    <div className="border-t-2 border-gray-200 pt-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-lg">📚</span> Academic Information
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">College</p>
                                <p className="text-sm font-black text-gray-900">{student.collegeName}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Branch</p>
                                <p className="text-sm font-black text-gray-900">{student.branch}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Section</p>
                                <p className="text-sm font-black text-gray-900">{student.section || "N/A"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Hostel Information */}
                    <div className="border-t-2 border-gray-200 pt-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-lg">🏠</span> Hostel Information
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Hostel Name</p>
                                <p className="text-sm font-black text-gray-900">{student.hostelName}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Room Number</p>
                                <p className="text-sm font-black text-gray-900">{student.roomNumber}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="border-t-2 border-gray-200 pt-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-lg">📞</span> Contact Information
                        </h3>
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Mobile Number</p>
                                <p className="text-lg font-black text-gray-900">
                                    <a href={`tel:${student.phoneNumber}`} className="text-blue-600 hover:underline">
                                        {student.phoneNumber}
                                    </a>
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Email Address</p>
                                <p className="text-sm font-bold text-gray-900 break-all">
                                    <a href={`mailto:${student.email}`} className="text-blue-600 hover:underline">
                                        {student.email}
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-b-3xl shadow-xl p-6 text-center">
                    <p className="text-gray-400 text-xs font-medium mb-1">Powered by</p>
                    <p className="text-white text-lg font-black">Hostelease Management System</p>
                    <p className="text-gray-500 text-xs mt-2">© {new Date().getFullYear()} All Rights Reserved</p>
                </div>
            </div>
        </div>
    );
}
