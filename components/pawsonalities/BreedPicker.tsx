'use client';

/** "Show them as… [breed]": sets ?breed= on the current page (keeps other query params) */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function BreedPicker({ breeds, value, label = 'Show them as', allLabel = 'Original pictures' }: {
  breeds: { id: string; name: string }[];
  value: string | null;
  label?: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!breeds.length) return null;
  return (
    <label className="inline-flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <span className="font-medium">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set('breed', e.target.value); else next.delete('breed');
          const qs = next.toString();
          router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        }}
        className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
      >
        <option value="">{allLabel}</option>
        {breeds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
