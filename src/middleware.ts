import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "insurancerp_session";

function isPublic(pathname: string): boolean {
  return pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/health" || pathname === "/icon.svg";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next")) return NextResponse.next();
  const token = request.cookies.get(COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  let valid = false;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (pathname === "/login" && valid) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isPublic(pathname)) return NextResponse.next();
  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
