import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * System-wide auth gate. Every route except /login requires a signed-in
 * user; unsigned visitors are bounced to /login. A signed-in user who lands
 * on /login is sent to the home page so they don't get stuck there. The
 * matcher below excludes Next's static assets and public files so nothing
 * behind auth ever blocks the CSS/JS/images that render the login page.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: CookieItem[]) =>
          list.forEach(({ name, value, options }: CookieItem) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";

  if (!session && !isLoginPage) {
    const url = new URL("/login", request.url);
    // Remember where they were headed so we can bounce back after sign-in.
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  // Match every path except Next internals, favicon, and static image files
  // in /public. Login itself is matched — the check above lets it through
  // for unsigned visitors and bounces signed-in users off it.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|woff2?)).*)",
  ],
};
