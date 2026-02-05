/**
 * Claude Composition Analyzer Service
 *
 * Uses Anthropic Claude AI to analyze pet portrait reference images and generate:
 * 1. Marketing descriptions (fun, witty copy for website)
 * 2. Technical composition analysis (for admin review and variation prompts)
 * 3. Subject identification (breeds, coats, positions)
 * 4. Variation prompt templates (precise instructions for Gemini AI)
 *
 * Cost: ~$0.015 per image (Claude Sonnet 4.5, ~2000 tokens)
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Types
// ============================================================================

export interface CompositionAnalysisRequest {
  imageBase64: string; // Base64 encoded image data (without data:image prefix)
  imageFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  context?: {
    theme?: string; // e.g., "Christmas", "Beach", "Formal"
    style?: string; // e.g., "Oil Painting", "Watercolor", "Photograph"
    knownBreeds?: string[]; // List of breed names to help AI identification
  };
}

export interface SubjectIdentification {
  subjectOrder: number; // 1, 2, 3...
  isPrimary: boolean; // True for main/dominant subject
  species: 'dog' | 'cat' | 'other';
  identifiedBreed: {
    name: string; // Best guess breed name
    confidence: number; // 0-10 scale
  };
  identifiedCoat: {
    pattern: string; // e.g., "golden", "brindle", "black and white tuxedo"
    confidence: number; // 0-10 scale
  };
  position: string; // left/center/right/foreground/background
  relativeSize: string; // primary/secondary/equal/dominant/minor
  pose: string; // sitting/standing/lying
  gaze: string; // camera/away/left/right
  expression: string; // neutral/happy/curious
}

export interface CompositionMetadata {
  lighting: {
    type: string; // natural/studio/dramatic
    direction: string; // front/side/back/overhead
    quality: string; // soft/hard/diffused
  };
  background: {
    type: string; // solid/gradient/environmental
    colors: string[]; // Hex codes
    elements: string[]; // props, furniture, etc.
  };
  composition: {
    framing: string; // closeup/portrait/full-body
    subjectPlacement: string; // center/left/right
  };
  artisticStyle: {
    medium: string; // photograph/oil-painting/watercolor
    texture: string; // smooth/rough/painterly
  };
  subjectDetails: {
    pose: string;
    gaze: string;
    expression: string;
  };
}

export interface CompositionAnalysisResponse {
  marketingDescription: string; // 1-2 paragraphs, fun and witty
  compositionAnalysis: string; // Markdown formatted technical analysis
  subjects: SubjectIdentification[]; // Array of identified subjects
  compositionMetadata: CompositionMetadata; // Structured data
  variationPromptTemplate: string; // Template for Gemini variations
  confidence: {
    overall: number; // 0-1
    breedIdentification: number; // 0-1
    compositionAnalysis: number; // 0-1
  };
}

// ============================================================================
// Service Class
// ============================================================================

export class ClaudeCompositionAnalyzer {
  private anthropic: Anthropic;

  constructor() {
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });
  }

  /**
   * Analyze image from File object (following established pattern from ImageDescriptionGenerator)
   */
  async analyzeImageFromFile(
    file: File,
    context?: { theme?: string; style?: string; knownBreeds?: string[] }
  ): Promise<CompositionAnalysisResponse> {
    console.log('🎨 [Claude Analyzer] Starting image analysis from file...');
    const startTime = Date.now();

    try {
      // Convert File to base64 using sharp (following established pattern)
      const arrayBuffer = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Compress and resize to stay within Claude limits (~5MB base64)
      const sharp = (await import('sharp')).default;
      const compressedBuffer = await sharp(inputBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const base64Data = compressedBuffer.toString('base64');
      console.log(`📦 [Claude Analyzer] Compressed: ${inputBuffer.length} → ${compressedBuffer.length} bytes`);

      // Build prompt
      const prompt = this.buildAnalysisPrompt(context);

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [Claude Analyzer] Analysis completed in ${duration}ms`);

      // Parse the response
      const analysisResult = this.parseResponse(response);
      console.log('📊 [Claude Analyzer] Parsed response:', {
        subjectCount: analysisResult.subjects.length,
        overallConfidence: analysisResult.confidence.overall
      });

      return analysisResult;
    } catch (error: any) {
      console.error('❌ [Claude Analyzer] Analysis failed:', error);
      throw new Error(`Claude analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze image composition from base64 data
   * @deprecated Use analyzeImageFromFile for better pattern consistency
   */
  async analyzeImage(request: CompositionAnalysisRequest): Promise<CompositionAnalysisResponse> {
    console.log('🎨 [Claude Analyzer] Starting image analysis...');
    const startTime = Date.now();

    try {
      // Build the comprehensive prompt
      const prompt = this.buildAnalysisPrompt(request.context);

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: request.imageFormat,
                  data: request.imageBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [Claude Analyzer] Analysis completed in ${duration}ms`);

      // Parse the response
      const analysisResult = this.parseResponse(response);
      console.log('📊 [Claude Analyzer] Parsed response:', {
        subjectCount: analysisResult.subjects.length,
        overallConfidence: analysisResult.confidence.overall
      });

      return analysisResult;
    } catch (error: any) {
      console.error('❌ [Claude Analyzer] Analysis failed:', error);
      throw new Error(`Claude analysis failed: ${error.message}`);
    }
  }

  /**
   * Build comprehensive analysis prompt (all tasks in one call for cost efficiency)
   */
  private buildAnalysisPrompt(context?: CompositionAnalysisRequest['context']): string {
    const contextInfo = context
      ? `\nContext provided:
- Theme: ${context.theme || 'Not specified'}
- Style: ${context.style || 'Not specified'}
- Known breeds in system: ${context.knownBreeds?.join(', ') || 'Not provided'}`
      : '';

    return `You are analyzing a pet portrait image for a print-on-demand business. Provide a comprehensive analysis in JSON format.

${contextInfo}

Analyze this image and provide the following:

## PART 1: MARKETING DESCRIPTION
Write a fun, witty description in Markdown format that would appeal to pet owners. Follow this EXACT structure:

1. **Opening line in bold** - A catchy title or hook that captures the essence of the portrait (e.g., "**Beagle's Beach Bar Happy Hour**")
2. Main body - 2-3 sentences with personality traits, witty observations, and what makes this portrait special. Be conversational, descriptive, and inject humor.
3. *Closing line in italics* - A funny, witty final thought that adds character (e.g., "*Some might say she's living her best island life, but that nose knows there's a burger buffet somewhere...*")

Keep it engaging, conversational, and full of personality. The description should make pet owners smile and connect with the image.

## PART 2: TECHNICAL COMPOSITION ANALYSIS (Markdown)
Provide detailed analysis covering:

**Lighting:** Type (natural/studio/dramatic), direction, quality, shadows, highlights
**Background:** Type, dominant colors (provide hex codes if possible), depth, elements, props
**Composition:** Framing type, subject placement, negative space, visual balance
**Artistic Style:** Medium (photograph/painting/digital), texture, brushwork if applicable, color treatment
**Subject Pose & Expression:** Body position, facial expression, gaze direction, body language

Format this as structured markdown that's easy to read.

## PART 3: SUBJECT IDENTIFICATION
Identify ALL animal subjects in the image:
- Count: How many subjects? (1, 2, 3+)
- For EACH subject provide:
  - Species: dog, cat, or other
  - Breed: Best guess with confidence rating 1-10 (use actual breed names from the provided list if available, otherwise common breed names)
  - Coat: Specific color/pattern description (e.g., "golden retriever coloring", "black and white tuxedo cat", "brindle")
  - Confidence in identification: 1-10 scale
  - Position in frame: left/center/right/foreground/background
  - Relative size/prominence: primary/secondary/equal/dominant/minor
  - Pose: sitting/standing/lying/playing
  - Gaze direction: camera/away/left/right/up/down
  - Expression: neutral/happy/curious/playful/serious

If multiple subjects, determine which is PRIMARY (main focus).

## PART 4: VARIATION GENERATION TEMPLATE
Provide PRECISE instructions for an AI (Gemini) that will generate variations by swapping in different pet breeds while preserving everything else.

Structure the template as:

**MUST PRESERVE EXACTLY:**
- [Specific background elements and their positions]
- [Exact lighting setup with technical details]
- [Precise color palette]
- [Props and their positions]
- [Artistic style and medium specifics]
- [Camera angle and framing]

**CRITICAL POSITIONING FOR REPLACEMENT SUBJECT(S):**
- Subject should be positioned [exact description]
- Subject should occupy [percentage/description] of frame
- Subject's gaze should be [direction]
- Subject's pose should be [description]

Be extremely specific so that generated variations maintain the exact composition.

## RESPONSE FORMAT

Respond with ONLY valid JSON in this exact structure:

\`\`\`json
{
  "marketing_description": "**Golden Retriever's Perfect Portrait Moment**\\nThis magnificent golden has mastered the art of looking effortlessly photogenic, with that classic head tilt that says 'I know exactly how adorable I am.' Between the soft lighting and that gentle, knowing gaze, this pup is giving serious professional model vibes – though we all know they're probably just waiting patiently for the photographer to drop a treat. *Some might say this is portrait perfection, but that tail wagging suggests there's definitely a tennis ball just out of frame...*",
  "composition_analysis_markdown": "# Lighting\\n\\n**Type:** ...\\n\\n# Background\\n...",
  "subjects": [
    {
      "subject_order": 1,
      "is_primary": true,
      "species": "dog",
      "identified_breed": {
        "name": "Golden Retriever",
        "confidence": 8
      },
      "identified_coat": {
        "pattern": "golden with slight wave",
        "confidence": 9
      },
      "position": "center",
      "relative_size": "primary",
      "pose": "sitting",
      "gaze": "camera",
      "expression": "happy"
    }
  ],
  "composition_metadata": {
    "lighting": {
      "type": "natural",
      "direction": "front",
      "quality": "soft"
    },
    "background": {
      "type": "solid",
      "colors": ["#F5F5DC", "#E8E8E8"],
      "elements": ["none"]
    },
    "composition": {
      "framing": "portrait",
      "subject_placement": "center"
    },
    "artistic_style": {
      "medium": "photograph",
      "texture": "smooth"
    },
    "subject_details": {
      "pose": "sitting",
      "gaze": "camera",
      "expression": "happy"
    }
  },
  "variation_prompt_template": "CRITICAL: COMPOSITION-PRESERVING variation...\\n\\nMUST PRESERVE EXACTLY:\\n- Solid beige background (#F5F5DC)\\n...",
  "confidence": {
    "overall": 0.85,
    "breed_identification": 0.80,
    "composition_analysis": 0.90
  }
}
\`\`\`

CRITICAL REQUIREMENTS:
1. Return ONLY the JSON object. No additional text before or after.
2. Ensure ALL string values are properly JSON-escaped:
   - Use \\\\ for backslashes
   - Use \\" for quotes within strings
   - Use \\n for newlines within strings
3. Multi-line strings (like composition_analysis_markdown) must use \\n for line breaks, NOT actual newlines
4. Validate the JSON is well-formed before responding`;
  }

  /**
   * Parse Claude's response and validate structure
   */
  private parseResponse(response: Anthropic.Messages.Message): CompositionAnalysisResponse {
    try {
      // Extract text content
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = textContent.text.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Log raw JSON for debugging (first 500 chars and last 500 chars)
      console.log('📄 [Claude Analyzer] Raw JSON preview (first 500 chars):', jsonText.substring(0, 500));
      console.log('📄 [Claude Analyzer] Raw JSON preview (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)));

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseError: any) {
        // If JSON parsing fails, log the problematic area
        console.error('❌ [Claude Analyzer] JSON parse error:', parseError.message);

        // Try to extract position from error message
        const posMatch = parseError.message.match(/position (\d+)/);
        if (posMatch) {
          const pos = parseInt(posMatch[1]);
          const start = Math.max(0, pos - 100);
          const end = Math.min(jsonText.length, pos + 100);
          console.error('📍 [Claude Analyzer] JSON around error position:', jsonText.substring(start, end));
        }

        throw parseError;
      }

      // Validate required fields
      if (!parsed.marketing_description || !parsed.composition_analysis_markdown || !parsed.subjects || !parsed.variation_prompt_template) {
        throw new Error('Missing required fields in Claude response');
      }

      // Transform to our response format
      const result: CompositionAnalysisResponse = {
        marketingDescription: parsed.marketing_description,
        compositionAnalysis: parsed.composition_analysis_markdown,
        subjects: parsed.subjects.map((s: any) => ({
          subjectOrder: s.subject_order,
          isPrimary: s.is_primary,
          species: s.species,
          identifiedBreed: s.identified_breed,
          identifiedCoat: s.identified_coat,
          position: s.position,
          relativeSize: s.relative_size,
          pose: s.pose,
          gaze: s.gaze,
          expression: s.expression
        })),
        compositionMetadata: parsed.composition_metadata,
        variationPromptTemplate: parsed.variation_prompt_template,
        confidence: parsed.confidence
      };

      return result;
    } catch (error: any) {
      console.error('❌ [Claude Analyzer] Failed to parse response:', error);
      console.error('Raw response:', response);
      throw new Error(`Failed to parse Claude response: ${error.message}`);
    }
  }
}
