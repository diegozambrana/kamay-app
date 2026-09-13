import { RouteLoading } from "@/components/shared/route-loading";
import { DetailSkeleton } from "@/components/shared/skeletons";

export default function ExpensesIdLoading() {
  return (
    <RouteLoading title="Egreso">
      <DetailSkeleton />
    </RouteLoading>
  );
}
