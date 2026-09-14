import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordDialog } from "@/features/account/change-password-dialog";
import { ProfileForm } from "@/features/account/profile-form";
import { getRequestUser } from "@/lib/auth/request-user";
import { getSessionContext } from "@/lib/auth/session-context";

export const metadata = { title: "Perfil · Kamay" };

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  assistant: "Ayudante",
};

/**
 * Perfil de la propia cuenta (KAM-24): datos de solo lectura (correo,
 * organización, rol) más los dos cambios que puede hacer cualquier persona
 * sobre sí misma —nombre visible y contraseña—. `getSessionContext()` ya
 * cubre el caso sin sesión desde el proxy, pero se verifica aquí también:
 * es una pantalla de cuenta, no debería depender solo de la capa de arriba.
 */
export default async function ProfilePage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const user = await getRequestUser();
  if (!user) redirect("/auth/login");

  const { membership } = context;

  return (
    <MainContainer title="Perfil" description="Tus datos de cuenta">
      <div className="flex flex-col gap-6 md:max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Datos de cuenta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Correo</span>
              <span data-testid="profile-email">{user.email}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Organización</span>
              <span data-testid="profile-organization">
                {membership.organization.name}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Rol</span>
              <span data-testid="profile-role">
                {ROLE_LABELS[membership.role] ?? membership.role}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nombre visible</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm initialDisplayName={membership.displayName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordDialog />
          </CardContent>
        </Card>
      </div>
    </MainContainer>
  );
}
