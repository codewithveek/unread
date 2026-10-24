import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@unread/db", "@unread/core"],
  // Native/ONNX packages stay out of the server bundle.
  serverExternalPackages: [
    "kokoro-js",
    "@huggingface/transformers",
    "onnxruntime-node",
    "@resvg/resvg-js",
    "sharp",
    "@temporalio/client",
  ],
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
