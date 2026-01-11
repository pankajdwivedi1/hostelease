import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import AdminSettings from "@/models/AdminSettings";

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { studentId, lat, lng, accuracy } = body;

    if (!studentId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get admin settings for hostel location
    let adminSettings = await AdminSettings.findOne();
    if (!adminSettings) {
      // Create default settings if none exist
      adminSettings = await AdminSettings.create({
        hostelLocation: { lat: 23.2483348, lng: 77.5026058 },
        radius: 200,
      });
    }

    if (!adminSettings.hostelLocation) {
      return NextResponse.json(
        { error: "Hostel location not set by admin" },
        { status: 400 }
      );
    }

    // Calculate distance from student location to hostel location
    const distance = calculateDistance(
      lat,
      lng,
      adminSettings.hostelLocation.lat,
      adminSettings.hostelLocation.lng
    );

    const radius = adminSettings.radius || 200;

    if (distance > radius) {
      return NextResponse.json(
        {
          error: "You are not inside the hostel",
          distance: Math.round(distance),
          radius,
        },
        { status: 400 }
      );
    }

    // Update student studentStatus to "in" and save location
    const student = await Student.findByIdAndUpdate(
      studentId,
      {
        studentStatus: "in",
        lastCheckInLocation: {
          lat,
          lng,
          accuracy: accuracy || 0,
          timestamp: new Date(),
        },
      },
      { new: true }
    );

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        student,
        distance: Math.round(distance),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error checking in student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check in" },
      { status: 500 }
    );
  }
}

