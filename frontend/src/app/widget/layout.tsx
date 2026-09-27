import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Widget - Web Collector',
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'transparent',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
