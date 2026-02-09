import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@supabase/supabase-js';
import { Sparkles, ArrowRight } from 'lucide-react';

interface CustomSharePageProps {
  params: { shareToken: string };
}

// Get custom image data for metadata
async function getCustomImage(shareToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: customImage, error } = await supabase
    .from('customer_custom_images')
    .select(`
      id,
      generated_image_url,
      share_token,
      share_count,
      created_at,
      pet_name,
      pet_breed_id,
      catalog_image_id,
      metadata,
      breeds:pet_breed_id (name, display_name),
      catalog:catalog_image_id (
        themes (name, display_name),
        styles (name, display_name)
      )
    `)
    .eq('share_token', shareToken)
    .eq('is_public', true)
    .single();

  if (error || !customImage) {
    return null;
  }

  // Increment share count (fire and forget)
  supabase
    .from('customer_custom_images')
    .update({
      share_count: customImage.share_count + 1,
      last_shared_at: new Date().toISOString()
    })
    .eq('id', customImage.id)
    .then(() => console.log('Share count incremented'));

  return customImage;
}

export async function generateMetadata({ params }: CustomSharePageProps): Promise<Metadata> {
  const customImage = await getCustomImage(params.shareToken);

  if (!customImage) {
    return {
      title: 'Custom Pet Portrait - Pawtraits',
      description: 'Create beautiful custom pet portraits with Pawtraits',
    };
  }

  const breedName = customImage.breeds?.display_name || customImage.breeds?.name || 'Pet';
  const themeName = customImage.catalog?.themes?.display_name || customImage.catalog?.themes?.name || 'Custom';
  const styleName = customImage.catalog?.styles?.display_name || customImage.catalog?.styles?.name || '';

  return {
    title: `${customImage.pet_name}'s ${themeName} Portrait - Pawtraits`,
    description: `Check out this beautiful ${themeName} ${styleName} portrait of ${customImage.pet_name}, a ${breedName}. Create your own custom pet portrait at Pawtraits!`,
    openGraph: {
      title: `${customImage.pet_name}'s ${themeName} Portrait`,
      description: `A beautiful ${themeName} portrait created with Pawtraits`,
      images: [
        {
          url: customImage.generated_image_url,
          width: 1024,
          height: 1024,
          alt: `${customImage.pet_name}'s custom portrait`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${customImage.pet_name}'s ${themeName} Portrait`,
      description: `A beautiful custom portrait created with Pawtraits`,
      images: [customImage.generated_image_url],
    },
  };
}

export default async function CustomSharePage({ params }: CustomSharePageProps) {
  const customImage = await getCustomImage(params.shareToken);

  if (!customImage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Portrait Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              This custom portrait is no longer available or the link is incorrect.
            </p>
            <Link href="/browse">
              <Button>
                Explore Gallery
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const breedName = customImage.breeds?.display_name || customImage.breeds?.name || 'Pet';
  const themeName = customImage.catalog?.themes?.display_name || customImage.catalog?.themes?.name || 'Custom';
  const styleName = customImage.catalog?.styles?.display_name || customImage.catalog?.styles?.name || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              {customImage.pet_name}'s Custom Portrait
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            A beautiful {themeName} {styleName} portrait
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Image Display */}
          <Card className="overflow-hidden">
            <div className="relative aspect-square w-full">
              <Image
                src={customImage.generated_image_url}
                alt={`${customImage.pet_name}'s custom portrait`}
                fill
                className="object-cover"
                priority
              />
            </div>
          </Card>

          {/* Details & CTA */}
          <div className="flex flex-col justify-center space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Portrait Details
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Pet Name</p>
                    <p className="text-lg font-medium text-gray-900">{customImage.pet_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Breed</p>
                    <p className="text-lg font-medium text-gray-900">{breedName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Theme</p>
                    <p className="text-lg font-medium text-gray-900">{themeName}</p>
                  </div>
                  {styleName && (
                    <div>
                      <p className="text-sm text-gray-500">Style</p>
                      <p className="text-lg font-medium text-gray-900">{styleName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Shared</p>
                    <p className="text-lg font-medium text-gray-900">
                      {customImage.share_count} {customImage.share_count === 1 ? 'time' : 'times'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-gradient-to-br from-purple-600 to-purple-700 text-white">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold mb-3">
                  Create Your Own Portrait
                </h3>
                <p className="mb-4 text-purple-100">
                  Transform your pet into a work of art with our AI-powered portrait generator.
                  Choose from hundreds of themes and styles!
                </p>
                <Link href="/browse">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full bg-white text-purple-600 hover:bg-gray-100"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Social Sharing Hint */}
            <p className="text-sm text-gray-500 text-center">
              Love this portrait? Share it with your friends!
            </p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center pt-8 border-t border-gray-200">
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">
            Ready to Create Your Own?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Join thousands of pet owners who have transformed their beloved companions
            into stunning works of art. It's free, fast, and fun!
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/browse">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                <Sparkles className="w-5 h-5 mr-2" />
                Explore Gallery
              </Button>
            </Link>
            <Link href="/signup/user">
              <Button size="lg" variant="outline">
                Sign Up Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
