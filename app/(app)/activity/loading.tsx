import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function ActivityLoading() {
  return (
    <RouteLoading title="Bitácora de actividad">
      <ListSkeleton />
    </RouteLoading>
  );
}
