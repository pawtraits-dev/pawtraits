'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Heart, 
  Share2, 
  ShoppingCart, 
  Star, 
  Sparkles, 
  ArrowRight,
  Quote,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';

interface GalleryImage {
  id: string;
  filename: string;
  public_url: string;
  prompt_text: string;
  description: string;
  tags: string[];
  breed_id?: string;
  theme_id?: string;
  style_id?: string;
  format_id?: string;
  rating?: number;
  is_featured: boolean;
  created_at: string;
  breed?: {
    id: string;
    name: string;
  };
  theme?: {
    id: string;
    name: string;
  };
  style?: {
    id: string;
    name: string;
  };
}

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  date: string;
  pet_name?: string;
  image_url?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [reviews] = useState<Review[]>([
    {
      id: '1',
      customer_name: 'Sarah M.',
      rating: 5,
      comment: 'Absolutely stunning! The AI captured my golden retriever Max perfectly. The quality is incredible and it now hangs proudly in our living room.',
      date: '2024-03-15',
      pet_name: 'Max',
      image_url: '/api/placeholder/200/200'
    },
    {
      id: '2', 
      customer_name: 'James L.',
      rating: 5,
      comment: 'I was skeptical about AI art, but this exceeded all expectations. My cat Luna looks majestic in the Renaissance style portrait!',
      date: '2024-03-10',
      pet_name: 'Luna',
      image_url: '/api/placeholder/200/200'
    },
    {
      id: '3',
      customer_name: 'Maria G.',
      rating: 5,
      comment: 'Perfect memorial piece for our beloved rescue dog Charlie. The team was incredibly thoughtful and the result brought tears to our eyes.',
      date: '2024-03-08',
      pet_name: 'Charlie',
      image_url: '/api/placeholder/200/200'
    },
    {
      id: '4',
      customer_name: 'David R.',
      rating: 5,
      comment: 'Amazing quality and fast delivery! My German Shepherd looks like royalty in the portrait. Highly recommend!',
      date: '2024-03-05',
      pet_name: 'Rex',
      image_url: '/api/placeholder/200/200'
    }
  ]);
  const [currentReview, setCurrentReview] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const supabase = getSupabaseClient();
  const supabaseService = new SupabaseService();

  useEffect(() => {
    checkUser();
    loadGalleryImages();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const profile = await supabaseService.getCurrentUserProfile();
        
        if (profile) {
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
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGalleryImages = async () => {
    try {
      const response = await fetch('/api/gallery/images');
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading gallery images:', error);
    }
  };

  const nextReview = () => {
    setCurrentReview((prev) => (prev + 1) % reviews.length);
  };

  const prevReview = () => {
    setCurrentReview((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  // Filter images by category
  const popularImages = images.filter(img => img.rating && img.rating >= 4.5).slice(0, 6);
  const newImages = images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  const featuredImages = images.filter(img => img.is_featured).slice(0, 6);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-margarine)]">PawTraits</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8 font-[family-name:var(--font-margarine)] text-lg">
              <Link href="/dogs" className="text-gray-700 hover:text-purple-600 transition-colors">
                Dogs
              </Link>
              <Link href="/cats" className="text-gray-700 hover:text-purple-600 transition-colors">
                Cats
              </Link>
              <button onClick={() => scrollToSection('reviews')} className="text-gray-700 hover:text-purple-600 transition-colors">
                Reviews
              </button>
              <Link href="/themes" className="text-gray-700 hover:text-purple-600 transition-colors">
                Themes
              </Link>
              <button onClick={() => scrollToSection('about')} className="text-gray-700 hover:text-purple-600 transition-colors">
                About
              </button>
              <button onClick={() => scrollToSection('signup')} className="text-gray-700 hover:text-purple-600 transition-colors">
                Sign Up
              </button>
              <Link href="/cart" className="relative">
                <ShoppingCart className="w-6 h-6 text-gray-700 hover:text-purple-600 transition-colors" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t bg-white">
              <div className="px-2 pt-2 pb-3 space-y-1 font-[family-name:var(--font-margarine)]">
                <Link href="/dogs" className="block px-3 py-2 text-gray-700 hover:text-purple-600">Dogs</Link>
                <Link href="/cats" className="block px-3 py-2 text-gray-700 hover:text-purple-600">Cats</Link>
                <button onClick={() => scrollToSection('reviews')} className="block px-3 py-2 text-gray-700 hover:text-purple-600 w-full text-left">Reviews</button>
                <Link href="/themes" className="block px-3 py-2 text-gray-700 hover:text-purple-600">Themes</Link>
                <button onClick={() => scrollToSection('about')} className="block px-3 py-2 text-gray-700 hover:text-purple-600 w-full text-left">About</button>
                <button onClick={() => scrollToSection('signup')} className="block px-3 py-2 text-gray-700 hover:text-purple-600 w-full text-left">Sign Up</button>
                <Link href="/cart" className="block px-3 py-2 text-gray-700 hover:text-purple-600">Basket</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI-Generated Pet Portraits
              <span className="block text-purple-600 font-[family-name:var(--font-margarine)]">Made with Love</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your beloved pets into stunning, personalized artworks using cutting-edge AI technology. 
              Perfect for gifts, memorials, or just celebrating your furry family members.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                onClick={() => router.push('/customer/shop')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Heart className="w-5 h-5 mr-2" />
                Start Creating
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => scrollToSection('gallery')}
              >
                View Gallery
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              Discover Amazing Pet Portraits
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our collection of AI-generated pet portraits in various styles and themes
            </p>
          </div>

          <Tabs defaultValue="popular" className="space-y-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="popular" className="font-[family-name:var(--font-margarine)]">
                Popular ({popularImages.length})
              </TabsTrigger>
              <TabsTrigger value="new" className="font-[family-name:var(--font-margarine)]">
                New ({newImages.length})
              </TabsTrigger>
              <TabsTrigger value="featured" className="font-[family-name:var(--font-margarine)]">
                Featured ({featuredImages.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="popular" className="space-y-6">
              {popularImages.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Popular images coming soon...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularImages.map((image) => (
                    <Card key={image.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                      <div className="relative aspect-square">
                        <CatalogImage
                          imageId={image.id}
                          alt={image.prompt_text}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Star className="w-3 h-3 mr-1" />
                            Popular
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{image.prompt_text}</h3>
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1">
                            {image.breed && (
                              <Badge variant="outline" className="text-xs">{image.breed.name}</Badge>
                            )}
                            {image.style && (
                              <Badge variant="outline" className="text-xs">{image.style.name}</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Heart className="w-4 h-4 text-gray-400" />
                            <Share2 className="w-4 h-4 text-gray-400" />
                            <ShoppingCart className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-6">
              {newImages.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">New images coming soon...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {newImages.map((image) => (
                    <Card key={image.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                      <div className="relative aspect-square">
                        <CatalogImage
                          imageId={image.id}
                          alt={image.prompt_text}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-green-100 text-green-800">
                            <Sparkles className="w-3 h-3 mr-1" />
                            New
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{image.prompt_text}</h3>
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1">
                            {image.breed && (
                              <Badge variant="outline" className="text-xs">{image.breed.name}</Badge>
                            )}
                            {image.style && (
                              <Badge variant="outline" className="text-xs">{image.style.name}</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Heart className="w-4 h-4 text-gray-400" />
                            <Share2 className="w-4 h-4 text-gray-400" />
                            <ShoppingCart className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="featured" className="space-y-6">
              {featuredImages.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Featured images coming soon...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredImages.map((image) => (
                    <Card key={image.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                      <div className="relative aspect-square">
                        <CatalogImage
                          imageId={image.id}
                          alt={image.prompt_text}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-purple-100 text-purple-800">
                            <Star className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{image.prompt_text}</h3>
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1">
                            {image.breed && (
                              <Badge variant="outline" className="text-xs">{image.breed.name}</Badge>
                            )}
                            {image.style && (
                              <Badge variant="outline" className="text-xs">{image.style.name}</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Heart className="w-4 h-4 text-gray-400" />
                            <Share2 className="w-4 h-4 text-gray-400" />
                            <ShoppingCart className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="text-center mt-12">
            <Button 
              size="lg"
              onClick={() => router.push('/customer/gallery')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              View Full Gallery
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600">
              Real reviews from pet parents who love their AI portraits
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-center mb-6">
                <Quote className="w-12 h-12 text-purple-600" />
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  {[...Array(reviews[currentReview].rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <p className="text-lg text-gray-700 mb-6 italic">
                  "{reviews[currentReview].comment}"
                </p>
                
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{reviews[currentReview].customer_name}</p>
                    <p className="text-sm text-gray-600">
                      Pet parent to {reviews[currentReview].pet_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(reviews[currentReview].date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel Controls */}
            <button
              onClick={prevReview}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <button
              onClick={nextReview}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>

            {/* Dots Indicator */}
            <div className="flex items-center justify-center space-x-2 mt-6">
              {reviews.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentReview(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentReview ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sign Up Section */}
      <section id="signup" className="py-20 bg-gradient-to-br from-purple-600 to-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-6 font-[family-name:var(--font-margarine)]">
              Ready to Create Your Pet's Portrait?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join thousands of happy pet parents who have transformed their beloved companions into beautiful artwork
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                variant="secondary"
                onClick={() => router.push('/signup/user')}
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                Sign Up as Pet Owner
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/signup/partner')}
                className="border-white text-white hover:bg-white hover:text-purple-600"
              >
                Join as Partner
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6 font-[family-name:var(--font-margarine)]">
              About PawTraits
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're passionate about celebrating the special bond between pets and their families through beautiful, AI-generated artwork
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI-Powered Technology</h3>
              <p className="text-gray-600">
                Our advanced AI technology creates unique, personalized portraits that capture your pet's personality and charm
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Made with Love</h3>
              <p className="text-gray-600">
                Every portrait is crafted with care and attention to detail, ensuring your pet's unique characteristics shine through
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Premium Quality</h3>
              <p className="text-gray-600">
                High-resolution artwork suitable for printing on canvas, paper, or digital sharing across all platforms
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Multiple Options</h3>
              <p className="text-gray-600">
                Choose from various styles, themes, and formats to create the perfect portrait for your space and budget
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <span className="text-xl font-bold font-[family-name:var(--font-margarine)]">PawTraits</span>
              </div>
              <p className="text-gray-400">
                Creating beautiful memories of your beloved pets through AI-powered artwork.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Browse</h3>
              <div className="space-y-2">
                <Link href="/dogs" className="block text-gray-400 hover:text-white transition-colors">Dogs</Link>
                <Link href="/cats" className="block text-gray-400 hover:text-white transition-colors">Cats</Link>
                <Link href="/themes" className="block text-gray-400 hover:text-white transition-colors">Themes</Link>
                <Link href="/customer/gallery" className="block text-gray-400 hover:text-white transition-colors">Gallery</Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Account</h3>
              <div className="space-y-2">
                <Link href="/signup/user" className="block text-gray-400 hover:text-white transition-colors">Sign Up</Link>
                <Link href="/auth/login" className="block text-gray-400 hover:text-white transition-colors">Sign In</Link>
                <Link href="/signup/partner" className="block text-gray-400 hover:text-white transition-colors">Partner Program</Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <div className="space-y-2">
                <a href="mailto:support@pawtraits.com" className="block text-gray-400 hover:text-white transition-colors">Contact Us</a>
                <Link href="/help" className="block text-gray-400 hover:text-white transition-colors">Help Center</Link>
                <Link href="/privacy" className="block text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="block text-gray-400 hover:text-white transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 PawTraits. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}