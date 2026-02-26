import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '班级签到',
    template: '%s | 班级签到',
  },
  description: '多用户在线班级签到系统，支持实时数据同步',
  keywords: ['签到', '班级', '考勤', '在线签到'],
  authors: [{ name: 'Coze Code' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
