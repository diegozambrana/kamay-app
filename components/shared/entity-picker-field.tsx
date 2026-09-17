"use client";

import { ArrowLeftRightIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * El disparador de un campo que se elige en un diálogo (design D2 de
 * `order-form-picker-dialogs`): sin valor, un botón «Seleccionar …»; con
 * valor, su nombre y dos botones de icono para cambiarlo o quitarlo.
 *
 * El `id` va siempre al control que abre el diálogo, para poder devolverle el
 * foco desde fuera (por ejemplo, tras «Guardar y crear otro»).
 */
export function EntityPickerField({
  id,
  value,
  selectLabel,
  changeLabel,
  clearLabel,
  onOpen,
  onClear,
  disabled,
  invalid,
  className,
  "data-testid": testId,
}: {
  id: string;
  /** El nombre de lo elegido, o `null` si todavía no hay nada. */
  value: string | null;
  /** «Seleccionar cliente». */
  selectLabel: string;
  /** «Cambiar cliente»: nombre accesible y texto de ayuda del botón. */
  changeLabel: string;
  /** «Quitar cliente». */
  clearLabel: string;
  onOpen: () => void;
  onClear: () => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  if (value === null) {
    return (
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        className={cn("w-full justify-start", className)}
        onClick={onOpen}
      >
        {selectLabel}
      </Button>
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-h-8 items-center justify-between gap-2 rounded-lg border px-2.5 py-1",
        invalid && "border-destructive",
        className,
      )}
    >
      <span data-testid="entity-picker-value" className="min-w-0 truncate font-medium">
        {value}
      </span>

      <TooltipProvider>
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id={id}
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={changeLabel}
                onClick={onOpen}
              >
                <ArrowLeftRightIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{changeLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={clearLabel}
                onClick={onClear}
              >
                <XIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{clearLabel}</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </TooltipProvider>
    </div>
  );
}
