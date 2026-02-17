/**
 * Safe fetch wrapper that ensures JSON parsing won't fail with HTML error pages
 * Prevents "Unexpected token '<'" errors
 */
export async function safeFetch(
  url: string,
  options?: RequestInit
): Promise<any> {
  try {
    const response = await fetch(url, options);

    // Check response status
    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`❌ API Error at ${url}:`, errorMsg);
      throw new Error(errorMsg);
    }

    // Check content type before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await response.text();
      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        console.error(
          `❌ API returned HTML instead of JSON at ${url}`,
          text.substring(0, 300)
        );
        throw new Error(
          "Server error: API returned error page instead of JSON"
        );
      }
      throw new Error(`Expected JSON, got ${contentType}`);
    }

    // Parse and return JSON
    const data = await response.json();
    return data;
  } catch (error: any) {
    // Re-throw with context
    console.error(`❌ Fetch failed for ${url}:`, error.message);
    throw error;
  }
}

/**
 * Safe fetch with automatic error handling and null return
 * Returns null on error instead of throwing
 */
export async function safeFetchOrNull(
  url: string,
  options?: RequestInit
): Promise<any | null> {
  try {
    return await safeFetch(url, options);
  } catch (error) {
    console.error(`Fetch failed gracefully:`, error);
    return null;
  }
}
