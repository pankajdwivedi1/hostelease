import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Creates a high-performance HTTP response with ETag and 304 Not Modified support.
 * - When client sends `If-None-Match: <etag>`, and content is unchanged:
 *   Returns HTTP 304 Not Modified with a 0-byte body (Zero egress!).
 * - Otherwise:
 *   Returns HTTP 200 OK with full JSON payload and the ETag header attached.
 * 
 * @param data The JSON data object to return
 * @param req Optional NextRequest to extract `If-None-Match` header
 * @param maxAgeSeconds Browser/CDN cache TTL (default: 30s, stale-while-revalidate: 60s)
 */
export function createCachedResponse(
    data: any,
    req?: NextRequest,
    maxAgeSeconds = 30
): NextResponse {
    try {
        const jsonString = JSON.stringify(data);
        const hash = crypto.createHash("md5").update(jsonString).digest("hex");
        const etag = `"${hash}"`;

        if (req) {
            const ifNoneMatch = req.headers.get("if-none-match");
            if (ifNoneMatch) {
                const cleanHeader = ifNoneMatch.trim();
                const cleanEtag = etag.replace(/"/g, "");
                if (cleanHeader === etag || cleanHeader.includes(cleanEtag)) {
                    return new NextResponse(null, {
                        status: 304,
                        headers: {
                            "ETag": etag,
                            "Cache-Control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`,
                            "Access-Control-Allow-Origin": "*",
                        },
                    });
                }
            }
        }

        return new NextResponse(jsonString, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "ETag": etag,
                "Cache-Control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`,
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err: any) {
        return NextResponse.json(data, { status: 200 });
    }
}
