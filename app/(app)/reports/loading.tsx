import { RouteLoading } from "@/components/shared/route-loading";
import { CardsSkeleton } from "@/components/shared/skeletons";

export default function ReportsLoading() {
  return (
    <RouteLoading title="Reportes">
      <CardsSkeleton />
    </RouteLoading>
  );
}
