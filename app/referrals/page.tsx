"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from '@/lib/supabase-client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Eye,
  UserPlus,
  TrendingUp,
  DollarSign,
  Activity,
  Calendar,
  Copy,
  Download,
  QrCode,
  Share2,
  ExternalLink,
  CheckCircle,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { PartnerOnly } from '@/components/user-access-control'
import UserAwareNavigation from '@/components/UserAwareNavigation'
import { CountryProvider } from '@/lib/country-context'

interface ReferralCode {
  code: string
  qr_code_url: string | null
  type: 'pre_registration' | 'personal'
  scans_count: number
  conversions_count: number
  share_url: string
  created_at?: string
}

interface ReferralActivity {
  id: string
  type: string
  date: string
  customer_name?: string
  commission?: number
  status?: string
}

interface ReferralData {
  user_type: string
  partner_name: string
  primary_code: ReferralCode | null
  all_codes: ReferralCode[]
  summary: {
    total_scans: number
    total_signups: number
    total_purchases: number
    total_order_value: number
    total_commissions: number
    conversion_rate: number
    avg_order_value: number
  }
  recent_activity: ReferralActivity[]
}

function ReferralCodeDisplay({ primaryCode }: { primaryCode: ReferralCode }) {
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${primaryCode.share_url}`
    : primaryCode.share_url

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'code') {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <Share2 className="h-6 w-6 mr-2 text-purple-600" />
              Your Referral Code
            </CardTitle>
            <CardDescription className="mt-2">
              Share this code with customers to earn commissions on their purchases
            </CardDescription>
          </div>
          {primaryCode.qr_code_url && (
            <div className="flex items-center">
              <QrCode className="h-5 w-5 text-purple-600 mr-2" />
              <span className="text-sm text-muted-foreground">QR Code Available</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Code */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Referral Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border-2 border-purple-300 rounded-lg px-6 py-4">
              <p className="text-3xl font-bold text-purple-600 tracking-wider text-center">
                {primaryCode.code}
              </p>
            </div>
            <Button
              onClick={() => copyToClipboard(primaryCode.code, 'code')}
              variant="outline"
              size="lg"
              className="h-full"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Share URL */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Share Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-700 truncate">
                {fullUrl}
              </p>
            </div>
            <Button
              onClick={() => copyToClipboard(fullUrl, 'url')}
              variant="outline"
            >
              {copiedUrl ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              onClick={() => window.open(fullUrl, '_blank')}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>

        {/* QR Code Display */}
        {primaryCode.qr_code_url && (
          <div className="pt-4 border-t border-gray-200">
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              QR Code
            </label>
            <div className="flex items-center gap-4">
              <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                <Image
                  src={primaryCode.qr_code_url}
                  alt="Referral QR Code"
                  width={200}
                  height={200}
                  className="rounded"
                />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-gray-600">
                  Download and share this QR code at your business location or on marketing materials
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = primaryCode.qr_code_url!
                    link.download = `referral-qr-${primaryCode.code}.png`
                    link.click()
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Eye className="h-4 w-4 mr-1" />
              Scans
            </div>
            <div className="text-2xl font-bold text-gray-900">{primaryCode.scans_count}</div>
          </div>
          <div>
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <UserPlus className="h-4 w-4 mr-1" />
              Conversions
            </div>
            <div className="text-2xl font-bold text-gray-900">{primaryCode.conversions_count}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ReferralsPageContent() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchReferrals()
  }, [])

  const fetchReferrals = async () => {
    try {
      setLoading(true)

      // Get session for authorization
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      console.log('Fetching referrals from /api/partners/referrals...')
      const response = await fetch('/api/partners/referrals', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Failed to fetch referral data')
      }

      const data = await response.json()
      console.log('Referral data received:', data)
      setReferralData(data)
    } catch (error) {
      console.error('Error fetching referral data:', error)
      setError('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `£${(amount / 100).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading referral data...</p>
          </div>
        </div>
      </CountryProvider>
    )
  }

  if (error) {
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchReferrals}>Try Again</Button>
          </div>
        </div>
      </CountryProvider>
    )
  }

  if (!referralData) {
    return null
  }

  return (
    <CountryProvider>
      <UserAwareNavigation />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Referral Dashboard</h1>
              <p className="text-gray-600 mt-2">Track your referrals and earnings</p>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <Link href="/partners">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              <Link href="/commissions">
                <Button variant="outline">View Commissions</Button>
              </Link>
              <Button onClick={fetchReferrals} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Referral Code Display */}
          {referralData.primary_code && (
            <ReferralCodeDisplay primaryCode={referralData.primary_code} />
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-900">{referralData.summary.total_scans}</div>
                    <div className="text-sm text-blue-700">Total Scans</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-900">{referralData.summary.total_signups}</div>
                    <div className="text-sm text-green-700">Signups</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-900">{referralData.summary.total_purchases}</div>
                    <div className="text-sm text-purple-700">Orders</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-orange-900">
                      {formatCurrency(referralData.summary.total_commissions)}
                    </div>
                    <div className="text-sm text-orange-700">Total Earned</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabbed Content */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-purple-900">Performance Metrics</CardTitle>
                    <CardDescription>Your referral performance statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Conversion Rate</span>
                      <span className="font-bold text-gray-900">
                        {(referralData.summary.conversion_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Average Order Value</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(referralData.summary.avg_order_value)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Total Order Value</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(referralData.summary.total_order_value)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">Total Commissions</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(referralData.summary.total_commissions)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-purple-900">Quick Actions</CardTitle>
                    <CardDescription>Manage your referral program</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Link href="/commissions">
                      <Button variant="outline" className="w-full justify-start">
                        <DollarSign className="w-4 h-4 mr-2" />
                        View Commission Details
                      </Button>
                    </Link>
                    {referralData.primary_code?.qr_code_url && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = referralData.primary_code!.qr_code_url!
                          link.download = `referral-qr-${referralData.primary_code!.code}.png`
                          link.click()
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download QR Code
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        if (referralData.primary_code) {
                          const fullUrl = `${window.location.origin}${referralData.primary_code.share_url}`
                          window.open(fullUrl, '_blank')
                        }
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Preview Referral Page
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Recent Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="text-purple-900">Recent Activity</CardTitle>
                  <CardDescription>
                    Recent referrals and conversions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referralData.recent_activity.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recent activity</p>
                      <p className="text-sm mt-2">Activity will appear here when customers use your referral code</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Commission</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {referralData.recent_activity.map((activity) => (
                            <TableRow key={activity.id}>
                              <TableCell>
                                <Badge variant="outline">
                                  {activity.type === 'purchase' ? 'Purchase' : 'Signup'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {activity.customer_name || 'Unknown'}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  activity.status === 'completed'
                                    ? "bg-green-100 text-green-800"
                                    : "bg-orange-100 text-orange-800"
                                }>
                                  {activity.status || 'pending'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {activity.commission
                                  ? formatCurrency(activity.commission)
                                  : '-'
                                }
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  {formatDate(activity.date)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </CountryProvider>
  )
}

export default function ReferralsPage() {
  return (
    <PartnerOnly>
      <ReferralsPageContent />
    </PartnerOnly>
  )
}
