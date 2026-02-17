import { NextResponse } from "next/server";

/**
 * Wraps API route handlers to ensure all errors return JSON, not HTML
 * This prevents "Unexpected token '<'" errors when parsing API responses
 */
export function withErrorHandler(handler: any) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      console.error("🔴 API Error:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });

      // Ensure we always return JSON, never HTML
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "An unexpected error occurred",
          errorType: error?.name || "UnknownError",
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Validates that a response is JSON and not HTML
 * Use in fetch calls to catch HTML error pages early
 */
export async function validateJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type");
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    if (text.startsWith("<!DOCTYPE")) {
      console.error("🔴 API returned HTML error page instead of JSON", text.substring(0, 200));
      throw new Error("API error: Server returned HTML error page. Check API logs.");
    }
    throw new Error(`Expected JSON but got ${contentType}`);
  }

  return response;
}
