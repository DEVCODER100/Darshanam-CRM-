/**
 * dev-auth.ts — local-only login bypass for the building phase.
 *
 * Active ONLY when AUTH_DISABLED=true AND NODE_ENV !== "production". A
 * production build (Vercel) always ignores the flag, so deployed sites keep the
 * Clerk login no matter what env vars are set.
 */
export function isAuthBypassed(): boolean {
  return (
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production"
  );
}
