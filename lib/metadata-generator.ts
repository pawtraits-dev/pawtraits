import type { Breed, Theme, Style, Format, Coat } from './types';

interface GeneratedMetadata {
  description: string;
  tags: string[];
}

interface MetadataParams {
  promptText: string;
  breed?: Breed;
  theme?: Theme;
  style?: Style;
  format?: Format;
  coat?: { name: string; pattern_type: string; rarity: string };
}

export function generateImageMetadata(params: MetadataParams): GeneratedMetadata {
  const { promptText, breed, theme, style, format, coat } = params;
  
  // Generate description
  let description = '';
  if (breed) {
    description = `AI-generated portrait of a ${breed.name}`;
    
    if (coat) {
      description += ` with ${coat.name.toLowerCase()} coat`;
    }
    
    if (style) {
      description += `, rendered in ${style.name.toLowerCase()} style`;
    }
    
    if (theme) {
      description += ` featuring ${theme.name.toLowerCase()} theme`;
    }
    
    if (format) {
      description += ` in ${format.name.toLowerCase()} format`;
    }
  } else {
    description = 'AI-generated pet portrait';
  }
  
  // Generate simple tags using only selected entity names
  const tags: string[] = [];
  
  // Add selected entity names as tags
  if (breed) {
    tags.push(breed.name.toLowerCase().replace(/\s+/g, '-'));
  }
  
  if (coat) {
    tags.push(coat.name.toLowerCase().replace(/\s+/g, '-'));
  }
  
  if (theme) {
    tags.push(theme.name.toLowerCase().replace(/\s+/g, '-'));
  }
  
  if (style) {
    tags.push(style.name.toLowerCase().replace(/\s+/g, '-'));
  }
  
  if (format) {
    tags.push(format.name.toLowerCase().replace(/\s+/g, '-'));
  }
  
  // Add basic category tags
  tags.push('ai-generated', 'pet', 'portrait');
  
  // Remove duplicates
  const uniqueTags = Array.from(new Set(tags));
  
  return {
    description,
    tags: uniqueTags
  };
}

export function extractColorTags(hexColor?: string): string[] {
  if (!hexColor) return [];
  
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Determine color names based on RGB values
  const tags: string[] = [];
  
  if (r > 200 && g > 200 && b > 200) tags.push('white', 'light');
  else if (r < 50 && g < 50 && b < 50) tags.push('black', 'dark');
  else if (r > g && r > b) tags.push('red', 'reddish');
  else if (g > r && g > b) tags.push('green', 'greenish');
  else if (b > r && b > g) tags.push('blue', 'bluish');
  else if (r > 150 && g > 100 && b < 100) tags.push('brown', 'tan');
  else if (r > 200 && g > 200 && b < 150) tags.push('yellow', 'golden');
  
  return tags;
}