"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

import type { BusinessLine, SalesChannel } from "@/types";

import { ExitFairMode } from "./exit-fair-mode";

/**
 * El paso de inicio de feria (design.md, decisiones 9 y 12).
 *
 * Línea y canal se eligen **una vez**, al abrir el puesto, y no vuelven a
 * preguntarse: elegirlos en cada venta es la fricción que este modo existe
 * para eliminar.
 *
 * No se inventa un «canal por omisión»: `sales_channels` no tiene esa columna
 * y añadirla sería un concepto nuevo para un problema de una sola pantalla
 * (convención nº 11). Se preselecciona el primero por posición y se puede
 * cambiar aquí mismo.
 */
export function FairStart({
  lines,
  channels,
  needsLine,
  offlineWithoutSnapshot,
  onStart,
}: {
  lines: readonly BusinessLine[];
  channels: readonly SalesChannel[];
  /** La línea activa es «Todas»: hay que elegir una antes de la cuadrícula. */
  needsLine: boolean;
  /** Sin red y sin captura previa: no hay cuadrícula que mostrar. */
  offlineWithoutSnapshot: boolean;
  onStart: (businessLineId: string, salesChannelId: string | null) => void;
}) {
  const [lineId, setLineId] = useState(lines[0]?.id ?? "");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");

  // La salida va en las dos ramas. El criterio 1 dice que el único control de
  // navegación tocable es la salida explícita, no que pueda no haberla: sin
  // ella, quien entra a una organización sin líneas —o sin señal ni catálogo—
  // queda atrapado en el modo feria y solo sale con el botón «atrás» del
  // navegador, que en una aplicación instalada puede no estar a la vista.
  const salida = (
    <div className="flex shrink-0 items-center px-2 py-1">
      <ExitFairMode />
    </div>
  );

  if (offlineWithoutSnapshot) {
    return (
      <>
        {salida}
        <div className="flex flex-1 items-center justify-center p-6">
          <p
            data-testid="fair-needs-network"
            className="max-w-sm text-center text-sm text-muted-foreground"
          >
            Para vender sin señal, abre la feria una vez con conexión: así se
            guarda el catálogo en el dispositivo.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {salida}
      <div className="flex flex-1 flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Abrir la feria</h1>

        {needsLine ? (
        <div className="grid gap-2">
          <label className="text-sm" htmlFor="fair-line">
            Línea de negocio
          </label>
          <Select value={lineId} onValueChange={setLineId}>
            <SelectTrigger id="fair-line" data-testid="fair-line" className="h-12">
              <SelectValue placeholder="Elige una línea" />
            </SelectTrigger>
            <SelectContent>
              {lines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se vende de una línea a la vez. Puedes cambiarla saliendo y
            volviendo a entrar.
          </p>
        </div>
        ) : null}

        {channels.length > 0 ? (
        <div className="grid gap-2">
          <label className="text-sm" htmlFor="fair-channel">
            Canal
          </label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger id="fair-channel" data-testid="fair-channel" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        ) : null}
        {needsLine && lines.length === 0 ? (
          <p data-testid="fair-no-lines" className="text-sm text-muted-foreground">
            Esta organización todavía no tiene líneas de negocio. Crea una en
            Configuración para poder vender.
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          data-testid="fair-start"
          disabled={needsLine && !lineId}
          onClick={() => onStart(lineId, channelId || null)}
          className="h-14 text-lg"
        >
          Empezar a vender
        </Button>
      </div>
    </>
  );
}
