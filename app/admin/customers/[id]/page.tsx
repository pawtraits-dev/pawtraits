'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  User,
  Users,
  Mail,
  Phone,
  Calendar,
  Heart,
  ShoppingCart,
  MapPin,
  Check,
  X,
  Clock,
  Star,
  Camera,
  UserCheck,
  Settings,
  LogIn,
  Share2,
  Eye,
  CreditCard,
  Gift,
  DollarSign
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Customer, Pet, PetWithDetails } from '@/lib/types';

interface OrderSummary {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
  items_count: number;
}

interface CustomerActivity {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
  metadata?: any;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets] = useState<PetWithDetails[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<PetWithDetails | null>(null);
  const [showPetModal, setShowPetModal] = useState(false);
  const [attributionData, setAttributionData] = useState<{
    total_attributed_customers: number;
    total_attributed_orders: number;
    total_attributed_revenue: number;
    by_level: Array<{ level: number; customers: number; orders: number; revenue: number }>;
    customers: Array<any>;
  } | null>(null);
  const [attributionLoading, setAttributionLoading] = useState(true);
  const [creditsData, setCreditsData] = useState<any>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadCustomerDetails();
      loadCustomerPets();
      loadCustomerOrders();
      loadCustomerActivity();
      loadAttributionData();
      loadCreditsData();
    }
  }, [params.id]);

  const loadCustomerDetails = async () => {
    try {
      const response = await fetch(`/api/admin/customers/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setCustomer(data);
      } else {
        router.push('/admin/customers');
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerPets = async () => {
    try {
      // This would be a new API endpoint for customer pets
      const response = await fetch(`/api/customers/${params.id}/pets`);
      if (response.ok) {
        const data = await response.json();
        setPets(data);
      }
    } catch (error) {
      console.error('Error loading customer pets:', error);
      setPets([]); // Set empty array if API doesn't exist yet
    } finally {
      setPetsLoading(false);
    }
  };

  const loadCustomerOrders = async () => {
    try {
      // This would be a new API endpoint for customer orders
      const response = await fetch(`/api/customers/${params.id}/orders`);
      if (response.ok) {
        const data = await response.json();
        // Transform orders data to match OrderSummary interface
        const transformedOrders = data.map((order: any) => ({
          id: order.id,
          order_date: order.created_at, // Map created_at to order_date
          total_amount: order.total_amount,
          status: order.status,
          items_count: order.order_items ? order.order_items.length : 0
        }));
        setOrders(transformedOrders);
      }
    } catch (error) {
      console.error('Error loading customer orders:', error);
      setOrders([]); // Set empty array if API doesn't exist yet
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadCustomerActivity = async () => {
    try {
      const response = await fetch(`/api/admin/customers/${params.id}/activity`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error loading customer activity:', error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  /**
   * Sort customers in tree order for display
   * Tree order: C1, C1->C2, C1->C2->C3, C1->C4, C5, C5->C6
   * This is a depth-first traversal where we show all descendants before siblings
   */
  const sortCustomersInTreeOrder = (customers: any[]) => {
    if (!customers || customers.length === 0) return [];

    // Build parent -> children mapping based on referral path
    const childrenMap = new Map<string, any[]>();
    const rootCustomers: any[] = [];

    customers.forEach(customer => {
      // Parse referral path to find parent
      // Path format: "CODE1" or "CODE1 → CODE2" or "CODE1 → CODE2 → CODE3"
      const pathParts = customer.referral_path?.split(' → ') || [];

      if (pathParts.length === 1) {
        // Direct referral (level 1) - only has their own code
        rootCustomers.push(customer);
      } else if (pathParts.length > 1) {
        // Multi-level: find parent by looking at second-to-last code in path
        const parentCode = pathParts[pathParts.length - 2];

        // Find parent customer by their personal referral code
        const parent = customers.find(c => c.referral_path?.endsWith(parentCode) && c.customer_id !== customer.customer_id);
        if (parent) {
          if (!childrenMap.has(parent.customer_id)) {
            childrenMap.set(parent.customer_id, []);
          }
          childrenMap.get(parent.customer_id)!.push(customer);
        } else {
          // If parent not found, treat as root
          rootCustomers.push(customer);
        }
      } else {
        // No path or malformed, treat as root
        rootCustomers.push(customer);
      }
    });

    // Depth-first traversal to build sorted list
    const result: any[] = [];
    const traverse = (customer: any) => {
      result.push(customer);
      const children = childrenMap.get(customer.customer_id) || [];
      // Sort children by created date to maintain consistent order
      children.sort((a, b) => {
        const dateA = new Date(a.customer_created_at || 0).getTime();
        const dateB = new Date(b.customer_created_at || 0).getTime();
        return dateA - dateB;
      });
      children.forEach(traverse);
    };

    // Sort root customers by created date
    rootCustomers.sort((a, b) => {
      const dateA = new Date(a.customer_created_at || 0).getTime();
      const dateB = new Date(b.customer_created_at || 0).getTime();
      return dateA - dateB;
    });

    rootCustomers.forEach(traverse);
    return result;
  };

  const loadAttributionData = async () => {
    try {
      console.log('Loading attribution data for customer:', params.id);
      const response = await fetch(`/api/admin/customers/${params.id}/attribution`);
      console.log('Attribution API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Attribution data received:', data);

        // Sort customers in tree order for display
        if (data.customers && data.customers.length > 0) {
          data.customers = sortCustomersInTreeOrder(data.customers);
        }

        setAttributionData(data);
      } else {
        console.error('Attribution API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading attribution data:', error);
    } finally {
      setAttributionLoading(false);
    }
  };

  const loadCreditsData = async () => {
    try {
      console.log('Loading credits data for customer:', params.id);
      const response = await fetch(`/api/admin/customers/${params.id}/credits`);
      console.log('Credits API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Credits data received:', data);
        setCreditsData(data);
      } else {
        console.error('Credits API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading credits data:', error);
    } finally {
      setCreditsLoading(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!customer) return;
    
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        loadCustomerDetails();
      }
    } catch (error) {
      console.error('Error toggling customer status:', error);
    }
  };

  const handlePetClick = (pet: PetWithDetails) => {
    setSelectedPet(pet);
    setShowPetModal(true);
  };

  const formatCurrency = (amountInPence: number) => {
    // Convert pence to pounds
    const amountInPounds = amountInPence / 100;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amountInPounds);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAgeDisplay = (age?: number) => {
    if (!age) return 'Unknown';
    if (age < 1) return `${Math.round(age * 12)} months`;
    return `${age} ${age === 1 ? 'year' : 'years'}`;
  };

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'user': return <User className="w-4 h-4" />;
      case 'check': return <Check className="w-4 h-4" />;
      case 'log-in': return <LogIn className="w-4 h-4" />;
      case 'heart': return <Heart className="w-4 h-4" />;
      case 'share': return <Share2 className="w-4 h-4" />;
      case 'shopping-cart': return <ShoppingCart className="w-4 h-4" />;
      case 'eye': return <Eye className="w-4 h-4" />;
      case 'credit-card': return <CreditCard className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600', 
      purple: 'bg-purple-100 text-purple-600',
      pink: 'bg-pink-100 text-pink-600',
      indigo: 'bg-indigo-100 text-indigo-600',
      orange: 'bg-orange-100 text-orange-600',
      gray: 'bg-gray-100 text-gray-600'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-600';
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

  if (!customer) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Customer Not Found</h1>
          <Link href="/admin/customers">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/customers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
              {customer.first_name && customer.last_name 
                ? customer.first_name.charAt(0) + customer.last_name.charAt(0)
                : customer.email?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email || 'Unknown Customer'}
              </h1>
              <p className="text-gray-600 mt-1">{customer.email}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge className={customer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {customer.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge className={customer.email_verified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}>
            {customer.email_verified ? '✓ Verified' : '⏳ Unverified'}
          </Badge>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleToggleActive(customer.is_active)}
          >
            {customer.is_active ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{pets.length}</p>
                <p className="text-sm text-gray-600">Pets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                <p className="text-sm text-gray-600">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
                <p className="text-sm text-gray-600">Total Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgOrderValue)}</p>
                <p className="text-sm text-gray-600">Avg Order Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pets">Pets ({pets.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({totalOrders})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="attribution">Attribution ({attributionData?.total_attributed_customers || 0})</TabsTrigger>
          <TabsTrigger value="credits">Credits & Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">{customer.email}</p>
                    <p className="text-sm text-gray-600">
                      Email Address {customer.email_verified ? '(Verified)' : '(Not Verified)'}
                    </p>
                  </div>
                </div>
                
                {customer.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">{customer.phone}</p>
                      <p className="text-sm text-gray-600">Phone Number</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">{formatDate(customer.created_at)}</p>
                    <p className="text-sm text-gray-600">Joined Date</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Settings className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">
                      {customer.marketing_consent ? 'Opted In' : 'Opted Out'}
                    </p>
                    <p className="text-sm text-gray-600">Marketing Communications</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      customer.is_active ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {customer.is_active ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Account Status</p>
                      <p className="text-sm text-gray-600">
                        {customer.is_active ? 'Active and can place orders' : 'Inactive - cannot place orders'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      customer.email_verified ? 'bg-blue-100' : 'bg-yellow-100'
                    }`}>
                      {customer.email_verified ? (
                        <Mail className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Email Verification</p>
                      <p className="text-sm text-gray-600">
                        {customer.email_verified ? 'Email address verified' : 'Email verification pending'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      totalOrders > 0 ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <ShoppingCart className={`w-4 h-4 ${totalOrders > 0 ? 'text-green-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium">Customer Status</p>
                      <p className="text-sm text-gray-600">
                        {totalOrders > 0 ? `Active customer with ${totalOrders} orders` : 'No orders placed yet'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer's Pets</CardTitle>
              <CardDescription>
                All pets registered by this customer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {petsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : pets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pets.map((pet) => (
                    <div 
                      key={pet.id} 
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-purple-300"
                      onClick={() => handlePetClick(pet)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                          {pet.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{pet.name}</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            {pet.breed_name && (
                              <p>Breed: {pet.breed_name}</p>
                            )}
                            {pet.coat_name && (
                              <div className="flex items-center space-x-2">
                                <span>Coat:</span>
                                <div className="flex items-center space-x-1">
                                  {pet.coat_hex_color && (
                                    <div 
                                      className="w-3 h-3 rounded-full border border-gray-300"
                                      style={{ backgroundColor: pet.coat_hex_color }}
                                    ></div>
                                  )}
                                  <span>{pet.coat_name}</span>
                                </div>
                              </div>
                            )}
                            {pet.age && (
                              <p>Age: {getAgeDisplay(pet.age)}</p>
                            )}
                            {pet.gender && (
                              <p>Gender: {pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1)}</p>
                            )}
                            {pet.weight && (
                              <p>Weight: {pet.weight} lbs</p>
                            )}
                            {pet.is_spayed_neutered !== undefined && (
                              <p>Spayed/Neutered: {pet.is_spayed_neutered ? 'Yes' : 'No'}</p>
                            )}
                          </div>
                          {pet.special_notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{pet.special_notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No pets registered yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>
                All orders placed by this customer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div>
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                Order #{order.order_number || order.id.slice(-8)}
                              </Link>
                              <p className="text-sm text-gray-600">{formatDate(order.order_date)}</p>
                              {order.payment_status && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Payment: {order.payment_status}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
                            <p className="text-sm text-gray-600">{order.items_count} items</p>
                            {order.subtotal_amount && order.subtotal_amount !== order.total_amount && (
                              <p className="text-xs text-green-600">
                                Subtotal: {formatCurrency(order.subtotal_amount)}
                              </p>
                            )}
                          </div>
                          <Badge className={
                            order.status === 'completed' || order.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'processing' || order.status === 'pending'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No orders placed yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Activity Timeline</CardTitle>
              <CardDescription>
                Comprehensive activity history including logins, interactions, and purchases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activities.map((activity, index) => (
                    <div key={`${activity.type}-${activity.timestamp}-${index}`} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColorClasses(activity.color)}`}>
                        {getActivityIcon(activity.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{activity.title}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleDateString('en-GB', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600">{activity.description}</p>
                        {activity.metadata && (
                          <div className="mt-2">
                            {activity.metadata.imageId && (
                              <Badge variant="outline" className="text-xs">
                                Image: {activity.metadata.imageId.slice(-8)}
                              </Badge>
                            )}
                            {activity.metadata.platform && (
                              <Badge variant="outline" className="text-xs ml-2">
                                {activity.metadata.platform}
                              </Badge>
                            )}
                            {activity.metadata.itemCount && (
                              <Badge variant="outline" className="text-xs ml-2">
                                {activity.metadata.itemCount} items
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attribution" className="space-y-6">
          {!attributionLoading && attributionData && attributionData.total_attributed_customers > 0 && (
            <div className="space-y-6">
              {/* Attribution Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Attributed Customers</p>
                        <p className="text-2xl font-bold text-gray-900">{attributionData.total_attributed_customers}</p>
                      </div>
                      <div className="p-3 bg-indigo-100 rounded-lg">
                        <Users className="w-6 h-6 text-indigo-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                        <p className="text-2xl font-bold text-gray-900">{attributionData.total_attributed_orders}</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-lg">
                        <ShoppingCart className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1" title="Total revenue from all attributed customers">Attr. Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(attributionData.total_attributed_revenue)}</p>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <CreditCard className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Attribution Customer List */}
              {attributionData.customers && attributionData.customers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Attributed Customers</CardTitle>
                    <CardDescription>
                      All customers in the referral chain with their order metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-gray-700">Email</th>
                            <th className="text-left p-3 font-medium text-gray-700">Level</th>
                            <th className="text-left p-3 font-medium text-gray-700">
                              <div>Direct Orders</div>
                              <div className="text-xs font-normal text-gray-500">(Customer Only)</div>
                            </th>
                            <th className="text-left p-3 font-medium text-gray-700">
                              <div>Chain Orders</div>
                              <div className="text-xs font-normal text-gray-500">(Referrals)</div>
                            </th>
                            <th className="text-left p-3 font-medium text-gray-700">
                              <div>Total Orders</div>
                              <div className="text-xs font-normal text-gray-500">(Direct + Chain)</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {attributionData.customers.map((cust: any, index: number) => {
                            const indentLevel = Math.max(0, cust.referral_level - 1);
                            const indentPx = indentLevel * 24;

                            // Calculate chain totals
                            let chainOrders = 0;
                            let chainRevenue = 0;

                            const findDescendants = (parentEmail: string) => {
                              attributionData.customers.forEach((c: any, idx: number) => {
                                if (idx > index) {
                                  const pathParts = c.referral_path?.split(' → ') || [];
                                  if (pathParts.includes(parentEmail)) {
                                    chainOrders += (c.order_count || 0);
                                    chainRevenue += (c.total_revenue || 0);
                                  }
                                }
                              });
                            };

                            findDescendants(cust.customer_email);

                            const directOrders = cust.order_count || 0;
                            const directRevenue = cust.total_revenue || 0;
                            const totalOrders = directOrders + chainOrders;
                            const totalRevenue = directRevenue + chainRevenue;

                            return (
                              <tr key={cust.customer_id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                  <div style={{ paddingLeft: `${indentPx}px` }} className="flex items-center gap-2">
                                    {indentLevel > 0 && (
                                      <span className="text-gray-400 text-xs">
                                        {'└─ '}
                                      </span>
                                    )}
                                    <Link
                                      href={`/admin/customers/${cust.customer_id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {cust.customer_email}
                                    </Link>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge className="bg-indigo-100 text-indigo-800">
                                    L{cust.referral_level}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    <div className="font-medium">{directOrders} orders</div>
                                    <div className="text-gray-600">{formatCurrency(directRevenue)}</div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    <div className="font-medium text-indigo-600">{chainOrders} orders</div>
                                    <div className="text-indigo-600">{formatCurrency(chainRevenue)}</div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    <div className="font-bold">{totalOrders} orders</div>
                                    <div className="font-semibold text-green-600">{formatCurrency(totalRevenue)}</div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {(!attributionData || attributionData.total_attributed_customers === 0) && !attributionLoading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No attributed customers found</p>
                <p className="text-sm text-gray-500 mt-2">
                  This customer has not referred anyone yet
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Credits & Rewards Tab */}
        <TabsContent value="credits" className="space-y-6">
          {creditsLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading credits data...</p>
              </CardContent>
            </Card>
          ) : creditsData ? (
            <div className="space-y-6">
              {/* Credit Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                        <p className="text-2xl font-bold text-blue-600">£{creditsData.summary.current_balance_pounds.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <DollarSign className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Earned</p>
                        <p className="text-2xl font-bold text-green-600">£{creditsData.summary.total_earned_pounds.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Gift className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Pending Credits</p>
                        <p className="text-2xl font-bold text-orange-600">£{creditsData.summary.pending_credits_pounds.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-orange-100 rounded-lg">
                        <Clock className="w-6 h-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Redeemed</p>
                        <p className="text-2xl font-bold text-purple-600">£{creditsData.summary.total_redeemed_pounds.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <ShoppingCart className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Earned Credits Table */}
              {creditsData.earned_credits && creditsData.earned_credits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Earned Credits</CardTitle>
                    <CardDescription>
                      Credits earned from customer referrals (10% of referred customer orders)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-gray-700">Date Earned</th>
                            <th className="text-left p-3 font-medium text-gray-700">Order</th>
                            <th className="text-left p-3 font-medium text-gray-700">Referred Customer</th>
                            <th className="text-right p-3 font-medium text-gray-700">Order Amount</th>
                            <th className="text-right p-3 font-medium text-gray-700">Credit Earned</th>
                            <th className="text-left p-3 font-medium text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditsData.earned_credits.map((credit: any) => (
                            <tr key={credit.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 text-sm">
                                {new Date(credit.earned_date).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-sm">
                                <Link
                                  href={`/admin/financial/orders/${credit.order_id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {credit.order_number}
                                </Link>
                              </td>
                              <td className="p-3 text-sm">{credit.referred_customer_email}</td>
                              <td className="p-3 text-sm text-right">£{credit.order_amount_pounds.toFixed(2)}</td>
                              <td className="p-3 text-sm text-right font-medium text-green-600">
                                £{credit.credit_amount_pounds.toFixed(2)}
                              </td>
                              <td className="p-3">
                                <Badge variant={
                                  credit.status === 'approved' || credit.status === 'paid' ? 'default' :
                                  credit.status === 'pending' ? 'secondary' : 'outline'
                                }>
                                  {credit.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Redemption History Table */}
              {creditsData.redemptions && creditsData.redemptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Redemption History</CardTitle>
                    <CardDescription>
                      Credits redeemed on orders
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-gray-700">Date Redeemed</th>
                            <th className="text-left p-3 font-medium text-gray-700">Order</th>
                            <th className="text-right p-3 font-medium text-gray-700">Order Total</th>
                            <th className="text-right p-3 font-medium text-gray-700">Credits Used</th>
                            <th className="text-right p-3 font-medium text-gray-700">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditsData.redemptions.map((redemption: any) => (
                            <tr key={redemption.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 text-sm">
                                {new Date(redemption.redeemed_date).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-sm">
                                <Link
                                  href={`/admin/financial/orders/${redemption.id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {redemption.order_number}
                                </Link>
                              </td>
                              <td className="p-3 text-sm text-right">£{redemption.order_total_pounds.toFixed(2)}</td>
                              <td className="p-3 text-sm text-right font-medium text-orange-600">
                                -£{redemption.credit_used_pounds.toFixed(2)}
                              </td>
                              <td className="p-3 text-sm text-right font-medium text-green-600">
                                £{redemption.amount_paid_pounds.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No Activity State */}
              {(!creditsData.earned_credits || creditsData.earned_credits.length === 0) &&
               (!creditsData.redemptions || creditsData.redemptions.length === 0) && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No credit activity yet</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Credits will appear here when this customer refers friends who make purchases
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Unable to load credits data</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Pet Detail Modal */}
      <Dialog open={showPetModal} onOpenChange={setShowPetModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                {selectedPet?.name.charAt(0)}
              </div>
              <span>{selectedPet?.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPet && (
            <div className="space-y-6">
              {/* Pet Photos Section */}
              {selectedPet.photo_urls && selectedPet.photo_urls.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Photos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedPet.photo_urls.map((photoUrl, index) => (
                      <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img 
                          src={photoUrl} 
                          alt={`${selectedPet.name} photo ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(photoUrl, '_blank')}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedPet.primary_photo_url ? (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Photo</h3>
                  <div className="aspect-square max-w-md rounded-lg overflow-hidden bg-gray-100">
                    <img 
                      src={selectedPet.primary_photo_url} 
                      alt={`${selectedPet.name} photo`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => window.open(selectedPet.primary_photo_url!, '_blank')}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No photos uploaded yet</p>
                </div>
              )}

              {/* Pet Details Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Pet Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {selectedPet.breed_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Breed:</span>
                        <span className="font-medium">{selectedPet.breed_name}</span>
                      </div>
                    )}
                    
                    {selectedPet.coat_name && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Coat:</span>
                        <div className="flex items-center space-x-2">
                          {selectedPet.coat_hex_color && (
                            <div 
                              className="w-4 h-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: selectedPet.coat_hex_color }}
                            ></div>
                          )}
                          <span className="font-medium">{selectedPet.coat_name}</span>
                        </div>
                      </div>
                    )}
                    
                    {selectedPet.gender && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gender:</span>
                        <span className="font-medium">{selectedPet.gender.charAt(0).toUpperCase() + selectedPet.gender.slice(1)}</span>
                      </div>
                    )}
                    
                    {selectedPet.age && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age:</span>
                        <span className="font-medium">{getAgeDisplay(selectedPet.age)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {selectedPet.weight && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Weight:</span>
                        <span className="font-medium">{selectedPet.weight} lbs</span>
                      </div>
                    )}
                    
                    {selectedPet.is_spayed_neutered !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Spayed/Neutered:</span>
                        <span className="font-medium">{selectedPet.is_spayed_neutered ? 'Yes' : 'No'}</span>
                      </div>
                    )}
                    
                    {selectedPet.created_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Added:</span>
                        <span className="font-medium">{formatDate(selectedPet.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personality Traits */}
              {selectedPet.personality_traits && selectedPet.personality_traits.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Personality Traits</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPet.personality_traits.map((trait, index) => (
                      <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Notes */}
              {selectedPet.special_notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Special Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 italic">"{selectedPet.special_notes}"</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}