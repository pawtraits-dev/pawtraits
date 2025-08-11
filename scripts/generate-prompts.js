#!/usr/bin/env node
// scripts/generate-prompts.js

import { Command } from 'commander';
import { PromptGenerator } from '../lib/prompt-generator.js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const program = new Command();

program
  .name('generate-prompts')
  .description('Generate AI prompts for pet portraits')
  .version('1.0.0');

// Validate environment variables
function validateEnv() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   ${key}`));
    console.error('\nPlease check your .env.local file');
    process.exit(1);
  }
}

// Test single prompt generation
program
  .command('test')
  .description('Generate and display a single test prompt')
  .option('-b, --breed <breed>', 'Breed slug', 'golden-retriever')
  .option('-t, --theme <theme>', 'Theme slug', 'christmas')
  .option('-s, --style <style>', 'Style slug', 'realistic')
  .option('-f, --format <format>', 'Format slug', 'product-portrait')
  .option('-g, --gender <gender>', 'Gender', 'male')
  .action(async (options) => {
    validateEnv();
    
    console.log('🎯 Generating Test Prompt...');
    
    const generator = new PromptGenerator(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
      const definitions = await generator.loadDefinitions();
      
      const breed = definitions.breeds.find(b => b.slug === options.breed);
      const theme = definitions.themes.find(t => t.slug === options.theme);
      const style = definitions.styles.find(s => s.slug === options.style);
      const format = definitions.formats.find(f => f.slug === options.format);
      const template = definitions.templates[0];

      if (!breed || !theme || !style || !format || !template) {
        console.error('❌ Could not find all required definitions');
        console.error(`   Breed: ${breed ? '✅' : '❌'} ${options.breed}`);
        console.error(`   Theme: ${theme ? '✅' : '❌'} ${options.theme}`);
        console.error(`   Style: ${style ? '✅' : '❌'} ${options.style}`);
        console.error(`   Format: ${format ? '✅' : '❌'} ${options.format}`);
        process.exit(1);
      }

      const prompt = await generator.generatePrompt(breed, theme, style, format, template, {
        gender: options.gender
      });

      console.log('\n📋 Generated Prompt:');
      console.log(`   Breed: ${prompt.breed.name}`);
      console.log(`   Theme: ${prompt.theme.name}`);
      console.log(`   Style: ${prompt.style.name}`);
      console.log(`   Format: ${prompt.format.name} (${prompt.format.aspect_ratio})`);
      console.log(`   Use Case: ${prompt.format.use_case}`);
      console.log(`   Gender: ${options.gender}`);
      console.log('\n📝 Final Prompt:');
      console.log(`   ${prompt.final_prompt}`);
      console.log('\n📁 Filename:');
      console.log(`   ${prompt.filename}`);
      console.log('\n🏷️  Tags:');
      console.log(`   ${prompt.tags.join(', ')}`);

    } catch (error) {
      console.error('❌ Error generating test prompt:', error);
      process.exit(1);
    }
  });

// List available definitions
program
  .command('list')
  .description('List available breeds, themes, styles, and formats')
  .option('-t, --type <type>', 'Type to list (breeds|themes|styles|formats|all)', 'all')
  .action(async (options) => {
    validateEnv();
    
    const generator = new PromptGenerator(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
      const definitions = await generator.loadDefinitions();

      if (options.type === 'breeds' || options.type === 'all') {
        console.log('\n🐕 Available Breeds:');
        definitions.breeds.forEach(breed => {
          console.log(`   ${breed.slug} - ${breed.name} ${breed.is_active ? '✅' : '❌'}`);
        });
      }

      if (options.type === 'themes' || options.type === 'all') {
        console.log('\n🎨 Available Themes:');
        definitions.themes.forEach(theme => {
          console.log(`   ${theme.slug} - ${theme.name} ${theme.is_active ? '✅' : '❌'}`);
        });
      }

      if (options.type === 'styles' || options.type === 'all') {
        console.log('\n✨ Available Styles:');
        definitions.styles.forEach(style => {
          console.log(`   ${style.slug} - ${style.name} ${style.is_active ? '✅' : '❌'}`);
        });
      }

      if (options.type === 'formats' || options.type === 'all') {
        console.log('\n📱 Available Formats:');
        definitions.formats.forEach(format => {
          console.log(`   ${format.slug} - ${format.name} (${format.aspect_ratio}) - ${format.use_case} ${format.is_active ? '✅' : '❌'}`);
        });
      }

    } catch (error) {
      console.error('❌ Error listing definitions:', error);
      process.exit(1);
    }
  });

// Generate Christmas collection
program
  .command('christmas')
  .description('Generate Christmas collection across multiple formats')
  .option('-b, --breeds <breeds>', 'Comma-separated list of breed slugs', 'golden-retriever,french-bulldog,german-shepherd')
  .option('-s, --styles <styles>', 'Comma-separated list of style slugs', 'realistic')
  .option('-f, --formats <formats>', 'Comma-separated list of format slugs', 'product-portrait,instagram-post')
  .option('-g, --genders <genders>', 'Comma-separated list of genders', 'male,female')
  .option('-o, --output <dir>', 'Output directory', './generated-prompts')
  .action(async (options) => {
    validateEnv();
    
    console.log('🎄 Generating Christmas Collection...');
    
    const generator = new PromptGenerator(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
      const breeds = options.breeds.split(',');
      const styles = options.styles.split(',');
      const formats = options.formats.split(',');
      const genders = options.genders.split(',');

      console.log(`📋 Configuration:`);
      console.log(`   Breeds: ${breeds.join(', ')}`);
      console.log(`   Styles: ${styles.join(', ')}`);
      console.log(`   Formats: ${formats.join(', ')}`);
      console.log(`   Genders: ${genders.join(', ')}`);
      console.log(`   Expected prompts: ${breeds.length * styles.length * formats.length * genders.length}`);
      
      const prompts = await generator.generateMatrix({
        themes: ['christmas'],
        breeds,
        styles,
        formats,
        genders
      });

      // Create output directory
      const outputDir = options.output;
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Export all formats
      const txtOutput = generator.exportPrompts(prompts, 'txt');
      const csvOutput = generator.exportPrompts(prompts, 'csv');
      const jsonOutput = generator.exportPrompts(prompts, 'json');

      fs.writeFileSync(path.join(outputDir, 'christmas-prompts.txt'), txtOutput);
      fs.writeFileSync(path.join(outputDir, 'christmas-prompts.csv'), csvOutput);
      fs.writeFileSync(path.join(outputDir, 'christmas-prompts.json'), jsonOutput);

      // Group by format and export separate files
      const formatGroups = prompts.reduce((groups, prompt) => {
        const formatSlug = prompt.format.slug;
        if (!groups[formatSlug]) groups[formatSlug] = [];
        groups[formatSlug].push(prompt);
        return groups;
      }, {});

      Object.entries(formatGroups).forEach(([formatSlug, formatPrompts]) => {
        const formatOutput = generator.exportPrompts(formatPrompts, 'txt');
        fs.writeFileSync(path.join(outputDir, `christmas-${formatSlug}.txt`), formatOutput);
        console.log(`   📄 christmas-${formatSlug}.txt (${formatPrompts.length} prompts)`);
      });

      console.log(`✅ Generated ${prompts.length} Christmas prompts`);
      console.log(`📁 Files saved to: ${outputDir}/`);

    } catch (error) {
      console.error('❌ Error generating Christmas collection:', error);
      process.exit(1);
    }
  });

// Quick collections
program
  .command('quick')
  .description('Generate quick collections for popular combinations')
  .option('-o, --output <dir>', 'Output directory', './generated-prompts')
  .action(async (options) => {
    validateEnv();
    
    console.log('⚡ Generating Quick Collections...');
    
    const generator = new PromptGenerator(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
      const collections = [
        {
          name: 'christmas-products',
          breeds: ['golden-retriever', 'french-bulldog', 'german-shepherd'],
          themes: ['christmas'],
          styles: ['realistic'],
          formats: ['product-portrait'],
          genders: ['male', 'female']
        },
        {
          name: 'christmas-social',
          breeds: ['golden-retriever', 'french-bulldog'],
          themes: ['christmas'],
          styles: ['realistic'],
          formats: ['instagram-post', 'instagram-story'],
          genders: ['male']
        },
        {
          name: 'sports-social',
          breeds: ['german-shepherd', 'bulldog'],
          themes: ['sports'],
          styles: ['realistic'],
          formats: ['instagram-post', 'youtube-thumbnail'],
          genders: ['male']
        }
      ];

      const outputDir = options.output;
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      for (const collection of collections) {
        console.log(`\n📦 Generating ${collection.name}...`);
        
        const prompts = await generator.generateMatrix(collection);
        const txtOutput = generator.exportPrompts(prompts, 'txt');
        
        fs.writeFileSync(path.join(outputDir, `${collection.name}.txt`), txtOutput);
        console.log(`   ✅ ${prompts.length} prompts → ${collection.name}.txt`);
      }

      console.log(`\n🎉 All quick collections generated in: ${outputDir}/`);

    } catch (error) {
      console.error('❌ Error generating quick collections:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}