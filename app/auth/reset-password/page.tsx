import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nueva contraseña · Kamay" };

export default async function ResetPasswordPage() {
  // Solo accesible con la sesión que otorga el enlace de recuperación.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?error=invalid-link");
  }

  return <ResetPasswordForm />;
}
