import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

const demoUsers = [
  {
    id: "demo-client",
    name: "Тестовый клиент",
    email: "client@photo-booking.local",
    password: "password123",
    role: "CLIENT",
    phone: "+7 700 000 00 02"
  },
  {
    id: "demo-photographer",
    name: "Арина Ким",
    email: "photographer@photo-booking.local",
    password: "password123",
    role: "PHOTOGRAPHER",
    phone: "+7 700 000 00 03"
  },
  {
    id: "demo-studio",
    name: "North Group",
    email: "studio@photo-booking.local",
    password: "password123",
    role: "STUDIO_OWNER",
    phone: "+7 700 000 00 04"
  },
  {
    id: "demo-admin",
    name: "Admin Framely",
    email: "admin@photo-booking.local",
    password: "admin123456",
    role: "ADMIN",
    phone: "+7 700 000 00 01"
  }
] as const;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "framely-local-development-secret" : undefined),
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/sign-in"
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        if (!canUseDatabase()) {
          const demoUser = demoUsers.find((user) => user.email === email);

          if (!demoUser || demoUser.password !== password) {
            return null;
          }

          return {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            phone: demoUser.phone
          };
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.phone = token.phone;
      }
      return session;
    }
  }
};

export function getSession() {
  return getServerSession(authOptions);
}

export function getDashboardHref(role?: string) {
  switch (role) {
    case "CLIENT":
      return "/dashboard/client";
    case "PHOTOGRAPHER":
      return "/dashboard/photographer";
    case "STUDIO_OWNER":
      return "/dashboard/studio";
    case "ADMIN":
      return "/admin";
    default:
      return "/";
  }
}
