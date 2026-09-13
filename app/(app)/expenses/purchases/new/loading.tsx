import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function ExpensesPurchasesNewLoading() {
  return (
    <RouteLoading title="Nueva compra">
      <FormSkeleton />
    </RouteLoading>
  );
}
