import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ExpenseBreakdownReport } from "@/features/reports/expense-breakdown-report";
import { LineComparisonReport } from "@/features/reports/line-comparison-report";
import { LowStockReport } from "@/features/reports/low-stock-report";
import { ProductRankingReport } from "@/features/reports/product-ranking-report";
import { ProfitabilityReport } from "@/features/reports/profitability-report";
import { ReportHeader } from "@/features/reports/report-header";
import { ReportsScreen } from "@/features/reports/reports-screen";
import { lineCookieName } from "@/constants/auth";
import { getOwnerContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { allocateSharedExpenses } from "@/lib/reports/allocation";
import { InvalidPeriodError, resolveReportPeriod } from "@/lib/reports/period";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { AllocationRuleService } from "@/services/configuration/allocation-rule-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";
import { OrganizationService } from "@/services/organization-service";
import { ReportService } from "@/services/reports/report-service";
import {
  ALL_LINES,
  REPORT_IDS,
  type ReportId,
  type ReportScope,
} from "@/types";

export const metadata = { title: "Reportes · Kamay" };

/**
 * V14 · Reportes (KAM-20).
 *
 * El rol se resuelve **antes del primer render** (design D3, requisito
 * *Reportes es una página completa reservada a la persona dueña*): un ayudante
 * es redirigido sin que ninguna cifra llegue a su navegador. La guardia real,
 * de todos modos, vive dentro de cada función derivada.
 *
 * El periodo se resuelve **una sola vez** aquí y se pasa igual a las cinco
 * lecturas (design D1): es lo que hace cierto por construcción que las cifras
 * cuadren entre los informes.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string;
    from?: string;
    to?: string;
    line?: string;
  }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const params = await searchParams;
  const organization = await new OrganizationService(context.supabase).getById(
    context.organizationId,
  );

  const today = todayInTimezone(organization.timezone);

  let period;
  try {
    period = resolveReportPeriod(params, today, organization.timezone);
  } catch (error) {
    if (!(error instanceof InvalidPeriodError)) throw error;
    // Un rango invertido no recalcula nada: se dice y se mantiene el anterior.
    period = resolveReportPeriod({}, today, organization.timezone);
  }

  const invalidRange =
    params.preset === "custom" &&
    Boolean(params.from) &&
    Boolean(params.to) &&
    (params.from as string) > (params.to as string);

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );

  const cookieLine = (await cookies()).get(
    lineCookieName(context.organizationId),
  )?.value;
  const requestedLine = params.line ?? resolveActiveLine(cookieLine, lines);
  const line =
    requestedLine !== ALL_LINES && lines.some((l) => l.id === requestedLine)
      ? requestedLine
      : ALL_LINES;

  const scope: ReportScope = {
    organizationId: context.organizationId,
    fromInstant: period.fromInstant,
    toInstant: period.toInstant,
    line,
  };

  const reports = new ReportService(context.supabase);

  const [
    profitability,
    breakdown,
    ranking,
    lowStock,
    comparison,
    allocationSettings,
    items,
    contacts,
    categories,
    channels,
  ] = await Promise.all([
    reports.profitability(scope),
    reports.expenseBreakdown(scope),
    reports.productRanking(scope),
    reports.lowStock(scope),
    reports.lineComparison(scope),
    new AllocationRuleService(context.supabase).get(context.organizationId),
    new ItemService(context.supabase).list(context.organizationId),
    new ContactService(context.supabase).list(context.organizationId),
    new ExpenseCategoryService(context.supabase).listAll(
      context.organizationId,
    ),
    new SalesChannelService(context.supabase).listAll(context.organizationId),
  ]);

  const allocation = allocateSharedExpenses(comparison, allocationSettings);

  const nameMap = <T extends { id: string; name: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.id, row.name]));

  const itemNames = nameMap(items);
  const lineNames = nameMap(lines);

  // El pedido se identifica por su número visible, no por su UUID.
  const orderLabels = new Map(
    profitability.map((row) => [
      row.orderId,
      `Pedido ${row.orderId.slice(0, 8)}`,
    ]),
  );

  const exportHref = (id: ReportId) =>
    `/reports/export?report=${id}&preset=${period.preset}&from=${period.from}&to=${period.to}&line=${line}`;

  // Se resuelven aquí: una función no puede cruzar la frontera hacia un
  // componente de cliente, y el servidor ya sabe las cinco direcciones.
  const exportHrefs = Object.fromEntries(
    REPORT_IDS.map((id) => [id, exportHref(id)]),
  ) as Record<ReportId, string>;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Reportes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Del {period.from} al {period.to}. Los cinco informes usan este mismo
          periodo, así que sus cifras cuadran entre sí.
        </p>
      </div>

      <ReportHeader
        lines={lines}
        preset={period.preset}
        from={period.from}
        to={period.to}
        line={line}
      />

      {invalidRange && (
        <p role="alert" className="text-sm text-destructive">
          El fin del periodo es anterior a su inicio; se mantuvo el periodo
          anterior.
        </p>
      )}

      <ReportsScreen
        exportHrefs={exportHrefs}
        reports={{
          "line-comparison": (
            <LineComparisonReport
              key="line-comparison"
              allocation={allocation}
              lineNames={lineNames}
            />
          ),
          profitability: (
            <ProfitabilityReport
              key="profitability"
              rows={profitability}
              orderLabels={orderLabels}
            />
          ),
          "expense-breakdown": (
            <ExpenseBreakdownReport
              key="expense-breakdown"
              rows={breakdown}
              categoryNames={nameMap(categories)}
              period={{ from: period.from, to: period.to }}
            />
          ),
          "product-ranking": (
            <ProductRankingReport
              key="product-ranking"
              rows={ranking}
              itemNames={itemNames}
              channelNames={nameMap(channels)}
            />
          ),
          "low-stock": (
            <LowStockReport
              key="low-stock"
              rows={lowStock}
              itemNames={itemNames}
              supplierNames={nameMap(contacts)}
            />
          ),
        }}
      />
    </section>
  );
}
