import { RouteLoading } from "@/components/shared/route-loading";
import { CardsSkeleton } from "@/components/shared/skeletons";

export default function QuickLoading() {
  return (
    <RouteLoading title="Registro rápido">
      <CardsSkeleton />
    </RouteLoading>
  );
}
