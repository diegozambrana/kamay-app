"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeForSearch } from "@/lib/search/normalize";
import type { Tag } from "@/types";

/**
 * Selector de etiquetas con creación al vuelo.
 *
 * Las etiquetas son agrupación transversal y efímera (`hornada-07`,
 * `feria-agosto`): obligar a darlas de alta en Configuración antes de usarlas
 * es la forma segura de que nadie las use.
 *
 * La búsqueda normaliza tildes y mayúsculas con la misma función que usa la
 * base a través de `search_name`, así que quien escribe "hornada" ve
 * "Hornada-07" **antes** de que se le ofrezca crear una segunda.
 */
export function TagPicker({
  available,
  value,
  onChange,
  disabled,
}: {
  /** Las etiquetas que ya existen en la organización. */
  available: Tag[];
  /** Nombres elegidos. Se trabaja con nombres, no ids: los nuevos aún no lo tienen. */
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");

  const normalizedTerm = normalizeForSearch(term);
  const chosen = new Set(value.map(normalizeForSearch));

  const suggestions = normalizedTerm
    ? available
        .filter(
          (tag) =>
            normalizeForSearch(tag.name).includes(normalizedTerm) &&
            !chosen.has(normalizeForSearch(tag.name)),
        )
        .slice(0, 6)
    : [];

  // Solo se ofrece crear cuando no hay una coincidencia exacta ya normalizada:
  // es lo que impide que "hornada-07" nazca al lado de "Hornada-07".
  const exists = available.some(
    (tag) => normalizeForSearch(tag.name) === normalizedTerm,
  );
  const canCreate = normalizedTerm.length > 0 && !exists && !chosen.has(normalizedTerm);

  function add(name: string) {
    if (!chosen.has(normalizeForSearch(name))) onChange([...value, name]);
    setTerm("");
  }

  return (
    <div className="flex flex-col gap-2" data-testid="tag-picker">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1">
              {name}
              <button
                type="button"
                aria-label={`Quitar ${name}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((current) => current !== name))}
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Input
        value={term}
        disabled={disabled}
        placeholder="Buscar o crear etiqueta"
        aria-label="Etiquetas"
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Enter no envía el formulario: aquí significa "añade esta etiqueta".
          event.preventDefault();
          const match = available.find(
            (tag) => normalizeForSearch(tag.name) === normalizedTerm,
          );
          if (match) add(match.name);
          else if (canCreate) add(term.trim());
        }}
      />

      {(suggestions.length > 0 || canCreate) && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((tag) => (
            <Button
              key={tag.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => add(tag.name)}
            >
              {tag.name}
            </Button>
          ))}

          {canCreate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              data-testid="create-tag"
              onClick={() => add(term.trim())}
            >
              Crear «{term.trim()}»
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
