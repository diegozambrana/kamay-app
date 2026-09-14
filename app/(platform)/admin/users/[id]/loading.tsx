import { RouteLoading } from "@/components/shared/route-loading";
import { CardsSkeleton } from "@/components/shared/skeletons";

export default function UserDetailLoading() {
  return (
    <RouteLoading title="Cuenta" description="Organizaciones y roles de la cuenta">
      <CardsSkeleton cards={3} />
    </RouteLoading>
  );
}
