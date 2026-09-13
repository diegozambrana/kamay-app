import { RouteLoading } from "@/components/shared/route-loading";
import { DetailSkeleton } from "@/components/shared/skeletons";

export default function OrdersIdLoading() {
  return (
    <RouteLoading title="Pedido">
      <DetailSkeleton />
    </RouteLoading>
  );
}
