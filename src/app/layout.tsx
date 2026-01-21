'use client';
import { useRef } from 'react';
import { Provider } from 'react-redux';
import { makeStore, AppStore } from '@/store/store';
import './globals.css';
import { MolstarInstanceManagerProvider } from '@/components/molstar/services/MolstarInstanceManager';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore | null>(null)

  if (!storeRef.current) {
    // Create the store instance only once
    storeRef.current = makeStore();
  }

  return (
    <html lang="en">
      <body className="bg-white">
        <Provider store={storeRef.current}>
          <MolstarInstanceManagerProvider>
            {children}
          </MolstarInstanceManagerProvider>
        </Provider>
      </body>
    </html>
  );
}
