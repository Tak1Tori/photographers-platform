import Link from "next/link";
import { Camera, Clapperboard, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

const roles = [
  {
    title: "Я клиент",
    description: "Продолжите подбор фотографа и времени для новой съемки.",
    href: "/photographers?mode=booking",
    icon: Search,
    allowedRoles: ["CLIENT", "ADMIN"]
  },
  {
    title: "Я фотограф",
    description: "Управляйте профилем, портфолио, ценами, доступностью и бронями.",
    href: "/dashboard/photographer",
    icon: Camera,
    allowedRoles: ["PHOTOGRAPHER", "ADMIN"]
  },
  {
    title: "Я монтажер",
    description: "Смотрите каталог монтажеров и свой публичный профиль после публикации администратором.",
    href: "/editors",
    icon: Clapperboard,
    allowedRoles: ["EDITOR", "ADMIN"]
  },
  {
    title: "Я администратор",
    description: "Смотрите операции платформы, модерацию партнеров и общую выручку.",
    href: "/admin",
    icon: ShieldCheck,
    allowedRoles: ["ADMIN"]
  }
];

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <section className="section">
      <div className="container grid gap-5 md:grid-cols-3">
        {roles.filter((role) => role.allowedRoles.includes(session.user.role)).map((role) => {
          const Icon = role.icon;
          return (
            <Card key={role.href}>
              <CardHeader>
                <span className="mb-3 flex size-11 items-center justify-center rounded-md bg-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <CardTitle>{role.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-5 text-sm leading-6 text-muted-foreground">
                  {role.description}
                </p>
                <Button asChild className="w-full">
                  <Link href={role.href}>Открыть кабинет</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
