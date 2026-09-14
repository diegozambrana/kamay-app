import { RouteLoading } from "@/components/shared/route-loading";
import { CardsSkeleton } from "@/components/shared/skeletons";

export default function OrganizationDetailLoading() {
  return (
    <RouteLoading title="Organización" description="Datos y equipo de la organización">
      <CardsSkeleton cards={3} />
    </RouteLoading>
  );
}
