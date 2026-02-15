import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Student from "@/models/Student";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type");

        await dbConnect();

        if (type === "duplicates-phone") {
            const duplicates = await Student.aggregate([
                {
                    $group: {
                        _id: "$phoneNumber",
                        count: { $sum: 1 },
                        students: {
                            $push: {
                                id: "$_id",
                                name: "$name",
                                regId: "$registrationId",
                                hostel: "$hostelName",
                                email: "$email"
                            }
                        }
                    }
                },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } }
            ]);
            return NextResponse.json({ success: true, data: duplicates });
        }

        if (type === "duplicates-regid") {
            const duplicates = await Student.aggregate([
                { $match: { registrationId: { $ne: null, $exists: true, $ne: "" } } },
                {
                    $group: {
                        _id: "$registrationId",
                        count: { $sum: 1 },
                        students: {
                            $push: {
                                id: "$_id",
                                name: "$name",
                                phone: "$phoneNumber",
                                hostel: "$hostelName",
                                email: "$email"
                            }
                        }
                    }
                },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } }
            ]);
            return NextResponse.json({ success: true, data: duplicates });
        }

        if (type === "gibberish-names") {
            // Fetch some fields to analyze
            const students = await Student.find({}, "name phoneNumber registrationId hostelName email").lean();

            const gibberish = students.filter(s => {
                if (!s.name) return true;
                const name = s.name.toLowerCase().trim();

                // Rules for gibberish
                if (name.length < 3) return true;

                // Rule 1: High consonant count/ratio (e.g. "ghjk")
                const vowels = name.match(/[aeiou]/gi) || [];
                const consonants = name.match(/[bcdfghjklmnpqrstvwxyz]/gi) || [];
                if (vowels.length === 0 && name.length > 3) return true;

                // Rule 2: Long sequences of same chars
                if (/(.)\1\1\1/.test(name)) return true;

                // Rule 3: Common keyboard mashing
                const mashPatterns = [
                    "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "lkjh", "kjhg", "jhgf", "hgfd", "gfds", "fdsa",
                    "qwerty", "asfg", "zxcv", "1234", "ghj", "jkl", "dfs", "dfg"
                ];
                if (mashPatterns.some(p => name.includes(p))) return true;

                // Rule 4: High entropy (rough approximation: few vowels relative to length)
                if (name.length > 8 && vowels.length < 2) return true;

                return false;
            });

            return NextResponse.json({ success: true, data: gibberish });
        }

        return NextResponse.json({ success: false, error: "Invalid audit type" });
    } catch (error: any) {
        console.error("Audit API Error:", error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
