'use client';

import { Button } from '@/components/ui/button';
import {
  Bell,
  Package,
  CreditCard,
  Gift,
  AlertCircle,
  CheckCircle,
  Info,
  Mail,
  ExternalLink,
  Archive,
  Check,
  ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface MessageCardProps {
  message: {
    id: string;
    title: string;
    body: string;
    icon?: string;
    is_read: boolean;
    action_url?: string;
    action_label?: string;
    created_at: string;
  };
  onMarkRead: (messageId: string) => void;
  onArchive: (messageId: string) => void;
  theme?: 'purple' | 'green';
}

const iconMap: Record<string, any> = {
  bell: Bell,
  package: Package,
  'credit-card': CreditCard,
  gift: Gift,
  'alert-circle': AlertCircle,
  'check-circle': CheckCircle,
  info: Info,
  mail: Mail,
};

export function MessageCard({
  message,
  onMarkRead,
  onArchive,
  theme = 'purple',
}: MessageCardProps) {
  const IconComponent = message.icon ? iconMap[message.icon] || Mail : Mail;
  const isUnread = !message.is_read;

  const themeColors = {
    purple: {
      bg: 'from-blue-500 to-purple-500',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      unreadBg: 'bg-blue-50',
      unreadDot: 'bg-blue-500',
    },
    green: {
      bg: 'from-green-500 to-emerald-500',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
      unreadBg: 'bg-green-50',
      unreadDot: 'bg-green-500',
    },
  };

  const colors = themeColors[theme];

  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={`p-4 rounded-lg border ${
        isUnread
          ? `${colors.unreadBg} border-gray-300`
          : 'bg-white border-gray-200'
      } hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start space-x-4">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-10 h-10 ${colors.iconBg} rounded-full flex items-center justify-center`}
        >
          <IconComponent className={`w-5 h-5 ${colors.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3
                  className={`text-sm font-medium ${
                    isUnread ? 'font-semibold' : ''
                  } text-gray-900`}
                >
                  {message.title}
                </h3>
                {isUnread && (
                  <div className={`w-2 h-2 rounded-full ${colors.unreadDot}`} />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{timeAgo}</p>
            </div>
          </div>

          <p className="mt-2 text-sm text-gray-700 line-clamp-2">
            {message.body}
          </p>

          {/* Actions */}
          <div className="mt-3 flex items-center space-x-2">
            {message.action_url && (
              <>
                {message.action_url.startsWith('/') ? (
                  // Internal link - use Next.js Link for client-side navigation
                  <Link href={message.action_url}>
                    <Button
                      size="sm"
                      className={`${colors.button} text-white`}
                      onClick={() => {
                        if (isUnread) {
                          onMarkRead(message.id);
                        }
                      }}
                    >
                      {message.action_label || 'View'}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  // External link - use anchor tag with target="_blank"
                  <a
                    href={message.action_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="sm"
                      className={`${colors.button} text-white`}
                      onClick={() => {
                        if (isUnread) {
                          onMarkRead(message.id);
                        }
                      }}
                    >
                      {message.action_label || 'View'}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </a>
                )}
              </>
            )}

            {isUnread && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkRead(message.id)}
              >
                <Check className="w-3 h-3 mr-1" />
                Mark Read
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onArchive(message.id)}
            >
              <Archive className="w-3 h-3 mr-1" />
              Archive
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
