'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Users, Percent, ShoppingBag } from 'lucide-react'

export interface OrderItem {
  title: string
  price: number // Original price in pounds
  discountedPrice?: number // Discounted price in pounds (for partners)
  quantity: number
}

export interface OrderSummaryData {
  subtotal: number // in pounds
  discount?: number // in pounds (for partners)
  discountedSubtotal?: number // in pounds (for partners)
  shipping: number // in pounds
  total: number // in pounds
  items: OrderItem[]
}

interface OrderSummaryProps {
  data: OrderSummaryData
  userType?: 'customer' | 'partner'
  discountPercentage?: number
  title?: string
}

export default function OrderSummary({
  data,
  userType = 'customer',
  discountPercentage = 15,
  title
}: OrderSummaryProps) {
  const isPartner = userType === 'partner'
  const hasDiscount = isPartner && data.discount && data.discount > 0

  const defaultTitle = isPartner ? 'Partner Order Summary' : 'Order Summary'
  const displayTitle = title || defaultTitle

  const icon = isPartner ? Users : ShoppingBag

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          {React.createElement(icon, { className: "w-5 h-5 mr-2" })}
          {displayTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        {data.items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-gray-600">
              {item.title} {item.quantity > 1 && `(×${item.quantity})`}
            </span>
            <div className="text-right">
              {hasDiscount && item.discountedPrice ? (
                <>
                  <div className="text-xs text-gray-400 line-through">
                    £{(item.price * item.quantity).toFixed(2)}
                  </div>
                  <div className="font-medium text-green-600">
                    £{(item.discountedPrice * item.quantity).toFixed(2)}
                  </div>
                </>
              ) : (
                <div className="font-medium">
                  £{(item.price * item.quantity).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ))}

        <Separator />

        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">£{data.subtotal.toFixed(2)}</span>
        </div>

        {/* Partner Discount */}
        {hasDiscount && (
          <div className="flex justify-between text-green-600">
            <span className="flex items-center">
              <Percent className="w-4 h-4 mr-1" />
              Partner Discount ({discountPercentage}%)
            </span>
            <span className="font-medium">-£{data.discount!.toFixed(2)}</span>
          </div>
        )}

        {/* Discounted Subtotal (Partners only) */}
        {hasDiscount && data.discountedSubtotal && (
          <div className="flex justify-between">
            <span className="text-gray-600">Discounted Subtotal</span>
            <span className="font-medium">£{data.discountedSubtotal.toFixed(2)}</span>
          </div>
        )}

        {/* Shipping */}
        <div className="flex justify-between">
          <span className="text-gray-600">Shipping</span>
          <span className="font-medium">
            {data.shipping === 0 ? "Free" : `£${data.shipping.toFixed(2)}`}
          </span>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>£{data.total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  )
}