import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function GovLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
