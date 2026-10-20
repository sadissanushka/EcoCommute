import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EcoCommute Analytical & Urban Dashboards',
  description: 'Corporate ESG Commute Analytics & Differentially Private Urban Mobility Planning',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
