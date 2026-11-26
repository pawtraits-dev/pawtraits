/** A calm highlighted note for the stall multi-buy saving (basket, checkout summary, buy sheet). Nothing shows when there is no message. */
export default function MultibuyNote({ message, className = '' }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p role="status" className={`rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-900 ${className}`}>{message}</p>
  );
}
