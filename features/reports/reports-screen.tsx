"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { REPORT_IDS, type ReportId } from "@/types";

const TITLES: Record<ReportId, string> = {
  profitability: "Rentabilidad",
  "expense-breakdown": "En qué se va el dinero",
  "product-ranking": "Qué se vende más",
  "low-stock": "Insumos por acabarse",
  "line-comparison": "Comparativo entre líneas",
};

const DESCRIPTIONS: Record<ReportId, string> = {
  profitability: "Cuánto deja cada pedido, y de cuáles lo sabemos de verdad.",
  "expense-breakdown": "A dónde fue el dinero que salió, por categoría y línea.",
  "product-ranking":
    "Qué se vende más y qué deja más. No siempre es lo mismo.",
  "low-stock": "Qué se está acabando, para reponerlo antes de que pare el taller.",
  "line-comparison": "Cómo le fue a cada línea, con los gastos de General repartidos.",
};

/**
 * La composición de V14 (KAM-20, design D7 y tarea 6.10).
 *
 * En escritorio los cinco informes se apilan, cada uno con su título y su
 * exportación. En pantallas estrechas se muestra **uno por vez** con un
 * conmutador: apilar cinco tablas en 390 px no es una pantalla, es una lista
 * de scroll infinito donde no se encuentra nada.
 *
 * Es el mismo árbol en las dos disposiciones, no dos composiciones distintas:
 * lo que cambia es cuántos se ven a la vez.
 */
export function ReportsScreen({
  reports,
  exportHrefs,
}: {
  reports: Record<ReportId, ReactNode>;
  /**
   * Un mapa y no una función: nada que cruce la frontera hacia un componente
   * de cliente puede ser una función, y el servidor ya sabe las cinco
   * direcciones cuando compone la pantalla.
   */
  exportHrefs: Record<ReportId, string>;
}) {
  const [active, setActive] = useState<ReportId>("line-comparison");

  return (
    <>
      {/* Conmutador: solo en pantallas estrechas. */}
      <div
        className="mb-4 flex gap-2 overflow-x-auto md:hidden"
        role="tablist"
        aria-label="Informes"
      >
        {REPORT_IDS.map((id) => (
          <Button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            variant={active === id ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setActive(id)}
          >
            {TITLES[id]}
          </Button>
        ))}
      </div>

      <div className="space-y-10">
        {REPORT_IDS.map((id) => (
          <section
            key={id}
            // En móvil solo el activo; en escritorio, todos.
            className={active === id ? "block" : "hidden md:block"}
            aria-label={TITLES[id]}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-base font-medium">{TITLES[id]}</h3>
                <p className="text-sm text-muted-foreground">
                  {DESCRIPTIONS[id]}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={exportHrefs[id]} download>
                  Exportar
                </a>
              </Button>
            </div>
            {reports[id]}
          </section>
        ))}
      </div>
    </>
  );
}
