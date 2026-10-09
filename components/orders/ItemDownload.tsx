'use client';

import { Download, Lock } from 'lucide-react';

type OrderDownload = { id: string; source: string; status: string; url: string; downloadCount?: number } | null | undefined;

/** Download button for an order item: a bought download, or the free digital copy that comes with a print */
export default function ItemDownload({ download }: { download: OrderDownload }) {
  if (!download) return null;
  const gift = download.source === 'welcome_gift';
  if (download.status === 'locked') {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-600">
        <Lock className="w-3.5 h-3.5" />
        Free digital copy: activate your account from the email we sent to unlock it
      </p>
    );
  }
  return (
    <a
      href={download.url}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-purple-600 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50"
    >
      <Download className="w-4 h-4" />
      {gift ? 'Download your free digital copy' : 'Download full resolution'}
    </a>
  );
}
