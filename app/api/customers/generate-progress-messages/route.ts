import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { breedName, breedDescription, themeName, themeDescription, coatColor } = body;

    if (!breedName || !coatColor) {
      return NextResponse.json(
        { error: 'Breed name and coat color are required' },
        { status: 400 }
      );
    }

    console.log('Generating progress messages for:', {
      breedName,
      themeName,
      coatColor
    });

    const prompt = `
Generate 5 sequential progress messages (18 seconds each) for an AI pet portrait generation process.

Context:
- Breed: ${breedName}
- Breed Personality: ${breedDescription || 'playful, loyal, intelligent'}
- Setting/Theme: ${themeName || 'studio portrait'} ${themeDescription ? `- ${themeDescription}` : ''}
- Coat Color: ${coatColor}

Requirements:
- Reference "Pawcasso" (our AI artist) working in his studio
- Incorporate the breed's personality traits naturally
- Reference the setting/theme context
- Mention the coat color creatively
- Be playful, engaging, match brand voice examples
- Each message: 15-25 words, one sentence
- Progress from starting work to near completion
- Include one emoji at end of each message (🎨, 🖌️, ✨, 🐾, 👨‍🎨)

Brand Voice Examples:
- "Pawcasso is setting up the perfect beach chair for this golden relaxation expert... 🎨"
- "Selecting designer sunglasses that match a Bulldog's sophisticated nap philosophy... 🖌️"
- "Capturing that 'professional couch warmer on vacation' energy... ✨"
- "Adding those signature ${breedName} features with extra personality... 🐾"

Output Format: Return ONLY a JSON array of 5 strings, no other text or explanation.
Example: ["message1", "message2", "message3", "message4", "message5"]
`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const messageContent = response.content[0].type === 'text'
      ? response.content[0].text
      : null;

    if (!messageContent) {
      throw new Error('No text content in response');
    }

    // Parse the JSON array from the response
    // Claude might wrap it in markdown code blocks, so clean it up
    let cleanedContent = messageContent.trim();

    // Remove markdown code block if present
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    }

    const messages = JSON.parse(cleanedContent);

    if (!Array.isArray(messages) || messages.length !== 5) {
      console.error('Invalid messages format:', messages);
      throw new Error('Expected array of 5 messages');
    }

    console.log('✅ Generated progress messages successfully');

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Failed to generate progress messages:', error);

    // Return fallback messages
    const fallbackMessages = [
      "Pawcasso is preparing his studio... 🎨",
      "Selecting the perfect colors and brushes... 🖌️",
      "Capturing your pet's unique personality... ✨",
      "Adding those special finishing touches... 🐾",
      "Almost there! Creating something amazing... 👨‍🎨"
    ];

    return NextResponse.json({
      messages: fallbackMessages,
      fallback: true
    });
  }
}
