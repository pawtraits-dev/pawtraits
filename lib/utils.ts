import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Extract the title from AI description (text between ** markers)
export function extractDescriptionTitle(description?: string): string {
  if (!description) return '';
  
  // Look for text between ** markers at the start
  const titleMatch = description.match(/^\*\*(.*?)\*\*/);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  // Fallback: return first line/sentence if no ** markers found
  const firstLine = description.split('\n')[0].trim();
  const firstSentence = firstLine.split('.')[0];
  return firstSentence.length < firstLine.length ? firstSentence + '.' : firstLine;
}
