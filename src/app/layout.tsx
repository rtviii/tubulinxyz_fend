'use client';
import { useRef } from 'react';
import { Provider } from 'react-redux';
import { makeStore, AppStore } from '@/store/store';
import { MolstarProvider } from '@/components/molstar/molstar_service';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore>();

  if (!storeRef.current) {
    // Create the store instance only once
    storeRef.current = makeStore();
  }

  return (
    <html lang="en">
      <body className="bg-white">
        <Provider store={storeRef.current}>
          <MolstarProvider>
            {children}
          </MolstarProvider>
        </Provider>
      </body>
    </html>
  );
}
