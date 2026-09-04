import { WifiOff } from "lucide-react";

/**
 * El retorno del service worker cuando una navegación no se puede servir sin
 * red. No es una página de error del navegador: es Kamay diciendo qué pasa y
 * qué sí funciona.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta pantalla necesita red para mostrarse. Lo que registres mientras
        tanto se guarda en el dispositivo y se envía solo cuando vuelva la
        señal: nada se pierde.
      </p>
    </main>
  );
}
