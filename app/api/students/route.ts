import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { firebaseUID, name, email, phoneNumber, hostelName, roomNumber, profilePicture, fatherName, fatherNumber, motherName, motherNumber, homePinCode, homeState, erpInformation, joiningDate, branch, collegeName, year, semester, section, localGuardianAddress, localGuardianPhoneNumber } = body;

    if (!firebaseUID || !name || !email || !phoneNumber || !hostelName || !roomNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const existingStudent = await Student.findOne({ firebaseUID });
    let registrationId = existingStudent?.registrationId;

    if (!registrationId) {
      const hostelPrefixes: { [key: string]: string } = {
        "Guest House Boys Hostel": "GUEST",
        "Boys Hostel": "BOYS",
        "Gangotri Hostel": "GANGOTRI",
        "Gaytri Hostel": "GAYTRI"
      };

      let prefix = "STUDENT";
      for (const [hName, p] of Object.entries(hostelPrefixes)) {
        if (hostelName.toLowerCase().includes(hName.toLowerCase())) {
          prefix = p;
          break;
        }
      }

      // Find the highest number for this prefix
      const lastStudent = await Student.findOne({
        registrationId: { $regex: new RegExp(`^${prefix}-`) }
      }).sort({ registrationId: -1 });

      let nextNumber = 1;
      if (lastStudent && lastStudent.registrationId) {
        const parts = lastStudent.registrationId.split('-');
        const lastNumber = parseInt(parts[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      registrationId = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
    }

    const student = await Student.findOneAndUpdate(
      { firebaseUID },
      {
        firebaseUID,
        name,
        email,
        phoneNumber,
        hostelName,
        roomNumber,
        registrationId,
        profilePicture: profilePicture || "",
        studentStatus: "in",
        fatherName: fatherName || "",
        fatherNumber: fatherNumber || "",
        motherName: motherName || "",
        motherNumber: motherNumber || "",
        homePinCode: homePinCode || "",
        homeState: homeState || "",
        erpInformation: erpInformation || "",
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
        branch: branch || "",
        collegeName: collegeName || "",
        year: year || "",
        semester: semester || "",
        section: section || "",
        localGuardianAddress: localGuardianAddress || "",
        localGuardianPhoneNumber: localGuardianPhoneNumber || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, student }, { status: 200 });
  } catch (error: any) {
    console.error("Error creating/updating student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save student" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const firebaseUID = searchParams.get("firebaseUID");
    const email = searchParams.get("email");
    const minimal = searchParams.get("minimal") === "true"; // ⚡ OPTIMIZATION: Support minimal data fetch

    if (firebaseUID) {
      // ⚡ OPTIMIZATION: For login, only select minimal fields to speed up response
      let student;
      if (minimal) {
        // ⚡ OPTIMIZED: Ultra-minimal selection for fastest login flow
        // Include dob and category to prevent profile completion modal from showing incorrectly
        student = await Student.findOne({ firebaseUID }).select("_id firebaseUID name studentStatus deviceId dob category");
      } else {
        student = await Student.findOne({ firebaseUID });
      }

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      if (!student.studentStatus) {
        await Student.findByIdAndUpdate(student._id, { studentStatus: "in" });
        student.studentStatus = "in";
      }

      return NextResponse.json({ student }, { status: 200 });
    }

    if (email) {
      const student = await Student.findOne({ email });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      if (!student.studentStatus) {
        await Student.findByIdAndUpdate(student._id, { studentStatus: "in" });
        student.studentStatus = "in";
      }

      return NextResponse.json({ student }, { status: 200 });
    }

    const search = searchParams.get("search");
    const hostelName = searchParams.get("hostelName");
    const collegeName = searchParams.get("collegeName");
    const semester = searchParams.get("semester");
    const branch = searchParams.get("branch");
    const section = searchParams.get("section");

    const light = searchParams.get("light") === "true"; // ⚡ OPTIMIZATION: Exclude heavy fields

    let query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { registrationId: { $regex: search, $options: "i" } },
      ];
    }
    if (hostelName && hostelName !== "all") {
      query.hostelName = { $regex: hostelName, $options: "i" };
    }
    if (collegeName && collegeName !== "all") {
      query.collegeName = collegeName;
    }
    if (semester && semester !== "all") {
      query.semester = { $regex: semester, $options: "i" };
    }
    if (branch && branch !== "all") {
      query.branch = branch;
    }
    if (section && section !== "all") {
      query.section = { $regex: section, $options: "i" };
    }

    let studentsQuery = Student.find(query).sort({ name: 1 });

    if (light) {
      // ⚡ Exclude profilePicture (base64 is heavy) to save bandwidth
      studentsQuery = studentsQuery.select("-profilePicture");
    }

    const students = await studentsQuery;
    return NextResponse.json({ students }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch students" },
      { status: 500 }
    );
  }
}
