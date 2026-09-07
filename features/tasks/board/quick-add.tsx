"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { createTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Alta rápida del tablero.
 *
 * Tres interacciones y ni una más: **abrir** el compositor, **escribir** el
 * título, **confirmar** con Enter. La línea no se pregunta —viene resuelta del
 * selector activo, o es la compartida cuando está en «Todas»— y el estado
 * inicial lo pone la base.
 *
 * El campo se vacía y conserva el foco tras guardar: anotar tres pendientes
 * seguidos es un gesto real del taller, y volver a pulsar *+ Nueva tarea* cada
 * vez lo convertiría en nueve interacciones en vez de cinco.
 */
export function QuickAdd({
  businessLineId,
  onError,
}: {
  /** `null` cuando la organización no tiene línea compartida: hay que pedirla. */
  businessLineId: string | null;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sin línea que resolver, el alta rápida no puede cumplir su promesa de tres
  // interacciones: se manda al formulario, que sí pide la línea. Es una
  // degradación honesta, no un botón roto.
  if (!businessLineId) {
    return (
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href="/tasks/new" data-testid="quick-add-task">
          <PlusIcon className="size-4" aria-hidden /> Nueva tarea
        </Link>
      </Button>
    );
  }

  const lineId = businessLineId;

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        data-testid="quick-add-task"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-4" aria-hidden /> Nueva tarea
      </Button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = title.trim();
    if (!trimmed) {
      onError("Escribe un título para la tarea");
      return;
    }

    startTransition(async () => {
      const result = await createTask({ title: trimmed, businessLineId: lineId });
      if ("error" in result) {
        onError(result.error);
        return;
      }

      setTitle("");
      inputRef.current?.focus();
    });
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md items-center gap-2">
      <Input
        ref={inputRef}
        autoFocus
        value={title}
        disabled={pending}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder="¿Qué hay que hacer?"
        aria-label="Título de la tarea"
        data-testid="quick-add-title"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Guardar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setOpen(false)}
      >
        Cancelar
      </Button>
    </form>
  );
}
