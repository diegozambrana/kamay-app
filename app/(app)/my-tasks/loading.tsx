import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function MyTasksLoading() {
  return (
    <RouteLoading title="Mis pendientes">
      <ListSkeleton />
    </RouteLoading>
  );
}
