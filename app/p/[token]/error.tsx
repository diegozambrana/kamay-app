"use client";

import { SectionError, type SectionErrorProps } from "@/components/shared/section-error";

export default function PublicOrderShareError(props: SectionErrorProps) {
  return <SectionError boundary="Tu pedido" {...props} />;
}
