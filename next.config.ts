import type { NextConfig } from "next";
import { getSupabaseEnvironment } from "./src/lib/supabase/env";

// Validate build configuration without depending on runtime-only platform flags.
getSupabaseEnvironment();

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.1.21"],
  experimental: {
    useTypeScriptCli: false,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
    ];

    const privateNoStoreHeaders = [
      { key: "Cache-Control", value: "private, no-store" },
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/login", headers: privateNoStoreHeaders },
      { source: "/", headers: privateNoStoreHeaders },
      { source: "/forbidden", headers: privateNoStoreHeaders },
      { source: "/dashboard/:path*", headers: privateNoStoreHeaders },
      { source: "/patients/:path*", headers: privateNoStoreHeaders },
      { source: "/appointments/:path*", headers: privateNoStoreHeaders },
      { source: "/accounting/:path*", headers: privateNoStoreHeaders },
      { source: "/security/:path*", headers: privateNoStoreHeaders },
    ];
  },
};

export default nextConfig;
