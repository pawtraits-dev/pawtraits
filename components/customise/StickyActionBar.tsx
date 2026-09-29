'use client';

import type { ReactNode } from 'react';

/** Thumb-reachable bottom action bar for mobile; becomes an inline block from md upwards. */
export default function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-40 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:mt-6">
        <div className="mx-auto max-w-xl space-y-2">{children}</div>
      </div>
    </>
  );
}
