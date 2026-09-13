import { CardsSkeleton } from "@/components/shared/skeletons";

/**
 * El modo feria no tiene cascarón (layout de `(fair)`): el esqueleto ocupa la
 * pantalla con la forma de la cuadrícula de productos, sin ningún elemento de
 * navegación que tocar mientras carga.
 */
export default function FairLoading() {
  return (
    <main className="flex min-h-dvh flex-col p-4">
      <CardsSkeleton cards={6} />
    </main>
  );
}
