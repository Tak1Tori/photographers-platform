import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CursorGlow } from "@/components/layout/cursor-glow";
import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

const manrope = Manrope({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Framely | Фотографы Алматы",
  description: "Находите фотографов в Алматы, смотрите портфолио и выбирайте удобное время для съёмки на Framely.",
  metadataBase: new URL("https://framelyphoto.com")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var theme=localStorage.getItem("framely-theme")==="light"?"light":"dark";document.documentElement.classList.toggle("light",theme==="light");document.documentElement.style.colorScheme=theme}catch(error){}'
          }}
        />
      </head>
      <body className={manrope.className}>
        <CursorGlow />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
