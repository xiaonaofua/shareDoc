import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 不让搜索引擎收录任何页面
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // 不把带令牌的地址通过 Referer 泄露给第三方
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
