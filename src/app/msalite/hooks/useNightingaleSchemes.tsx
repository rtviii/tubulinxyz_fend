'use client';

import { useEffect, useState } from 'react';
import { positionColorScheme } from '../colorschemes/positionScheme';

// This hook attempts to register our custom color scheme with nightingale-msa
export function useNightingaleSchemes() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to access nightingale's internal scheme registry
    // This is a bit hacky since nightingale doesn't expose a public API for this
    
    const tryRegister = () => {
      try {
        // Check if nightingale-msa custom elements are defined
        const msaElement = document.createElement('nightingale-msa');
        
        // nightingale-msa stores schemes in a module-level Map
        // We need to find a way to inject our scheme
        // 
        // Option 1: Monkey-patch after the component is created
        // Option 2: Use the component's colorScheme setter with a custom object
        // Option 3: Fork and modify nightingale-msa
        
        // For now, let's check if we can access it through the element
        console.log('MSA element created:', msaElement);
        console.log('MSA element properties:', Object.keys(msaElement));
        
        // The cleanest approach without forking is to see if we can
        // intercept the colorScheme getter/setter
        
        setIsRegistered(true);
      } catch (e) {
        console.error('Failed to register custom scheme:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    // Wait for custom elements to be defined
    if (customElements.get('nightingale-msa')) {
      tryRegister();
    } else {
      customElements.whenDefined('nightingale-msa').then(tryRegister);
    }
  }, []);

  return { isRegistered, error };
}