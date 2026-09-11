import { redirect } from "next/navigation";

import { ContactsScreen } from "@/features/contacts/contacts-screen";
import { getSessionContext } from "@/lib/auth/session-context";
import { loadRecordHistory } from "@/services/activity/record-history";
import { ContactService } from "@/services/catalog/contact-service";
import { CONTACT_ROLE_FILTERS, type ContactRoleFilter } from "@/types";

export const metadata = { title: "Contactos · Kamay" };

/**
 * V13 · Contactos. Los filtros y el contacto preseleccionado viven en la
 * dirección: `?id=` es lo que usan los enlaces entrantes desde pedidos y
 * egresos.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    q?: string;
    archived?: string;
    id?: string;
  }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  const roleFilter: ContactRoleFilter = CONTACT_ROLE_FILTERS.includes(
    params.role as ContactRoleFilter,
  )
    ? (params.role as ContactRoleFilter)
    : "all";
  const search = params.q ?? "";
  const includeArchived = params.archived === "1";

  const contacts = await new ContactService(context.supabase).list(
    context.organizationId,
    { role: roleFilter, search, includeArchived },
  );

  // El historial del contacto abierto, por la misma lectura que la bitácora
  // general filtrada por ese contacto (KAM-22).
  const history = params.id
    ? await loadRecordHistory(context.supabase, {
        organizationId: context.organizationId,
        tableName: "contacts",
        recordId: params.id,
        timezone: context.membership.organization.timezone,
        currency: context.membership.organization.currency,
      })
    : null;

  return (
    <ContactsScreen
      contacts={contacts}
      roleFilter={roleFilter}
      search={search}
      includeArchived={includeArchived}
      timezone={context.membership.organization.timezone}
      selectedId={params.id ?? null}
      history={history}
      role={context.membership.role}
    />
  );
}
