import { RouteLoading } from "@/components/shared/route-loading";
import { CardsSkeleton } from "@/components/shared/skeletons";

export default function DashboardLoading() {
  return (
    <RouteLoading title="Panel">
      <CardsSkeleton />
    </RouteLoading>
  );
}
