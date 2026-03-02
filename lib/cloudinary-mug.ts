/**
 * Cloudinary Mug Composite URL Builder
 *
 * Builds Cloudinary transformation URLs for mug print files.
 * All compositing is done lazily by Cloudinary on first access — no server-side
 * image processing required.
 *
 * Canvas base: pawtraits/mugs/white_canvas_2362x1134
 * Upload it once with: tsx scripts/setup-mug-canvas.ts
 */

import { v2 as cloudinary } from 'cloudinary';
import type { MugColour, MugCatalogEntry } from './product-types';

// Configure Cloudinary (idempotent)
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    url_analytics: false,
  });
}

/**
 * Layout constants for the 2362×1134 print canvas.
 * Tune these values visually using tsx scripts/test-mug-generation.ts
 */
export const MUG_LAYOUT = {
  // Canvas
  CANVAS_WIDTH: 2362,
  CANVAS_HEIGHT: 1134,
  CANVAS_PUBLIC_ID: 'pawtraits/mugs/white_canvas_2362x1134',

  // Left panel — personalised pet image
  PET_IMAGE_WIDTH: 1020,
  PET_IMAGE_HEIGHT: 880,
  PET_IMAGE_X: 80,
  PET_IMAGE_Y: 80,

  // Left panel — pet name text
  // gravity: 'north' anchors at centre-top; x is offset from canvas centre (1181px).
  // Left panel centre = 590 → offset = 590 - 1181 = -591
  PET_NAME_FONT_FAMILY: 'Life Savers',
  PET_NAME_FONT_SIZE: 90,
  PET_NAME_X: -591,
  PET_NAME_Y: 1000,
  PET_NAME_MAX_WIDTH: 1180,

  // Divider (10%–90% of canvas height)
  DIVIDER_X: 1180,
  DIVIDER_WIDTH: 2,
  DIVIDER_Y: 113,       // 10% of 1134
  DIVIDER_HEIGHT: 908,  // 80% of 1134

  // Right panel text — gravity: 'north', x offset from canvas centre.
  // Right panel centre = 1772 → offset = 1772 - 1181 = +591
  HEADING_FONT_FAMILY: 'Montserrat',
  HEADING_FONT_SIZE: 110,
  HEADING_X: 591,
  HEADING_Y: 120,
  HEADING_MAX_WIDTH: 1060,

  // Right panel — sub-heading
  SUBHEADING_FONT_SIZE: 52,
  SUBHEADING_X: 591,
  SUBHEADING_Y: 290,
  SUBHEADING_MAX_WIDTH: 1060,
  SUBHEADING_COLOUR: '2D2926',

  // Right panel — description body
  DESCRIPTION_FONT_SIZE: 38,
  DESCRIPTION_X: 591,
  DESCRIPTION_Y: 420,
  DESCRIPTION_MAX_WIDTH: 1000,
  DESCRIPTION_COLOUR: '555555',

  // Preview scale
  PREVIEW_WIDTH: 1181,
} as const;

export interface MugCompositeParams {
  personalisedImagePublicId: string;
  petName: string;
  mugColour: MugColour;
  catalogEntry: MugCatalogEntry;
}

function buildTransformationChain(params: MugCompositeParams): object[] {
  const { personalisedImagePublicId, petName, mugColour, catalogEntry } = params;
  const colourHex = mugColour.overlay_hex;

  // Cloudinary requires forward slashes and URL-encoded special chars in overlay public IDs
  const escapedPetImageId = personalisedImagePublicId.replace(/\//g, ':');

  return [
    // LEFT: personalised pet image
    {
      overlay: escapedPetImageId,
      width: MUG_LAYOUT.PET_IMAGE_WIDTH,
      height: MUG_LAYOUT.PET_IMAGE_HEIGHT,
      crop: 'fit',
      gravity: 'north_west',
      x: MUG_LAYOUT.PET_IMAGE_X,
      y: MUG_LAYOUT.PET_IMAGE_Y,
    },

    // LEFT: pet name — Life Savers font, centred at left panel midpoint
    // gravity: 'north' anchors the text at its own centre-top, so x=-591 places
    // the text centre at canvas_centre(1181) + (-591) = 590 = left panel centre.
    {
      overlay: {
        font_family: MUG_LAYOUT.PET_NAME_FONT_FAMILY,
        font_size: MUG_LAYOUT.PET_NAME_FONT_SIZE,
        font_weight: 'normal',
        text_align: 'center',
        text: petName,
      },
      color: `#${colourHex}`,
      gravity: 'north',
      x: MUG_LAYOUT.PET_NAME_X,
      y: MUG_LAYOUT.PET_NAME_Y,
      width: MUG_LAYOUT.PET_NAME_MAX_WIDTH,
      crop: 'fit',
    },

    // DIVIDER: 2px coloured vertical line (10%–90% height via colorize overlay)
    {
      overlay: MUG_LAYOUT.CANVAS_PUBLIC_ID.replace(/\//g, ':'),
      width: MUG_LAYOUT.DIVIDER_WIDTH,
      height: MUG_LAYOUT.DIVIDER_HEIGHT,
      crop: 'fill',
      effect: 'colorize:100',
      color: `#${colourHex}`,
      gravity: 'north_west',
      x: MUG_LAYOUT.DIVIDER_X,
      y: MUG_LAYOUT.DIVIDER_Y,
    },

    // RIGHT: banner heading — Montserrat Bold, centred at right panel midpoint
    // gravity: 'north' + x=591 → text centre at 1181+591=1772 = right panel centre
    {
      overlay: {
        font_family: MUG_LAYOUT.HEADING_FONT_FAMILY,
        font_size: MUG_LAYOUT.HEADING_FONT_SIZE,
        font_weight: 'bold',
        text_align: 'center',
        text: catalogEntry.name.toUpperCase(),
      },
      color: `#${colourHex}`,
      gravity: 'north',
      x: MUG_LAYOUT.HEADING_X,
      y: MUG_LAYOUT.HEADING_Y,
      width: MUG_LAYOUT.HEADING_MAX_WIDTH,
      crop: 'fit',
    },

    // RIGHT: sub-heading — Montserrat Bold, always dark
    {
      overlay: {
        font_family: MUG_LAYOUT.HEADING_FONT_FAMILY,
        font_size: MUG_LAYOUT.SUBHEADING_FONT_SIZE,
        font_weight: 'bold',
        text_align: 'center',
        text: catalogEntry.sub_heading,
      },
      color: `rgb:${MUG_LAYOUT.SUBHEADING_COLOUR}`,
      gravity: 'north',
      x: MUG_LAYOUT.SUBHEADING_X,
      y: MUG_LAYOUT.SUBHEADING_Y,
      width: MUG_LAYOUT.SUBHEADING_MAX_WIDTH,
      crop: 'fit',
    },

    // RIGHT: description body — Montserrat Regular, always grey
    {
      overlay: {
        font_family: MUG_LAYOUT.HEADING_FONT_FAMILY,
        font_size: MUG_LAYOUT.DESCRIPTION_FONT_SIZE,
        font_weight: 'normal',
        text_align: 'center',
        text: catalogEntry.description_short || catalogEntry.description,
      },
      color: `rgb:${MUG_LAYOUT.DESCRIPTION_COLOUR}`,
      gravity: 'north',
      x: MUG_LAYOUT.DESCRIPTION_X,
      y: MUG_LAYOUT.DESCRIPTION_Y,
      width: MUG_LAYOUT.DESCRIPTION_MAX_WIDTH,
      crop: 'fit',
    },

    // OUTPUT quality
    { quality: 95, fetch_format: 'jpg' },
  ];
}

/**
 * Build the full-resolution print URL (2362×1134).
 */
export function buildMugPrintUrl(params: MugCompositeParams): string {
  const transformation = buildTransformationChain(params);
  return cloudinary.url(MUG_LAYOUT.CANVAS_PUBLIC_ID, { transformation, secure: true });
}

/**
 * Build the preview URL (50% scale: 1181px wide).
 */
export function buildMugPreviewUrl(params: MugCompositeParams): string {
  const transformation = [
    ...buildTransformationChain(params),
    { width: MUG_LAYOUT.PREVIEW_WIDTH, crop: 'scale' },
  ];
  return cloudinary.url(MUG_LAYOUT.CANVAS_PUBLIC_ID, { transformation, secure: true });
}
