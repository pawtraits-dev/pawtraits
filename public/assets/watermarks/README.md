# Watermark Setup Instructions

## 1. Place Your SVG Watermark

Put your SVG watermark file in this directory as:
- `pawtraits-logo.svg`

## 2. Upload to Cloudinary

You can upload the watermark to Cloudinary in two ways:

### Option A: Manual Upload (Recommended for initial setup)
1. Go to your Cloudinary dashboard: https://cloudinary.com/console
2. Navigate to Media Library
3. Upload your `pawtraits-logo.svg` file
4. Set the Public ID to: `pawtraits_watermark_logo`
5. Make sure it's in the root folder (not in any subfolder)

### Option B: Programmatic Upload
Run this script after placing your SVG in this directory:

```bash
npm run upload-watermark
```

## 3. Verify Configuration

The watermark should be accessible at:
- Cloudinary URL: `httpswhen I run `
- Local file: `/public/assets/watermarks/pawtraits-logo.svg`

## Environment Variables Used

- `CLOUDINARY_WATERMARK_PUBLIC_ID=pawtraits_watermark_logo`
- `CLOUDINARY_WATERMARK_OPACITY=60`

## Testing

After upload, test the watermark by running:
```bash
npm run test-watermark
```

This will generate a test image with the watermark applied.