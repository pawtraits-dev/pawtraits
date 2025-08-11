"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Heart, Share2, ShoppingCart, Check } from "lucide-react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [selectedSize, setSelectedSize] = useState("medium")
  const [selectedFormat, setSelectedFormat] = useState("canvas")
  const [isAddedToCart, setIsAddedToCart] = useState(false)

  // Mock product data - in real app, fetch based on params.id
  const product = {
    id: 1,
    title: "Golden Retriever Portrait",
    breed: "Golden Retriever",
    color: "Golden",
    theme: "Classic",
    style: "Realistic",
    description:
      "A stunning realistic portrait of a Golden Retriever, perfect for any pet lover. This AI-generated artwork captures the gentle and friendly nature of this beloved breed with incredible detail and warmth. The classic style makes it suitable for any home decor.",
    features: [
      "High-resolution AI-generated artwork",
      "Professional quality printing",
      "Fade-resistant inks",
      "Ready to hang hardware included",
      "30-day satisfaction guarantee",
    ],
    images: [
      "/placeholder.svg?height=500&width=500",
      "/placeholder.svg?height=500&width=500",
      "/placeholder.svg?height=500&width=500",
    ],
    tags: ["Popular", "Best Seller"],
  }

  const sizes = [
    { id: "small", name: "Small", dimensions: '8" x 10"', price: 39.99 },
    { id: "medium", name: "Medium", dimensions: '11" x 14"', price: 49.99 },
    { id: "large", name: "Large", dimensions: '16" x 20"', price: 69.99 },
    { id: "xlarge", name: "X-Large", dimensions: '20" x 24"', price: 89.99 },
  ]

  const formats = [
    {
      id: "canvas",
      name: "Canvas Print",
      description: "Gallery-wrapped canvas with wooden frame",
      priceMultiplier: 1,
    },
    {
      id: "wood",
      name: "Wood Print",
      description: "Direct print on sustainable birch wood",
      priceMultiplier: 1.3,
    },
    {
      id: "acrylic",
      name: "Acrylic Print",
      description: "Vibrant colors on premium acrylic glass",
      priceMultiplier: 1.5,
    },
  ]

  const selectedSizeData = sizes.find((size) => size.id === selectedSize)
  const selectedFormatData = formats.find((format) => format.id === selectedFormat)
  const finalPrice =
    selectedSizeData && selectedFormatData
      ? (selectedSizeData.price * selectedFormatData.priceMultiplier).toFixed(2)
      : "0.00"

  const handleAddToCart = () => {
    setIsAddedToCart(true)
    setTimeout(() => setIsAddedToCart(false), 2000)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link href="/dashboard/catalog" className="flex items-center hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Catalog
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img
                src={product.images[0] || "/placeholder.svg"}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {product.images.slice(1).map((image, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80"
                >
                  <img
                    src={image || "/placeholder.svg"}
                    alt={`${product.title} view ${index + 2}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{product.title}</h1>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm">
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                <div>
                  <span className="font-medium">Breed:</span> {product.breed}
                </div>
                <div>
                  <span className="font-medium">Style:</span> {product.style}
                </div>
                <div>
                  <span className="font-medium">Theme:</span> {product.theme}
                </div>
                <div>
                  <span className="font-medium">Color:</span> {product.color}
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </div>

            <Separator />

            {/* Size Selection */}
            <div>
              <Label className="text-base font-medium mb-4 block">Choose Size</Label>
              <RadioGroup value={selectedSize} onValueChange={setSelectedSize} className="space-y-3">
                {sizes.map((size) => (
                  <div key={size.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={size.id} id={size.id} />
                    <Label htmlFor={size.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{size.name}</span>
                          <span className="text-gray-600 ml-2">({size.dimensions})</span>
                        </div>
                        <span className="font-medium">${size.price}</span>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Format Selection */}
            <div>
              <Label className="text-base font-medium mb-4 block">Choose Format</Label>
              <RadioGroup value={selectedFormat} onValueChange={setSelectedFormat} className="space-y-3">
                {formats.map((format) => (
                  <div key={format.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={format.id} id={format.id} />
                    <Label htmlFor={format.id} className="flex-1 cursor-pointer">
                      <div>
                        <div className="font-medium">{format.name}</div>
                        <div className="text-sm text-gray-600">{format.description}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Price and Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">${finalPrice}</span>
                <span className="text-sm text-gray-600">
                  {selectedSizeData?.name} • {selectedFormatData?.name}
                </span>
              </div>

              <Button
                onClick={handleAddToCart}
                className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 h-12"
                disabled={isAddedToCart}
              >
                {isAddedToCart ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </>
                )}
              </Button>
            </div>

            {/* Features */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">What's Included:</h3>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
