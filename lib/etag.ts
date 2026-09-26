import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sends a JSON response with automatic MD5 ETag and conditional HTTP 304 (Not Modified) support.
 * If the client's cached ETag matches the response payload, 0 bytes of body data are sent over the network.
 */
export function jsonWithEtag(request: NextRequest, data: any, status = 200): NextResponse {
  const jsonString = JSON.stringify(data);
  const etag = `"${crypto.createHash('md5').update(jsonString).digest('hex')}"`;
  const clientEtag = request.headers.get('if-none-match');

  if (clientEtag && clientEtag === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    });
  }

  return new NextResponse(jsonString, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
      'Cache-Control': 'no-cache, must-revalidate',
    },
  });
}
