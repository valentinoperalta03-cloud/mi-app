import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/mp/webhook",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,OPTIONS" },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
