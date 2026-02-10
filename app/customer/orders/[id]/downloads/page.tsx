'use client';

/**
 * Customer Downloads Page
 *
 * Allows customers to view and download their purchased digital files.
 * Shows download expiry, access count, and file details.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Clock,
  FileImage,
  Check,
  AlertCircle,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';

interface DownloadItem {
  id: string;
  product_data: any;
  quantity: number;
  unit_price: number;
  is_digital: boolean;
  download_url: string | null;
  download_url_generated_at: string | null;
  download_expires_at: string | null;
  download_access_count: number;
  last_downloaded_at: string | null;
  digital_file_format: string | null;
  digital_file_size_bytes: number | null;
  image_id: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  status: string;
  created_at: string;
  fulfillment_type: string;
  digital_delivery_status: string;
}

export default function CustomerDownloadsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadOrderAndDownloads();
  }, [orderId]);

  async function loadOrderAndDownloads() {
    try {
      setLoading(true);
      setError(null);

      // Get authenticated user
      const { data: { user } } = await supabaseService.getClient().auth.getUser();

      if (!user) {
        setError('Please log in to view your downloads');
        return;
      }

      // Fetch order
      const { data: orderData, error: orderError } = await supabaseService.getClient()
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('customer_email', user.email)
        .single();

      if (orderError || !orderData) {
        setError('Order not found or you do not have access to it');
        return;
      }

      setOrder(orderData);

      // Fetch order items with digital downloads
      const { data: items, error: itemsError } = await supabaseService.getClient()
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .eq('is_digital', true);

      if (itemsError) {
        console.error('Failed to load order items:', itemsError);
        setError('Failed to load download items');
        return;
      }

      setDownloadItems(items || []);

    } catch (error: any) {
      console.error('Error loading downloads:', error);
      setError('Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(item: DownloadItem) {
    try {
      setDownloadingItemId(item.id);

      // Get user for authentication
      const { data: { user } } = await supabaseService.getClient().auth.getUser();

      if (!user) {
        alert('Please log in to download');
        return;
      }

      // Call download API
      const response = await fetch(
        `/api/orders/${orderId}/download/${item.id}?email=${encodeURIComponent(user.email)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const downloadData = await response.json();

      // Open download URL in new tab
      window.open(downloadData.downloadUrl, '_blank');

      // Reload to update access count
      await loadOrderAndDownloads();

    } catch (error: any) {
      console.error('Download error:', error);
      alert(error.message || 'Failed to download file');
    } finally {
      setDownloadingItemId(null);
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getExpiryStatus(expiresAt: string | null): {
    expired: boolean;
    daysRemaining: number;
    message: string;
  } {
    if (!expiresAt) {
      return { expired: false, daysRemaining: 999, message: 'No expiry' };
    }

    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { expired: true, daysRemaining: 0, message: 'Expired' };
    } else if (diffDays === 0) {
      return { expired: false, daysRemaining: 0, message: 'Expires today' };
    } else if (diffDays <= 7) {
      return { expired: false, daysRemaining: diffDays, message: `${diffDays} days remaining` };
    } else {
      return { expired: false, daysRemaining: diffDays, message: `${diffDays} days remaining` };
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your downloads...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error || 'Order not found'}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push('/customer/orders')}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/customer/orders/${orderId}`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Order Details
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Download className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Your Downloads</h1>
            <p className="text-gray-600">Order #{order.order_number}</p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {order.digital_delivery_status && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Check className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Digital downloads are ready. Download links expire after {downloadItems[0] && formatDate(downloadItems[0].download_expires_at)}.
          </AlertDescription>
        </Alert>
      )}

      {/* Download Items */}
      {downloadItems.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No digital downloads available for this order.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {downloadItems.map((item) => {
            const expiryStatus = getExpiryStatus(item.download_expires_at);
            const productName = item.product_data?.name || 'Digital Download';

            return (
              <Card key={item.id} className={expiryStatus.expired ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileImage className="w-5 h-5" />
                        {productName}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {item.product_data?.description}
                      </CardDescription>
                    </div>
                    {!expiryStatus.expired && (
                      <Button
                        onClick={() => handleDownload(item)}
                        disabled={downloadingItemId === item.id}
                        className="ml-4"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {downloadingItemId === item.id ? 'Downloading...' : 'Download'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {/* File Format */}
                    <div>
                      <p className="text-gray-600">Format</p>
                      <p className="font-medium uppercase">{item.digital_file_format || 'JPG'}</p>
                    </div>

                    {/* File Size */}
                    <div>
                      <p className="text-gray-600">File Size</p>
                      <p className="font-medium">{formatFileSize(item.digital_file_size_bytes)}</p>
                    </div>

                    {/* Downloads */}
                    <div>
                      <p className="text-gray-600">Downloads</p>
                      <p className="font-medium">{item.download_access_count || 0} times</p>
                    </div>

                    {/* Expiry */}
                    <div>
                      <p className="text-gray-600">Status</p>
                      {expiryStatus.expired ? (
                        <Badge variant="destructive" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Expired
                        </Badge>
                      ) : expiryStatus.daysRemaining <= 7 ? (
                        <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {expiryStatus.message}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Last Downloaded */}
                  {item.last_downloaded_at && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Last downloaded: {formatDate(item.last_downloaded_at)}
                    </div>
                  )}

                  {/* Expiry Warning */}
                  {!expiryStatus.expired && expiryStatus.daysRemaining <= 7 && (
                    <Alert className="mt-4 border-yellow-200 bg-yellow-50">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        Download link expires in {expiryStatus.daysRemaining} {expiryStatus.daysRemaining === 1 ? 'day' : 'days'}. Please download soon!
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Expired Message */}
                  {expiryStatus.expired && (
                    <Alert className="mt-4 border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        This download link has expired. Please contact support if you need access.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Help Text */}
      <Card className="mt-6 bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">Download Help</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>• Your downloads are available for 30 days from purchase</p>
          <p>• Files are high-resolution and suitable for printing</p>
          <p>• You can download multiple times before expiry</p>
          <p>• Need help? Contact us at support@pawtraits.com</p>
        </CardContent>
      </Card>
    </div>
  );
}
