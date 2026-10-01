/** Quiz status + version chip for Admin → Quizzes */
export default function StatusChip({ status, version }: { status: 'draft' | 'live' | 'paused'; version: number }) {
  const styles = {
    live: 'bg-green-100 text-green-800',
    paused: 'bg-gray-200 text-gray-800',
    draft: 'bg-amber-100 text-amber-900',
  }[status];
  const label = status === 'live' ? 'Live' : status === 'paused' ? 'Paused' : 'Draft';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {label}{version ? ` · version ${version}` : ''}
    </span>
  );
}
