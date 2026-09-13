import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function CatalogLoading() {
  return (
    <RouteLoading title="Catálogo">
      <ListSkeleton />
    </RouteLoading>
  );
}
