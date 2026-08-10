import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import {
  consumeTelegramSessionTicket,
  getTelegramAccountUser,
  handleTelegramOidcSignIn,
  isTelegramLoginEnabled
} from "@/lib/telegram-login";
import { normalizePhone } from "@/lib/phone";

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
  }
] as const;

function canUseLocalDemoAuth() {
  return process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "true";
}

export const authOptions: NextAuthOptions = {
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "framely-local-development-secret" : undefined),
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/sign-in"
  },
  providers: [
    CredentialsProvider({
      name: "Phone and password",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        password: { label: "Password", type: "password" },
        adminAccess: { label: "Admin access", type: "hidden" }
      },
      async authorize(credentials) {
        const password = credentials?.password;
        const isAdminAccess = credentials?.adminAccess === "true";
        const phone = normalizePhone(credentials?.phone);

        if (!password || (!isAdminAccess && !phone)) {
          return null;
        }

        if (!process.env.DATABASE_URL) {
          if (!canUseLocalDemoAuth() || isAdminAccess) {
            return null;
          }

          const demoUser = demoUsers.find(
            (user) => normalizePhone(user.phone) === phone
          );

          if (!demoUser || demoUser.password !== password) {
            return null;
          }

          return {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            phone: demoUser.phone,
            image: null
          };
        }

        const [{ compare }, { prisma }] = await Promise.all([
          import("bcryptjs"),
          import("@/lib/prisma")
        ]);
        const user = isAdminAccess
          ? await prisma.user.findFirst({ where: { role: "ADMIN" } })
          : await prisma.user.findUnique({ where: { phone } });

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
          phone: user.phone,
          image: user.image
        };
      }
    }),
    CredentialsProvider({
      id: "telegram-onboarding",
      name: "Telegram onboarding",
      credentials: {
        ticket: { label: "Telegram onboarding ticket", type: "hidden" }
      },
      async authorize(credentials) {
        const user = await consumeTelegramSessionTicket(credentials?.ticket ?? "");
        return user;
      }
    }),
    ...(isTelegramLoginEnabled() ? [telegramOidcProvider()] : [])
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "telegram") return true;

      const currentSession = await getSession();
      const result = await handleTelegramOidcSignIn(profile ?? {}, currentSession?.user.id);

      switch (result.status) {
        case "signed-in":
          return true;
        case "onboarding":
          return `/auth/telegram/onboarding?intent=${encodeURIComponent(result.intentToken)}`;
        case "password-verification-required":
          return `/auth/sign-in?error=TelegramLinkRequiresPassword&telegramLink=${encodeURIComponent(result.intentToken)}`;
        case "phone-required":
          return "/auth/sign-in?error=TelegramPhoneRequired";
        case "phone-already-linked":
          return "/auth/sign-in?error=TelegramPhoneAlreadyLinked";
        default:
          return "/auth/sign-in?error=TelegramSignInFailed";
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        const authenticatedUser =
          account?.provider === "telegram"
            ? await getTelegramAccountUser(account.providerAccountId)
            : user;

        if (!authenticatedUser) {
          throw new Error("Telegram account is not linked to a Framely user");
        }

        token.id = authenticatedUser.id;
        token.role = authenticatedUser.role;
        token.phone = authenticatedUser.phone;
        token.image = authenticatedUser.image;
        token.name = authenticatedUser.name;
        token.email = authenticatedUser.email;
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name ?? token.name;
        token.email = session.user.email ?? token.email;
        token.phone = session.user.phone ?? token.phone;
        token.image = session.user.image ?? token.image;
      }
      if (token.id && process.env.DATABASE_URL) {
        try {
          const { prisma } = await import("@/lib/prisma");
          const account = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              name: true,
              email: true,
              phone: true,
              image: true,
              role: true
            }
          });

          if (account) {
            token.name = account.name;
            token.email = account.email;
            token.phone = account.phone;
            token.image = account.image;
            token.role = account.role;
          }
        } catch {
          // Keep the existing token if the database is temporarily unavailable.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.phone = token.phone;
        session.user.image = token.image;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      try {
        return new URL(url).origin === baseUrl ? url : baseUrl;
      } catch {
        return baseUrl;
      }
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
    case "EDITOR":
      return "/dashboard";
    case "STUDIO_OWNER":
      return "/dashboard/studio";
    case "ADMIN":
      return "/admin";
    default:
      return "/";
  }
}

function telegramOidcProvider(): OAuthConfig<Record<string, unknown>> {
  return {
    id: "telegram",
    name: "Telegram",
    type: "oauth",
    wellKnown: "https://oauth.telegram.org/.well-known/openid-configuration",
    clientId: process.env.TELEGRAM_OIDC_CLIENT_ID,
    clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET,
    authorization: {
      params: {
        scope: "openid profile phone"
      }
    },
    client: {
      token_endpoint_auth_method: "client_secret_basic"
    },
    checks: ["pkce", "state", "nonce"],
    idToken: true,
    profile(profile) {
      const subject = typeof profile.sub === "string" ? profile.sub : "";
      const name = typeof profile.name === "string" ? profile.name : "Telegram";
      const image = typeof profile.picture === "string" ? profile.picture : null;

      if (!subject) {
        throw new Error("Telegram identity is missing");
      }

      return {
        id: subject,
        name,
        email: null,
        image,
        role: "CLIENT"
      };
    }
  };
}
