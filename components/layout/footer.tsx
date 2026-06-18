import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container grid gap-8 py-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="text-base font-semibold">
            Framely
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            MVP marketplace-платформы для бронирования фотосессий под ключ:
            стиль, фотограф, студия и время в одном потоке.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <p className="font-medium">Marketplace</p>
          <Link href="/styles" className="text-muted-foreground hover:text-foreground">
            Стили съемки
          </Link>
          <Link href="/photographers" className="text-muted-foreground hover:text-foreground">
            Фотографы
          </Link>
          <Link href="/studios" className="text-muted-foreground hover:text-foreground">
            Студии
          </Link>
        </div>
        <div className="grid gap-2 text-sm">
          <p className="font-medium">Кабинеты</p>
          <Link href="/dashboard/photographer" className="text-muted-foreground hover:text-foreground">
            Фотограф
          </Link>
          <Link href="/dashboard/studio" className="text-muted-foreground hover:text-foreground">
            Студия
          </Link>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            Админ
          </Link>
        </div>
      </div>
    </footer>
  );
}
