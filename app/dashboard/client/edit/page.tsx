import { ClientProfileForm } from "@/components/dashboard/client-profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { getAccountProfile } from "@/lib/data/account";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function ClientProfileEditPage() {
  const session = await requireSession(["CLIENT", "ADMIN"]);
  const account = await getAccountProfile(session);

  return (
    <section className="section">
      <div className="container max-w-3xl">
        <Card>
          <CardContent className="p-5 md:p-8">
            <ClientProfileForm account={account} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
