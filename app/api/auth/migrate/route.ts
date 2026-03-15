import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: "No ID token provided" }, { status: 400 });
        }

        // 1. Verify Firebase ID Token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const email = decodedToken.email;
        const firebaseUID = decodedToken.uid;

        if (!email) {
            return NextResponse.json({ error: "Email not verified in Firebase account" }, { status: 400 });
        }

        console.log(`[Migration] Migrating user: ${email} (${firebaseUID})`);

        // 2. Check if student exists in our database
        const student = await db.students.findOne({ firebaseUID });
        if (!student) {
            console.warn(`[Migration] Student record not found for UID: ${firebaseUID}`);
            // We can still create the auth user if we want, but they might need to redo onboarding
        }

        // 3. Setup Supabase Admin
        const supabaseAdmin = getSupabaseAdmin();

        // 4. Check if user already exists in Supabase Auth
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        let supabaseUser = users.find(u => u.email === email);
        let temporaryPassword = `Migrate-${firebaseUID.substring(0, 8)}-${Math.random().toString(36).slice(-8)}`;

        if (!supabaseUser) {
            // 5. Create Supabase Auth User
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: temporaryPassword,
                email_confirm: true,
                user_metadata: {
                    firebase_migrated: true,
                    old_uid: firebaseUID
                }
            });

            if (createError) {
                console.error("[Migration] Error creating Supabase user:", createError);
                return NextResponse.json({ error: "Failed to create Supabase account" }, { status: 500 });
            }
            supabaseUser = newUser.user;
            console.log(`[Migration] Created new Supabase user for ${email}`);
        } else {
            console.log(`[Migration] Supabase user already exists for ${email}`);
            // Update password so we can sign them in silenlty if needed, 
            // OR just return success and let them use Google Login next time.
            // For silent handoff, we MUST set a known password.
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                supabaseUser.id,
                { password: temporaryPassword }
            );
            if (updateError) console.warn("[Migration] Could not update password for silent handoff:", updateError);
        }

        // 6. Update student record with supabase_id if not already there
        if (student) {
            await db.students.save(firebaseUID, {
                ...student,
                supabase_id: supabaseUser?.id,
                auth_provider: 'supabase'
            });
        }

        return NextResponse.json({
            success: true,
            email,
            password: temporaryPassword,
            message: "Migration prepared successfully"
        });

    } catch (error: any) {
        console.error("[Migration] Fatal error:", error);
        return NextResponse.json({ error: error.message || "Migration failed" }, { status: 500 });
    }
}
