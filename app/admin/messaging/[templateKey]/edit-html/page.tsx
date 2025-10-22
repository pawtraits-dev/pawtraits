'use client';

import { useState, useEffect } from 'react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface MessageTemplate {
  id: string;
  template_key: string;
  name: string;
  email_body_template: string | null;
  variables: any;
}

export default function EditHtmlTemplatePage() {
  const params = useParams();
  const templateKey = params.templateKey as string;
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [sampleVariables, setSampleVariables] = useState<Record<string, any>>({});
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadTemplate();
  }, [templateKey]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const adminService = new AdminSupabaseService();
      const data = await adminService.getTemplate(templateKey);
      setTemplate(data);

      // Load HTML content directly from database using templateKey
      await loadHtmlTemplate(data.template_key);

      // Generate sample variables
      if (data?.variables) {
        setSampleVariables(generateSampleVariables(data.variables));
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHtmlTemplate = async (templateKey: string) => {
    try {
      const response = await fetch(`/api/admin/templates/html?templateKey=${encodeURIComponent(templateKey)}`);
      if (!response.ok) throw new Error('Failed to load HTML template');
      const data = await response.json();
      setHtmlContent(data.content);
    } catch (error) {
      console.error('Failed to load HTML template:', error);
    }
  };

  const generateSampleVariables = (variables: Record<string, string>): Record<string, any> => {
    const samples: Record<string, any> = {};

    Object.keys(variables).forEach(key => {
      if (key.includes('email')) samples[key] = 'customer@example.com';
      else if (key.includes('name')) samples[key] = 'John Doe';
      else if (key.includes('amount') || key.includes('price') || key.includes('total')) samples[key] = '£49.99';
      else if (key.includes('date')) samples[key] = new Date().toLocaleDateString('en-GB');
      else if (key.includes('url')) samples[key] = 'https://pawtraits.pics/example';
      else if (key.includes('number') || key.includes('id')) samples[key] = '12345';
      else if (key === 'items') {
        samples[key] = [
          {
            title: 'Golden Retriever Portrait',
            format: 'Canvas',
            size: '30x40cm',
            quantity: 1,
            price: '£49.99'
          }
        ];
      } else {
        samples[key] = 'Sample Value';
      }
    });

    return samples;
  };

  const replaceVariables = (html: string): string => {
    let result = html;

    // Replace simple variables
    Object.entries(sampleVariables).forEach(([key, value]) => {
      if (typeof value === 'string') {
        result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
      }
    });

    // Replace array iteration (simplified Handlebars {{#each}})
    if (sampleVariables.items && Array.isArray(sampleVariables.items)) {
      const eachMatch = result.match(/{{#each items}}([\s\S]*?){{\/each}}/);
      if (eachMatch) {
        const itemTemplate = eachMatch[1];
        const itemsHtml = sampleVariables.items.map((item: any) => {
          let itemHtml = itemTemplate;
          Object.entries(item).forEach(([itemKey, itemValue]) => {
            itemHtml = itemHtml.replace(new RegExp(`{{\\s*this\\.${itemKey}\\s*}}`, 'g'), String(itemValue));
          });
          return itemHtml;
        }).join('');
        result = result.replace(eachMatch[0], itemsHtml);
      }
    }

    // Remove any remaining Handlebars syntax
    result = result.replace(/{{#if.*?}}/g, '');
    result = result.replace(/{{\/if}}/g, '');
    result = result.replace(/{{else}}/g, '');

    return result;
  };

  const handleSave = async () => {
    if (!template) return;

    try {
      setSaving(true);
      setSaveMessage(null);

      const response = await fetch('/api/admin/templates/html', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: template.template_key, content: htmlContent })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save template');
      }

      setSaveMessage({ type: 'success', text: 'Template saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save template:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save template. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Template not found</h3>
          <Link href="/admin/messaging" className="text-purple-600 hover:text-purple-700">
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  const previewHtml = replaceVariables(htmlContent);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/messaging/${templateKey}`}
                className="inline-flex items-center text-purple-600 hover:text-purple-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{template.name}</h1>
                <p className="text-sm text-gray-600">HTML Email Template Editor</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'code' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Code
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'split' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'preview' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Preview
                </button>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {saving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Template'
                )}
              </button>
            </div>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`mt-3 p-3 rounded-lg ${
              saveMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {saveMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-4" style={{
          gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr'
        }}>
          {/* Code Editor */}
          {(viewMode === 'code' || viewMode === 'split') && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                <h3 className="text-sm font-medium text-gray-900">HTML Source</h3>
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="w-full h-[calc(100vh-200px)] p-4 font-mono text-sm focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                <h3 className="text-sm font-medium text-gray-900">Live Preview (with sample data)</h3>
              </div>
              <div className="h-[calc(100vh-200px)] overflow-auto">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sample Variables Info */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Preview Sample Variables:</h4>
          <div className="text-xs text-blue-800 font-mono space-y-1">
            {Object.entries(sampleVariables).map(([key, value]) => (
              <div key={key}>
                <span className="text-blue-600">{key}</span> = {JSON.stringify(value)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
