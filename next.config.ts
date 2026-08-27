import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos del catálogo viajan como FormData a una Server Action y el
      // límite de la especificación es 5 MB por archivo; el margen cubre el
      // resto del formulario.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
