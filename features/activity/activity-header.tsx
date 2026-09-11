import { Badge } from "@/components/ui/badge";
import { retentionLabel } from "@/lib/activity/retention";

/**
 * La cabecera de V23: qué es esta pantalla y bajo qué reglas.
 *
 * El aviso no es decoración. La bitácora es el único sitio del sistema donde
 * el dato no se puede corregir, y quien la mira tiene que saberlo antes de
 * buscar el botón de editar. El plazo se lee de la configuración y **no es un
 * texto fijo**: si dice doce meses cuando están configurados veinticuatro, el
 * aviso es peor que no tenerlo.
 */
export function ActivityHeader({ retentionMonths }: { retentionMonths: number }) {
  return (
    <div className="flex flex-col gap-2" data-testid="activity-notice">
      <Badge variant="secondary" className="w-fit">
        Solo dueño
      </Badge>
      <p className="text-muted-foreground text-sm">
        La bitácora <strong>no puede editarse ni borrarse</strong>. Retención
        vigente: detalle completo de los últimos{" "}
        <strong data-testid="retention-months">
          {retentionLabel(retentionMonths)}
        </strong>
        ; pasado ese plazo se conserva el evento y se suelta el detalle del
        cambio.
      </p>
    </div>
  );
}
