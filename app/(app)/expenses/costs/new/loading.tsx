import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function ExpensesCostsNewLoading() {
  return (
    <RouteLoading title="Nuevo gasto">
      <FormSkeleton />
    </RouteLoading>
  );
}
