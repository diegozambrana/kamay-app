import { redirect } from "next/navigation";

import { selectOrganization } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolvePostAuthPath } from "@/lib/auth/post-auth";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";

export const metadata = { title: "Elegir organización · Kamay" };

export default async function SelectOrgPage({
  searchParams,
}: PageProps<"/auth/select-org">) {
  const params = await searchParams;
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : null,
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const memberships = await new MembershipService(supabase).listActiveForUser(
    user.id,
  );
  if (memberships.length <= 1) {
    // Con una sola organización no hay nada que elegir.
    redirect(await resolvePostAuthPath(supabase, next));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Elige una organización</CardTitle>
        <CardDescription>
          Tu cuenta pertenece a varias organizaciones. Elige con cuál quieres
          trabajar.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {memberships.map((membership) => (
          <form key={membership.id} action={selectOrganization}>
            <input
              type="hidden"
              name="organizationId"
              value={membership.organizationId}
            />
            {next && <input type="hidden" name="next" value={next} />}
            <Button
              type="submit"
              variant="outline"
              className="w-full justify-start"
            >
              {membership.organization.name}
            </Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
