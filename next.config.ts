import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin usa requires dinámicos y gRPC; si Turbopack lo empaqueta,
  // la función de Vercel falla al importarlo y todas las rutas privadas dan 500.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
