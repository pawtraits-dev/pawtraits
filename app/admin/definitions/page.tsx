// app/admin/definitions/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { EnhancedPromptGenerator } from '@/lib/enhanced-prompt-generator';
import { FormatsManager, BreedForm, ThemeForm, StyleForm, FormatForm } from './components';

interface Breed {
  id: string;
  name: string;
  slug: string;
  description: string;
  physical_traits: any;
  personality_traits: string[];
  alternative_names: string[];
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
  sort_order: number;
}

interface Style {
  id: string;
  name: string;
  slug: string;
  description: string;
  prompt_suffix: string;
  technical_parameters: any;
  is_active: boolean;
  sort_order: number;
}

interface Format {
  id: string;
  name: string;
  slug: string;
  aspect_ratio: string;
  use_case: string;
  prompt_adjustments: string;
  midjourney_parameters: string;
  is_active: boolean;
}

type TabType = 'breeds' | 'themes' | 'styles' | 'formats' | 'generate' | 'export';

export default function DefinitionsAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('breeds');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<any[]>([]);

  const supabase = createClientComponentClient();
  const promptGenerator = new EnhancedPromptGenerator(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadAllDefinitions();
  }, []);

  const loadAllDefinitions = async () => {
    setIsLoading(true);
    try {
      const [breedsResult, themesResult, stylesResult, formatsResult] = await Promise.all([
        supabase.from('breeds').select('*').order('popularity_rank'),
        supabase.from('themes').select('*').order('sort_order'),
        supabase.from('styles').select('*').order('sort_order'),
        supabase.from('formats').select('*').order('name')
      ]);

      if (breedsResult.error) throw breedsResult.error;
      if (themesResult.error) throw themesResult.error;
      if (stylesResult.error) throw stylesResult.error;
      if (formatsResult.error) throw formatsResult.error;

      setBreeds(breedsResult.data || []);
      setThemes(themesResult.data || []);
      setStyles(stylesResult.data || []);
      setFormats(formatsResult.data || []);
    } catch (error) {
      console.error('Error loading definitions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const testPromptGeneration = async () => {
    setIsGenerating(true);
    try {
      const prompts = await promptGenerator.generateMatrix({
        breeds: ['golden-retriever', 'french-bulldog'],
        themes: ['christmas', 'sports'],
        styles: ['realistic'],
        genders: ['male']
      });
      
      setGeneratedPrompts(prompts);
    } catch (error) {
      console.error('Error generating prompts:', error);
      alert('Error generating prompts. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPrompts = async (format: 'txt' | 'csv' | 'json') => {
    if (generatedPrompts.length === 0) {
      alert('Generate prompts first');
      return;
    }

    const output = promptGenerator.exportPrompts(generatedPrompts, format);
    
    // Create and download file
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading definitions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Definitions Manager</h1>
              <p className="text-gray-600">Manage breeds, themes, styles, and generate prompts</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => loadAllDefinitions()}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'breeds', label: 'Breeds', count: breeds.length },
              { id: 'themes', label: 'Themes', count: themes.length },
              { id: 'styles', label: 'Styles', count: styles.length },
              { id: 'formats', label: 'Formats', count: formats.length },
              { id: 'generate', label: 'Generate', icon: '⚡' },
              { id: 'export', label: 'Export', icon: '📤' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon && <span className="mr-2">{tab.icon}</span>}
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-2 bg-gray-200 text-gray-600 py-1 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breeds Tab */}
        {activeTab === 'breeds' && (
          <BreedsManager breeds={breeds} onUpdate={loadAllDefinitions} />
        )}

        {/* Themes Tab */}
        {activeTab === 'themes' && (
          <ThemesManager themes={themes} onUpdate={loadAllDefinitions} />
        )}

        {/* Styles Tab */}
        {activeTab === 'styles' && (
          <StylesManager styles={styles} onUpdate={loadAllDefinitions} />
        )}

        {/* Formats Tab */}
        {activeTab === 'formats' && (
          <FormatsManager formats={formats} onUpdate={loadAllDefinitions} />
        )}

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">🎯 Prompt Generation</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{breeds.filter((b: any) => b.is_active).length}</div>
                  <div className="text-blue-800 font-medium">Active Breeds</div>
                </div>
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{themes.filter((t: any) => t.is_active).length}</div>
                  <div className="text-green-800 font-medium">Active Themes</div>
                </div>
                <div className="text-center p-6 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{styles.filter((s: any) => s.is_active).length}</div>
                  <div className="text-purple-800 font-medium">Active Styles</div>
                </div>
                <div className="text-center p-6 bg-orange-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{formats.filter((f: any) => f.is_active).length}</div>
                  <div className="text-orange-800 font-medium">Active Formats</div>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={testPromptGeneration}
                  disabled={isGenerating}
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating Prompts...' : 'Generate Test Prompts'}
                </button>

                <p className="text-gray-600 text-sm">
                  This will generate prompts for Golden Retriever + French Bulldog across Christmas + Sports themes
                </p>
              </div>

              {generatedPrompts.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="font-semibold mb-4">Generated Prompts ({generatedPrompts.length})</h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {generatedPrompts.slice(0, 5).map((prompt, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">
                            {prompt.breed.name} - {prompt.theme.name} - {prompt.style.name}
                          </div>
                          <div className="flex gap-2">
                            {prompt.tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 font-mono bg-white p-3 rounded border">
                          {prompt.final_prompt}
                        </div>
                      </div>
                    ))}
                    {generatedPrompts.length > 5 && (
                      <div className="text-center text-gray-500">
                        ... and {generatedPrompts.length - 5} more prompts
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">📤 Export Prompts</h2>
              
              {generatedPrompts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No prompts generated</h3>
                  <p className="text-gray-600 mb-4">Go to the Generate tab to create prompts first</p>
                  <button
                    onClick={() => setActiveTab('generate')}
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
                  >
                    Generate Prompts
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-green-800">
                      ✅ {generatedPrompts.length} prompts ready for export
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => exportPrompts('txt')}
                      className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-2xl mb-2">📄</div>
                      <div className="font-medium">Text File (.txt)</div>
                      <div className="text-sm text-gray-600">Ready for Midjourney copy-paste</div>
                    </button>

                    <button
                      onClick={() => exportPrompts('csv')}
                      className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-2xl mb-2">📊</div>
                      <div className="font-medium">CSV File (.csv)</div>
                      <div className="text-sm text-gray-600">For spreadsheet analysis</div>
                    </button>

                    <button
                      onClick={() => exportPrompts('json')}
                      className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-2xl mb-2">🔧</div>
                      <div className="font-medium">JSON File (.json)</div>
                      <div className="text-sm text-gray-600">For API integration</div>
                    </button>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">💡 Usage Tips</h4>
                    <ul className="text-yellow-700 text-sm space-y-1">
                      <li>• Use <strong>TXT</strong> for direct copy-paste into Midjourney</li>
                      <li>• Use <strong>CSV</strong> for tracking generation results and quality ratings</li>
                      <li>• Use <strong>JSON</strong> for automated prompt processing systems</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Breeds Manager Component
function BreedsManager({ breeds, onUpdate }: { breeds: Breed[], onUpdate: () => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the breed "${name}"?`)) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/breeds/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onUpdate();
      } else {
        alert('Failed to delete breed');
      }
    } catch (error) {
      console.error('Error deleting breed:', error);
      alert('Error deleting breed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">🐕 Breeds Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          Add Breed
        </button>
      </div>

      {showAddForm && (
        <BreedForm
          onSubmit={async (data) => {
            const response = await fetch('/api/breeds', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setShowAddForm(false);
              onUpdate();
            }
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editingBreed && (
        <BreedForm
          breed={editingBreed}
          onSubmit={async (data) => {
            const response = await fetch(`/api/breeds/${editingBreed.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setEditingBreed(null);
              onUpdate();
            }
          }}
          onCancel={() => setEditingBreed(null)}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Traits</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {breeds.map(breed => (
              <tr key={breed.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  #{breed.popularity_rank || '?'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{breed.name}</div>
                  <div className="text-sm text-gray-500 line-clamp-2">
                    {breed.description.substring(0, 80)}...
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {breed.slug}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {breed.personality_traits.slice(0, 3).map(trait => (
                      <span key={trait} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {trait}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    breed.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {breed.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setEditingBreed(breed)}
                    className="text-purple-600 hover:text-purple-900 mr-4"
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(breed.id, breed.name)}
                    className="text-red-600 hover:text-red-900"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Themes Manager Component  
function ThemesManager({ themes, onUpdate }: { themes: Theme[], onUpdate: () => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the theme "${name}"?`)) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/themes/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onUpdate();
      } else {
        alert('Failed to delete theme');
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      alert('Error deleting theme');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">🎨 Themes Management</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          Add Theme
        </button>
      </div>

      {showAddForm && (
        <ThemeForm
          onSubmit={async (data) => {
            const response = await fetch('/api/themes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setShowAddForm(false);
              onUpdate();
            }
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editingTheme && (
        <ThemeForm
          theme={editingTheme}
          onSubmit={async (data) => {
            const response = await fetch(`/api/themes/${editingTheme.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setEditingTheme(null);
              onUpdate();
            }
          }}
          onCancel={() => setEditingTheme(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map(theme => (
          <div key={theme.id} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-lg">{theme.name}</h3>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                theme.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {theme.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">{theme.description}</p>
            
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 mb-2">KEYWORDS</div>
              <div className="flex flex-wrap gap-1">
                {theme.style_keywords.map(keyword => (
                  <span key={keyword} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 mb-2">PROMPT TEMPLATE</div>
              <div className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded line-clamp-3">
                {theme.base_prompt_template}
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setEditingTheme(theme)}
                className="flex-1 bg-purple-100 text-purple-700 px-3 py-2 rounded text-sm hover:bg-purple-200"
                disabled={isLoading}
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(theme.id, theme.name)}
                className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-200"
                disabled={isLoading}
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles Manager Component
function StylesManager({ styles, onUpdate }: { styles: Style[], onUpdate: () => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStyle, setEditingStyle] = useState<Style | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the style "${name}"?`)) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/styles/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onUpdate();
      } else {
        alert('Failed to delete style');
      }
    } catch (error) {
      console.error('Error deleting style:', error);
      alert('Error deleting style');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">✨ Styles Management</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          Add Style
        </button>
      </div>

      {showAddForm && (
        <StyleForm
          onSubmit={async (data) => {
            const response = await fetch('/api/styles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setShowAddForm(false);
              onUpdate();
            }
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editingStyle && (
        <StyleForm
          style={editingStyle}
          onSubmit={async (data) => {
            const response = await fetch(`/api/styles/${editingStyle.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setEditingStyle(null);
              onUpdate();
            }
          }}
          onCancel={() => setEditingStyle(null)}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt Suffix</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {styles.map(style => (
              <tr key={style.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{style.name}</div>
                  <div className="text-sm text-gray-500">{style.slug}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 line-clamp-2">{style.description}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded line-clamp-2 max-w-xs">
                    {style.prompt_suffix}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    style.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {style.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => setEditingStyle(style)}
                    className="text-purple-600 hover:text-purple-900 mr-4"
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(style.id, style.name)}
                    className="text-red-600 hover:text-red-900"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}