import type { Metadata } from 'next';
import './globals.css';

// Test deploy: force dynamic rendering so client pages using useSearchParams
// don't fail static prerender.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'PrivateID Integration Demo',
  description: 'Demo application showcasing PrivateID integration with redirect and iframe flows',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
