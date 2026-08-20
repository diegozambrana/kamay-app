import { redirect } from "next/navigation";

/** `/settings` no tiene contenido propio: abre en la primera sección. */
export default function SettingsPage() {
  redirect("/settings/general");
}
