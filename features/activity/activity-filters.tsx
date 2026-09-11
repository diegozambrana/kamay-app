"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIONS,
  ANY,
  type ActivityFilters,
  activityHref,
  hasActiveFilters,
} from "@/lib/activity/filters";
import { ALL_LINES } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  created: "Registró",
  updated: "Editó",
  status_changed: "Cambió de estado",
  archived: "Archivó",
  unarchived: "Desarchivó",
};

export type FilterOption = { value: string; label: string };

export type ActivityFiltersProps = {
  filters: ActivityFilters;
  lines: FilterOption[];
  people: FilterOption[];
  /** Los tipos de registro que esta organización tiene en su bitácora. */
  recordTypes: FilterOption[];
  /** La dirección de la exportación, con los filtros vigentes. */
  exportHref: string;
};

/**
 * La barra de filtros de V23.
 *
 * **Empuja a la dirección y no guarda estado propio.** De ahí salen tres cosas
 * del requisito sin escribir código para ninguna: el enlace filtrado se
 * comparte, volver atrás recupera el filtro anterior, y el filtro se aplica en
 * la consulta —porque el servidor solo conoce la consulta— (design D10).
 *
 * El cursor no se arrastra: cambiar un filtro devuelve a la primera página, y
 * conservar el de la página siete mostraría un hueco sin explicación.
 */
export function ActivityFilterBar({
  filters,
  lines,
  people,
  recordTypes,
  exportHref,
}: ActivityFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  function apply(patch: Partial<ActivityFilters>) {
    router.push(activityHref({ ...filters, ...patch, cursor: null }));
  }

  return (
    <div className="flex flex-col gap-3" data-testid="activity-filters">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde" htmlFor="from">
          <Input
            id="from"
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => apply({ from: event.target.value || null })}
            className="w-40"
          />
        </Field>

        <Field label="Hasta" htmlFor="to">
          <Input
            id="to"
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => apply({ to: event.target.value || null })}
            className="w-40"
          />
        </Field>

        <Picker
          id="line"
          label="Línea"
          value={filters.line}
          anyValue={ALL_LINES}
          anyLabel="Todas las líneas"
          options={lines}
          onChange={(value) => apply({ line: value })}
        />

        <Picker
          id="actor"
          label="Usuario"
          value={filters.actor}
          anyValue={ANY}
          anyLabel="Cualquiera"
          options={people}
          onChange={(value) => apply({ actor: value })}
        />

        <Picker
          id="type"
          label="Tipo de registro"
          value={filters.table}
          anyValue={ANY}
          anyLabel="Todos"
          options={recordTypes}
          onChange={(value) => apply({ table: value })}
        />

        <Picker
          id="action"
          label="Tipo de acción"
          value={filters.action}
          anyValue={ANY}
          anyLabel="Todas"
          options={ACTIONS.map((action) => ({
            value: action,
            label: ACTION_LABELS[action],
          }))}
          onChange={(value) => apply({ action: value as never })}
        />

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search });
          }}
        >
          <Field label="Buscar registro" htmlFor="q">
            <Input
              id="q"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="142 o identificador"
              className="w-48"
            />
          </Field>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" data-testid="activity-export">
          <a href={exportHref}>Exportar</a>
        </Button>

        {hasActiveFilters(filters) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/activity">Quitar los filtros</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Picker({
  id,
  label,
  value,
  anyValue,
  anyLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  anyValue: string;
  anyLabel: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={anyValue}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
