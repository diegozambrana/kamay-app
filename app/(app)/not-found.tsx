import Link from "next/link";

import { MainContainer } from "@/components/layout/main-container";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Lo que rinde un detalle cuando `notFound()` no encuentra el registro: un
 * pedido, egreso, ítem o tarea que no existe o que es de otra organización.
 *
 * Dentro del cascarón, a propósito: quien sigue un enlace viejo conserva la
 * navegación. Y el mismo mensaje para «no existe» que para «es de otra
 * organización», porque distinguirlos le diría a alguien ajeno que el
 * registro existe.
 */
export default function AppNotFound() {
  return (
    <MainContainer title="No encontrado">
      <EmptyState
        title="Este registro no existe o no está a tu alcance"
        description="Puede que el enlace sea de otra organización o que la dirección esté mal escrita."
        action={
          <Button asChild>
            <Link href="/dashboard">Volver al panel</Link>
          </Button>
        }
      />
    </MainContainer>
  );
}
