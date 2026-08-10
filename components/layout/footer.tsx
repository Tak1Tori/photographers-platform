import Link from "next/link";
import { Instagram, Send } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

const marketplaceLinks = [
  { href: "/photographers?mode=booking", label: "Фотографы" },
  { href: "/editors", label: "Монтажеры" }
];

const legalLinks = [
  { href: "/contacts", label: "Контакты" },
  { href: "/privacy-policy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/offer", label: "Публичная оферта" },
  { href: "/payment-and-refund", label: "Правила оплаты и возврата" },
  { href: "/cookies", label: "Политика Cookies" }
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container grid gap-9 py-9 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_1.25fr_auto] lg:items-start lg:gap-12 lg:py-10">
        <div className="max-w-[17rem]">
          <Link href="/" className="inline-flex items-center" aria-label="Framely">
            <BrandLogo className="h-12 w-auto" sizes="108px" />
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Онлайн-платформа для бронирования фотографов и монтажеров.
          </p>
        </div>

        <nav className="grid content-start gap-3 text-sm" aria-label="Маркетплейс">
          {marketplaceLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="grid content-start gap-3 text-sm text-muted-foreground" aria-label="Документы">
          {legalLinks.map((link) => (
            <Link key={link.label} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="grid content-start gap-3 lg:justify-items-end">
          <p className="text-sm text-muted-foreground">Следите за нами:</p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex size-9 items-center justify-center rounded-full border border-border" title="Instagram">
              <Instagram className="size-4" aria-hidden="true" />
            </span>
            <span className="flex size-9 items-center justify-center rounded-full border border-border" title="Telegram">
              <Send className="size-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
