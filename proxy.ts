import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protects everything except the (auth) group and static assets. See
// CLAUDE.md — auth is entirely RLS + this redirect; no separate authz layer.
// Next.js 16 renamed middleware.ts -> proxy.ts / middleware() -> proxy().
// Keep this thin per Next.js 16 guidance: cookie-presence check + redirect
// only. Do not add DB calls or heavy logic here.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /reset-password is reached from an emailed recovery link. Supabase signs
  // the user in as part of that flow, so it must NOT bounce them to /dashboard
  // the way /sign-in does — they still have to set the new password.
  const isRecoveryRoute = request.nextUrl.pathname.startsWith("/reset-password");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/sign-in") || isRecoveryRoute;

  // ponytail: local dev bypass, skip prod (NODE_ENV=production on build/deploy)
  if (process.env.NODE_ENV === "development") {
    return response;
  }

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && !isRecoveryRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
