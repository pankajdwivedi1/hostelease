import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
        const safeRelativePath = path.normalize(path.join(...pathSegments)).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(process.cwd(), 'public', 'uploads', safeRelativePath);

        if (!fs.existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const buffer = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();

        const mimeMap: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
        };

        const contentType = mimeMap[ext] || 'application/octet-stream';

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error: any) {
        console.error('File serving error:', error);
        return new NextResponse('Error serving file', { status: 500 });
    }
}
