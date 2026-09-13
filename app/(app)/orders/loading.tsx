import { RouteLoading } from "@/components/shared/route-loading";
import { BoardSkeleton } from "@/components/shared/skeletons";

export default function OrdersLoading() {
  return (
    <RouteLoading title="Pedidos">
      <BoardSkeleton />
    </RouteLoading>
  );
}
