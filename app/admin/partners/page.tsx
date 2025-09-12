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
  Check, 
  X, 
  Pause, 
  Play, 
  MoreHorizontal,
  Calendar,
  DollarSign,
  Users,
  TrendingUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminPartnerOverview } from '@/lib/types';

const approvalStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-800'
};

const businessTypeLabels = {
  groomer: '✂️ Groomer',
  vet: '🏥 Veterinarian', 
  breeder: '🐕 Breeder',
  salon: '💅 Pet Salon',
  mobile: '🚐 Mobile Service',
  independent: '⭐ Independent',
  chain: '🏢 Chain/Franchise'
};

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<AdminPartnerOverview[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<AdminPartnerOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [businessTypeFilter, setBusinessTypeFilter] = useState('all');

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    filterPartners();
  }, [partners, searchTerm, statusFilter, businessTypeFilter]);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/partners');
      if (response.ok) {
        const data = await response.json();
        setPartners(data);
      }
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPartners = () => {
    let filtered = partners;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(partner => 
        partner.full_name.toLowerCase().includes(term) ||
        partner.email.toLowerCase().includes(term) ||
        partner.business_name?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(partner => partner.approval_status === statusFilter);
    }

    if (businessTypeFilter !== 'all') {
      filtered = filtered.filter(partner => partner.business_type === businessTypeFilter);
    }

    setFilteredPartners(filtered);
  };

  const handleStatusChange = async (partnerId: string, newStatus: string, reason?: string) => {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          approval_status: newStatus,
          rejection_reason: reason 
        })
      });

      if (response.ok) {
        loadPartners(); // Reload data
      }
    } catch (error) {
      console.error('Error updating partner status:', error);
    }
  };

  const handleToggleActive = async (partnerId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        loadPartners();
      }
    } catch (error) {
      console.error('Error toggling partner status:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getConversionRate = (total: number, successful: number) => {
    return total > 0 ? ((successful / total) * 100).toFixed(1) : '0';
  };

  const stats = {
    total: partners.length,
    pending: partners.filter(p => p.approval_status === 'pending').length,
    approved: partners.filter(p => p.approval_status === 'approved').length,
    active: partners.filter((p: any) => p.is_active).length,
    total_commissions: partners.reduce((sum: number, p: any) => sum + (p.total_commissions || 0), 0),
    unpaid_commissions: partners.reduce((sum: number, p: any) => sum + (p.unpaid_commissions || 0), 0)
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
        <h1 className="text-3xl font-bold text-gray-900">Partner Management</h1>
        <p className="text-gray-600 mt-2">Manage B2B partners, approvals, and monitor performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-sm text-gray-600">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
                <p className="text-sm text-gray-600">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
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
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_commissions)}</p>
                <p className="text-sm text-gray-600">Total Commissions</p>
                {stats.unpaid_commissions > 0 && (
                  <p className="text-xs text-orange-600">{formatCurrency(stats.unpaid_commissions)} unpaid</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search partners by name, email, or business..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </select>

              <select
                value={businessTypeFilter}
                onChange={(e) => setBusinessTypeFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Business Types</option>
                {Object.entries(businessTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Showing {filteredPartners.length} of {partners.length}
                </span>
                <Button variant="outline" onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setBusinessTypeFilter('all');
                }} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Partners</CardTitle>
          <CardDescription>Manage partner accounts and approvals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Partner</th>
                  <th className="text-left p-4 font-medium">Business</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Performance</th>
                  <th className="text-left p-4 font-medium">Joined</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{partner.full_name}</div>
                        <div className="text-sm text-gray-600">{partner.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{partner.business_name || 'N/A'}</div>
                        <div className="text-sm text-gray-600">
                          {partner.business_type ? businessTypeLabels[partner.business_type as keyof typeof businessTypeLabels] : 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <Badge className={approvalStatusColors[partner.approval_status as keyof typeof approvalStatusColors]}>
                          {partner.approval_status.charAt(0).toUpperCase() + partner.approval_status.slice(1)}
                        </Badge>
                        {partner.is_active ? (
                          <div className="text-xs text-green-600">Active</div>
                        ) : (
                          <div className="text-xs text-gray-500">Inactive</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="font-medium">{partner.total_referrals} referrals</div>
                        <div className="text-gray-600">
                          {partner.successful_referrals} successful ({getConversionRate(partner.total_referrals, partner.successful_referrals)}%)
                        </div>
                        <div className="text-purple-600 font-medium">
                          {formatCurrency(partner.total_commissions)} total
                        </div>
                        {partner.unpaid_commissions > 0 && (
                          <div className="text-orange-600 text-xs">
                            {formatCurrency(partner.unpaid_commissions)} unpaid
                          </div>
                        )}
                        {partner.paid_commissions > 0 && (
                          <div className="text-green-600 text-xs">
                            {formatCurrency(partner.paid_commissions)} paid
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{formatDate(partner.created_at)}</div>
                        {partner.last_login_at && (
                          <div className="text-gray-600">
                            Last: {formatDate(partner.last_login_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Link href={`/admin/partners/${partner.id}`}>
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
                            {partner.approval_status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleStatusChange(partner.id, 'approved')}>
                                  <Check className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const reason = prompt('Rejection reason:');
                                  if (reason) handleStatusChange(partner.id, 'rejected', reason);
                                }}>
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {partner.approval_status === 'approved' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(partner.id, 'suspended')}>
                                <Pause className="w-4 h-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            {partner.approval_status === 'suspended' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(partner.id, 'approved')}>
                                <Play className="w-4 h-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleToggleActive(partner.id, partner.is_active)}>
                              {partner.is_active ? (
                                <>
                                  <Pause className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
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

          {filteredPartners.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No partners found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}