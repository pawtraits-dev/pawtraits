/**
 * Render one of the email templates in lib/messaging/templates (shared layout and parts included)
 * for emails sent straight away with sendMessageImmediate. Server only.
 */
import fs from 'fs';
import path from 'path';
import { renderTemplate } from './template-engine';

export function renderEmailFile(file: string, variables: Record<string, any>): string {
  const html = fs.readFileSync(path.join(process.cwd(), 'lib', 'messaging', 'templates', file), 'utf8');
  return renderTemplate(html, { base_url: process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics', ...variables });
}
