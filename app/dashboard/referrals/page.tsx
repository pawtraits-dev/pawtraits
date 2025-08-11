"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Download, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"
import type { Referral } from "@/lib/types"

export default function ReferralsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All Statuses")
  const [sortBy, setSortBy] = useState("date")

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Fetch real referral data
  useEffect(() => {
    fetchReferrals()
  }, [])

  const fetchReferrals = async () => {
    try {
      setLoading(true)
      
      // Get auth token
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('Session data:', session ? 'Session exists' : 'No session')
      console.log('Access token:', session?.access_token ? 'Token exists' : 'No token')
      
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      console.log('Fetching referrals from /api/referrals...')
      const response = await fetch('/api/referrals', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Failed to fetch referrals')
      }
      
      const data = await response.json()
      console.log('Referrals data received:', data)
      console.log('Number of referrals:', data.length)
      setReferrals(data)
    } catch (error) {
      console.error('Error fetching referrals:', error)
      setError('Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      Purchased: "bg-emerald-100 text-emerald-800",
      Pending: "bg-amber-100 text-amber-800",
      Viewed: "bg-blue-100 text-blue-800",
      Expired: "bg-gray-100 text-gray-800",
    }
    return variants[status as keyof typeof variants] || "bg-gray-100 text-gray-800"
  }

  const filteredReferrals = referrals.filter((referral) => {
    return (
      (searchTerm === "" ||
        referral.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        referral.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        referral.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === "All Statuses" || referral.status === statusFilter)
    )
  })

  const totalCommissions = referrals
    .filter((r) => r.status === "applied")
    .reduce((sum, r) => sum + (r.order_value || 0) * (r.commission_rate || 0) / 100, 0)

  const stats = [
    { label: "Total Referrals", value: referrals.length.toString() },
    { label: "Successful", value: referrals.filter((r) => r.status === "applied").length.toString() },
    { label: "Total Commissions", value: `$${totalCommissions.toFixed(2)}` },
    {
      label: "Conversion Rate",
      value: `${((referrals.filter((r) => r.status === "applied").length / referrals.length) * 100).toFixed(1)}%`,
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Referral Center</h1>
            <p className="text-gray-600 mt-2">Manage your referrals and track commissions</p>
          </div>
          <Link href="/dashboard/referrals/create">
            <Button className="bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              New Referral
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search referrals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Statuses">All Statuses</SelectItem>
                  <SelectItem value="Purchased">Purchased</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Viewed">Viewed</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date Created</SelectItem>
                  <SelectItem value="name">Client Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="commission">Commission</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referrals</CardTitle>
            <CardDescription>
              Showing {filteredReferrals.length} of {referrals.length} referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>QR Scans</TableHead>
                    <TableHead>Order Value</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">{referral.referral_code}</TableCell>
                      <TableCell>{referral.client_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{referral.client_email}</div>
                          <div className="text-gray-500">{referral.client_phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(referral.status)}>{referral.status}</Badge>
                      </TableCell>
                      <TableCell>{referral.qr_scans}</TableCell>
                      <TableCell>{referral.order_value ? `$${referral.order_value}` : '-'}</TableCell>
                      <TableCell className="font-medium">{referral.commission_amount ? `$${referral.commission_amount}` : 'Pending'}</TableCell>
                      <TableCell>{new Date(referral.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
