'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

export default function MessageQueuePage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadStats();
    // Auto-refresh stats every 10 seconds
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/messaging/process');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    try {
      setProcessing(true);
      setResult(null);

      const response = await fetch('/api/messaging/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 })
      });

      const data = await response.json();
      setResult(data);

      // Refresh stats after processing
      await loadStats();
    } catch (error) {
      console.error('Failed to process queue:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process queue'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/messaging"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Templates
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Message Queue</h1>
        <p className="text-gray-600">Monitor and process pending messages</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-gray-900">
            {loading ? '...' : stats?.total || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Messages</div>
        </div>

        <div className="bg-white border border-yellow-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-yellow-600">
            {loading ? '...' : stats?.pending || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Pending</div>
        </div>

        <div className="bg-white border border-blue-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-blue-600">
            {loading ? '...' : stats?.processing || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Processing</div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-green-600">
            {loading ? '...' : stats?.sent || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Sent</div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-red-600">
            {loading ? '...' : stats?.failed || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Failed</div>
        </div>
      </div>

      {/* Process Button */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Manual Processing</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manually trigger the message queue processor to send pending messages
            </p>
          </div>
          <button
            onClick={processQueue}
            disabled={processing || (stats?.pending || 0) === 0}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {processing ? (
              <span className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Process Queue Now'
            )}
          </button>
        </div>

        {/* Processing Result */}
        {result && (
          <div className={`mt-4 p-4 rounded-lg border ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            {result.success ? (
              <div>
                <div className="flex items-center text-green-800 mb-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Processing Complete</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>• Processed: {result.processed} messages</p>
                  <p>• Sent: {result.sent} messages</p>
                  <p>• Failed: {result.failed} messages</p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Errors:</p>
                      <ul className="list-disc list-inside mt-1">
                        {result.errors.map((error: string, idx: number) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center text-red-800 mb-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Processing Failed</span>
                </div>
                <p className="text-sm text-red-700">{result.error || 'Unknown error occurred'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">About Message Queue Processing</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Messages are automatically queued when triggered by system events</li>
              <li>In production, this endpoint should be called by a cron job every 1-5 minutes</li>
              <li>Failed messages are automatically retried with exponential backoff</li>
              <li>Email delivery is handled by Resend, SMS by Twilio</li>
              <li>Stats auto-refresh every 10 seconds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
