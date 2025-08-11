"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Images, Users, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"

export default function PreviewDashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Preview Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-amber-800">Preview Mode</h3>
              <p className="text-sm text-amber-700">
                You're viewing the dashboard in preview mode. All functionality is available for testing.
              </p>
            </div>
            <Link href="/preview">
              <Button variant="outline" size="sm" className="bg-white">
                Back to Preview Menu
              </Button>
            </Link>
          </div>
        </div>

        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, Sarah!</h1>
          <p className="text-gray-600 mt-2">Here's what's happening with your referrals today.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                  <Images className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Browse Catalog</CardTitle>
                  <CardDescription>Explore AI pet portraits to share with clients</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/preview/catalog">
                <Button className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700">
                  View Catalog
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>Create Referral</CardTitle>
                  <CardDescription>Generate QR code for new client referral</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/preview/referrals/create">
                <Button className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Referral
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest referrals and commissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  client: "Jennifer Walsh",
                  action: "Purchased Canvas Print",
                  amount: "$89.50",
                  commission: "$17.90",
                  time: "2 hours ago",
                },
                {
                  client: "Mike Rodriguez",
                  action: "QR Code Generated",
                  amount: "-",
                  commission: "Pending",
                  time: "1 day ago",
                },
                {
                  client: "Lisa Chen",
                  action: "Purchased Wood Print",
                  amount: "$124.00",
                  commission: "$24.80",
                  time: "3 days ago",
                },
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{activity.client}</p>
                    <p className="text-sm text-gray-600">{activity.action}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{activity.commission}</p>
                    <p className="text-sm text-gray-600">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link href="/preview/referrals">
                <Button variant="outline" className="w-full bg-transparent">
                  View All Referrals
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
