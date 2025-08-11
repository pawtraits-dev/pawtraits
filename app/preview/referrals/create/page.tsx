import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
// import ReferralForm from "./ReferralForm" // Temporarily disabled

export default function CreateReferralPage() {
  return (
    <div className="container mx-auto py-10">
      <Link href="/preview/referrals" className="flex items-center hover:text-indigo-600">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Referrals
      </Link>

      {/* Preview Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-amber-800">Preview Mode - Create Referral</h3>
            <p className="text-sm text-amber-700">Form submission will generate a mock QR code</p>
          </div>
          <Link href="/preview">
            <Button variant="outline" size="sm" className="bg-white">
              Back to Preview Menu
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-center text-gray-500">ReferralForm component will be added later</div>
      </div>
    </div>
  )
}
