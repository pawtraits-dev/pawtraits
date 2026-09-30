/**
 * Fulfillment Router
 *
 * Central orchestrator for multi-fulfillment order processing.
 * Routes order items to appropriate fulfillment services based on product type.
 *
 * Responsibilities:
 * - Determine fulfillment type (physical/digital/hybrid)
 * - Group order items by fulfillment service
 * - Execute fulfillment via each service
 * - Update order with fulfillment results
 * - Handle errors and partial fulfillment
 */

import { createClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '@/lib/types';
import { DigitalDownloadService } from './digital-download-service';
import { GelatoFulfillmentService } from './gelato-fulfillment-service';
import { SelfPrintFulfillmentService } from './self-print-fulfillment-service';
import { getSetting, type FulfillmentProvider } from '@/lib/app-settings';
import type { FulfillmentService, FulfillmentResult } from './base-fulfillment-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class FulfillmentRouter {
  private services: FulfillmentService[] = [];
  private supabase: ReturnType<typeof createClient>;
  private providerOverride?: FulfillmentProvider;

  /**
   * @param provider who makes the posted prints. Defaults to the admin setting
   *   `default_fulfillment_provider` (self_print unless changed in /admin/orders).
   */
  constructor(provider?: FulfillmentProvider) {
    this.providerOverride = provider;

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  /**
   * Main entry point: Fulfill an order with all its items
   */
  async fulfillOrder(order: Order, orderItems: OrderItem[]): Promise<FulfillmentResult[]> {
    console.log('📦 [Fulfillment Router] Processing order:', order.order_number);
    console.log('📦 [Fulfillment Router] Order items:', orderItems.length);

    try {
      const provider = this.providerOverride ?? await getSetting('default_fulfillment_provider');
      this.services = [
        new DigitalDownloadService(),
        provider === 'gelato' ? new GelatoFulfillmentService() : new SelfPrintFulfillmentService(),
      ];
      console.log('📦 [Fulfillment Router] Print provider:', provider);

      // Determine overall fulfillment type
      const fulfillmentType = this.determineFulfillmentType(orderItems);
      console.log('📦 [Fulfillment Router] Fulfillment type:', fulfillmentType);

      // Update order with fulfillment type
      await this.updateOrderFulfillmentType(order.id, fulfillmentType);

      // Group items by service
      const itemsByService = this.groupItemsByService(orderItems);
      console.log('📦 [Fulfillment Router] Services needed:', Array.from(itemsByService.keys()).map(s => s.constructor.name));

      // Process each group with appropriate service
      const results: FulfillmentResult[] = [];

      for (const [service, items] of Array.from(itemsByService.entries())) {
        const serviceName = service.constructor.name;
        console.log(`📦 [Fulfillment Router] Processing ${items.length} items with ${serviceName}`);

        try {
          const result = await service.fulfill(order, items);
          results.push(result);

          if (!result.success) {
            console.error(`❌ Fulfillment failed for ${serviceName}:`, result.error);
          }
        } catch (error: any) {
          console.error(`❌ Unexpected error in ${serviceName}:`, error);
          results.push({
            success: false,
            error: error.message,
            errorDetails: error
          });
        }
      }

      // Update order with overall fulfillment results
      await this.updateOrderWithResults(order.id, results, fulfillmentType);

      console.log('✅ [Fulfillment Router] All fulfillments processed');
      console.log(`📊 [Fulfillment Router] Success: ${results.filter(r => r.success).length}/${results.length}`);

      return results;

    } catch (error: any) {
      console.error('❌ [Fulfillment Router] Critical error:', error);
      return [{
        success: false,
        error: `Fulfillment router failed: ${error.message}`,
        errorDetails: error
      }];
    }
  }

  /**
   * Determine fulfillment type based on order items
   */
  private determineFulfillmentType(orderItems: OrderItem[]): 'physical' | 'digital' | 'hybrid' {
    const hasPhysical = orderItems.some(item => {
      const productData = item.product_data as any;
      return productData?.product_type === 'physical_print' ||
             productData?.product_type === undefined; // Legacy = physical
    });

    const hasDigital = orderItems.some(item => {
      const productData = item.product_data as any;
      return productData?.product_type === 'digital_download';
    });

    if (hasPhysical && hasDigital) return 'hybrid';
    if (hasDigital) return 'digital';
    return 'physical';
  }

  /**
   * Group order items by fulfillment service
   * Note: Physical products require BOTH Gelato + Digital services
   */
  private groupItemsByService(orderItems: OrderItem[]): Map<FulfillmentService, OrderItem[]> {
    // Keyed by instance, not class name (class names aren't reliable after minification)
    const grouped = new Map<FulfillmentService, OrderItem[]>();

    for (const item of orderItems) {
      // Physical products go to BOTH the print service AND DigitalDownloadService
      for (const service of this.services) {
        if (service.canFulfill(item)) {
          grouped.set(service, [...(grouped.get(service) || []), item]);
        }
      }
    }

    return grouped;
  }

  /**
   * Update order with fulfillment type
   */
  private async updateOrderFulfillmentType(
    orderId: string,
    fulfillmentType: 'physical' | 'digital' | 'hybrid'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('orders')
      .update({
        fulfillment_type: fulfillmentType,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('⚠️ Failed to update order fulfillment type:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Update order with overall fulfillment results
   */
  private async updateOrderWithResults(
    orderId: string,
    results: FulfillmentResult[],
    fulfillmentType: 'physical' | 'digital' | 'hybrid'
  ): Promise<void> {
    const allSuccessful = results.every(r => r.success);
    const someSuccessful = results.some(r => r.success);
    const noneFulfilled = results.every(r => !r.success);

    const selfPrint = results.find(r => r.success && r.trackingInfo?.provider === 'self_print');
    const gelato = results.find(r => r.trackingInfo?.provider === 'gelato');

    let overallStatus: string;
    if (allSuccessful && selfPrint) {
      overallStatus = 'processing'; // queued to print; becomes fulfilled when posted
    } else if (allSuccessful) {
      overallStatus = 'fulfilled';
    } else if (someSuccessful) {
      overallStatus = 'partially_fulfilled';
    } else if (noneFulfilled) {
      overallStatus = 'failed';
    } else {
      overallStatus = 'processing';
    }

    // Collect tracking info from all successful results
    const trackingInfo: any = {};
    for (const result of results) {
      if (result.success && result.trackingInfo) {
        Object.assign(trackingInfo, result.trackingInfo);
      }
    }

    const base: Record<string, any> = {
      fulfillment_status: overallStatus,
      // Keep the Gelato order id on the order so Gelato status webhooks can find it
      ...(gelato?.success && gelato.trackingInfo?.providerOrderId
        ? { gelato_order_id: gelato.trackingInfo.providerOrderId, gelato_status: 'pending' }
        : {}),
      ...(noneFulfilled || !allSuccessful
        ? { error_message: results.filter(r => !r.success).map(r => r.error).join(' | ').slice(0, 1000) }
        : {}),
      updated_at: new Date().toISOString()
    };
    const providerFields = {
      ...(selfPrint ? { fulfillment_provider: 'self_print', self_print_status: 'to_print' } : {}),
      ...(gelato ? { fulfillment_provider: 'gelato' } : {}),
    };

    let { error } = await this.supabase.from('orders').update({ ...base, ...providerFields } as any).eq('id', orderId);
    if (error && /fulfillment_provider|self_print_status/.test(error.message || '')) {
      // Self-print migration not run yet — still record the rest
      console.error('⚠️ Self-print columns missing — run db/migrations/2026-09-29-self-print-fulfilment.sql');
      ({ error } = await this.supabase.from('orders').update(base as any).eq('id', orderId));
    }

    if (error) {
      console.error('⚠️ Failed to update order with fulfillment results:', error);
      // Don't throw - order was already fulfilled
    }

    console.log(`📊 [Fulfillment Router] Order ${orderId} updated: ${overallStatus}`);
  }

  /**
   * Get status of all fulfillments for an order
   */
  async getOrderFulfillmentStatus(order: Order): Promise<Record<string, any>> {
    // TODO: Implement comprehensive status checking across all services
    // This will query order_fulfillment_tracking table and call service.getStatus()
    // for each tracked fulfillment
    return {
      status: 'not_implemented',
      message: 'Comprehensive status checking will be implemented in future iteration'
    };
  }
}
