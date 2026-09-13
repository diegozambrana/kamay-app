import { RouteLoading } from "@/components/shared/route-loading";
import { DetailSkeleton } from "@/components/shared/skeletons";

export default function TasksIdLoading() {
  return (
    <RouteLoading title="Tarea">
      <DetailSkeleton />
    </RouteLoading>
  );
}
