// ==============================================================
// QUICK REFERENCE: Fixing "Unexpected token '<'" Errors
// ==============================================================

// ❌ WRONG - Will fail with "Unexpected token '<'" if API errors
const response = await fetch("/api/endpoint");
const data = await response.json(); // Crashes if response is HTML error page

// ✅ CORRECT - Pattern 1: Check response.ok
const response = await fetch("/api/endpoint");
if (!response.ok) throw new Error(`API error: ${response.status}`);
const data = await response.json();

// ✅ CORRECT - Pattern 2: Validate content-type
const response = await fetch("/api/endpoint");
const contentType = response.headers.get("content-type");
if (!contentType?.includes("application/json")) {
  throw new Error("API returned non-JSON response");
}
const data = await response.json();

// ✅ CORRECT - Pattern 3: Use safeFetch wrapper (RECOMMENDED)
import { safeFetch, safeFetchOrNull } from "@/lib/safeFetch";

// Throws on error
const data = await safeFetch("/api/endpoint");

// Returns null on error (no throw)
const data = await safeFetchOrNull("/api/endpoint");
if (!data) {
  // Handle gracefully
  setHostels([]);
}

// ==============================================================
// COMMON API CALL PATTERNS
// ==============================================================

// Pattern: GET with query parameters
const data = await safeFetch(`/api/students?firebaseUID=${uid}&minimal=true`);

// Pattern: POST with body
const data = await safeFetch("/api/students", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Student", email: "test@example.com" })
});

// Pattern: With try-catch for fallback
try {
  const hostels = await safeFetch("/api/hostels");
  setHostels(hostels);
} catch (error) {
  console.error("Failed to fetch hostels:", error);
  setHostels(DEFAULT_HOSTELS); // Use default fallback
}

// Pattern: With loading state
const fetchData = async () => {
  setLoading(true);
  try {
    const data = await safeFetch("/api/endpoint");
    setData(data);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};

// ==============================================================
// API ROUTE ERROR HANDLING
// ==============================================================

// ❌ WRONG - Could accidentally return HTML on error
export async function GET(request: NextRequest) {
  const data = await someAsyncOperation();
  return NextResponse.json({ data }); // No error handling!
}

// ✅ CORRECT - Always wrap with try-catch
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const data = await someAsyncOperation();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ✅ RECOMMENDED - With error handler wrapper
import { withErrorHandler } from "@/lib/apiErrorHandler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await connectDB();
  const data = await someAsyncOperation();
  return NextResponse.json({ success: true, data });
  // Errors automatically caught and returned as JSON!
});

// ==============================================================
// CHECKLIST BEFORE COMMITTING
// ==============================================================

// When adding a new fetch call:
// ☑ Is response.ok checked?
// ☑ Is there a catch block?
// ☑ Is error message descriptive?
// ☑ Does it provide user feedback?
// ☑ Is there a fallback/default value?

// When adding a new API route:
// ☑ Has try-catch wrapper?
// ☑ Returns JSON on error?
// ☑ Has error logging with context?
// ☑ Validates request body?
// ☑ Has proper HTTP status codes?

// ==============================================================
// DEBUGGING TIPS
// ==============================================================

// 1. Check Network tab in DevTools
//    - Look for API response that's HTML instead of JSON
//    - Check the response preview/text

// 2. Add console logging
const response = await fetch("/api/endpoint");
console.log("Status:", response.status);
console.log("Content-Type:", response.headers.get("content-type"));
if (!response.ok) {
  const text = await response.text();
  console.error("Response body:", text);
}

// 3. Check API logs on server
//    - Look for unhandled errors in terminal output
//    - Check MongoDB connection status

// 4. Verify environment variables
//    - Ensure .env.local has all required keys
//    - Check MONGODB_URL is valid

// ==============================================================
// EXAMPLE: Complete Refetch Function
// ==============================================================

const fetchWithRetry = async (url: string, options?: RequestInit, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error(`Expected JSON, got ${contentType}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

// Usage:
try {
  const data = await fetchWithRetry("/api/endpoint");
  setData(data);
} catch (error) {
  setError("Failed to load data after 3 attempts");
}
