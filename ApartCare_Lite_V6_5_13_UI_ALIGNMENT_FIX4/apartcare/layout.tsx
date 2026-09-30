import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ApartCare Lite',
  description: 'Your daily partner in property care. Helping you run your building beautifully.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
