import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Lo que ve una cuenta con sesión y sin ninguna membresía activa (KAM-25):
 * nunca la invitaron o la quitaron de todos los equipos. No hay cascarón, así
 * que tampoco hay menú de cuenta: sin este botón la persona quedaría atrapada
 * en su sesión, sin poder entrar con otra cuenta.
 *
 * Un formulario y no `useSignOut()` (design D6): ese hook pregunta cuando hay
 * registros pendientes, y el recuento lo publica el `SyncProvider`, que aquí
 * no se monta porque no hay organización contra la cual sincronizar. Cerrar
 * sesión no borra la cola del dispositivo, así que no hay nada que perder.
 */
export function NoOrganizationNotice() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        Tu cuenta no pertenece a ninguna organización. Pide a la persona dueña
        que te invite.
      </p>
      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          data-testid="no-organization-sign-out"
        >
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
