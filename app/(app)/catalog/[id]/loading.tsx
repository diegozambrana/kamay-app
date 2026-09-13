import { RouteLoading } from "@/components/shared/route-loading";
import { DetailSkeleton } from "@/components/shared/skeletons";

export default function CatalogIdLoading() {
  return (
    <RouteLoading title="Ítem">
      <DetailSkeleton />
    </RouteLoading>
  );
}
