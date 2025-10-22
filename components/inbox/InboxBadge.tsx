'use client';

interface InboxBadgeProps {
  count: number;
  theme?: 'purple' | 'green';
}

export function InboxBadge({ count, theme = 'purple' }: InboxBadgeProps) {
  if (count === 0) return null;

  const bgColor = theme === 'purple' ? 'bg-blue-500' : 'bg-green-500';

  return (
    <span
      className={`absolute -top-1 -right-1 ${bgColor} text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
