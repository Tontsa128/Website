const SAFE_BASE_URL = "https://internal-redirect.invalid";

export function getSafeRedirectPath(
  candidate: string | null,
  fallback = "/dashboard",
): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, SAFE_BASE_URL);
    if (parsed.origin !== SAFE_BASE_URL) {
      return fallback;
    }

    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
