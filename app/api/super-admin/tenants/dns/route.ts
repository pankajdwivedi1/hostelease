import { NextRequest, NextResponse } from "next/server";
import dns from "dns";

export const dynamic = 'force-dynamic';

function resolveDns(hostname: string): Promise<boolean> {
    return new Promise((resolve) => {
        dns.lookup(hostname, (err, address) => {
            if (err) {
                resolve(false);
            } else {
                resolve(!!address);
            }
        });
    });
}

export async function POST(request: NextRequest) {
    try {
        const { domain } = await request.json();
        if (!domain) {
            return NextResponse.json({ success: false, error: "Domain is required" }, { status: 400 });
        }

        // Clean domain (remove protocols and port suffix if present)
        let hostname = domain
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .split('/')[0]
            .split(':')[0];

        const resolved = await resolveDns(hostname);

        return NextResponse.json({ success: true, resolved });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
