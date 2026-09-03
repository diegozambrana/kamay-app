"use client";

import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useTransition } from "react";

import { selectBusinessLine } from "@/actions/business-line-context";
import { Button } from "@/components/ui/button";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { cn } from "@/lib/utils";
import { useBusinessLineStore } from "@/stores/business-line-store";
import { ALL_LINES } from "@/types";

/**
 * Selector de línea global (V15 / mapa de navegación §2.2). No es un filtro más:
 * es el contexto que acompaña al usuario por todas las secciones, así que vive
 * en la barra superior y no dentro de ninguna pantalla.
 */
export function LineSelector({
  /**
   * El selector se rinde dos veces —menú lateral en escritorio, tira de
   * contexto en móvil— y solo una es visible a la vez. Cada instancia
   * necesita su propio identificador: con el mismo, cualquier consulta por
   * `testId` encontraría dos coincidencias.
   */
  testId = "line-selector",
}: {
  testId?: string;
} = {}) {
  const lines = useBusinessLineStore((state) => state.lines);
  const activeLine = useBusinessLineStore((state) => state.activeLine);
  const setActiveLine = useBusinessLineStore((state) => state.setActiveLine);
  const [pending, startTransition] = useTransition();

  const current = lines.find((line) => line.id === activeLine);
  const label = current?.name ?? "Todas";

  function choose(value: string) {
    if (value === activeLine) return;
    // Se pinta de inmediato y la acción confirma: la cookie es `httpOnly`,
    // así que el servidor es quien la escribe y revalida.
    setActiveLine(value);
    startTransition(async () => {
      await selectBusinessLine(value);
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={testId}
          aria-label="Línea de negocio"
          disabled={pending}
        >
          {current ? (
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                lineColorClasses(current.color).dot,
              )}
            />
          ) : null}
          {label}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <LineOption
            label="Todas"
            selected={activeLine === ALL_LINES}
            onSelect={() => choose(ALL_LINES)}
          />

          {lines.map((line) => (
            <LineOption
              key={line.id}
              label={line.name}
              dotClass={lineColorClasses(line.color).dot}
              selected={activeLine === line.id}
              onSelect={() => choose(line.id)}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function LineOption({
  label,
  dotClass,
  selected,
  onSelect,
}: {
  label: string;
  dotClass?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-muted"
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", dotClass ?? "bg-transparent")}
      />
      <span className="flex-1">{label}</span>
      {selected && <Check className="size-3.5" />}
    </DropdownMenu.Item>
  );
}
