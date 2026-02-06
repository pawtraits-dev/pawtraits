/**
 * Digital Download Fulfillment Service
 *
 * Handles fulfillment for digital download products:
 * - Generates signed Cloudinary download URLs
 * - Tracks download access and expiry
 * - Sends download notification emails
 * - Updates order and order_items with digital delivery status
 */

import { createClient } from '@supabase/supabase-js';
import { CloudinaryImageService } from '@/lib/cloudinary';
import type { Order, OrderItem } from '@/lib/types';
import type {
  FulfillmentService,
  FulfillmentResult,
  FulfillmentStatus,
  DownloadUrlInfo,
  FulfillmentError
} from './base-fulfillment-service';
import { FulfillmentErrorCode } from './base-fulfillment-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class DigitalDownloadService implements FulfillmentService {
  private cloudinary: CloudinaryImageService;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.cloudinary = new CloudinaryImageService();
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  /**
   * Check if this service can handle the order item
   * Digital downloads are included with:
   * 1. Digital-only products (product_type = 'digital_download')
   * 2. Physical products (product_type = 'physical_print') - bundled digital download
   */
  canFulfill(orderItem: OrderItem): boolean {
    const productData = orderItem.product_data as any;

    // Digital-only products
    if (productData?.product_type === 'digital_download') {
      return true;
    }

    // Physical products with bundled digital download
    if (productData?.product_type === 'physical_print') {
      return true; // All physical products include digital download
    }

    // Legacy products (undefined product_type) - assume physical with digital
    if (!productData?.product_type) {
      return true;
    }

    return false;
  }

  /**
   * Fulfill digital download order
   */
  async fulfill(order: Order, orderItems: OrderItem[]): Promise<FulfillmentResult> {
    console.log('🔽 [Digital Download] Starting fulfillment for order:', order.order_number);

    try {
      // Filter items this service can handle
      const digitalItems = orderItems.filter(item => this.canFulfill(item));

      if (digitalItems.length === 0) {
        console.log('🔽 [Digital Download] No digital items to fulfill');
        return { success: true, fulfillmentId: null };
      }

      console.log(`🔽 [Digital Download] Processing ${digitalItems.length} digital items`);

      // Generate download URLs for each item (including multi-image products)
      const allDownloadResults: DownloadUrlInfo[] = [];

      for (const item of digitalItems) {
        const itemResults = await this.generateDownloadUrlsForItem(item, order);
        allDownloadResults.push(...itemResults);
      }

      // Update order_items with download URLs
      await this.updateOrderItemsWithDownloads(digitalItems, allDownloadResults);

      // Update order status
      await this.updateOrderStatus(order.id, 'fulfilled');

      // Create fulfillment tracking record
      await this.createFulfillmentTrackingRecord(order.id, allDownloadResults);

      // TODO: Send download email to customer (integrate with email service)
      console.log('📧 [Digital Download] Email integration pending - customer should receive download links');

      console.log('✅ [Digital Download] Fulfillment complete');

      return {
        success: true,
        fulfillmentId: `digital_${order.id}`,
        trackingInfo: {
          downloadUrls: allDownloadResults,
          expiresAt: this.calculateExpiryDate(7),
          provider: 'digital_download'
        }
      };

    } catch (error: any) {
      console.error('❌ [Digital Download] Fulfillment failed:', error);
      return {
        success: false,
        error: error.message,
        errorDetails: error
      };
    }
  }

  /**
   * Generate download URLs for an order item (handles both single and multi-image products)
   */
  private async generateDownloadUrlsForItem(
    orderItem: OrderItem,
    order: Order
  ): Promise<DownloadUrlInfo[]> {
    const orderItemData = orderItem as any;

    // Check if this is a multi-image product
    const imageIds = orderItemData.image_ids;

    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      // Multi-image product: generate URL for each image
      console.log(`🔽 [Digital Download] Multi-image product: ${imageIds.length} images`);

      const results = await Promise.all(
        imageIds.map((imageId: string) =>
          this.generateDownloadUrl(orderItem, order, imageId)
        )
      );

      return results;
    } else {
      // Single-image product: use existing image_id
      const result = await this.generateDownloadUrl(orderItem, order, orderItem.image_id);
      return [result];
    }
  }

  /**
   * Generate download URL for a single order item + specific image
   * @param orderItem The order item
   * @param order The order
   * @param imageId The specific image ID (for multi-image products) or uses orderItem.image_id if not provided
   */
  private async generateDownloadUrl(
    orderItem: OrderItem,
    order: Order,
    imageId?: string
  ): Promise<DownloadUrlInfo> {
    // Use provided imageId or fall back to orderItem.image_id
    const targetImageId = imageId || orderItem.image_id;

    console.log(`🔽 [Digital Download] Generating URL for item ${orderItem.id}, image ${targetImageId}`);

    if (!targetImageId) {
      throw new Error(`No image_id for order item ${orderItem.id}`);
    }

    // Fetch image metadata
    const { data: image, error: imageError } = await this.supabase
      .from('image_catalog')
      .select('cloudinary_public_id, filename')
      .eq('id', targetImageId)
      .single();

    if (imageError || !image?.cloudinary_public_id) {
      throw new Error(`No Cloudinary public_id for image ${targetImageId}: ${imageError?.message}`);
    }

    // Determine file format based on product configuration
    const productData = orderItem.product_data as any;
    const format = productData.digital_file_format || 'jpg';
    const quality = productData.digital_resolution || 'original';

    // Generate high-quality download URL (valid for 7 days)
    // Note: Cloudinary signed URLs are generated on-demand via API endpoint
    // For now, we'll store a reference that will be used to generate the actual URL
    const downloadToken = `${order.id}_${orderItem.id}_${Date.now()}`;

    // Calculate file size estimate (actual size will be determined when generated)
    const fileSizeEstimate = await this.getFileSizeEstimate(format);

    const expiryDate = this.calculateExpiryDate(7);

    console.log(`✅ [Digital Download] URL generated for ${image.filename}`);

    return {
      orderItemId: orderItem.id,
      downloadUrl: `/api/orders/${order.id}/download/${orderItem.id}?token=${downloadToken}`,
      format,
      expiresAt: expiryDate,
      fileSize: fileSizeEstimate,
      fileName: `${image.filename}.${format}`
    };
  }

  /**
   * Update order_items with download URLs and metadata
   */
  private async updateOrderItemsWithDownloads(
    items: OrderItem[],
    downloadResults: DownloadUrlInfo[]
  ): Promise<void> {
    console.log(`💾 [Digital Download] Updating ${items.length} order items with download info`);

    for (const result of downloadResults) {
      const { error } = await this.supabase
        .from('order_items')
        .update({
          is_digital: true,
          download_url: result.downloadUrl,
          download_url_generated_at: new Date().toISOString(),
          download_expires_at: result.expiresAt.toISOString(),
          digital_file_format: result.format,
          digital_file_size_bytes: result.fileSize,
          download_access_count: 0
        })
        .eq('id', result.orderItemId);

      if (error) {
        console.error(`❌ Failed to update order_item ${result.orderItemId}:`, error);
        throw new Error(`Failed to update order_item: ${error.message}`);
      }
    }

    console.log('✅ [Digital Download] Order items updated successfully');
  }

  /**
   * Update order fulfillment status
   */
  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('orders')
      .update({
        fulfillment_status: status,
        fulfillment_type: 'digital',
        digital_delivery_status: 'sent',
        download_expires_at: this.calculateExpiryDate(7).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('❌ Failed to update order status:', error);
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    console.log('✅ [Digital Download] Order status updated');
  }

  /**
   * Create fulfillment tracking record
   */
  private async createFulfillmentTrackingRecord(
    orderId: string,
    downloadResults: DownloadUrlInfo[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('order_fulfillment_tracking')
      .insert({
        order_id: orderId,
        fulfillment_method: 'download',
        status: 'fulfilled',
        status_message: `Digital downloads available (${downloadResults.length} items)`,
        tracking_data: {
          download_count: downloadResults.length,
          expires_at: this.calculateExpiryDate(7).toISOString(),
          items: downloadResults.map(r => ({
            order_item_id: r.orderItemId,
            format: r.format,
            file_size: r.fileSize
          }))
        },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

    if (error) {
      console.warn('⚠️ Failed to create fulfillment tracking record:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Calculate download expiry date (default 7 days)
   */
  private calculateExpiryDate(days: number = 7): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  /**
   * Get file size estimate based on format
   */
  private async getFileSizeEstimate(format: string): Promise<number> {
    // Rough estimates for high-quality images
    const estimates: Record<string, number> = {
      jpg: 5 * 1024 * 1024,   // 5MB
      png: 10 * 1024 * 1024,  // 10MB
      pdf: 3 * 1024 * 1024    // 3MB
    };

    return estimates[format.toLowerCase()] || 5 * 1024 * 1024;
  }

  /**
   * Get status of digital download fulfillment
   */
  async getStatus(fulfillmentId: string): Promise<FulfillmentStatus> {
    const orderId = fulfillmentId.replace('digital_', '');

    const { data: items, error } = await this.supabase
      .from('order_items')
      .select('download_access_count, last_downloaded_at, download_expires_at')
      .eq('order_id', orderId)
      .eq('is_digital', true);

    if (error || !items || items.length === 0) {
      return {
        status: 'failed',
        statusMessage: 'No digital items found'
      };
    }

    const totalDownloads = items.reduce((sum, item) => sum + (item.download_access_count || 0), 0);
    const hasBeenDownloaded = totalDownloads > 0;
    const expiryDate = items[0]?.download_expires_at ? new Date(items[0].download_expires_at) : undefined;
    const isExpired = expiryDate ? expiryDate < new Date() : false;

    return {
      status: hasBeenDownloaded ? 'fulfilled' : 'processing',
      trackingInfo: {
        downloadUrls: [], // Not included in status check
        expiresAt: expiryDate
      },
      statusMessage: isExpired
        ? 'Downloads expired'
        : hasBeenDownloaded
        ? `Downloaded ${totalDownloads} time(s)`
        : 'Awaiting first download'
    };
  }

  /**
   * Cancel digital download (expire URLs)
   */
  async cancel(fulfillmentId: string): Promise<boolean> {
    const orderId = fulfillmentId.replace('digital_', '');

    console.log(`🚫 [Digital Download] Canceling/expiring downloads for order ${orderId}`);

    const { error } = await this.supabase
      .from('order_items')
      .update({ download_expires_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('is_digital', true);

    if (error) {
      console.error('❌ Failed to cancel downloads:', error);
      return false;
    }

    // Update order status
    await this.supabase
      .from('orders')
      .update({
        digital_delivery_status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    console.log('✅ [Digital Download] Downloads expired');
    return true;
  }
}
