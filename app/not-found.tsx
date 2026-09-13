import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "No encontrado · Kamay" };

/**
 * Una dirección que no corresponde a ninguna pantalla. Fuera del cascarón de
 * la aplicación, porque no se sabe si hay sesión: la salida es el inicio, que
 * ya decide adónde llevar a cada quien.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        className="max-w-md"
        title="Esta página no existe"
        description="Puede que el enlace esté mal escrito o que la dirección haya cambiado."
        action={
          <Button asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
        }
      />
    </main>
  );
}
