"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from '@/lib/supabase-client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DollarSign, TrendingUp, Clock, CheckCircle, Filter } from "lucide-react"
import Link from "next/link"
import { PartnerOnly } from '@/components/user-access-control'
import UserAwareNavigation from '@/components/UserAwareNavigation'
import { CountryProvider } from '@/lib/country-context'

interface CommissionOrder {
  id: string
  order_id: string
  client_email: string
  client_name: string | null
  partner_id: string
  order_type: string
  commission_amount: number
  commission_rate: number
  commission_paid: boolean
  is_initial_order: boolean
  created_at: string
  updated_at: string
  referrals?: {
    referral_code: string
    client_name: string
    client_email: string
  }
}

interface CommissionSummary {
  totalCommissions: string
  unpaidTotal: string
  paidTotal: string
  unpaidCount: number
  paidCount: number
  initialOrdersCount: number
  subsequentOrdersCount: number
}

interface CommissionData {
  summary: CommissionSummary
  orders: CommissionOrder[]
  unpaidCommissions: CommissionOrder[]
  paidCommissions: CommissionOrder[]
}

function CommissionsPageContent() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    fetchCommissions()
  }, [statusFilter])

  const fetchCommissions = async () => {
    try {
      setLoading(true)
      
      // Get session for authorization
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Build API URL with filters
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      console.log('Fetching commissions from /api/partner/commissions...')
      const response = await fetch(`/api/partner/commissions?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Failed to fetch commission data')
      }
      
      const data = await response.json()
      console.log('Commission data received:', data)
      setCommissionData(data)
    } catch (error) {
      console.error('Error fetching commission data:', error)
      setError('Failed to load commission data')
    } finally {
      setLoading(false)
    }
  }


  const getOrderTypeDisplay = (orderType: string, isInitial: boolean) => {
    if (isInitial) {
      return { label: 'Initial Order', color: 'bg-green-100 text-green-800' }
    } else {
      return { label: 'Lifetime Commission', color: 'bg-blue-100 text-blue-800' }
    }
  }

  const ordersToDisplay = statusFilter === 'paid' 
    ? commissionData?.paidCommissions || []
    : statusFilter === 'unpaid' 
    ? commissionData?.unpaidCommissions || []
    : commissionData?.orders || []

  if (loading) {
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading commission data...</p>
          </div>
        </div>
      </CountryProvider>
    )
  }

  if (error) {
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchCommissions}>Try Again</Button>
          </div>
        </div>
      </CountryProvider>
    )
  }

  return (
    <CountryProvider>
      <UserAwareNavigation />
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Commission Management</h1>
            <p className="text-gray-600 mt-2">Track your earnings and payment status</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <Link href="/partners">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Link href="/referrals">
              <Button variant="outline">View Referrals</Button>
            </Link>
          </div>
        </div>

        {/* Commission Summary */}
        {commissionData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-900">£{commissionData.summary.totalCommissions}</div>
                    <div className="text-sm text-green-700">Total Commissions</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-orange-900">£{commissionData.summary.unpaidTotal}</div>
                    <div className="text-sm text-orange-700">Unpaid ({commissionData.summary.unpaidCount})</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-900">£{commissionData.summary.paidTotal}</div>
                    <div className="text-sm text-blue-700">Paid ({commissionData.summary.paidCount})</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-900">{commissionData.summary.initialOrdersCount}</div>
                    <div className="text-sm text-purple-700">Initial Orders</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-green-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              </div>
              <Select value={statusFilter} onValueChange={(value: 'all' | 'paid' | 'unpaid') => setStatusFilter(value)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Commissions</SelectItem>
                  <SelectItem value="unpaid">Unpaid Only</SelectItem>
                  <SelectItem value="paid">Paid Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Commissions Table */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">Commission Details</CardTitle>
            <CardDescription>
              Showing {ordersToDisplay.length} commission record{ordersToDisplay.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ordersToDisplay.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No commission records found</p>
                <p className="text-sm mt-2">Commission records are created when clients make purchases through your referrals</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersToDisplay.map((order) => {
                      const orderType = getOrderTypeDisplay(order.order_type, order.is_initial_order)
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            <Link href={`/orders/${order.order_id}`} className="text-blue-600 hover:underline">
                              {order.order_id}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{order.client_name || 'N/A'}</div>
                              <div className="text-gray-500">{order.client_email}</div>
                              {order.referrals && (
                                <div className="text-xs text-blue-600">
                                  Ref: {order.referrals.referral_code}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={orderType.color}>{orderType.label}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            £{(order.commission_amount / 100).toFixed(2)}
                          </TableCell>
                          <TableCell>{order.commission_rate}%</TableCell>
                          <TableCell>
                            <Badge className={order.commission_paid 
                              ? "bg-green-100 text-green-800" 
                              : "bg-orange-100 text-orange-800"
                            }>
                              {order.commission_paid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </CountryProvider>
  )
}

export default function CommissionsPage() {
  return (
    <PartnerOnly>
      <CommissionsPageContent />
    </PartnerOnly>
  )
}