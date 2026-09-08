import type { Metadata } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import './globals.css';
const display = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
});
const body = Manrope({ variable: '--font-body', subsets: ['latin'] });
export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: 'Taal — Your tabla studio',
  description:
    'Find your rhythm. Play tabla with your keyboard or fingertips, practice traditional taals, and record your own sessions.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
