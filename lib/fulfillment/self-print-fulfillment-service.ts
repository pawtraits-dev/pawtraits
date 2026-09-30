/**
 * Self-print Fulfillment Service
 *
 * The default for posted prints: nothing is sent anywhere. The order is queued in
 * /admin/orders as "To print" and moves through To print → Printed → Packed → Posted
 * by hand (see lib/fulfillment/order-fulfilment.ts). From the queue any order can
 * instead be sent to Gelato.
 */

import type { Order, OrderItem } from '@/lib/types';
import type { FulfillmentService, FulfillmentResult, FulfillmentStatus } from './base-fulfillment-service';

export { isPostedPrintItem } from './shared';
import { isPostedPrintItem } from './shared';

export class SelfPrintFulfillmentService implements FulfillmentService {
  canFulfill(orderItem: OrderItem): boolean {
    return isPostedPrintItem(orderItem);
  }

  async fulfill(order: Order, orderItems: OrderItem[]): Promise<FulfillmentResult> {
    const items = orderItems.filter(i => this.canFulfill(i));
    const missingFiles = items.filter((i: any) => !i.print_image_url).length;
    console.log(`🖨️ [Self-print] Order ${order.order_number}: ${items.length} item(s) queued to print`);
    return {
      success: true,
      fulfillmentId: null as any,
      trackingInfo: { provider: 'self_print', queuedItems: items.length, missingPrintFiles: missingFiles },
    };
  }

  async getStatus(): Promise<FulfillmentStatus> {
    return { status: 'processing', statusMessage: 'Self-printed — tracked in /admin/orders' };
  }

  async cancel(): Promise<boolean> {
    return true; // nothing external to cancel
  }
}
