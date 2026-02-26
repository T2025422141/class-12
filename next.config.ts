import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 启用严格模式
  reactStrictMode: true,
  
  // 输出配置 - Docker 部署使用 standalone 模式
  output: 'standalone',
  
  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // 服务器外部包配置（用于 Supabase）
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // 环境变量配置
  env: {
    NEXT_PUBLIC_APP_NAME: '班级签到系统',
  },
  
  // 头部安全配置
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
