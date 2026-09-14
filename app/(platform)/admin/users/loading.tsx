import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function UsersLoading() {
  return (
    <RouteLoading title="Usuarios" description="Todas las cuentas de la plataforma">
      <ListSkeleton />
    </RouteLoading>
  );
}
