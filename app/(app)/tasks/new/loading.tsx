import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function TasksNewLoading() {
  return (
    <RouteLoading title="Nueva tarea">
      <FormSkeleton />
    </RouteLoading>
  );
}
