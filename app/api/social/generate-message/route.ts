import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { breedName, themeName, styleName, coatName, outfitName, description } = body;

    if (!breedName) {
      return NextResponse.json(
        { error: 'Breed name is required' },
        { status: 400 }
      );
    }

    console.log('Generating social share messages for:', {
      breedName,
      themeName,
      styleName,
      coatName,
      outfitName
    });

    // Build context parts
    const contextParts = [];
    if (breedName) contextParts.push(`Breed: ${breedName}`);
    if (themeName) contextParts.push(`Setting: ${themeName}`);
    if (styleName) contextParts.push(`Art Style: ${styleName}`);
    if (coatName) contextParts.push(`Coat: ${coatName}`);
    if (outfitName) contextParts.push(`Outfit: ${outfitName}`);
    if (description) contextParts.push(`Description: ${description.substring(0, 200)}`);

    const contextString = contextParts.join('\n- ');

    const prompt = `
Generate 3 short, engaging social media share messages for this AI-generated pet portrait.

Context about the portrait:
- ${contextString}

Requirements:
- Each message: 15-30 words maximum
- Be authentic and fun - something someone would genuinely share with friends
- NOT overtly marketing - no "check out" or "visit our site" language
- Natural enthusiasm without being salesy
- Can be playful, witty, or heartwarming
- Each message should have a slightly different tone:
  * Message 1: Enthusiastic and excited
  * Message 2: Fun and playful
  * Message 3: Sweet and heartwarming
- No hashtags (people add their own)
- No emojis (keeps it clean and universal)

Examples of the right tone:
- "This AI artist totally nailed the 'professional nap expert' vibe my Golden Retriever has perfected"
- "When your dog's portrait captures their personality better than any photo ever could"
- "I'm obsessed with how this watercolor beach scene turned out - it's so perfectly them"

Bad examples (too marketing-focused):
- "Check out this amazing portrait from Pawtraits! #petportrait"
- "Get your own custom pet portrait today!"

Output Format: Return ONLY a JSON array of 3 strings, no other text or explanation.
Example: ["message1", "message2", "message3"]
`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
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

    if (!Array.isArray(messages) || messages.length !== 3) {
      console.error('Invalid messages format:', messages);
      throw new Error('Expected array of 3 messages');
    }

    // Add breed hashtag to each message
    const breedHashtag = breedName ? `#${breedName.replace(/\s+/g, '')}` : '';
    const messagesWithHashtag = messages.map(msg =>
      breedHashtag ? `${msg} ${breedHashtag}` : msg
    );

    console.log('✅ Generated social share messages successfully');

    return NextResponse.json({ messages: messagesWithHashtag });

  } catch (error) {
    console.error('Failed to generate social share messages:', error);

    // Return fallback messages based on breed if available
    const body = await request.json().catch(() => ({}));
    const breedName = body.breedName || 'pet';
    const breedHashtag = breedName && breedName !== 'pet' ? `#${breedName.replace(/\s+/g, '')}` : '';

    const fallbackMessages = [
      `This ${breedName} portrait turned out absolutely perfect${breedHashtag ? ' ' + breedHashtag : ''}`,
      `AI-generated pet portraits are amazing and I'm here for it${breedHashtag ? ' ' + breedHashtag : ''}`,
      `Sometimes AI just gets it right - love how this turned out${breedHashtag ? ' ' + breedHashtag : ''}`
    ];

    return NextResponse.json({
      messages: fallbackMessages,
      fallback: true
    });
  }
}
