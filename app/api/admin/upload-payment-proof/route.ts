export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { uploadInvoiceScreenshotToR2 } from "@/lib/billingR2Storage";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const invoiceId = (formData.get("invoiceId") as string) || `proof_${Date.now()}`;

        if (!file) {
            return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = file.type || "image/png";

        const url = await uploadInvoiceScreenshotToR2(buffer, invoiceId, mimeType);

        return NextResponse.json({
            success: true,
            url,
            message: "Payment proof screenshot uploaded to Cloudflare R2 successfully!"
        });
    } catch (error: any) {
        console.error("Upload payment proof error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to upload screenshot" }, { status: 500 });
    }
}
