import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * Protect the admin routes. If the user isn't signed in, bounce to /login.
 * On success we refresh the session cookies so RLS works on the next request.
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

  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  if (isAdminRoute && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
