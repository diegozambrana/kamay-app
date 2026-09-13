import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function ExpensesLoading() {
  return (
    <RouteLoading title="Egresos">
      <ListSkeleton />
    </RouteLoading>
  );
}
