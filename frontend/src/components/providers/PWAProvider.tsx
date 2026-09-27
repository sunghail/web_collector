'use client';

import { useEffect } from 'react';

export function PWAProvider() {
  useEffect(() => {
    // Electron 환경에서는 서비스 워커 등록하지 않음
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !(window as any).electronAPI) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW 등록 실패 시 무시 (localhost HTTP에서는 실패할 수 있음)
      });
    }
  }, []);

  return null;
}
