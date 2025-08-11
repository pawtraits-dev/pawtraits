'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Users, Shield, ShoppingBag, Sparkles, Heart } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { SupabaseService } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const supabase = getSupabaseClient();
  const supabaseService = new SupabaseService();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Get user profile to determine user type
        const profile = await supabaseService.getCurrentUserProfile();
        setUserProfile(profile);
        
        if (profile) {
          // Redirect based on user type
          switch (profile.user_type) {
            case 'admin':
              router.push('/admin');
              return;
            case 'partner':
              router.push('/partners/shop');
              return;
            case 'customer':
              router.push('/customer/shop');
              return;
            default:
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // If user is logged in but no profile found, show profile setup
  if (user && !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Setup Required</h2>
                <p className="text-gray-600 mb-4">
                  Your account needs to be set up. Please contact support or sign up again.
                </p>
                <div className="space-x-4">
                  <Button onClick={() => router.push('/auth/login')} variant="outline">
                    Sign In Again
                  </Button>
                  <Button onClick={() => supabase.auth.signOut()} variant="outline">
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show landing page for non-logged in users
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">PawTraits</h1>
            </div>
            <div className="space-x-4">
              <Button 
                variant="outline" 
                onClick={() => router.push('/auth/login')}
              >
                Sign In
              </Button>
              <Button 
                onClick={() => router.push('/shop')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Browse Gallery
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Generated Pet Portraits
            <span className="block text-purple-600">Made with Love</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform your beloved pets into stunning, personalized artworks using cutting-edge AI technology. 
            Perfect for gifts, memorials, or just celebrating your furry family members.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Button 
              size="lg"
              onClick={() => router.push('/shop')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Heart className="w-5 h-5 mr-2" />
              Explore Gallery
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => router.push('/signup/user')}
            >
              Create Account
            </Button>
          </div>
        </div>

        {/* User Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Customer Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/customer/shop')}>
            <CardHeader className="text-center">
              <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Pet Owners</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Browse our gallery and order custom AI portraits of your beloved pets. 
                Choose from hundreds of styles, themes, and formats.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/signup/user');
                }}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* Partner Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/partners/shop')}>
            <CardHeader className="text-center">
              <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">Business Partners</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Veterinarians, groomers, and pet businesses - earn commissions by 
                recommending our portraits to your clients.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/signup/partner');
                }}
              >
                Join as Partner
              </Button>
            </CardContent>
          </Card>

          {/* Admin Card - Only show if user is admin */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Administration</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                System administration, analytics, and content management. 
                Access restricted to authorized personnel.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => router.push('/auth/login')}
              >
                Admin Login
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">Why Choose PawTraits?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">AI-Powered</h3>
              <p className="text-sm text-gray-600">Latest AI technology creates stunning, unique portraits</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Pet-Focused</h3>
              <p className="text-sm text-gray-600">Specialized in capturing the essence of your beloved pets</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Partner Network</h3>
              <p className="text-sm text-gray-600">Trusted by veterinarians and pet professionals</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold mb-2">Multiple Formats</h3>
              <p className="text-sm text-gray-600">Canvas, prints, digital downloads, and more</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold">PawTraits</span>
          </div>
          <p className="text-gray-400">
            © 2024 PawTraits. Creating beautiful memories of your beloved pets.
          </p>
        </div>
      </footer>
    </div>
  );
}