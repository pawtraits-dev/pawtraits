"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckCircle,
  Package,
  Truck,
  Star,
  ExternalLink,
  Facebook,
  Twitter,
  MessageCircle,
  Linkedin,
  Copy,
  Check,
} from "lucide-react"

interface Order {
  id: string
  orderNumber: string
  date: string
  status: "confirmed" | "processing" | "shipped" | "delivered"
  total: number
  items: Array<{
    title: string
    image: string
    quantity: number
  }>
  trackingNumber?: string
  estimatedDelivery?: string
}

interface OrderDetailsModalProps {
  order: Order | null
}

export default function OrderDetailsModal({ order }: OrderDetailsModalProps) {
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  if (!order) return null

  const trackingSteps = [
    {
      status: "confirmed",
      title: "Order Confirmed",
      completed: true,
      icon: CheckCircle,
      date: order.date,
    },
    {
      status: "processing",
      title: "Processing",
      completed: ["processing", "shipped", "delivered"].includes(order.status),
      icon: Package,
      date: order.status === "processing" ? "In progress" : undefined,
    },
    {
      status: "shipped",
      title: "Shipped",
      completed: ["shipped", "delivered"].includes(order.status),
      icon: Truck,
      date: order.status === "shipped" ? "In transit" : undefined,
    },
    {
      status: "delivered",
      title: "Delivered",
      completed: order.status === "delivered",
      icon: CheckCircle,
      date: order.status === "delivered" ? "Completed" : undefined,
    },
  ]

  const handleFeedbackSubmit = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setFeedbackSubmitted(true)
  }

  const handleShare = (platform: string) => {
    const shareText = `Check out this amazing ${order.items[0]?.title || "pet portrait"} from Pawtraits!`
    const shareUrl = `https://pawtraits.com/order/${order.orderNumber}`

    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    }

    if (platform === "copy") {
      navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } else {
      window.open(urls[platform as keyof typeof urls], "_blank", "width=600,height=400")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Order #{order.orderNumber}</h2>
        <p className="text-gray-600">
          Placed on{" "}
          {new Date(order.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Order Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Order Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trackingSteps.map((step, index) => (
              <div key={step.status} className="flex items-center space-x-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.completed ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${step.completed ? "text-gray-900" : "text-gray-500"}`}>{step.title}</h3>
                  {step.date && <p className="text-sm text-gray-600">{step.date}</p>}
                </div>
                {step.completed && <CheckCircle className="w-5 h-5 text-green-600" />}
              </div>
            ))}
          </div>

          {order.trackingNumber && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Tracking Information</h4>
              <p className="text-sm text-blue-800 mb-2">
                Tracking Number: <span className="font-mono">{order.trackingNumber}</span>
              </p>
              {order.estimatedDelivery && (
                <p className="text-sm text-blue-800 mb-3">Estimated Delivery: {order.estimatedDelivery}</p>
              )}
              <Button variant="outline" size="sm" className="bg-white border-blue-300 text-blue-700">
                <ExternalLink className="w-4 h-4 mr-2" />
                Track with Carrier
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center space-x-4">
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Form - Only show for delivered orders */}
      {order.status === "delivered" && (
        <Card>
          <CardHeader>
            <CardTitle>Leave Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Thank you for your feedback!</h3>
                <p className="text-gray-600">Your review helps us improve our service.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Star Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rate your experience</label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                        <Star
                          className={`w-8 h-8 ${star <= rating ? "text-yellow-400 fill-current" : "text-gray-300"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comments (optional)</label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us about your experience..."
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleFeedbackSubmit}
                  disabled={rating === 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Submit Feedback
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Social Sharing */}
      <Card>
        <CardHeader>
          <CardTitle>Share Your Order</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">Love your pet portraits? Share them with friends and family!</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare("facebook")}
              className="bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Facebook className="w-4 h-4 mr-2" />
              Facebook
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare("twitter")}
              className="bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
            >
              <Twitter className="w-4 h-4 mr-2" />
              Twitter
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare("whatsapp")}
              className="bg-white border-green-200 text-green-600 hover:bg-green-50"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare("linkedin")}
              className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn
            </Button>

            <Button variant="outline" size="sm" onClick={() => handleShare("copy")} className="bg-white">
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
