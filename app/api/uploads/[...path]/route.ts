import { NextRequest, NextResponse } from 'next/server';
import { R2_PHOTOS_PUBLIC_BASE } from '@/lib/r2Storage';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await context.params;
        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('File path required', { status: 400 });
        }

        // Prevent directory traversal attacks
        const safeRelativePath = pathSegments
            .map(p => encodeURIComponent(p))
            .join('/')
            .replace(/^(\.\.[\/\\])+/, '');

        // 307 Redirect directly to Cloudflare R2 CDN ($0 Railway egress)
        const destination = `${R2_PHOTOS_PUBLIC_BASE}/${safeRelativePath}`;
        return NextResponse.redirect(destination, {
            status: 307,
            headers: {
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error: any) {
        console.error('File redirect error:', error);
        return new NextResponse('Error serving file', { status: 500 });
    }
}

