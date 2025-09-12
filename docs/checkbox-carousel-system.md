# Checkbox-Based Carousel System

## Overview

The carousel system has been redesigned from a manual slide-creation system to a checkbox-based content selection system. This new approach uses existing hero images from themes, dog breeds, and cat breeds instead of requiring administrators to manually upload and configure individual slides.

## Key Benefits

✅ **Eliminates Content Duplication** - Uses existing hero images from themes/breeds tables
✅ **Automatic Content Updates** - New themes/breeds automatically become available for carousels  
✅ **Consistent Branding** - Same hero images used across application
✅ **Simplified Admin Workflow** - Checkbox selection instead of manual slide creation
✅ **Dynamic Navigation** - Clicking carousel items navigates to filtered shop results
✅ **Better Maintenance** - Single source of truth for hero images

## Database Schema

### New Tables

**`carousel_content_selections`**
- Links carousels to themes/breeds via checkboxes
- Replaces individual slide records
- Supports custom overrides for titles/descriptions

### New Views

**`carousel_content_with_details`**
- Combines selection data with theme/breed details
- Auto-generates titles, descriptions, and CTAs
- Creates URLs for filtered shop navigation

## Admin Interface Changes

### Before (Manual Slides)
- Admin uploads individual slide images
- Manually enters titles, descriptions, CTAs
- Complex slide ordering and configuration

### After (Checkbox Selection)
- Admin selects from existing themes/breeds via checkboxes
- Content auto-populated from existing data
- Simple checkbox interface with search/filtering

### New Admin Flow

1. **Navigate to Carousel Content**: `/admin/carousels/[id]/content`
2. **Select Content Types**: Choose from Themes, Dog Breeds, Cat Breeds tabs
3. **Check Desired Items**: Use checkboxes to select content
4. **Save Configuration**: All selected items become carousel slides

## Public Display Changes

### New Component: `ContentBasedCarousel`
- Replaces `EnhancedHeroCarousel`
- Fetches content from new database structure
- Handles navigation to filtered shop pages

### Navigation Behavior
When users click carousel items, they navigate to:
- **Themes**: `/customer/shop?theme=theme-name`
- **Dog Breeds**: `/customer/shop?breed=breed-name&animal=dog` 
- **Cat Breeds**: `/customer/shop?breed=breed-name&animal=cat`

## API Endpoints

### Admin Endpoints
- `GET /api/admin/carousel-content?carousel_id=X` - Get carousel content with admin data
- `POST /api/admin/carousel-content` - Save checkbox selections
- `PATCH /api/admin/carousel-content` - Update content order/status

### Public Endpoints  
- `GET /api/public/carousel-content?page_type=home` - Get carousel content for public display

## Implementation Steps

### 1. Database Migration
```bash
# Run the database schema migration
psql -d your_database -f scripts/create-checkbox-carousel-schema.sql
```

### 2. Update Homepage
```tsx
// Replace EnhancedHeroCarousel with ContentBasedCarousel
import ContentBasedCarousel from '@/components/ContentBasedCarousel';

<ContentBasedCarousel 
  pageType="home"
  className="h-[40vh] md:h-[45vh]"
  showControls={true}
/>
```

### 3. Admin Configuration
1. Navigate to `/admin/carousels`
2. Click "Content" button for existing carousels
3. Use checkbox interface to select themes/breeds
4. Save configuration

## Content Requirements

For the system to work properly, ensure:

✅ **Themes have hero images**: `themes.hero_image_url` populated
✅ **Breeds have hero images**: `breeds.hero_image_url` populated  
✅ **Content is active**: `is_active = true` on themes/breeds
✅ **Descriptions exist**: For auto-generated subtitles

## Configuration Options

### Carousel Settings (unchanged)
- Auto-play interval
- Show/hide thumbnails
- Show/hide controls
- Active/inactive status

### Content Selection (new)
- Multi-select themes via checkboxes
- Multi-select dog breeds via checkboxes
- Multi-select cat breeds via checkboxes
- Search/filter available content
- Drag-and-drop reordering (future enhancement)

## Migration from Old System

### For Existing Carousels
1. **Backup existing slide data** (if needed for reference)
2. **Identify equivalent themes/breeds** for current slides
3. **Use admin interface** to select equivalent content
4. **Test carousel display** and navigation
5. **Disable old slide system** once verified

### Data Preservation
- Old slide tables remain intact for reference
- New system runs alongside old system during transition
- No data loss during migration

## Troubleshooting

### Carousel Not Displaying
- Check if carousel is active: `carousels.is_active = true`
- Verify content selections exist for the carousel
- Ensure selected themes/breeds have hero images
- Check browser console for API errors

### Navigation Not Working  
- Verify shop page supports expected URL parameters
- Test URLs manually: `/customer/shop?theme=portrait&animal=dog`
- Check that themes/breeds names match URL encoding

### Content Not Loading
- Verify theme/breed records exist and are active
- Check `hero_image_url` fields are populated
- Test API endpoints directly in browser/Postman

## Future Enhancements

### Planned Features
- **Drag-and-drop reordering** within admin interface
- **Custom text overrides** per carousel item
- **A/B testing** for different content combinations
- **Analytics tracking** for carousel engagement
- **Bulk import/export** of carousel configurations

### Scalability Considerations
- Caching layer for frequently accessed carousels
- CDN integration for hero images
- Lazy loading for large content lists
- Search indexing for admin content selection