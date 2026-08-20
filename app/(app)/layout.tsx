import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { MainContainer } from "@/components/layout/main-container";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OrganizationProvider } from "@/components/providers/organization-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { ORG_COOKIE } from "@/constants/auth";
import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";

/**
 * AuthCheck: carga usuario y membresías, revalida la organización activa
 * (cookie `kamay-org`) y envuelve la interfaz en los providers.
 * El proxy ya bloquea sin sesión; esto es la segunda línea de defensa.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const memberships = await new MembershipService(supabase).listActiveForUser(
    user.id,
  );

  if (memberships.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Tu cuenta no pertenece a ninguna organización. Pide a la persona
          dueña que te invite.
        </p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_COOKIE)?.value;
  let active = memberships.find((m) => m.organizationId === cookieOrgId);

  if (!active) {
    if (memberships.length === 1) {
      // Cookie ausente o inválida con una sola organización: no hay ambigüedad.
      active = memberships[0];
    } else {
      // Cookie inválida con varias organizaciones: se vuelve a elegir
      // (la selección sobreescribe la cookie).
      redirect("/auth/select-org");
    }
  }

  return (
    <UserProvider
      user={{ id: user.id, email: user.email ?? "" }}
      membership={{
        id: active.id,
        organizationId: active.organizationId,
        role: active.role,
        displayName: active.displayName,
      }}
    >
      <OrganizationProvider
        organization={active.organization}
        memberships={memberships}
      >
        <div className="flex min-h-dvh flex-col">
          <Header />
          <MainContainer>{children}</MainContainer>
          <MobileNav />
        </div>
      </OrganizationProvider>
    </UserProvider>
  );
}
