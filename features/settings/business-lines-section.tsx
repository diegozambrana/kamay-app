"use client";

import { useEntityDialog } from "@/components/shared/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LINE_COLOR_LABELS } from "@/lib/business-lines/colors";
import type { BusinessLine } from "@/types";

import { ColorDot } from "./color-select";
import { ConfigTables, ENTITY_COPY } from "./config-list";
import { LineDialog } from "./line-dialog";
import { SectionHeader } from "./section-header";

/**
 * Sección Líneas de negocio de V15. La línea compartida se lista sin
 * «Archivar» en su menú: el invariante lo garantiza la base, y ofrecer una
 * acción que siempre falla sería mentirle al usuario.
 */
export function BusinessLinesSection({ lines }: { lines: BusinessLine[] }) {
  const dialog = useEntityDialog<BusinessLine>();

  return (
    <section>
      <SectionHeader
        title="Líneas de negocio"
        description="Cada línea tiene sus propias cuentas y su propio color."
        action={<Button onClick={dialog.openNew}>{ENTITY_COPY.line.createButton}</Button>}
      />

      <ConfigTables
        entity="line"
        items={lines}
        caption="Líneas de negocio"
        labelOf={(line) => line.name}
        isProtected={(line) => line.isShared}
        onEdit={dialog.openEdit}
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (line) => (
              <span className="flex flex-wrap items-center gap-2">
                <ColorDot color={line.color} />
                <span className="font-medium">{line.name}</span>
                {line.isShared && <Badge variant="secondary">Compartida</Badge>}
              </span>
            ),
          },
          {
            key: "color",
            header: "Color",
            className: "w-32",
            cell: (line) => LINE_COLOR_LABELS[line.color],
          },
        ]}
      />

      <LineDialog dialog={dialog} />
    </section>
  );
}
