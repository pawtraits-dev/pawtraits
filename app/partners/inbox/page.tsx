'use client';

import { useEffect, useState } from 'react';
import { MessageList } from '@/components/inbox/MessageList';
import { Button } from '@/components/ui/button';
import { RefreshCw, Inbox as InboxIcon } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';

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

export default function PartnerInboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    // Get user email
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (userEmail) {
      fetchMessages();
    }
  }, [userEmail, filter]);

  const fetchMessages = async () => {
    if (!userEmail) return;

    try {
      setLoading(true);
      const unreadOnly = filter === 'unread';
      const response = await fetch(
        `/api/partners/messages?email=${encodeURIComponent(userEmail)}&unread_only=${unreadOnly}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (messageId: string) => {
    if (!userEmail) return;

    try {
      const response = await fetch('/api/partners/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          action: 'mark_read',
          email: userEmail,
        }),
      });

      if (response.ok) {
        // Update local state
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, is_read: true } : msg
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleArchive = async (messageId: string) => {
    if (!userEmail) return;

    try {
      const response = await fetch('/api/partners/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          action: 'archive',
          email: userEmail,
        }),
      });

      if (response.ok) {
        // Remove from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

        // Update unread count if message was unread
        const message = messages.find((msg) => msg.id === messageId);
        if (message && !message.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error archiving message:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <InboxIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                  <p className="text-sm text-gray-500">
                    {unreadCount > 0
                      ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
                      : 'All caught up!'}
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-2 mt-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              All Messages
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
              className={filter === 'unread' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Unread ({unreadCount})
            </Button>
          </div>
        </div>

        {/* Message List */}
        <div className="p-6">
          <MessageList
            messages={messages}
            onMarkRead={handleMarkRead}
            onArchive={handleArchive}
            loading={loading}
            theme="green"
          />
        </div>
      </div>
    </div>
  );
}
