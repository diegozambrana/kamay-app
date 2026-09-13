import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function AssetsLoading() {
  return (
    <RouteLoading title="Activos">
      <ListSkeleton />
    </RouteLoading>
  );
}
