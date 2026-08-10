import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const roleAccess: Array<{ path: string; roles: string[] }> = [
  { path: "/dashboard/photographer", roles: ["PHOTOGRAPHER", "ADMIN"] },
  { path: "/dashboard/studio", roles: ["STUDIO_OWNER", "ADMIN"] },
  { path: "/admin", roles: ["ADMIN"] }
];

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? "framely-local-development-secret" : undefined);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/access") {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: authSecret
  });

  if (!token) {
    const signInUrl = new URL(pathname.startsWith("/admin") ? "/admin/access" : "/auth/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  const rule = roleAccess.find((item) => pathname.startsWith(item.path));

  if (rule && !rule.roles.includes(String(token.role))) {
    if (pathname.startsWith("/admin")) {
      const adminAccessUrl = new URL("/admin/access", request.url);
      adminAccessUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(adminAccessUrl);
    }

    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
};
