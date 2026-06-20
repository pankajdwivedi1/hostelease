import { createClient } from '@supabase/supabase-js';

// ⚡ CACHE: Store the Supabase client in a global variable for reuse
let cachedSupabaseAdmin: any = null;

// This client is for SERVER-SIDE use only.
// It uses the SERVICE ROLE key to bypass RLS.
export const getSupabaseAdmin = () => {
    if (cachedSupabaseAdmin) return cachedSupabaseAdmin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE?.includes('build');

    if (!supabaseUrl || !supabaseServiceKey) {
        if (isBuildPhase) {
            console.warn('⚠️ Warning: Missing Supabase Server-Side Environment Variables during build phase. Returning dummy client.');
            return new Proxy({}, {
                get(target, prop) {
                    return () => {};
                }
            }) as any;
        }
        throw new Error('Missing Supabase Server-Side Environment Variables');
    }

    cachedSupabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });

    return cachedSupabaseAdmin;
};

export async function uploadProfilePictureToSupabase(base64Image: string, tenantId: string, studentId: string): Promise<string> {
    const supabase = getSupabaseAdmin();
    
    // Expected format: data:image/jpeg;base64,...
    const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
        throw new Error("Invalid base64 image format");
    }
    
    const mimeType = matches[1];
    const extension = mimeType.split('/')[1] || 'jpg';
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const bucketName = 'profile-pictures';
    const filePath = `${tenantId}/${studentId}_${Date.now()}.${extension}`;
    
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b: any) => b.name === bucketName);
        if (!bucketExists) {
            await supabase.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 10485760, // 10MB
            });
        }
    } catch (err) {
        console.warn("Could not check/create storage bucket:", err);
    }
    
    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: true,
        });
        
    if (uploadError) {
        throw new Error(`Failed to upload photo to Supabase storage: ${uploadError.message}`);
    }
    
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    if (!data?.publicUrl) {
        throw new Error("Failed to get public URL for uploaded photo");
    }
    
    return data.publicUrl;
}
