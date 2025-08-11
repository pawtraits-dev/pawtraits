import { NextRequest, NextResponse } from 'next/server';
import { ImageDescriptionGenerator } from '@/lib/image-description-generator';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

class ThemeGenerator {
  private buildThemeAnalysisPrompt(): string {
    return `
You are an expert at analyzing images to create AI art generation themes. Look at this image and extract its key thematic elements to create a comprehensive theme definition.

Please analyze the image and provide a JSON response with the following structure:

{
  "name": "A descriptive theme name (e.g., 'Autumn Forest Magic', 'Vintage Studio Portrait')",
  "description": "A detailed description of the theme's visual characteristics and mood (2-3 sentences)",
  "base_prompt_template": "A Midjourney-style prompt template using placeholders like [BREED], [COAT], [OUTFIT] for pet portraits in this style. Include specific lighting, composition, and style elements from the image. DO NOT include technical parameters like --ar, --style, --sref, etc. as these are handled separately by the system.",
  "style_keywords": ["array", "of", "specific", "visual", "keywords", "that", "capture", "this", "theme's", "essence"],
  "difficulty_level": 1-5 (based on complexity of recreating this style),
  "seasonal_relevance": {
    "spring": 0-10,
    "summer": 0-10, 
    "autumn": 0-10,
    "winter": 0-10
  }
}

Focus on:
- Visual style and mood
- Lighting characteristics
- Color palette and tones
- Composition and framing
- Artistic techniques or effects
- Setting or environment elements
- Any distinctive visual features

Make the base_prompt_template specific enough to recreate this style but flexible enough to work with different pet breeds and poses. Include technical photography/art terms where appropriate.

IMPORTANT: Do NOT include any Midjourney technical parameters (--ar, --style, --sref, --v, etc.) in the base_prompt_template as these are handled separately by the system.

Return ONLY the JSON object, no other text.`;
  }

  async analyzeImageForTheme(file: File): Promise<any> {
    try {
      const base64 = await this.fileToBase64Server(file);
      const prompt = this.buildThemeAnalysisPrompt();
      
      // Determine media type from file type
      let mediaType = 'image/jpeg';
      if (file.type === 'image/png') mediaType = 'image/png';
      else if (file.type === 'image/webp') mediaType = 'image/webp';
      else if (file.type === 'image/gif') mediaType = 'image/gif';
      
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType as any,
                  data: base64
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      });

      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      // Parse the JSON response
      try {
        const themeData = JSON.parse(responseText);
        return themeData;
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('Raw response:', responseText);
        throw new Error('Failed to parse AI response as JSON');
      }

    } catch (error) {
      console.error('Error analyzing image for theme:', error);
      throw new Error('Failed to analyze image for theme generation');
    }
  }

  private async fileToBase64Server(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return base64;
    } catch (error) {
      console.error('Error converting file to base64 on server:', error);
      throw new Error('Failed to process image file');
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Please upload an image smaller than 10MB.' },
        { status: 400 }
      );
    }

    const generator = new ThemeGenerator();
    const themeData = await generator.analyzeImageForTheme(file);

    return NextResponse.json(themeData);

  } catch (error) {
    console.error('Error in theme generation API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate theme from image' },
      { status: 500 }
    );
  }
}