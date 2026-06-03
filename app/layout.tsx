import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'รายงานฝึกงานประจำสัปดาห์',
  description: 'ระบบกรอกรายงานฝึกงานประจำสัปดาห์ สำหรับนักศึกษาฝึกงาน',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
