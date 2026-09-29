'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Lock, Gift } from 'lucide-react';

interface Item { id: string; source: 'purchase' | 'welcome_gift'; status: 'locked' | 'available'; title: string; previewUrl: string | null; downloadCount: number }

export default function DownloadsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get('welcome') === '1');
    fetch('/api/customers/downloads', { credentials: 'include' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setItems(d); })
      .catch(e => setError(e.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {welcome && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white">
          <p className="text-lg font-semibold flex items-center gap-2"><Gift className="w-5 h-5" /> Welcome to Pawtraits!</p>
          <p className="text-sm opacity-90 mt-1">Your account is all set up and your free download is below. Tap to save it to your phone.</p>
        </div>
      )}
      <h1 className="text-2xl font-bold text-gray-900">My downloads</h1>
      <p className="text-gray-600 text-sm mt-1">Full-resolution files of your portraits. Each link is fresh every time you tap.</p>

      {error && <p className="mt-6 text-red-600">{error} — <Link href="/auth/login?returnTo=/customer/downloads" className="underline">sign in</Link></p>}
      {!items && !error && <p className="mt-6 text-gray-500">Loading…</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-gray-600">Nothing here yet. <Link href="/browse" className="text-purple-700 underline">Find a design</Link> and put your pet in it!</p>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items?.map(item => (
          <div key={item.id} className="rounded-xl border bg-white overflow-hidden">
            <div className="aspect-square bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.previewUrl && <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
              <p className="text-xs text-gray-500">{item.source === 'welcome_gift' ? 'Free gift' : 'Purchased'}</p>
              {item.status === 'available' ? (
                <a href={`/api/downloads/${item.id}`} className="mt-2 flex h-11 items-center justify-center gap-1 rounded-lg bg-purple-600 text-white text-sm font-semibold">
                  <Download className="w-4 h-4" /> Download
                </a>
              ) : (
                <p className="mt-2 flex h-11 items-center justify-center gap-1 rounded-lg bg-gray-100 text-gray-500 text-xs text-center px-2">
                  <Lock className="w-3 h-3" /> Unlocks when you activate your account
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
