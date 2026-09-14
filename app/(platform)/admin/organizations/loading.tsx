import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function OrganizationsLoading() {
  return (
    <RouteLoading title="Organizaciones" description="Todas las organizaciones de la plataforma">
      <ListSkeleton />
    </RouteLoading>
  );
}
