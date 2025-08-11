// scripts/claude-dev-helper.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeCode(code: string, task: string) {
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `As a senior developer working on a Next.js pet portrait AI app, ${task}:\n\n${code}`
    }]
  });
  
  return message.content;
}

// Usage examples for your project:
// analyzeCode(promptTemplate, "optimize this Midjourney prompt template")
// analyzeCode(replicateCode, "review this AI integration for rate limiting")
// analyzeCode(breedSchema, "suggest improvements to this Supabase schema")