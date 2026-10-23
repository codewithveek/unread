import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@unread/db"],
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
