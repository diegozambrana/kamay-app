import { MainContainer } from "@/components/layout/main-container";
import { ActivityFilterBar } from "@/features/activity/activity-filters";
import { ActivityHeader } from "@/features/activity/activity-header";
import {
  ActivityList,
  type ActivityDay,
} from "@/features/activity/activity-list";
import type { ActivityRowItem } from "@/features/activity/activity-row";
import { describeEvent, recordHref } from "@/lib/activity/describe";
import { buildDetail } from "@/lib/activity/diff";
import {
  activityHref,
  hasActiveFilters,
  parseFilters,
} from "@/lib/activity/filters";
import {
  dayLabel,
  groupByDay,
  longDate,
  timeOf,
} from "@/lib/activity/grouping";
import { RetentionPolicyService } from "@/services/activity/retention-service";
import { getOwnerContext } from "@/lib/auth/session-context";
import { todayInTimezone } from "@/lib/orders/overdue";
import {
  ActivityService,
  type RecentActivityEntry,
} from "@/services/activity/activity-service";
import { LabelService, resolveSearch } from "@/services/activity/label-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { InvitationService } from "@/services/invitation-service";
import { OrganizationService } from "@/services/organization-service";

export const metadata = { title: "Bitácora · Kamay" };

/** Cómo se rotula el tipo de registro en la fila y en el filtro. */
const RECORD_KINDS: Record<string, string> = {
  orders: "Pedido",
  order_items: "Línea de pedido",
  expenses: "Egreso",
  expense_items: "Línea de egreso",
  payments: "Dinero",
  items: "Ítem",
  item_variants: "Variante",
  contacts: "Contacto",
  tasks: "Tarea",
  task_links: "Vínculo de tarea",
  task_deliverables: "Entregable",
  tags: "Etiqueta",
  attachments: "Adjunto",
  asset_details: "Activo",
  inventory_movements: "Inventario",
  business_lines: "Línea de negocio",
  statuses: "Estado",
  sales_channels: "Canal",
  expense_categories: "Categoría",
  units: "Unidad",
  memberships: "Equipo",
  membership_lines: "Acceso a línea",
  invitations: "Invitación",
  organizations: "Organización",
};

/**
 * V23 · Bitácora de actividad.
 *
 * Componente de servidor: los filtros se leen de la dirección y se aplican en
 * la consulta, no sobre un resultado ya cargado (design D10). El guardián de
 * rol vive en el layout; aquí `getOwnerContext()` se resuelve otra vez porque
 * hace falta el cliente y la organización, no porque se desconfíe de él.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getOwnerContext();
  if (!context) return null; // El layout ya redirigió.

  const { supabase, organizationId } = context;
  const filters = parseFilters(await searchParams);

  const organization = await new OrganizationService(supabase).getById(
    organizationId,
  );
  const timezone = organization.timezone;

  // La búsqueda se resuelve a un `record_id` antes de consultar: la bitácora
  // se busca por identificador de registro, no por texto dentro del cambio.
  const recordId = await resolveSearch(supabase, organizationId, filters.search);

  const activity = new ActivityService(supabase);
  const page =
    recordId === null && filters.search
      ? { entries: [], nextCursor: null } // Búsqueda sin correspondencia.
      : await activity.search(organizationId, filters, { timezone, recordId });

  const labels = new LabelService(supabase);
  const [recordLabels, detailNames, actorNames, lines, members, retentionMonths] =
    await Promise.all([
      labels.forRecords(organizationId, page.entries),
      labels.forDetails(organizationId, page.entries),
      labels.people(
        organizationId,
        page.entries.map((entry) => entry.actorId).filter((id) => id !== null),
      ),
      new BusinessLineService(supabase).listActive(organizationId),
      new InvitationService(supabase).listMembers(organizationId),
      new RetentionPolicyService(supabase).get(organizationId),
    ]);

  const lineById = new Map(lines.map((line) => [line.id, line]));
  const today = todayInTimezone(timezone);

  const days: ActivityDay[] = groupByDay(page.entries, timezone).map((group) => ({
    label: dayLabel(group.day, today),
    date: longDate(group.day),
    items: group.items.map((entry) =>
      toRow(entry, {
        timezone,
        currency: organization.currency,
        recordLabels,
        detailNames,
        actorNames,
        line: entry.businessLineId
          ? (lineById.get(entry.businessLineId) ?? null)
          : null,
      }),
    ),
  }));

  return (
    <MainContainer
      title="Bitácora de actividad"
      description="Qué cambió, quién y cuándo"
    >
      <div className="flex flex-col gap-6">
        <ActivityHeader retentionMonths={retentionMonths} />

        <ActivityFilterBar
          filters={filters}
          lines={lines.map((line) => ({ value: line.id, label: line.name }))}
          people={members.map((member) => ({
            value: member.userId,
            label: member.displayName ?? "Sin nombre",
          }))}
          recordTypes={Object.entries(RECORD_KINDS).map(([value, label]) => ({
            value,
            label,
          }))}
          exportHref={`/activity/export?${new URLSearchParams(
            Object.fromEntries(
              Object.entries(await searchParams).flatMap(([key, value]) =>
                typeof value === "string" ? [[key, value]] : [],
              ),
            ),
          )}`}
        />

        <ActivityList
          days={days}
          nextHref={
            page.nextCursor
              ? activityHref(
                  { ...filters, cursor: page.nextCursor },
                  { keepCursor: true },
                )
              : null
          }
          // Con filtros puestos, «ninguno coincide» y su salida; sin ellos,
          // «todavía no hay movimientos», que no tiene salida que ofrecer.
          filtered={hasActiveFilters(filters)}
          clearHref="/activity"
        />
      </div>
    </MainContainer>
  );
}

type RowContext = {
  timezone: string;
  currency: string;
  recordLabels: ReadonlyMap<string, string>;
  detailNames: ReadonlyMap<string, string>;
  actorNames: ReadonlyMap<string, string>;
  line: { id: string; name: string; color: string | null } | null;
};

function toRow(entry: RecentActivityEntry, ctx: RowContext): ActivityRowItem {
  const actorName = entry.actorId
    ? (ctx.actorNames.get(entry.actorId) ?? null)
    : null;
  const recordLabel = ctx.recordLabels.get(entry.recordId) ?? null;

  return {
    id: entry.id,
    sentence: describeEvent({
      action: entry.action,
      tableName: entry.tableName,
      actorName,
      actorLabel: entry.actorLabel,
      recordLabel,
    }),
    initials: initialsOf(actorName ?? entry.actorLabel),
    author: actorName ?? entry.actorLabel ?? "Alguien",
    time: timeOf(entry.occurredAt, ctx.timezone),
    occurredAt: entry.occurredAt,
    recordLabel,
    recordKind: RECORD_KINDS[entry.tableName] ?? "Registro",
    lineName: ctx.line?.name ?? null,
    lineColor: ctx.line?.color ?? null,
    origin: entry.origin,
    href: recordHref(entry.tableName, entry.recordId),
    detail: buildDetail(entry.tableName, entry.changes, {
      timezone: ctx.timezone,
      currency: ctx.currency,
      names: ctx.detailNames,
    }),
    action: entry.action,
    tableName: entry.tableName,
    recordId: entry.recordId,
  };
}

/** «MC» de «Marcela Cruz». Sin nombre no hay iniciales que inventar. */
function initialsOf(name: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}
