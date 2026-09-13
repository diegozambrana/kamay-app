import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function OrdersNewLoading() {
  return (
    <RouteLoading title="Nuevo pedido">
      <FormSkeleton />
    </RouteLoading>
  );
}
