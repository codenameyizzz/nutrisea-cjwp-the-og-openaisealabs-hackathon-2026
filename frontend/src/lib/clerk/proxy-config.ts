import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/merchant(.*)",
  "/admin(.*)",
  "/scanner(.*)",
  "/cart(.*)",
  "/menu(.*)",
  "/bmi(.*)",
  "/__clerk(.*)",
]);

export const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
