/**
 * Base Fulfillment Service Interface
 *
 * Defines the contract for all fulfillment service implementations:
 * - Digital downloads
 * - Gelato API fulfillment
 * - Manual fulfillment
 * - Other POD API providers (Prodigi, etc.)
 */

import type { Order, OrderItem } from '@/lib/types';

export interface FulfillmentService {
  /**
   * Check if this service can handle the given order item
   * @param orderItem - The order item to check
   * @returns true if this service can fulfill the item
   */
  canFulfill(orderItem: OrderItem): boolean;

  /**
   * Process fulfillment for the given order and items
   * @param order - The order to fulfill
   * @param orderItems - The items to fulfill (filtered by canFulfill)
   * @returns Result of the fulfillment operation
   */
  fulfill(order: Order, orderItems: OrderItem[]): Promise<FulfillmentResult>;

  /**
   * Check the status of a fulfillment
   * @param fulfillmentId - The fulfillment ID to check
   * @returns Current fulfillment status
   */
  getStatus(fulfillmentId: string): Promise<FulfillmentStatus>;

  /**
   * Cancel or modify a fulfillment
   * @param fulfillmentId - The fulfillment ID to cancel
   * @returns true if cancellation was successful
   */
  cancel(fulfillmentId: string): Promise<boolean>;
}

export interface FulfillmentResult {
  success: boolean;
  fulfillmentId?: string;
  trackingInfo?: FulfillmentTrackingInfo;
  error?: string;
  errorDetails?: any;
}

export interface FulfillmentStatus {
  status: 'pending' | 'processing' | 'fulfilled' | 'failed';
  trackingInfo?: FulfillmentTrackingInfo;
  estimatedCompletion?: Date;
  statusMessage?: string;
}

export interface FulfillmentTrackingInfo {
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  downloadUrls?: DownloadUrlInfo[];
  expiresAt?: Date;
  provider?: string;
  providerOrderId?: string;
  [key: string]: any; // Allow provider-specific fields
}

export interface DownloadUrlInfo {
  orderItemId: string;
  downloadUrl: string;
  format: string;
  expiresAt: Date;
  fileSize: number;
  fileName?: string;
}

/**
 * Error types for fulfillment operations
 */
export class FulfillmentError extends Error {
  constructor(
    message: string,
    public code: FulfillmentErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'FulfillmentError';
  }
}

export enum FulfillmentErrorCode {
  INVALID_ITEM = 'INVALID_ITEM',
  API_ERROR = 'API_ERROR',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  GENERATION_FAILED = 'GENERATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN'
}
