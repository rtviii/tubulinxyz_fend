'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import { makeStore, AppStore } from '@/store/store';
import './globals.css';
import { MolstarInstanceManagerProvider } from '@/components/molstar/services/MolstarInstanceManager';
import { IBM_Plex_Sans } from 'next/font/google';
import { FloatingNav } from '@/components/ui/FloatingNav';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <html lang="en" className={ibmPlexSans.variable}>
      <body className="bg-white font-sans">
        <Provider store={storeRef.current}>
          <MolstarInstanceManagerProvider>
            {children}
            <FloatingNav />
          </MolstarInstanceManagerProvider>
        </Provider>
      </body>
    </html>
  );
}