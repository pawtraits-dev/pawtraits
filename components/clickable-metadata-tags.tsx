'use client';

import { Badge } from '@/components/ui/badge';
import { useRouter, usePathname } from 'next/navigation';

interface ClickableMetadataTagsProps {
  breed?: {
    id: string;
    name: string;
    slug?: string;
    animal_type?: 'dog' | 'cat';
  };
  theme?: {
    id: string;
    name: string;
  };
  style?: {
    id: string;
    name: string;
  };
  coat?: {
    id: string;
    name: string;
    hex_color?: string;
    animal_type?: 'dog' | 'cat';
  };
  // Support both homepage and shop page data structures
  breed_name?: string;
  breed_id?: string;
  breed_animal_type?: 'dog' | 'cat';
  theme_name?: string;
  theme_id?: string;
  style_name?: string;
  style_id?: string;
  coat_name?: string;
  coat_id?: string;
  coat_hex_color?: string;
  coat_animal_type?: 'dog' | 'cat';
  // Optional target page override (defaults to browse)
  targetShopPage?: '/browse';
}

export default function ClickableMetadataTags({
  breed,
  theme,
  style,
  coat,
  breed_name,
  breed_id,
  breed_animal_type,
  theme_name,
  theme_id,
  style_name,
  style_id,
  coat_name,
  coat_id,
  coat_hex_color,
  coat_animal_type,
  targetShopPage = '/browse'
}: ClickableMetadataTagsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleTagClick = (filterType: string, filterId: string) => {
    // Skip style and format filtering since they've been removed
    if (filterType === 'style' || filterType === 'format') return;
    
    // Build URL with filter parameter
    const params = new URLSearchParams();
    params.set(filterType, filterId);
    
    const targetUrl = `${targetShopPage}?${params.toString()}`;
    
    // If we're already on the target shop page, use replace to ensure URL change is detected
    if (pathname === targetShopPage) {
      router.replace(targetUrl);
    } else {
      // If coming from a different page, use push
      router.push(targetUrl);
    }
  };

  // Normalize data - support both object and separate field structures
  const breedData = breed || (breed_id && breed_name ? { 
    id: breed_id, 
    name: breed_name, 
    animal_type: breed_animal_type 
  } : null);
  const themeData = theme || (theme_id && theme_name ? { id: theme_id, name: theme_name } : null);
  const styleData = style || (style_id && style_name ? { id: style_id, name: style_name } : null);
  const coatData = coat || (coat_id && coat_name ? { 
    id: coat_id, 
    name: coat_name, 
    hex_color: coat_hex_color,
    animal_type: coat_animal_type
  } : null);

  return (
    <div className="space-y-1">
      {breedData && (
        <div>
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-colors"
            onClick={() => handleTagClick('breed', breedData.id)}
            title={`Filter by ${breedData.name} breed`}
          >
            {breedData.animal_type === 'cat' ? '🐱' : '🐕'} {breedData.name}
          </Badge>
        </div>
      )}
      
      {themeData && (
        <div>
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
            onClick={() => handleTagClick('theme', themeData.id)}
            title={`Filter by ${themeData.name} theme`}
          >
            🎨 {themeData.name}
          </Badge>
        </div>
      )}
      
      {coatData && (
        <div>
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors flex items-center space-x-1"
            onClick={() => handleTagClick('coat', coatData.id)}
            title={`Filter by ${coatData.name} coat`}
          >
            {coatData.hex_color && (
              <div 
                className="w-2 h-2 rounded-full border border-gray-300"
                style={{ backgroundColor: coatData.hex_color }}
              />
            )}
            <span>{coatData.name}</span>
          </Badge>
        </div>
      )}
    </div>
  );
}