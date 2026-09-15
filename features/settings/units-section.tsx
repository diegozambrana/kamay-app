"use client";

import { useEntityDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import type { Unit } from "@/types";

import { ConfigTables, ENTITY_COPY } from "./config-list";
import { SectionHeader } from "./section-header";
import { UnitDialog } from "./unit-dialog";

/** Sección Unidades de V15. Aquí la clave visible es el código ('u', 'kg'…). */
export function UnitsSection({ units }: { units: Unit[] }) {
  const dialog = useEntityDialog<Unit>();

  return (
    <section>
      <SectionHeader
        title="Unidades"
        description="Cómo se mide lo que se compra y se vende."
        action={<Button onClick={dialog.openNew}>{ENTITY_COPY.unit.createButton}</Button>}
      />

      <ConfigTables
        entity="unit"
        items={units}
        caption="Unidades"
        labelOf={(unit) => `${unit.code} · ${unit.name}`}
        onEdit={dialog.openEdit}
        columns={[
          {
            key: "code",
            header: "Código",
            className: "w-28",
            cell: (unit) => <span className="font-medium">{unit.code}</span>,
          },
          { key: "name", header: "Nombre" },
        ]}
      />

      <UnitDialog dialog={dialog} />
    </section>
  );
}
