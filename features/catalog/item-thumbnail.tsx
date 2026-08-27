import { ImageIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Miniatura de la foto del ítem para el listado. Cuando no hay foto —o la URL
 * firmada caducó— queda el icono, que mantiene la columna alineada en vez de
 * dejar un hueco que descuadra la fila.
 */
export function ItemThumbnail({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  return (
    <Avatar className="size-9 rounded-md" data-testid="item-thumbnail">
      {url && <AvatarImage src={url} alt={`Foto de ${name}`} />}
      <AvatarFallback className="rounded-md text-muted-foreground">
        <ImageIcon className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
