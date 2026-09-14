import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordDialog } from "@/features/account/change-password-dialog";
import { ProfileForm } from "@/features/account/profile-form";
import { profileView } from "@/features/account/profile-view";
import {
  getRequestAccess,
  getRequestPlatformAdmin,
  getRequestUser,
} from "@/lib/auth/request-user";

export const metadata = { title: "Perfil · Kamay" };

/**
 * Perfil de la propia cuenta (KAM-24): datos de solo lectura (correo,
 * organización, rol) más los dos cambios que puede hacer cualquier persona
 * sobre sí misma —nombre visible y contraseña—. El proxy ya cubre el caso
 * sin sesión, pero se verifica aquí también: es una pantalla de cuenta, no
 * debería depender solo de la capa de arriba.
 *
 * El administrador de la plataforma (KAM-26) ve «Administrador de la
 * plataforma» como acceso, con o sin organización activa, y el nombre visible
 * solo si tiene membresía en la organización en la que está.
 */
export default async function ProfilePage() {
  const user = await getRequestUser();
  if (!user) redirect("/auth/login");

  // El layout de `(account)` ya resolvió que hay algo que mostrar: una
  // organización activa o, para el super admin, la vista de plataforma.
  const [resolution, platformAdmin] = await Promise.all([
    getRequestAccess(),
    getRequestPlatformAdmin(),
  ]);
  const access = resolution?.kind === "active" ? resolution.access : null;
  if (!access && !platformAdmin) redirect("/auth/login");

  const view = profileView(access, platformAdmin);

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
            {view.organizationName && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Organización</span>
                <span data-testid="profile-organization">
                  {view.organizationName}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Rol</span>
              <span data-testid="profile-role">{view.roleLabel}</span>
            </div>
          </CardContent>
        </Card>

        {view.canRename && (
          <Card>
            <CardHeader>
              <CardTitle>Nombre visible</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm initialDisplayName={view.displayName} />
            </CardContent>
          </Card>
        )}

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
