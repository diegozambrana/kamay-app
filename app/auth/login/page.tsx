import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { resolvePostAuthPath } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Entrar · Kamay" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/auth/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  const linkError =
    params.error === "invalid-link"
      ? "El enlace no es válido o ya expiró. Pide uno nuevo."
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(await resolvePostAuthPath(supabase, next));
  }

  return <LoginForm next={next} initialError={linkError} />;
}
