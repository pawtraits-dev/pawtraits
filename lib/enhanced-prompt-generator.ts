// lib/enhanced-prompt-generator.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface Breed {
  id: string;
  name: string;
  slug: string;
  description: string;
  physical_traits: any;
  personality_traits: string[];
  popularity_rank: number;
  is_active: boolean;
}

interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_prompt_template: string;
  style_keywords: string[];
  seasonal_relevance: any;
  is_active: boolean;
}

interface Style {
  id: string;
  name: string;
  slug: string;
  description: string;
  prompt_suffix: string;
  technical_parameters: any;
  is_active: boolean;
}

interface Format {
  id: string;
  name: string;
  slug: string;
  description: string;
  aspect_ratio: string;
  use_case: string;
  prompt_adjustments: string;
  midjourney_parameters: string;
  is_active: boolean;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: any;
  ai_platform: string;
  is_active: boolean;
}

interface GeneratedPrompt {
  breed: Breed;
  theme: Theme;
  style: Style;
  format: Format;
  template: PromptTemplate;
  final_prompt: string;
  tags: string[];
  filename: string;
  generation_parameters: any;
}

interface GenerationCriteria {
  breeds?: string[];
  themes?: string[];
  styles?: string[];
  formats?: string[];
  genders?: string[];
  customizations?: Record<string, string>;
}

export class EnhancedPromptGenerator {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Load all active definitions from database
   */
  async loadDefinitions() {
    const [breedsResult, themesResult, stylesResult, formatsResult, templatesResult] = await Promise.all([
      this.supabase.from('breeds').select('*').eq('is_active', true).order('popularity_rank'),
      this.supabase.from('themes').select('*').eq('is_active', true).order('sort_order'),
      this.supabase.from('styles').select('*').eq('is_active', true).order('sort_order'),
      this.supabase.from('formats').select('*').eq('is_active', true).order('sort_order'),
      this.supabase.from('prompt_templates').select('*').eq('is_active', true)
    ]);

    if (breedsResult.error) throw breedsResult.error;
    if (themesResult.error) throw themesResult.error;
    if (stylesResult.error) throw stylesResult.error;
    if (formatsResult.error) throw formatsResult.error;
    if (templatesResult.error) throw templatesResult.error;

    return {
      breeds: breedsResult.data as Breed[],
      themes: themesResult.data as Theme[],
      styles: stylesResult.data as Style[],
      formats: formatsResult.data as Format[],
      templates: templatesResult.data as PromptTemplate[]
    };
  }

  /**
   * Generate a single prompt for a specific combination
   */
  async generatePrompt(
    breed: Breed, 
    theme: Theme, 
    style: Style, 
    format: Format, 
    template: PromptTemplate, 
    options: { gender?: string; customizations?: Record<string, string> } = {}
  ): Promise<GeneratedPrompt> {
    // Build the base prompt with breed description
    let basePrompt = theme.base_prompt_template.replace(
      '{breed_description}',
      this.getBreedDescription(breed, options.gender)
    );

    // Apply any custom substitutions
    if (options.customizations) {
      Object.entries(options.customizations).forEach(([key, value]) => {
        basePrompt = basePrompt.replace(`{${key}}`, value);
      });
    }

    // Build format adjustments
    const formatAdjustments = format.prompt_adjustments ? `, ${format.prompt_adjustments}` : '';

    // Build final prompt using template
    let finalPrompt = template.template
      .replace('{base_prompt}', basePrompt)
      .replace('{style_suffix}', style.prompt_suffix)
      .replace('{format_adjustments}', formatAdjustments)
      .replace('{midjourney_parameters}', format.midjourney_parameters)
      .replace('{aspect_ratio}', format.aspect_ratio);

    // Clean up any remaining placeholders
    finalPrompt = finalPrompt.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();

    // Generate tags and filename
    const tags = this.generateTags(breed, theme, style, format, options.gender);
    const filename = this.generateFilename(breed, theme, style, format, options.gender);

    return {
      breed,
      theme,
      style,
      format,
      template,
      final_prompt: finalPrompt,
      tags,
      filename,
      generation_parameters: {
        breed_id: breed.id,
        theme_id: theme.id,
        style_id: style.id,
        format_id: format.id,
        template_id: template.id,
        options: options
      }
    };
  }

  /**
   * Generate prompts for multiple combinations with smart batching
   */
  async generateMatrix(criteria: GenerationCriteria, templateName = 'Midjourney Standard'): Promise<GeneratedPrompt[]> {
    const definitions = await this.loadDefinitions();
    
    const template = definitions.templates.find(t => t.name === templateName);
    if (!template) throw new Error(`Template "${templateName}" not found`);

    // Filter definitions based on criteria
    const targetBreeds = criteria.breeds 
      ? definitions.breeds.filter(b => criteria.breeds!.includes(b.slug))
      : definitions.breeds.slice(0, 5); // Default to top 5 breeds

    const targetThemes = criteria.themes
      ? definitions.themes.filter(t => criteria.themes!.includes(t.slug))
      : definitions.themes.slice(0, 3); // Default to top 3 themes

    const targetStyles = criteria.styles
      ? definitions.styles.filter(s => criteria.styles!.includes(s.slug))
      : [definitions.styles.find(s => s.slug === 'realistic')!]; // Default to realistic

    const targetFormats = criteria.formats
      ? definitions.formats.filter(f => criteria.formats!.includes(f.slug))
      : [definitions.formats.find(f => f.slug === 'product-portrait')!]; // Default to product portrait

    const targetGenders = criteria.genders || ['male'];

    // Generate all combinations
    const results: GeneratedPrompt[] = [];
    for (const breed of targetBreeds) {
      for (const theme of targetThemes) {
        for (const style of targetStyles) {
          for (const format of targetFormats) {
            for (const gender of targetGenders) {
              const prompt = await this.generatePrompt(breed, theme, style, format, template, { 
                gender,
                customizations: criteria.customizations 
              });
              results.push(prompt);
            }
          }
        }
      }
    }

    console.log(`Generated ${results.length} prompt combinations`);
    return results;
  }

  /**
   * Generate prompts organized by format for efficient batch processing
   */
  async generateByFormat(criteria: GenerationCriteria, templateName = 'Midjourney Standard') {
    const prompts = await this.generateMatrix(criteria, templateName);
    
    // Group by format for organized generation
    const formatGroups = prompts.reduce((groups, prompt) => {
      const formatSlug = prompt.format.slug;
      if (!groups[formatSlug]) {
        groups[formatSlug] = {
          format: prompt.format,
          prompts: []
        };
      }
      groups[formatSlug].prompts.push(prompt);
      return groups;
    }, {} as Record<string, { format: Format; prompts: GeneratedPrompt[] }>);

    return formatGroups;
  }

  /**
   * Get breed description with gender adjustments
   */
  private getBreedDescription(breed: Breed, gender?: string): string {
    let description = breed.description;

    // Apply gender adjustments
    if (gender === 'female') {
      description = description
        .replace(/\bhis\b/g, 'her')
        .replace(/\bhe\b/g, 'she')
        .replace(/\bhim\b/g, 'her');
    } else if (gender === 'male') {
      description = description
        .replace(/\bher\b/g, 'his')
        .replace(/\bshe\b/g, 'he');
    }

    return description;
  }

  /**
   * Generate comprehensive tags for the combination
   */
  private generateTags(breed: Breed, theme: Theme, style: Style, format: Format, gender?: string): string[] {
    const tags = [
      breed.slug,
      theme.slug,
      style.slug,
      format.slug,
      format.use_case,
      ...theme.style_keywords,
      ...breed.personality_traits,
      ...(gender ? [gender] : []),
      ...(breed.physical_traits?.typical_colors || []),
      breed.physical_traits?.size || '',
      format.aspect_ratio.replace(':', 'x'),
      'ai-generated',
      'pet-portrait'
    ].filter(Boolean);

    return Array.from(new Set(tags)); // Remove duplicates
  }

  /**
   * Generate organized filename for easy identification
   */
  private generateFilename(breed: Breed, theme: Theme, style: Style, format: Format, gender?: string): string {
    const parts = [
      breed.slug,
      theme.slug,
      style.slug,
      format.slug,
      gender || 'neutral'
    ];
    
    return parts.join('-');
  }

  /**
   * Export prompts to various formats with enhanced organization
   */
  exportPrompts(prompts: GeneratedPrompt[], format = 'txt'): string {
    switch (format) {
      case 'csv':
        const headers = [
          'breed', 'theme', 'style', 'format', 'gender', 'aspect_ratio', 
          'use_case', 'filename', 'prompt', 'tags', 'midjourney_params'
        ];
        const rows = prompts.map(p => [
          p.breed.name,
          p.theme.name,
          p.style.name,
          p.format.name,
          p.generation_parameters.options?.gender || 'neutral',
          p.format.aspect_ratio,
          p.format.use_case,
          p.filename,
          `"${p.final_prompt.replace(/"/g, '""')}"`,
          p.tags.join(';'),
          p.format.midjourney_parameters
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');

      case 'json':
        return JSON.stringify(prompts.map(p => ({
          breed: p.breed.name,
          theme: p.theme.name,
          style: p.style.name,
          format: p.format.name,
          aspect_ratio: p.format.aspect_ratio,
          use_case: p.format.use_case,
          filename: p.filename,
          prompt: p.final_prompt,
          tags: p.tags,
          midjourney_parameters: p.format.midjourney_parameters
        })), null, 2);

      case 'txt':
      default:
        return prompts.map(p => {
          return [
            `// ${p.filename}`,
            `// ${p.format.name} (${p.format.aspect_ratio}) - ${p.format.use_case}`,
            `${p.final_prompt}`,
            '',
            ''
          ].join('\n');
        }).join('');
    }
  }

  /**
   * Export organized by format for efficient Midjourney batch processing
   */
  exportByFormat(formatGroups: Record<string, { format: Format; prompts: GeneratedPrompt[] }>, exportFormat = 'txt') {
    const exports: Record<string, string> = {};
    
    Object.entries(formatGroups).forEach(([formatSlug, group]) => {
      const header = [
        `# ${group.format.name} Collection (${group.format.aspect_ratio})`,
        `# Use Case: ${group.format.use_case}`,
        `# Total Prompts: ${group.prompts.length}`,
        `# Generated: ${new Date().toISOString()}`,
        '',
        ''
      ].join('\n');
      
      const content = this.exportPrompts(group.prompts, exportFormat);
      exports[formatSlug] = header + content;
    });
    
    return exports;
  }

  /**
   * Generate collection summary for planning
   */
  generateCollectionSummary(prompts: GeneratedPrompt[]) {
    const summary = {
      total_prompts: prompts.length,
      breeds: Array.from(new Set(prompts.map(p => p.breed.name))),
      themes: Array.from(new Set(prompts.map(p => p.theme.name))),
      styles: Array.from(new Set(prompts.map(p => p.style.name))),
      formats: Array.from(new Set(prompts.map(p => p.format.name))),
      by_format: {} as Record<string, number>,
      by_use_case: {} as Record<string, number>,
      estimated_generation_time: prompts.length * 60 // 60 seconds per prompt average
    };

    prompts.forEach(p => {
      summary.by_format[p.format.name] = (summary.by_format[p.format.name] || 0) + 1;
      summary.by_use_case[p.format.use_case] = (summary.by_use_case[p.format.use_case] || 0) + 1;
    });

    return summary;
  }
}