"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { MainContainer } from "@/components/layout/main-container";
import { OutstandingSummary } from "@/features/payments/outstanding-summary";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ExpenseSummary } from "@/lib/expenses/totals";
import type { ExpenseWithTotal } from "@/services/expenses/expense-service";
import {
  ALL_LINES,
  type Contact,
  type ExpenseCategory,
  type ExpenseKind,
  type LineColor,
  type OutstandingByLine,
} from "@/types";

import { ExpenseCard } from "./expense-card";
import { ExpenseDetail, KIND_LABELS, type ExpenseDetailData } from "./expense-detail";
import { ExpenseFilters, type ExpenseFilterValues } from "./expense-filters";
import { ExpenseRows } from "./expense-row";
import { hasPendingUploads, useReceiptUploadStore } from "./receipt-upload-store";

/** Una fila de la bandeja con lo que hace falta mostrar, resuelto en lote. */
export type ExpenseRowView = ExpenseWithTotal & {
  lineName: string;
  lineColor: LineColor;
  /** El proveedor de la compra o la categoría del gasto. */
  counterpartyName: string | null;
};

/**
 * V7 · Bandeja de egresos. Compras y gastos en una sola lista cronológica;
 * los filtros viven en la dirección y los totales del periodo se calculan al
 * leer (design D6). En móvil, tarjetas apiladas en vez de tabla.
 */
export function ExpensesScreen({
  rows,
  summary,
  suppliers,
  categories,
  filters,
  activeLineId,
  payables,
  selected,
  timezone,
}: {
  rows: ExpenseRowView[];
  summary: ExpenseSummary;
  suppliers: Contact[];
  categories: ExpenseCategory[];
  filters: ExpenseFilterValues;
  /** La línea activa del selector global; `null` es "Todas". */
  activeLineId: string | null;
  /** Lo pendiente de pago por línea, tal como llega de la vista. */
  payables: OutstandingByLine[];
  /** El egreso abierto en el panel lateral (`?selected=`), ya resuelto. */
  selected: ExpenseDetailData | null;
  timezone: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const isMobile = useIsMobile();
  const uploads = useReceiptUploadStore((state) => state.uploads);

  // Salir con un comprobante a medio subir avisa (design D4). El egreso ya
  // está guardado; lo que se perdería es la foto.
  useEffect(() => {
    if (!hasPendingUploads(uploads)) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploads]);

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `/expenses?${query}` : "/expenses");
  }

  function open(expenseId: string) {
    updateParams({ selected: expenseId });
  }

  return (
    <MainContainer
      title="Egresos"
      description="Todo lo que sale de caja: compras y gastos."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* Por pagar de la línea activa. Al ayudante le daría cero, pero a
              esta pantalla no llega: los egresos son del dueño (§16). */}
          <OutstandingSummary
            label="Por pagar"
            rows={payables}
            activeLine={activeLineId ?? ALL_LINES}
            testId="payables-summary"
          />
          <Button asChild variant="outline" data-testid="new-purchase">
            <Link href="/expenses/purchases/new">
              <PlusIcon className="size-4" aria-hidden /> Nueva compra
            </Link>
          </Button>
          <Button asChild data-testid="new-cost">
            <Link href="/expenses/costs/new">
              <PlusIcon className="size-4" aria-hidden /> Nuevo gasto
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ExpenseFilters
          values={filters}
          suppliers={suppliers}
          categories={categories}
          onChange={updateParams}
        />

        <Summary summary={summary} />

        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay egresos en este periodo.
          </p>
        ) : isMobile ? (
          <ul className="flex flex-col gap-3" data-testid="expense-cards">
            {rows.map((row) => (
              <ExpenseCard
                key={row.id}
                row={row}
                timezone={timezone}
                upload={uploads[row.id]}
                onOpen={() => open(row.id)}
              />
            ))}
          </ul>
        ) : (
          <ExpenseRows
            rows={rows}
            timezone={timezone}
            uploads={uploads}
            onOpen={open}
          />
        )}
      </div>

      {/* El detalle en un panel, sin abandonar la bandeja (mapa §7). */}
      <Sheet
        open={selected !== null}
        onOpenChange={(isOpen) => !isOpen && updateParams({ selected: null })}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{KIND_LABELS[selected.expense.kind]}</SheetTitle>
                <SheetDescription>
                  <Link
                    href={`/expenses/${selected.expense.id}`}
                    className="hover:underline"
                  >
                    Abrir a página completa
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <ExpenseDetail data={selected} timezone={timezone} variant="panel" />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainContainer>
  );
}

function Summary({ summary }: { summary: ExpenseSummary }) {
  const cells: { label: string; value: number; testId: string }[] = [
    { label: KIND_LABELS.purchase + "s", value: summary.purchases, testId: "summary-purchases" },
    { label: KIND_LABELS.expense + "s", value: summary.costs, testId: "summary-costs" },
    { label: "Total del periodo", value: summary.total, testId: "summary-total" },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-3" data-testid="expense-summary">
      {cells.map((cell) => (
        <div key={cell.testId} className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{cell.label}</dt>
          <dd className="text-xl font-semibold tabular-nums" data-testid={cell.testId}>
            {cell.value.toFixed(2)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type { ExpenseKind };
