import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function OrdersIdEditLoading() {
  return (
    <RouteLoading title="Editar pedido">
      <FormSkeleton />
    </RouteLoading>
  );
}
