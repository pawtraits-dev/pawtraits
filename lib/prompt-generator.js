// lib/prompt-generator.js
import { createClient } from '@supabase/supabase-js';

export class PromptGenerator {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Fetch all active definitions from database
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
      breeds: breedsResult.data,
      themes: themesResult.data,
      styles: stylesResult.data,
      formats: formatsResult.data,
      templates: templatesResult.data
    };
  }

  /**
   * Generate a single prompt for a specific combination
   */
  async generatePrompt(breed, theme, style, format, template, options = {}) {
    // Build the base prompt with breed description
    let basePrompt = theme.base_prompt_template.replace(
      '{breed_description}',
      this.getBreedsDescription(breed, options.gender)
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
      .replace('{midjourney_parameters}', format.midjourney_parameters);

    // Generate tags and filename
    const tags = this.generateTags(breed, theme, style, format, options.gender);
    const filename = this.generateFilename(breed, theme, style, format, options.gender);

    return {
      breed,
      theme,
      style,
      format,
      template,
      final_prompt: finalPrompt.trim(),
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
   * Generate prompts for multiple combinations
   */
  async generateMatrix(criteria, templateName = 'Midjourney Standard') {
    const definitions = await this.loadDefinitions();
    
    const template = definitions.templates.find(t => t.name === templateName);
    if (!template) throw new Error(`Template "${templateName}" not found`);

    // Filter definitions based on criteria
    const targetBreeds = criteria.breeds 
      ? definitions.breeds.filter(b => criteria.breeds.includes(b.slug))
      : definitions.breeds;

    const targetThemes = criteria.themes
      ? definitions.themes.filter(t => criteria.themes.includes(t.slug))
      : definitions.themes;

    const targetStyles = criteria.styles
      ? definitions.styles.filter(s => criteria.styles.includes(s.slug))
      : definitions.styles;

    const targetFormats = criteria.formats
      ? definitions.formats.filter(f => criteria.formats.includes(f.slug))
      : [definitions.formats.find(f => f.slug === 'product-portrait')];

    const targetGenders = criteria.genders || ['male', 'female'];

    // Generate all combinations
    const results = [];
    for (const breed of targetBreeds) {
      for (const theme of targetThemes) {
        for (const style of targetStyles) {
          for (const format of targetFormats) {
            for (const gender of targetGenders) {
              const prompt = await this.generatePrompt(breed, theme, style, format, template, { gender });
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
   * Get breed description with gender adjustments
   */
  getBreedsDescription(breed, gender) {
    let description = breed.description;

    // Simple gender adjustments
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
   * Generate tags for the combination
   */
  generateTags(breed, theme, style, format, gender) {
    const tags = [
      breed.slug,
      theme.slug,
      style.slug,
      format.slug,
      ...theme.style_keywords,
      ...breed.personality_traits,
      ...(gender ? [gender] : []),
      ...(breed.physical_traits?.typical_colors || []),
      breed.physical_traits?.size || '',
      format.use_case,
      format.aspect_ratio,
      'ai-generated',
      'pet-portrait'
    ].filter(Boolean);

    return [...new Set(tags)];
  }

  /**
   * Generate filename for organization
   */
  generateFilename(breed, theme, style, format, gender) {
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
   * Export prompts to various formats
   */
  exportPrompts(prompts, format = 'txt') {
    switch (format) {
      case 'csv':
        const headers = ['breed', 'theme', 'style', 'format', 'gender', 'aspect_ratio', 'use_case', 'filename', 'prompt', 'tags'];
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
          p.tags.join(';')
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
          tags: p.tags
        })), null, 2);

      case 'txt':
      default:
        return prompts.map(p => {
          return `// ${p.filename}\n// ${p.format.name} (${p.format.aspect_ratio}) - ${p.format.use_case}\n${p.final_prompt}\n\n`;
        }).join('');
    }
  }
}