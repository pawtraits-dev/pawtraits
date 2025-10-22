'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageList } from '@/components/inbox/MessageList';
import { Button } from '@/components/ui/button';
import { RefreshCw, Inbox as InboxIcon } from 'lucide-react';
import { useUserRouting } from '@/hooks/use-user-routing';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

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

export default function UnifiedInboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { userProfile, loading: userLoading } = useUserRouting();
  const router = useRouter();

  // Determine user type and theme
  const userType = userProfile?.user_type || 'customer';
  const isPartner = userType === 'partner';
  const isAdmin = userType === 'admin';
  const theme = isPartner ? 'green' : 'purple';

  // Redirect admin users away from inbox
  useEffect(() => {
    if (!userLoading && isAdmin) {
      router.push('/admin');
    }
  }, [isAdmin, userLoading, router]);

  useEffect(() => {
    if (userProfile && !isAdmin) {
      fetchMessages();
    }
  }, [userProfile, filter, isAdmin]);

  const fetchMessages = async () => {
    if (!userProfile?.email || isAdmin) return;

    try {
      setLoading(true);
      const endpoint = isPartner ? '/api/partners/messages' : '/api/customers/messages';
      const unreadOnly = filter === 'unread';

      const response = await fetch(
        `${endpoint}?email=${encodeURIComponent(userProfile.email)}&unread_only=${unreadOnly}`
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
    if (!userProfile?.email || isAdmin) return;

    try {
      const endpoint = isPartner ? '/api/partners/messages' : '/api/customers/messages';

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          action: 'mark_read',
          email: userProfile.email,
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
    if (!userProfile?.email || isAdmin) return;

    try {
      const endpoint = isPartner ? '/api/partners/messages' : '/api/customers/messages';

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          action: 'archive',
          email: userProfile.email,
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

  // Loading state
  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Don't render for admin users
  if (isAdmin) {
    return null;
  }

  const gradientColor = isPartner
    ? 'from-green-500 to-emerald-500'
    : 'from-blue-500 to-purple-500';

  const buttonColor = isPartner
    ? 'bg-green-600 hover:bg-green-700'
    : 'bg-blue-600 hover:bg-blue-700';

  return (
    <CountryProvider>
      <div className="min-h-screen bg-gray-50">
        <UserAwareNavigation />

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 bg-gradient-to-r ${gradientColor} rounded-full flex items-center justify-center`}>
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
              className={filter === 'all' ? buttonColor : ''}
            >
              All Messages
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
              className={filter === 'unread' ? buttonColor : ''}
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
            theme={theme}
          />
        </div>
      </div>
        </div>
      </div>
    </CountryProvider>
  );
}
