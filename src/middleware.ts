import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes = the auth pages only. Everything else requires a session.
// No public signup: sign-up is invite-only via Clerk, but the route must be
// reachable so an invited user can complete it.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    // No session -> redirect to sign-in (pages) or 401 (API handled per-route).
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|otf)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
