import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { lineCookieName } from "@/constants/auth";
import { getOwnerContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { allocateSharedExpenses } from "@/lib/reports/allocation";
import { type CsvTable, csvFilename, toCsv } from "@/lib/reports/csv";
import { marginOf } from "@/lib/reports/margin";
import { resolveReportPeriod } from "@/lib/reports/period";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { AllocationRuleService } from "@/services/configuration/allocation-rule-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { OrganizationService } from "@/services/organization-service";
import { ReportService } from "@/services/reports/report-service";
import {
  ALL_LINES,
  REPORT_IDS,
  type ReportId,
  type ReportScope,
} from "@/types";

const TITLES: Record<ReportId, string> = {
  profitability: "Rentabilidad",
  "expense-breakdown": "En qué se va el dinero",
  "product-ranking": "Qué se vende más",
  "low-stock": "Insumos por acabarse",
  "line-comparison": "Comparativo entre líneas",
};

/**
 * Exportación de un informe a hoja de cálculo (KAM-20, design D8).
 *
 * **Vuelve a ejecutar la lectura** con los mismos parámetros de la dirección
 * en vez de serializar lo que quedó pintado en el cliente. Serializar lo
 * pintado sería más corto, pero exportaría lo que hubiera en memoria en vez de
 * lo que la base dice ahora, y dejaría la cabecera de contexto a cargo del
 * componente que la dibuja en lugar de a cargo de quien produce el archivo.
 *
 * El mismo guardián de dueño que la página: un ayudante no descarga por aquí
 * lo que no puede ver por pantalla.
 */
export async function GET(request: Request) {
  const context = await getOwnerContext();
  if (!context) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const reportId = url.searchParams.get("report") ?? "";
  if (!(REPORT_IDS as readonly string[]).includes(reportId)) {
    return NextResponse.json({ error: "Informe desconocido" }, { status: 400 });
  }
  const report = reportId as ReportId;

  const organization = await new OrganizationService(context.supabase).getById(
    context.organizationId,
  );
  const today = todayInTimezone(organization.timezone);
  const period = resolveReportPeriod(
    {
      preset: url.searchParams.get("preset") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    },
    today,
    organization.timezone,
  );

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );
  const cookieLine = (await cookies()).get(
    lineCookieName(context.organizationId),
  )?.value;
  const requested =
    url.searchParams.get("line") ?? resolveActiveLine(cookieLine, lines);
  const line =
    requested !== ALL_LINES && lines.some((l) => l.id === requested)
      ? requested
      : ALL_LINES;

  const scope: ReportScope = {
    organizationId: context.organizationId,
    fromInstant: period.fromInstant,
    toInstant: period.toInstant,
    line,
  };

  const service = new ReportService(context.supabase);
  const lineNames = new Map(lines.map((l) => [l.id, l.name]));

  let table: CsvTable;
  let legend: string | undefined;

  switch (report) {
    case "line-comparison": {
      const allocation = allocateSharedExpenses(
        await service.lineComparison(scope),
        await new AllocationRuleService(context.supabase).get(
          context.organizationId,
        ),
      );
      legend = allocation.legend;
      table = {
        headers: ["Línea", "Ingresos", "Egresos", "De General", "Margen"],
        rows: allocation.lines.map((row) => [
          lineNames.get(row.businessLineId) ?? "Línea",
          row.revenue,
          row.expenses,
          row.allocated,
          row.margin,
        ]),
      };
      break;
    }

    case "profitability": {
      const rows = await service.profitability(scope);
      table = {
        headers: [
          "Pedido",
          "Fecha",
          "Línea",
          "Ingresos",
          "Costo",
          "Margen",
          "Margen %",
          "Costo registrado",
        ],
        rows: rows.map((row) => {
          const margin = marginOf({
            revenue: row.revenue,
            cost: row.materialCost,
          });
          return [
            row.orderId,
            row.occurredAt.slice(0, 10),
            lineNames.get(row.businessLineId) ?? "",
            row.revenue,
            row.materialCost,
            margin.amount,
            margin.percent,
            row.hasCost ? "sí" : "no",
          ];
        }),
      };
      break;
    }

    case "expense-breakdown": {
      const [rows, categories] = await Promise.all([
        service.expenseBreakdown(scope),
        new ExpenseCategoryService(context.supabase).listAll(
          context.organizationId,
        ),
      ]);
      const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
      table = {
        headers: ["Categoría", "Línea", "Tipo", "Total"],
        rows: rows.map((row) => [
          row.kind === "purchase"
            ? "Compras a proveedores"
            : (categoryNames.get(row.expenseCategoryId ?? "") ?? "Sin categoría"),
          lineNames.get(row.businessLineId) ?? "",
          row.kind === "purchase" ? "Compra" : "Gasto",
          row.total,
        ]),
      };
      break;
    }

    case "product-ranking": {
      const [rows, items] = await Promise.all([
        service.productRanking(scope),
        new ItemService(context.supabase).list(context.organizationId),
      ]);
      const itemNames = new Map(items.map((i) => [i.id, i.name]));
      table = {
        headers: ["Producto", "Unidades", "Ingresos", "Costo", "Margen"],
        rows: rows.map((row) => [
          itemNames.get(row.itemId) ?? "",
          row.unitsSold,
          row.revenue,
          row.attributedCost,
          row.revenue - row.attributedCost,
        ]),
      };
      break;
    }

    case "low-stock": {
      const [rows, items, contacts] = await Promise.all([
        service.lowStock(scope),
        new ItemService(context.supabase).list(context.organizationId),
        new ContactService(context.supabase).list(context.organizationId),
      ]);
      const itemNames = new Map(items.map((i) => [i.id, i.name]));
      const supplierNames = new Map(contacts.map((c) => [c.id, c.name]));
      table = {
        headers: [
          "Insumo",
          "Saldo",
          "Mínimo",
          "Faltante",
          "Último costo",
          "Proveedor",
        ],
        rows: rows.map((row) => [
          itemNames.get(row.itemId) ?? "",
          row.balance,
          row.minStock,
          row.missing,
          row.lastCost,
          row.lastSupplierId
            ? (supplierNames.get(row.lastSupplierId) ?? "")
            : "",
        ]),
      };
      break;
    }
  }

  const csv = toCsv(
    {
      title: TITLES[report],
      period:
        report === "low-stock"
          ? `Saldo de hoy (${today})`
          : `${period.from} a ${period.to}`,
      line: line === ALL_LINES ? "Todas" : (lineNames.get(line) ?? "Todas"),
      legend,
    },
    table,
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(report, period)}"`,
    },
  });
}
