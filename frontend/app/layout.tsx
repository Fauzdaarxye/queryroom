import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../src/styles/styles.css';

export const metadata: Metadata = {
  title: 'Queryroom · Your SQL practice space',
  description:
    'Practice SQL with real MySQL and PostgreSQL, save your progress, and learn at your own pace.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
