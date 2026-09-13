import { RouteLoading } from "@/components/shared/route-loading";
import { BoardSkeleton } from "@/components/shared/skeletons";

export default function TasksLoading() {
  return (
    <RouteLoading title="Tareas">
      <BoardSkeleton />
    </RouteLoading>
  );
}
