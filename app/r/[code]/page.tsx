'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Star, Gift, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ReferralData {
  id: string;
  referral_code: string;
  client_name: string;
  status: string;
  commission_rate: number;
  expires_at: string;
  referral_type?: string; // 'traditional' or 'image_share'
  image_id?: string; // For Method 2 image sharing
  client_notes?: string;
  partner: {
    first_name: string;
    last_name: string;
    business_name?: string;
    business_type?: string;
    avatar_url?: string;
  };
  image?: {
    id: string;
    filename: string;
    description?: string;
    public_url: string;
    breed_name?: string;
    theme_name?: string;
    style_name?: string;
  };
}

export default function ReferralLandingPage() {
  const params = useParams();
  const code = params.code as string;
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (code) {
      loadReferral();
    }
  }, [code]);

  const loadReferral = async () => {
    try {
      setLoading(true);

      // First try partner referrals
      let response = await fetch(`/api/referrals/code/${code}`);

      if (response.ok) {
        const data = await response.json();
        setReferral(data);

        // Track page view for partner referrals
        await fetch(`/api/referrals/${data.id}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'page_view' })
        });
      } else if (response.status === 404) {
        // If partner referral not found, try customer referrals
        const customerResponse = await fetch(`/api/customer-referrals/verify/${code}`);

        if (customerResponse.ok) {
          const customerData = await customerResponse.json();

          // Convert customer data to referral format
          setReferral({
            id: customerData.referral.id,
            referral_code: customerData.referral.referral_code,
            client_name: customerData.referral.customer_name,
            status: customerData.referral.status,
            commission_rate: 0,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
            referral_type: 'customer',
            partner: {
              first_name: customerData.referral.customer_name.split(' ')[0] || 'Customer',
              last_name: customerData.referral.customer_name.split(' ')[1] || 'Friend',
              business_name: 'Pawtraits Customer'
            }
          });
        } else {
          setError('Referral code not found or expired');
        }
      } else {
        setError('Failed to load referral');
      }
    } catch (err) {
      setError('Failed to load referral');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDiscount = async () => {
    if (!referral) return;

    try {
      // Track claim event differently for customer vs partner referrals
      if (referral.referral_type === 'customer') {
        // Track customer referral click
        await fetch(`/api/referrals/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referral_code: referral.referral_code,
            action: 'click',
            platform: 'web'
          })
        });
      } else {
        // Track partner referral event
        await fetch(`/api/referrals/${referral.id}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'link_click' })
        });
      }

      setClaimed(true);

      // Redirect based on referral type
      setTimeout(() => {
        if (referral.referral_type === 'customer') {
          // Customer referral: Redirect to signup with customer code
          window.location.href = `/signup/user?ref=${code}&discount=20&type=customer`;
        } else if (referral.referral_type === 'influencer') {
          // Influencer referral: Redirect to signup with influencer code
          window.location.href = `/signup/user?ref=${code}&discount=20&type=influencer`;
        } else if (referral.referral_type === 'image_share' && referral.image_id) {
          // Partner Method 2: Redirect to shop page for the specific image
          window.location.href = `/shop/${referral.image_id}?ref=${code}&discount=20`;
        } else {
          // Partner Method 1: Traditional signup flow
          window.location.href = `/signup/user?ref=${code}&discount=20`;
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to track claim:', err);
      // Still redirect even if tracking fails
      if (referral.referral_type === 'customer') {
        window.location.href = `/signup/user?ref=${code}&discount=20&type=customer`;
      } else if (referral.referral_type === 'influencer') {
        window.location.href = `/signup/user?ref=${code}&discount=20&type=influencer`;
      } else if (referral.referral_type === 'image_share' && referral.image_id) {
        window.location.href = `/shop/${referral.image_id}?ref=${code}&discount=20`;
      } else {
        window.location.href = `/signup/user?ref=${code}&discount=20`;
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Oops!</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!referral) {
    return null;
  }

  const isExpired = new Date(referral.expires_at) < new Date();
  const daysLeft = Math.ceil((new Date(referral.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  if (claimed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Discount Claimed!</h1>
            <p className="text-gray-600 mb-6">
              {referral.referral_type === 'image_share' 
                ? "You're being redirected to purchase this portrait style with 20% off!"
                : "You're being redirected to create your custom pet portrait with 20% off!"
              }
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-10 h-10 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 You've Been Invited!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {referral.referral_type === 'customer'
              ? `${referral.partner.first_name} ${referral.partner.last_name} wants to share something special with you - get 20% off your first AI pet portrait!`
              : referral.referral_type === 'influencer'
              ? `${referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`} is sharing their favorite pet portrait service with you!`
              : `${referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`} wants to treat you to a custom AI pet portrait`
            }
          </p>
        </div>

        {referral.referral_type === 'image_share' && referral.image ? (
          // Method 2: Image sharing layout with 3 cards
          <div className="space-y-8">
            {/* Featured Image */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Your Recommended Portrait Style
                </h3>
                <div className="max-w-sm mx-auto">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                    <Image
                      src={referral.image.public_url}
                      alt={referral.image.description || 'Pet portrait style'}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-gray-700 mb-2">{referral.image.description}</p>
                  <div className="flex justify-center space-x-2">
                    {referral.image.breed_name && (
                      <Badge variant="outline" className="text-xs">{referral.image.breed_name}</Badge>
                    )}
                    {referral.image.theme_name && (
                      <Badge variant="outline" className="text-xs">{referral.image.theme_name}</Badge>
                    )}
                    {referral.image.style_name && (
                      <Badge variant="outline" className="text-xs">{referral.image.style_name}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Discount Card */}
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-purple-900 mb-2">20% OFF</h2>
                  <p className="text-lg text-purple-700 mb-6">This Portrait Style</p>
                  
                  {isExpired ? (
                    <div className="space-y-4">
                      <Badge variant="destructive" className="text-sm px-4 py-2">
                        Expired on {new Date(referral.expires_at).toLocaleDateString()}
                      </Badge>
                      <p className="text-gray-600">This referral has expired. Contact your groomer for a new one!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Badge variant="secondary" className="text-sm px-4 py-2">
                        {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                      </Badge>
                      <Button 
                        onClick={handleClaimDiscount}
                        size="lg" 
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        Get This Style 🎉
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Partner Info Card */}
              <Card>
                <CardContent className="p-8">
                  <div className="flex items-center space-x-4 mb-6">
                    {referral.partner.avatar_url ? (
                      <Image
                        src={referral.partner.avatar_url}
                        alt={referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`}
                        width={64}
                        height={64}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 text-xl font-bold">
                          {referral.partner.first_name[0]}{referral.partner.last_name[0]}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`}
                      </h3>
                      {referral.partner.business_type && (
                        <p className="text-gray-600 capitalize">{referral.partner.business_type}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">What You Get:</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>Professional AI-generated pet portrait</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>Multiple artistic styles to choose from</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>High-resolution files for printing</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>Perfect for gifts and keepsakes</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Method 1: Traditional layout with 2 cards
          <div className="grid md:grid-cols-2 gap-8">
            {/* Discount Card */}
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-3xl font-bold text-purple-900 mb-2">20% OFF</h2>
                <p className="text-lg text-purple-700 mb-6">Your First Custom Pet Portrait</p>
                
                {isExpired ? (
                  <div className="space-y-4">
                    <Badge variant="destructive" className="text-sm px-4 py-2">
                      Expired on {new Date(referral.expires_at).toLocaleDateString()}
                    </Badge>
                    <p className="text-gray-600">This referral has expired. Contact your groomer for a new one!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Badge variant="secondary" className="text-sm px-4 py-2">
                      {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                    </Badge>
                    <Button 
                      onClick={handleClaimDiscount}
                      size="lg" 
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      Claim My 20% Discount 🎉
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Partner Info Card */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center space-x-4 mb-6">
                  {referral.partner.avatar_url ? (
                    <Image
                      src={referral.partner.avatar_url}
                      alt={referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`}
                      width={64}
                      height={64}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-xl font-bold">
                        {referral.partner.first_name[0]}{referral.partner.last_name[0]}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`}
                    </h3>
                    {referral.partner.business_type && (
                      <p className="text-gray-600 capitalize">{referral.partner.business_type}</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">What You Get:</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>Professional AI-generated pet portrait</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>Multiple artistic styles to choose from</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>High-resolution files for printing</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>Perfect for gifts and keepsakes</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Portfolio Preview */}
        <Card>
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              ✨ See What We Can Create
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Sample portraits - you can replace with real examples */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Sample {i}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-gray-600 mt-6">
              Custom portraits created for happy customers
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Questions? Contact {referral.partner.business_name || `${referral.partner.first_name} ${referral.partner.last_name}`} directly.</p>
          <p className="mt-2">
            <Link href="/" className="hover:text-gray-700 underline">
              Learn more about Pawtraits
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}