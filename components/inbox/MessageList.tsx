'use client';

import { MessageCard } from './MessageCard';
import { Inbox } from 'lucide-react';

interface Message {
  id: string;
  title: string;
  body: string;
  icon?: string;
  is_read: boolean;
  action_url?: string;
  action_label?: string;
  created_at: string;
}

interface MessageListProps {
  messages: Message[];
  onMarkRead: (messageId: string) => void;
  onArchive: (messageId: string) => void;
  loading?: boolean;
  theme?: 'purple' | 'green';
}

export function MessageList({
  messages,
  onMarkRead,
  onArchive,
  loading = false,
  theme = 'purple',
}: MessageListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (messages.length === 0) {
    const emptyColor = theme === 'purple' ? 'text-blue-400' : 'text-green-400';

    return (
      <div className="text-center py-12">
        <Inbox className={`w-16 h-16 mx-auto ${emptyColor} mb-4`} />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No messages yet
        </h3>
        <p className="text-sm text-gray-500">
          When you have new notifications, they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          onMarkRead={onMarkRead}
          onArchive={onArchive}
          theme={theme}
        />
      ))}
    </div>
  );
}
