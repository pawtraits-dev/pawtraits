/**
 * Gelato Fulfillment Service
 *
 * Wrapper around existing GelatoService to match FulfillmentService interface.
 * Handles physical print fulfillment via Gelato API.
 *
 * This service:
 * - Checks if items require Gelato fulfillment
 * - Creates Gelato orders via existing GelatoService
 * - Tracks Gelato order status
 * - Provides unified fulfillment interface
 */

import { GelatoService } from '@/lib/gelato-service';
import type { Order, OrderItem } from '@/lib/types';
import type {
  FulfillmentService,
  FulfillmentResult,
  FulfillmentStatus,
  FulfillmentError
} from './base-fulfillment-service';
import { FulfillmentErrorCode } from './base-fulfillment-service';

export class GelatoFulfillmentService implements FulfillmentService {
  private gelato: GelatoService;

  constructor() {
    this.gelato = new GelatoService();
  }

  /**
   * Check if this service can handle the order item
   */
  canFulfill(orderItem: OrderItem): boolean {
    const raw = orderItem.product_data as any;
    const productData = typeof raw === 'string' ? safeJson(raw) : raw; // legacy rows stored JSON strings

    // Check if it's a physical print with Gelato fulfillment
    const isPhysicalPrint =
      productData?.product_type === 'physical_print' ||
      productData?.product_type === undefined; // Legacy products default to physical

    const usesGelato =
      productData?.fulfillment_method === 'gelato' ||
      productData?.fulfillment_method === undefined; // Legacy products default to Gelato

    return isPhysicalPrint && usesGelato;
  }

  /**
   * Fulfill physical print order via Gelato
   */
  async fulfill(order: Order, orderItems: OrderItem[]): Promise<FulfillmentResult> {
    console.log('🖨️ [Gelato Fulfillment] Starting fulfillment for order:', order.order_number);

    try {
      // Filter items this service can handle
      const gelatoItems = orderItems.filter(item => this.canFulfill(item));

      if (gelatoItems.length === 0) {
        console.log('🖨️ [Gelato Fulfillment] No Gelato items to fulfill');
        return { success: true, fulfillmentId: null };
      }

      console.log(`🖨️ [Gelato Fulfillment] Processing ${gelatoItems.length} Gelato items`);

      // Use existing Gelato service to create order
      // Note: The GelatoService.createOrder method expects the full order object
      // and internally handles all order items that have gelato_sku
      // Build the Gelato v4 payload (previously the raw DB order was passed, which Gelato rejects)
      const imageUrls: Record<string, string> = {};
      const normalisedItems = gelatoItems.map((item: any) => ({
        ...item,
        product_data: typeof item.product_data === 'string' ? safeJson(item.product_data) : item.product_data,
      }));
      for (const item of normalisedItems) {
        if (!item.print_image_url) {
          throw new Error(`Order item ${item.id} (image ${item.image_id}) has no print file URL — not sending to Gelato`);
        }
        if (!item.product_data?.gelato_sku) {
          throw new Error(`Order item ${item.id} has no Gelato product (gelato_sku)`);
        }
        imageUrls[item.image_id] = item.print_image_url;
      }
      const payload = this.gelato.mapOrderToGelato(order, normalisedItems, imageUrls);
      // itemReferenceId must be unique per line — the same image can appear in two sizes
      // and each line gets its own file: print files are cropped per size, so M and L of one image differ
      payload.items = payload.items.map((gi: any, i: number) => ({
        ...gi,
        itemReferenceId: normalisedItems[i].id || `${gi.itemReferenceId}_${i}`,
        files: [{ type: 'default', url: normalisedItems[i].print_image_url }],
      }));

      // AI-upscaled files are generated on first request (Cloudinary 423s meanwhile) — make sure they exist first
      const { cloudinaryService } = await import('@/lib/cloudinary');
      for (const item of normalisedItems) {
        if (item.print_file_meta?.ai_upscaled) await cloudinaryService.warmDerived(item.print_image_url, 45_000);
      }

      const created = await this.gelato.createOrder(payload);
      const gelatoOrderId = created?.id;

      if (!gelatoOrderId) {
        throw new Error('Gelato order creation failed - no order ID returned');
      }

      console.log('✅ [Gelato Fulfillment] Gelato order created:', gelatoOrderId);

      return {
        success: true,
        fulfillmentId: gelatoOrderId,
        trackingInfo: {
          provider: 'gelato',
          providerOrderId: gelatoOrderId,
          // Tracking details will be updated via Gelato webhook
        }
      };

    } catch (error: any) {
      console.error('❌ [Gelato Fulfillment] Fulfillment failed:', error);

      // Map Gelato-specific errors to fulfillment error codes
      let errorCode = FulfillmentErrorCode.UNKNOWN;
      if (error.message?.includes('address')) {
        errorCode = FulfillmentErrorCode.INVALID_ADDRESS;
      } else if (error.message?.includes('inventory') || error.message?.includes('stock')) {
        errorCode = FulfillmentErrorCode.INSUFFICIENT_INVENTORY;
      } else if (error.message?.includes('API') || error.message?.includes('network')) {
        errorCode = FulfillmentErrorCode.API_ERROR;
      }

      return {
        success: false,
        error: error.message,
        errorDetails: {
          code: errorCode,
          originalError: error
        }
      };
    }
  }

  /**
   * Get status of Gelato fulfillment
   */
  async getStatus(fulfillmentId: string): Promise<FulfillmentStatus> {
    try {
      // Use existing Gelato service to get order status
      const gelatoStatus = await this.gelato.getOrderStatus(fulfillmentId);

      if (!gelatoStatus) {
        return {
          status: 'failed',
          statusMessage: 'Gelato order not found'
        };
      }

      // Map Gelato status to fulfillment status
      let status: FulfillmentStatus['status'];
      switch (gelatoStatus.orderStatus) {
        case 'draft':
        case 'pending':
          status = 'pending';
          break;
        case 'in-production':
        case 'shipped':
          status = 'processing';
          break;
        case 'delivered':
          status = 'fulfilled';
          break;
        case 'failed':
        case 'cancelled':
          status = 'failed';
          break;
        default:
          status = 'processing';
      }

      return {
        status,
        trackingInfo: {
          provider: 'gelato',
          providerOrderId: fulfillmentId,
          trackingNumber: gelatoStatus.trackingNumber,
          carrier: gelatoStatus.carrier,
          trackingUrl: gelatoStatus.trackingUrl
        },
        statusMessage: gelatoStatus.statusMessage
      };

    } catch (error: any) {
      console.error('❌ [Gelato Fulfillment] Failed to get status:', error);
      return {
        status: 'failed',
        statusMessage: `Failed to get Gelato status: ${error.message}`
      };
    }
  }

  /**
   * Cancel Gelato order
   */
  async cancel(fulfillmentId: string): Promise<boolean> {
    console.log(`🚫 [Gelato Fulfillment] Canceling Gelato order ${fulfillmentId}`);

    try {
      // Use existing Gelato service to cancel order
      const success = await this.gelato.cancelOrder(fulfillmentId);

      if (success) {
        console.log('✅ [Gelato Fulfillment] Order cancelled successfully');
      } else {
        console.warn('⚠️ [Gelato Fulfillment] Order cancellation returned false');
      }

      return success;

    } catch (error: any) {
      console.error('❌ [Gelato Fulfillment] Cancellation failed:', error);
      return false;
    }
  }
}


function safeJson(v: string): any {
  try { return JSON.parse(v); } catch { return undefined; }
}
