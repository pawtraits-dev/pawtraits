import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params

  return (
    <div className="container mx-auto py-10">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link href="/preview/catalog" className="flex items-center hover:text-indigo-600">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Catalog
        </Link>
      </nav>

      {/* Preview Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-amber-800">Preview Mode - Product Detail</h3>
            <p className="text-sm text-amber-700">Try selecting different sizes and formats!</p>
          </div>
          <Link href="/preview">
            <Button variant="outline" size="sm" className="bg-white">
              Back to Preview Menu
            </Button>
          </Link>
        </div>
      </div>

      {/* Product Details */}
      <div className="mt-8">
        <h1 className="text-2xl font-bold mb-4">Product ID: {productId}</h1>
        <p className="text-gray-700">
          This is a placeholder for the product details page. You can dynamically fetch and display product information
          based on the <code>productId</code>.
        </p>
      </div>
    </div>
  )
}
