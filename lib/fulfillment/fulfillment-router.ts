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
import type { FulfillmentService, FulfillmentResult } from './base-fulfillment-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class FulfillmentRouter {
  private services: FulfillmentService[];
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    // Register all available fulfillment services
    this.services = [
      new DigitalDownloadService(),
      new GelatoFulfillmentService()
      // Phase 2: Add ManualFulfillmentService
      // Phase 3: Add ProdigiService and other providers
    ];

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
      // Determine overall fulfillment type
      const fulfillmentType = this.determineFulfillmentType(orderItems);
      console.log('📦 [Fulfillment Router] Fulfillment type:', fulfillmentType);

      // Update order with fulfillment type
      await this.updateOrderFulfillmentType(order.id, fulfillmentType);

      // Group items by service
      const itemsByService = this.groupItemsByService(orderItems);
      console.log('📦 [Fulfillment Router] Services needed:', Object.keys(itemsByService));

      // Process each group with appropriate service
      const results: FulfillmentResult[] = [];

      for (const [serviceName, items] of Object.entries(itemsByService)) {
        console.log(`📦 [Fulfillment Router] Processing ${items.length} items with ${serviceName}`);

        // Find the service instance by name
        const service = this.services.find(s => s.constructor.name === serviceName);

        if (!service) {
          console.error(`❌ No service instance found for: ${serviceName}`);
          results.push({
            success: false,
            error: `No fulfillment service found for ${serviceName}`
          });
          continue;
        }

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
  private groupItemsByService(orderItems: OrderItem[]): Record<string, OrderItem[]> {
    const grouped: Record<string, OrderItem[]> = {};

    for (const item of orderItems) {
      // Check each service to see if it can fulfill this item
      // Physical products will be added to BOTH GelatoFulfillmentService AND DigitalDownloadService
      for (const service of this.services) {
        if (service.canFulfill(item)) {
          const serviceName = service.constructor.name;

          if (!grouped[serviceName]) {
            grouped[serviceName] = [];
          }
          grouped[serviceName].push(item);
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

    let overallStatus: string;
    if (allSuccessful) {
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

    const { error } = await this.supabase
      .from('orders')
      .update({
        fulfillment_status: overallStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

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
