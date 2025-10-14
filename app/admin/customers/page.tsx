'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Search,
  Filter,
  Eye,
  Mail,
  Phone,
  MoreHorizontal,
  Users,
  UserCheck,
  Heart,
  ShoppingCart,
  Gift,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminCustomerOverview } from '@/lib/types';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerOverview[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<AdminCustomerOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [creditsSummary, setCreditsSummary] = useState<any>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
    loadCreditsSummary();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, statusFilter, verifiedFilter]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCreditsSummary = async () => {
    try {
      setCreditsLoading(true);
      const response = await fetch('/api/admin/customers/credits-summary');
      if (response.ok) {
        const data = await response.json();
        setCreditsSummary(data);
      }
    } catch (error) {
      console.error('Error loading credits summary:', error);
    } finally {
      setCreditsLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(customer => 
        (customer.full_name && customer.full_name.toLowerCase().includes(term)) ||
        customer.email.toLowerCase().includes(term) ||
        customer.phone?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => 
        statusFilter === 'active' ? customer.customer_status === 'active' : customer.customer_status !== 'active'
      );
    }

    if (verifiedFilter !== 'all') {
      filtered = filtered.filter(customer => 
        verifiedFilter === 'verified' ? customer.email_verified : !customer.email_verified
      );
    }

    setFilteredCustomers(filtered);
  };

  const handleToggleActive = async (customerId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isActive ? 'inactive' : 'active' })
      });

      if (response.ok) {
        loadCustomers();
      }
    } catch (error) {
      console.error('Error toggling customer status:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.customer_status === 'active').length,
    verified: customers.filter(c => c.email_verified).length,
    withPets: customers.filter(c => c.total_pets > 0).length,
    withOrders: customers.filter(c => c.total_orders > 0).length
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
        <p className="text-gray-600 mt-2">Manage B2C customers, pets, and monitor activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.verified}</p>
                <p className="text-sm text-gray-600">Email Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.withPets}</p>
                <p className="text-sm text-gray-600">With Pets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.withOrders}</p>
                <p className="text-sm text-gray-600">With Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Liability Overview */}
      {!creditsLoading && creditsSummary && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Gift className="w-5 h-5 mr-2 text-blue-600" />
              Credit Liability Overview
            </CardTitle>
            <CardDescription>
              Outstanding customer credit balances and lifetime statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Outstanding Liability */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Outstanding Liability</p>
                  <DollarSign className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-600">
                  £{creditsSummary.aggregate_summary.total_outstanding_credits_pounds.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {creditsSummary.aggregate_summary.number_of_customers_with_credits} customers
                </p>
              </div>

              {/* Pending Future Liability */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Pending Credits</p>
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-orange-600">
                  £{creditsSummary.aggregate_summary.pending_credits_pounds.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Awaiting approval
                </p>
              </div>

              {/* Lifetime Issued */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Lifetime Issued</p>
                  <Gift className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  £{creditsSummary.aggregate_summary.total_credits_earned_lifetime_pounds.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {creditsSummary.aggregate_summary.total_credit_records} total credits
                </p>
              </div>

              {/* Redemption Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Redemption Rate</p>
                  <ShoppingCart className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {creditsSummary.liability_breakdown.redemption_rate_percent}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  £{creditsSummary.aggregate_summary.total_redeemed_lifetime_pounds.toFixed(2)} redeemed
                </p>
              </div>
            </div>

            {/* Top Customers with Credits */}
            {creditsSummary.top_customers_by_balance && creditsSummary.top_customers_by_balance.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Top Customers by Credit Balance</h4>
                <div className="space-y-2">
                  {creditsSummary.top_customers_by_balance.slice(0, 5).map((customer: any) => (
                    <div key={customer.id} className="flex items-center justify-between text-sm">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline flex-1"
                      >
                        {customer.email}
                      </Link>
                      <span className="font-medium text-green-600">
                        £{customer.credit_balance_pounds.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              <select
                value={verifiedFilter}
                onChange={(e) => setVerifiedFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Verification</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>

              <div></div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Showing {filteredCustomers.length} of {customers.length}
                </span>
                <Button variant="outline" onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setVerifiedFilter('all');
                }} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Manage customer accounts and view activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Customer</th>
                  <th className="text-left p-4 font-medium">Contact</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Activity</th>
                  <th className="text-left p-4 font-medium">Referrals</th>
                  <th className="text-left p-4 font-medium">Joined</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium">
                          {customer.full_name ? customer.full_name.split(' ').map(n => n[0]).join('') : customer.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{customer.full_name || 'No name provided'}</div>
                          <div className="text-sm text-gray-600">{customer.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {customer.phone ? (
                          <div className="flex items-center text-gray-600">
                            <Phone className="w-4 h-4 mr-1" />
                            {customer.phone}
                          </div>
                        ) : (
                          <div className="text-gray-400">No phone</div>
                        )}
                        {customer.marketing_consent && (
                          <div className="text-xs text-green-600 mt-1">Marketing OK</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <Badge className={customer.customer_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {customer.customer_status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="text-xs">
                          {customer.email_verified ? (
                            <span className="text-green-600">✓ Verified</span>
                          ) : (
                            <span className="text-red-600">✗ Unverified</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="font-medium">
                          {customer.total_pets} {customer.total_pets === 1 ? 'pet' : 'pets'}
                        </div>
                        <div className="text-gray-600">
                          {customer.total_orders} {customer.total_orders === 1 ? 'order' : 'orders'}
                        </div>
                        {customer.total_orders > 0 && (
                          <div className="text-purple-600 text-xs">Customer</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="font-medium text-blue-600">
                          {(customer as any).referral_scans || 0} scans
                        </div>
                        <div className="text-green-600">
                          {(customer as any).referral_signups || 0} signups
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-600">
                        {formatDate(customer.created_at)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Link href={`/admin/customers/${customer.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleToggleActive(customer.id, customer.customer_status === 'active')}>
                              {customer.customer_status === 'active' ? (
                                <>
                                  <Users className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Pets
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No customers found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}