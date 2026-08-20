import { InviteForm } from "@/features/auth/invite-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invitación · Kamay" };

export default async function InvitePage({
  params,
}: PageProps<"/auth/invite/[token]">) {
  const { token } = await params;

  // No se consulta la invitación aquí: solo el dueño puede leer `invitations`,
  // y la validación entera vive en `accept_invitation()`, que responde lo mismo
  // ante cualquier fallo para no delatar qué invitaciones existen.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <InviteForm token={token} signedIn={Boolean(user)} />;
}
