"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { activateTool, deactivateTool } from "@/actions/tools";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/features/settings/section-header";
import type { CatalogEntry } from "@/features/tools/catalog-view";
import { ConfigForm } from "@/features/tools/config-form";

/**
 * KAM-27 · Sección *Herramientas* de V15 (spec `tenant-tools` → *El catálogo
 * vive en la configuración y es de la dueña*).
 *
 * El catálogo es el mismo para todas las organizaciones: sale del registro en
 * código. Aquí la dueña lee qué hace cada herramienta **antes** de activarla
 * —qué produce, si sale a internet, quién puede usarla, dónde aparece—, la
 * activa, la desactiva y edita sus parámetros.
 */
function ToolCard({ entry }: { entry: CatalogEntry }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function activate() {
    setError(null);
    startTransition(async () => {
      const result = await activateTool(entry.slug);
      if (result?.error) setError(result.error);
    });
  }

  function deactivate() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateTool(entry.slug);
      if (result?.error) setError(result.error);
      else setConfirming(false);
    });
  }

  return (
    <li className="rounded-lg border p-4 sm:p-5" data-testid={`tool-${entry.slug}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{entry.name}</h3>
            <Badge variant={entry.active ? "default" : "outline"}>
              {entry.active ? "Activa" : "No activa"}
            </Badge>
          </div>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{entry.description}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {entry.href && (
            <Button asChild variant="outline" size="sm">
              <Link href={entry.href}>Abrir</Link>
            </Button>
          )}
          {entry.active ? (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              Desactivar
            </Button>
          ) : (
            <Button size="sm" disabled={pending} onClick={activate}>
              {pending ? "Activando…" : "Activar"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium">Qué hace y qué no</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {entry.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

      {!entry.active && entry.hasSavedConfig && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ya la usaste antes: al activarla vuelve con los parámetros que dejaste.
        </p>
      )}

      {error && !confirming && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {entry.active && (
        <details className="mt-4 border-t pt-4" data-testid={`tool-params-${entry.slug}`}>
          <summary className="cursor-pointer text-sm font-medium">Parámetros</summary>
          <p className="mt-2 mb-4 max-w-prose text-sm text-muted-foreground">
            Recién activada trae valores de ejemplo: revísalos antes de confiar en sus resultados.
          </p>
          {/* La llave fuerza un borrador nuevo si los parámetros cambian por fuera. */}
          <ConfigForm key={JSON.stringify(entry.config)} slug={entry.slug} config={entry.config} />
        </details>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Desactivar ${entry.name}?`}
        description="Dejará de aparecer en el menú y en los pedidos. Tus parámetros se conservan: si la vuelves a activar, vuelven tal como los dejaste. Nada de lo que ya añadiste a un pedido cambia."
        confirmLabel="Desactivar"
        pending={pending}
        error={error}
        onConfirm={deactivate}
      />
    </li>
  );
}

export function ToolsCatalog({ entries }: { entries: CatalogEntry[] }) {
  return (
    <section>
      <SectionHeader
        title="Herramientas"
        description="Utilidades opcionales que puedes sumar a tu organización. Ninguna cambia cómo funciona Kamay: solo guardan sus parámetros, y lo que producen entra por donde entraría si lo escribieras a mano."
      />
      {entries.length === 0 ? (
        <EmptyState testId="tools-empty" title="Todavía no hay herramientas disponibles." />
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <ToolCard key={entry.slug} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
