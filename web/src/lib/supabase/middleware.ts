import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Baca profil dari database public.users
  let role: string | null = null;
  let hasProfile = false;
  if (user) {
    const { data: dbUser } = await supabase
      .from("users")
      .select("role, phone")
      .eq("auth_id", user.id)
      .single();
    role = dbUser?.role ?? null;
    hasProfile = !!dbUser?.phone;
  }

  // User sudah login tapi belum lengkapi data diri → onboarding
  if (user && !hasProfile && !pathname.startsWith("/onboarding") && !pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Sudah lengkap data diri tapi masih di onboarding → lanjut
  if (user && hasProfile && pathname.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Halaman admin: hanya admin
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Halaman dashboard: harus login
  if (pathname.startsWith("/dashboard") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect dari / ke dashboard (kalau sudah login)
  if (pathname === "/" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect dari /login ke dashboard (kalau sudah login)
  if ((pathname === "/login" || pathname === "/login-admin") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
