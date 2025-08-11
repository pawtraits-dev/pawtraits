"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, Layout, Images, Users, Settings, QrCode } from "lucide-react"
import Link from "next/link"

export default function PreviewPage() {
  const previewPages = [
    {
      title: "Dashboard Home",
      description: "Main dashboard with stats and quick actions",
      href: "/preview/dashboard",
      icon: Layout,
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      title: "Catalog Browse",
      description: "Browse portraits with filtering and search",
      href: "/preview/catalog",
      icon: Images,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Product Detail",
      description: "Individual product page with size/format selection",
      href: "/preview/catalog/1",
      icon: Eye,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Referrals List",
      description: "Manage and track all referrals",
      href: "/preview/referrals",
      icon: Users,
      color: "bg-purple-100 text-purple-600",
    },
    {
      title: "Create Referral",
      description: "Generate QR codes for new clients",
      href: "/preview/referrals/create",
      icon: QrCode,
      color: "bg-amber-100 text-amber-600",
    },
    {
      title: "Account Settings",
      description: "Profile, payment, security, and notifications",
      href: "/preview/account",
      icon: Settings,
      color: "bg-gray-100 text-gray-600",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Dashboard Preview</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Preview all dashboard screens without logging in. Click on any card below to explore the different sections
            of the groomer partner dashboard.
          </p>
        </div>

        {/* Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {previewPages.map((page, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
              <Link href={page.href}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${page.color}`}>
                      <page.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="group-hover:text-indigo-600 transition-colors">{page.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">{page.description}</CardDescription>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors bg-transparent"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Screen
                    </Button>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        {/* Quick Access */}
        <Card className="bg-gradient-to-r from-indigo-50 to-emerald-50 border-indigo-200">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Want to see the full signup flow?</h2>
            <p className="text-gray-600 mb-6">
              Experience the complete registration process from initial signup to dashboard access.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button className="bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700">
                  Start Signup Process
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" className="bg-white">
                  View Login Page
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            💡 <strong>Tip:</strong> All preview pages include full navigation and functionality. You can interact with
            forms, filters, and buttons to see how everything works.
          </p>
        </div>
      </div>
    </div>
  )
}
