import React, { createContext, useContext } from 'react';
import { useDocumentScanner } from '../hooks/useDocumentScanner';

const ScannerContext = createContext(null);

export function ScannerProvider({ children }) {
  const scanner = useDocumentScanner();
  return (
    <ScannerContext.Provider value={scanner}>
      {children}
    </ScannerContext.Provider>
  );
}

export function useScannerContext() {
  const context = useContext(ScannerContext);
  if (!context) {
    throw new Error('useScannerContext must be used within a ScannerProvider');
  }
  return context;
}
