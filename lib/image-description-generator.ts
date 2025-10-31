import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

export class ImageDescriptionGenerator {
  private buildDescriptionPrompt(breed?: string, traits?: string[]): string {
    const breedInfo = breed ? `
BREED CONTEXT:
- This is a ${breed}
- Key personality traits: ${traits?.join(', ') || 'playful, loyal, intelligent'}
- Use these traits to inform the pet's "personality" and likely thoughts/attitudes
- Reference breed-specific behaviors or stereotypes humorously` : '';

    return `
You are a witty pet portrait copywriter who writes fun, lighthearted descriptions in this specific style:

STYLE GUIDELINES:
- Start with a catchy title using "**" markdown
- Write only 1-2 SHORT paragraphs (max 3-4 sentences total)
- Use humor and personality - imagine the pets have human-like thoughts and attitudes  
- Reference what the pet is "thinking" or their apparent "personality"
- Use phrases like "clearly," "obviously," "apparently," "definitely"
- Make observations about their expression and apparent confidence
- End with an italicized quip in *asterisks*
- NO sales language, NO AI/tech mentions, NO business promotion
- Keep it fun, conversational, and CONCISE
${breedInfo}

EXAMPLE TONE:
"This absolutely fabulous Goldendoodle has decided that Tuesday afternoon is the perfect time to debut her new spring collection... That gentle, knowing expression suggests she's fully aware of her floral fabulousness and is probably wondering why her humans aren't also wearing coordinating botanical headpieces."

BREED-SPECIFIC EXAMPLE:
"**The Labrador's Professional Food Quality Assessment**
This distinguished Labrador has clearly appointed himself as Chief Treat Inspector, and judging by that focused expression, he's taking his responsibilities very seriously. His gentle but determined gaze suggests he's mentally cataloguing every snack in a five-mile radius while maintaining the patient dignity that only a true food enthusiast can muster."

Now write a fun description for this image in exactly that style, incorporating the breed's personality traits naturally.`;
  }

  async generateDescription(
    imageUrl: string, 
    breed?: string, 
    traits?: string[]
  ): Promise<string> {
    try {
      const prompt = this.buildDescriptionPrompt(breed, traits);
      
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: await this.imageToBase64(imageUrl)
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

      return response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'Unable to generate description';

    } catch (error) {
      console.error('Error generating image description:', error);
      throw new Error('Failed to generate image description');
    }
  }

  private async imageToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);
      
      // Check original size
      const originalSize = inputBuffer.length;
      console.log(`Original image size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
      
      // Compress and resize image to stay within Claude's limits (~5MB base64)
      // Target ~3MB compressed to leave room for base64 encoding overhead
      const targetSizeBytes = 3 * 1024 * 1024; // 3MB
      let compressedBuffer = inputBuffer;
      
      if (originalSize > targetSizeBytes) {
        console.log('Compressing image for Claude API...');
        
        // Start with reasonable dimensions and high quality
        let width = 1024;
        let quality = 85;
        
        compressedBuffer = await sharp(inputBuffer)
          .resize(width, null, { 
            withoutEnlargement: true, 
            fit: 'inside' 
          })
          .jpeg({ quality })
          .toBuffer();
          
        // If still too large, reduce quality iteratively
        while (compressedBuffer.length > targetSizeBytes && quality > 30) {
          quality -= 15;
          console.log(`Reducing quality to ${quality}%...`);
          
          compressedBuffer = await sharp(inputBuffer)
            .resize(width, null, { 
              withoutEnlargement: true, 
              fit: 'inside' 
            })
            .jpeg({ quality })
            .toBuffer();
        }
        
        // If still too large, reduce dimensions
        while (compressedBuffer.length > targetSizeBytes && width > 512) {
          width = Math.floor(width * 0.8);
          console.log(`Reducing width to ${width}px...`);
          
          compressedBuffer = await sharp(inputBuffer)
            .resize(width, null, { 
              withoutEnlargement: true, 
              fit: 'inside' 
            })
            .jpeg({ quality })
            .toBuffer();
        }
        
        console.log(`Compressed image size: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      const base64 = compressedBuffer.toString('base64');
      const finalSizeMB = (base64.length / 1024 / 1024).toFixed(2);
      console.log(`Final base64 size: ${finalSizeMB}MB`);
      
      return base64;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to process image');
    }
  }

  // Alternative method for local file uploads (server-side)
  async generateDescriptionFromFile(
    file: File, 
    breed?: string, 
    traits?: string[]
  ): Promise<string> {
    try {
      console.log('Starting generateDescriptionFromFile with:', { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type, 
        breed, 
        hasTraits: !!traits 
      });
      
      const { base64, processedFile } = await this.fileToBase64Server(file);
      const prompt = this.buildDescriptionPrompt(breed, traits);
      
      console.log('About to call Claude API with:', {
        promptLength: prompt.length,
        base64Length: base64.length,
        hasApiKey: !!process.env.CLAUDE_API_KEY,
        originalFileType: file.type,
        processedFileType: processedFile.type
      });
      
      // Determine media type from processed file type (not original)
      let mediaType = 'image/jpeg';
      if (processedFile.type === 'image/png') mediaType = 'image/png';
      else if (processedFile.type === 'image/webp') mediaType = 'image/webp';
      else if (processedFile.type === 'image/gif') mediaType = 'image/gif';
      
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
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

      console.log('Claude API response received:', {
        hasContent: !!response.content,
        contentLength: response.content?.length,
        firstContentType: response.content?.[0]?.type
      });

      const result = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'Unable to generate description';
        
      console.log('Returning description, length:', result.length);
      return result;

    } catch (error) {
      console.error('Error generating description from file:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        apiKey: process.env.CLAUDE_API_KEY ? 'Present' : 'Missing'
      });
      throw new Error(`Failed to generate image description: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Server-side file to base64 conversion with compression
  private async fileToBase64Server(file: File): Promise<{ base64: string; processedFile: File }> {
    try {
      console.log('Converting file to base64:', { 
        name: file.name, 
        size: file.size, 
        type: file.type 
      });

      let processedFile = file;
      
      // If file is over 4MB, compress it to stay under Claude's 5MB limit
      if (file.size > 4 * 1024 * 1024) {
        console.log('File size over 4MB, compressing...');
        processedFile = await this.compressImage(file);
        console.log('Compressed file size:', processedFile.size);
      }

      const arrayBuffer = await processedFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      console.log('Base64 conversion successful, final size:', base64.length);
      
      // Check if base64 is still too large (Claude limit is ~5MB)
      if (base64.length > 5 * 1024 * 1024) {
        throw new Error('Image is still too large after compression. Please use a smaller image.');
      }
      
      return { base64, processedFile };
    } catch (error) {
      console.error('Error converting file to base64 on server:', error);
      console.error('File details:', { 
        name: file?.name, 
        size: file?.size, 
        type: file?.type 
      });
      throw new Error(`Failed to process image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Compress image to reduce size using Sharp
  private async compressImage(file: File): Promise<File> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Get image metadata to determine dimensions
      const metadata = await sharp(buffer).metadata();
      const { width = 0, height = 0 } = metadata;
      
      // Calculate new dimensions
      const maxDimension = 1200;
      let newWidth = width;
      let newHeight = height;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          newHeight = Math.round((height * maxDimension) / width);
          newWidth = maxDimension;
        } else {
          newWidth = Math.round((width * maxDimension) / height);
          newHeight = maxDimension;
        }
      }
      
      // Compress and resize image
      const compressedBuffer = await sharp(buffer)
        .resize(newWidth, newHeight)
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
        .toBuffer();
      
      // Create new File object
      const compressedFile = new File([compressedBuffer], file.name.replace(/\.[^/.]+$/, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      
      console.log('Image compressed:', {
        originalSize: file.size,
        compressedSize: compressedFile.size,
        originalDimensions: `${width}x${height}`,
        newDimensions: `${newWidth}x${newHeight}`
      });
      
      return compressedFile;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Client-side file to base64 conversion (kept for reference)
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}