"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from '@/lib/supabase-client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, TrendingUp, Clock, CheckCircle, Filter, Package, Calendar } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { PartnerOnly } from '@/components/user-access-control'
import UserAwareNavigation from '@/components/UserAwareNavigation'
import { CountryProvider } from '@/lib/country-context'

interface CommissionRecord {
  id: string
  recipient_id: string
  recipient_type: string
  order_id: string
  commission_amount: number
  commission_rate: number
  status: string
  created_at: string
  updated_at: string
  commission_payment_id?: string
  metadata: {
    commission_type?: string
    order_items_count?: number
    [key: string]: any
  }
  orders?: {
    id: string
    created_at: string
    subtotal_amount: number
    shipping_amount: number
    total_amount: number
    order_items: Array<{
      id: string
      product_name: string
      product_description: string
      thumbnail_url: string
      quantity: number
      unit_price: number
    }>
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
  commissions: CommissionRecord[]
  unpaidCommissions: CommissionRecord[]
  paidCommissions: CommissionRecord[]
}

interface PaymentRecord {
  id: string
  payment_period_start: string
  payment_period_end: string
  total_amount_pounds: number
  commission_count: number
  status: string
  payment_method: string
  paid_at?: string
  created_at: string
}

interface PaymentData {
  summary: {
    total_payments: number
    total_paid_amount: string
    total_pending_amount: string
    paid_payments_count: number
    pending_payments_count: number
  }
  payments: PaymentRecord[]
}

function CommissionsPageContent() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    fetchCommissions()
    fetchPayments()
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

      console.log('Fetching commissions from /api/partners/commissions...')
      const response = await fetch(`/api/partners/commissions?${params}`, {
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

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true)

      // Get session for authorization
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      console.log('Fetching payments from /api/partners/payments...')
      const response = await fetch('/api/partners/payments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Failed to fetch payment data')
      }

      const data = await response.json()
      console.log('Payment data received:', data)
      setPaymentData(data)
    } catch (error) {
      console.error('Error fetching payment data:', error)
      setError('Failed to load payment data')
    } finally {
      setPaymentsLoading(false)
    }
  }


  const getCommissionTypeDisplay = (metadata: any) => {
    if (metadata?.commission_type === 'initial') {
      return { label: 'Initial Order', color: 'bg-green-100 text-green-800' }
    } else if (metadata?.commission_type === 'lifetime') {
      return { label: 'Lifetime Commission', color: 'bg-blue-100 text-blue-800' }
    } else {
      return { label: 'Commission', color: 'bg-gray-100 text-gray-800' }
    }
  }

  const commissionsToDisplay = statusFilter === 'paid'
    ? commissionData?.paidCommissions || []
    : statusFilter === 'unpaid'
    ? commissionData?.unpaidCommissions || []
    : commissionData?.commissions || []

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

        {/* Tabbed Content */}
        <Tabs defaultValue="commissions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
          </TabsList>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="space-y-4">
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
                  Showing {commissionsToDisplay.length} commission record{commissionsToDisplay.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {commissionsToDisplay.length === 0 ? (
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
                          <TableHead>Order Details</TableHead>
                          <TableHead>Products</TableHead>
                          <TableHead>Order Value</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionsToDisplay.map((commission) => {
                          const commissionType = getCommissionTypeDisplay(commission.metadata)
                          const order = commission.orders
                          const itemsCount = order?.order_items?.length || 1
                          const orderTotal = order?.subtotal_amount ? (order.subtotal_amount / 100) : 0

                          return (
                            <TableRow key={commission.id}>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="font-medium text-blue-600">
                                    #{commission.id.slice(-8)}
                                  </div>
                                  <div className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                                    <Calendar className="w-3 h-3" />
                                    {order?.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                                  </div>
                                  <div className="text-gray-500 text-xs flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    {itemsCount} item{itemsCount !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2 max-w-xs">
                                  {order?.order_items?.slice(0, 2).map((item, index) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                      {item.thumbnail_url && (
                                        <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                                          <Image
                                            src={item.thumbnail_url}
                                            alt={item.product_name}
                                            width={32}
                                            height={32}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-xs truncate">
                                          {item.product_name}
                                        </div>
                                        <div className="text-gray-500 text-xs">
                                          {item.quantity}x £{(item.unit_price / 100).toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {order && order.order_items && order.order_items.length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      +{order.order_items.length - 2} more items
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {orderTotal > 0 ? `£${orderTotal.toFixed(2)}` : 'N/A'}
                                {order?.shipping_amount && (
                                  <div className="text-xs text-gray-500">
                                    (excl. shipping)
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  £{(commission.commission_amount / 100).toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {commission.commission_rate}%
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={commissionType.color}>{commissionType.label}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={commission.status === 'paid'
                                  ? "bg-green-100 text-green-800"
                                  : "bg-orange-100 text-orange-800"
                                }>
                                  {commission.status === 'paid' ? 'Paid' : 'Unpaid'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(commission.created_at).toLocaleDateString()}
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
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {/* Payment Summary */}
            {paymentData && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="text-2xl font-bold text-blue-900">£{paymentData.summary.total_paid_amount}</div>
                        <div className="text-sm text-blue-700">Total Paid</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <div>
                        <div className="text-2xl font-bold text-orange-900">£{paymentData.summary.total_pending_amount}</div>
                        <div className="text-sm text-orange-700">Pending Payment</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="text-2xl font-bold text-green-900">{paymentData.summary.paid_payments_count}</div>
                        <div className="text-sm text-green-700">Completed Payments</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      <div>
                        <div className="text-2xl font-bold text-purple-900">{paymentData.summary.total_payments}</div>
                        <div className="text-sm text-purple-700">Total Payments</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payments Table */}
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">Payment History</CardTitle>
                <CardDescription>
                  Your commission payment history and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading payment history...</p>
                  </div>
                ) : !paymentData || paymentData.payments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No payment records found</p>
                    <p className="text-sm mt-2">Payment records will appear here when commissions are processed for payment</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment Period</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Commission Count</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentData.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">
                                  {new Date(payment.payment_period_start).toLocaleDateString()} -
                                </div>
                                <div className="text-gray-500">
                                  {new Date(payment.payment_period_end).toLocaleDateString()}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              £{payment.total_amount_pounds.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {payment.commission_count} commission{payment.commission_count !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{payment.payment_method}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={payment.status === 'paid'
                                ? "bg-green-100 text-green-800"
                                : payment.status === 'pending'
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-800"
                              }>
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {payment.paid_at
                                ? new Date(payment.paid_at).toLocaleDateString()
                                : new Date(payment.created_at).toLocaleDateString()
                              }
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

export default function CommissionsPage() {
  return (
    <PartnerOnly>
      <CommissionsPageContent />
    </PartnerOnly>
  )
}