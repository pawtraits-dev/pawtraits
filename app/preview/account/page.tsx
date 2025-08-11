import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AccountPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

      {/* Preview Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-amber-800">Preview Mode - Account Settings</h3>
            <p className="text-sm text-amber-700">All form changes are simulated and won't be saved</p>
          </div>
          <Link href="/preview">
            <Button variant="outline" size="sm" className="bg-white">
              Back to Preview Menu
            </Button>
          </Link>
        </div>
      </div>

      {/* Account Settings Form (Placeholder) */}
      <div className="border rounded-lg p-6">
        <p className="text-gray-600">
          This is a placeholder for the account settings form. In preview mode, changes will not be saved.
        </p>
      </div>
    </div>
  )
}
