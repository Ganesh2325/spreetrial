import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spreetrail | Shared Roommate Expense Platform',
  description: 'Corporate-grade shared expense ledger with simplified settlements and anomalies checkers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
