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
  Settings
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

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets] = useState<PetWithDetails[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<PetWithDetails | null>(null);
  const [showPetModal, setShowPetModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadCustomerDetails();
      loadCustomerPets();
      loadCustomerOrders();
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
        setOrders(data);
      }
    } catch (error) {
      console.error('Error loading customer orders:', error);
      setOrders([]); // Set empty array if API doesn't exist yet
    } finally {
      setOrdersLoading(false);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div>
                              <h3 className="font-medium text-gray-900">Order #{order.id.slice(-8)}</h3>
                              <p className="text-sm text-gray-600">{formatDate(order.order_date)}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
                            <p className="text-sm text-gray-600">{order.items_count} items</p>
                          </div>
                          <Badge className={
                            order.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'processing'
                              ? 'bg-blue-100 text-blue-800'
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
              <CardTitle>Account Activity</CardTitle>
              <CardDescription>Customer account and activity timeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Account created</p>
                    <p className="text-sm text-gray-600">{formatDate(customer.created_at)}</p>
                  </div>
                </div>

                {customer.email_verified && (
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Email verified</p>
                      <p className="text-sm text-gray-600">Customer verified their email address</p>
                    </div>
                  </div>
                )}

                {pets.length > 0 && (
                  <div className="flex items-center space-x-3 p-3 bg-pink-50 rounded-lg">
                    <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                      <Heart className="w-4 h-4 text-pink-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Pets registered</p>
                      <p className="text-sm text-gray-600">{pets.length} pet{pets.length !== 1 ? 's' : ''} added to account</p>
                    </div>
                  </div>
                )}

                {totalOrders > 0 && (
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">First order placed</p>
                      <p className="text-sm text-gray-600">Customer became a paying customer</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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