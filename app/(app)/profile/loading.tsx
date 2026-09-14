import { RouteLoading } from "@/components/shared/route-loading";
import { CardsSkeleton } from "@/components/shared/skeletons";

export default function ProfileLoading() {
  return (
    <RouteLoading title="Perfil" description="Tus datos de cuenta">
      <CardsSkeleton cards={3} />
    </RouteLoading>
  );
}
