import React, { useState } from 'react';

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

// Formats Manager Component
export function FormatsManager({ formats, onUpdate }: { formats: Format[], onUpdate: () => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFormat, setEditingFormat] = useState<Format | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the format "${name}"?`)) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/formats/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onUpdate();
      } else {
        alert('Failed to delete format');
      }
    } catch (error) {
      console.error('Error deleting format:', error);
      alert('Error deleting format');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">📐 Formats Management</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          Add Format
        </button>
      </div>

      {showAddForm && (
        <FormatForm
          onSubmit={async (data) => {
            const response = await fetch('/api/formats', {
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

      {editingFormat && (
        <FormatForm
          format={editingFormat}
          onSubmit={async (data) => {
            const response = await fetch(`/api/formats/${editingFormat.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (response.ok) {
              setEditingFormat(null);
              onUpdate();
            }
          }}
          onCancel={() => setEditingFormat(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formats.map(format => (
          <div key={format.id} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-lg">{format.name}</h3>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                format.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {format.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">ASPECT RATIO</div>
                <div className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                  {format.aspect_ratio}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">USE CASE</div>
                <div className="text-sm text-gray-700">{format.use_case}</div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => setEditingFormat(format)}
                className="flex-1 bg-purple-100 text-purple-700 px-3 py-2 rounded text-sm hover:bg-purple-200"
                disabled={isLoading}
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(format.id, format.name)}
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

// Form Components
export function BreedForm({ breed, onSubmit, onCancel }: { 
  breed?: Breed; 
  onSubmit: (data: any) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: breed?.name || '',
    description: breed?.description || '',
    popularity_rank: breed?.popularity_rank || 1,
    personality_traits: breed?.personality_traits?.join(', ') || '',
    alternative_names: breed?.alternative_names?.join(', ') || '',
    is_active: breed?.is_active ?? true,
    physical_traits: JSON.stringify(breed?.physical_traits || {}, null, 2)
  });

  const generateSlug = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      slug: generateSlug(formData.name),
      personality_traits: formData.personality_traits.split(',').map(t => t.trim()).filter(Boolean),
      alternative_names: formData.alternative_names.split(',').map(n => n.trim()).filter(Boolean),
      physical_traits: formData.physical_traits ? JSON.parse(formData.physical_traits) : {}
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">
        {breed ? 'Edit Breed' : 'Add New Breed'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Popularity Rank</label>
            <input
              type="number"
              value={formData.popularity_rank}
              onChange={(e) => setFormData({...formData, popularity_rank: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              min="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Personality Traits (comma-separated)</label>
          <input
            type="text"
            value={formData.personality_traits}
            onChange={(e) => setFormData({...formData, personality_traits: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="playful, loyal, energetic"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Names (comma-separated)</label>
          <input
            type="text"
            value={formData.alternative_names}
            onChange={(e) => setFormData({...formData, alternative_names: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Golden, Goldie"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Physical Traits (JSON)</label>
          <textarea
            value={formData.physical_traits}
            onChange={(e) => setFormData({...formData, physical_traits: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-32 font-mono text-sm"
            placeholder='{"size": "large", "coat": "long"}'
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            {breed ? 'Update' : 'Create'} Breed
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function ThemeForm({ theme, onSubmit, onCancel }: { 
  theme?: Theme; 
  onSubmit: (data: any) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: theme?.name || '',
    description: theme?.description || '',
    base_prompt_template: theme?.base_prompt_template || '',
    style_keywords: theme?.style_keywords?.join(', ') || '',
    seasonal_relevance: JSON.stringify(theme?.seasonal_relevance || {}, null, 2),
    is_active: theme?.is_active ?? true,
    sort_order: theme?.sort_order || 1
  });

  const generateSlug = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      slug: generateSlug(formData.name),
      style_keywords: formData.style_keywords.split(',').map(k => k.trim()).filter(Boolean),
      seasonal_relevance: formData.seasonal_relevance ? JSON.parse(formData.seasonal_relevance) : {}
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">
        {theme ? 'Edit Theme' : 'Add New Theme'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              min="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Base Prompt Template</label>
          <textarea
            value={formData.base_prompt_template}
            onChange={(e) => setFormData({...formData, base_prompt_template: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-32 font-mono text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Style Keywords (comma-separated)</label>
          <input
            type="text"
            value={formData.style_keywords}
            onChange={(e) => setFormData({...formData, style_keywords: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="christmas, festive, holiday"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seasonal Relevance (JSON)</label>
          <textarea
            value={formData.seasonal_relevance}
            onChange={(e) => setFormData({...formData, seasonal_relevance: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 font-mono text-sm"
            placeholder='{"season": "winter", "months": ["dec", "jan"]}'
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="theme_is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="theme_is_active" className="ml-2 block text-sm text-gray-700">
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            {theme ? 'Update' : 'Create'} Theme
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function StyleForm({ style, onSubmit, onCancel }: { 
  style?: Style; 
  onSubmit: (data: any) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: style?.name || '',
    description: style?.description || '',
    prompt_suffix: style?.prompt_suffix || '',
    technical_parameters: JSON.stringify(style?.technical_parameters || {}, null, 2),
    is_active: style?.is_active ?? true,
    sort_order: style?.sort_order || 1
  });

  const generateSlug = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      slug: generateSlug(formData.name),
      technical_parameters: formData.technical_parameters ? JSON.parse(formData.technical_parameters) : {}
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">
        {style ? 'Edit Style' : 'Add New Style'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              min="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Suffix</label>
          <textarea
            value={formData.prompt_suffix}
            onChange={(e) => setFormData({...formData, prompt_suffix: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 font-mono text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Technical Parameters (JSON)</label>
          <textarea
            value={formData.technical_parameters}
            onChange={(e) => setFormData({...formData, technical_parameters: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-32 font-mono text-sm"
            placeholder='{"ar": "16:9", "chaos": 10}'
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="style_is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="style_is_active" className="ml-2 block text-sm text-gray-700">
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            {style ? 'Update' : 'Create'} Style
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function FormatForm({ format, onSubmit, onCancel }: { 
  format?: Format; 
  onSubmit: (data: any) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: format?.name || '',
    aspect_ratio: format?.aspect_ratio || '',
    use_case: format?.use_case || '',
    prompt_adjustments: format?.prompt_adjustments || '{}',
    midjourney_parameters: format?.midjourney_parameters || '--style raw --v 6',
    is_active: format?.is_active ?? true
  });

  const generateSlug = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      slug: generateSlug(formData.name),
      // Keep as strings since the database expects TEXT
      prompt_adjustments: formData.prompt_adjustments || '{}',
      midjourney_parameters: formData.midjourney_parameters || '--style raw --v 6'
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">
        {format ? 'Edit Format' : 'Add New Format'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aspect Ratio</label>
            <input
              type="text"
              value={formData.aspect_ratio}
              onChange={(e) => setFormData({...formData, aspect_ratio: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="16:9"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Use Case</label>
          <input
            type="text"
            value={formData.use_case}
            onChange={(e) => setFormData({...formData, use_case: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Social media posts, YouTube thumbnails, etc."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Adjustments</label>
          <textarea
            value={formData.prompt_adjustments}
            onChange={(e) => setFormData({...formData, prompt_adjustments: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 font-mono text-sm"
            placeholder='close-up portrait, focus on face'
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Midjourney Parameters</label>
          <textarea
            value={formData.midjourney_parameters}
            onChange={(e) => setFormData({...formData, midjourney_parameters: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 font-mono text-sm"
            placeholder='--style raw --v 6 --ar 16:9'
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="format_is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="format_is_active" className="ml-2 block text-sm text-gray-700">
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            {format ? 'Update' : 'Create'} Format
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}