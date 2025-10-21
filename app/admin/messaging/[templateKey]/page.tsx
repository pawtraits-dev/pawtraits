'use client';

import { useState, useEffect } from 'react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface MessageTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string;
  category: string;
  channels: string[];
  user_types: string[];
  email_subject_template: string | null;
  email_body_template: string | null;
  sms_body_template: string | null;
  inbox_title_template: string | null;
  inbox_body_template: string | null;
  inbox_icon: string | null;
  inbox_action_url: string | null;
  inbox_action_label: string | null;
  variables: any;
  is_active: boolean;
  can_be_disabled: boolean;
  default_enabled: boolean;
  priority: string;
  created_at: string;
  updated_at: string;
}

export default function TemplateDetailsPage() {
  const params = useParams();
  const templateKey = params.templateKey as string;
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'email' | 'sms' | 'inbox'>('email');

  useEffect(() => {
    loadTemplate();
  }, [templateKey]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const adminService = new AdminSupabaseService();
      const { data, error } = await adminService.getClient()
        .from('message_templates')
        .select('*')
        .eq('template_key', templateKey)
        .single();

      if (error) throw error;
      setTemplate(data);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/messaging"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Templates
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{template.name}</h1>
            <p className="text-gray-600">{template.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {template.is_active ? 'Active' : 'Inactive'}
            </span>
            <Link
              href={`/admin/messaging/test?template=${template.template_key}`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Test Template
            </Link>
          </div>
        </div>
      </div>

      {/* Template Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Category</div>
          <div className="text-lg font-semibold text-gray-900 capitalize">{template.category}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Priority</div>
          <div className="text-lg font-semibold text-gray-900 capitalize">{template.priority}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">User Types</div>
          <div className="text-lg font-semibold text-gray-900 capitalize">
            {template.user_types.join(', ')}
          </div>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg mb-8">
        <div className="border-b border-gray-200">
          <div className="flex">
            {template.channels.includes('email') && (
              <button
                onClick={() => setActiveTab('email')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'email'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Email
              </button>
            )}
            {template.channels.includes('sms') && (
              <button
                onClick={() => setActiveTab('sms')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sms'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                SMS
              </button>
            )}
            {template.channels.includes('inbox') && (
              <button
                onClick={() => setActiveTab('inbox')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'inbox'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                In-App
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <code className="text-sm text-gray-900">{template.email_subject_template}</code>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body Template</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-auto">
                  <pre className="text-xs text-gray-900 whitespace-pre-wrap">
                    {template.email_body_template}
                  </pre>
                </div>
                {template.email_body_template?.includes('lib/messaging/templates/') && (
                  <p className="mt-2 text-sm text-gray-600">
                    Note: This template references an external HTML file. View the actual template in{' '}
                    <code className="text-purple-600">
                      {template.email_body_template.match(/lib\/messaging\/templates\/[\w-]+\.html/)?.[0]}
                    </code>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SMS Tab */}
          {activeTab === 'sms' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SMS Message</label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <code className="text-sm text-gray-900 whitespace-pre-wrap">
                  {template.sms_body_template || 'No SMS template configured'}
                </code>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                SMS messages are limited to 160 characters for optimal delivery.
              </p>
            </div>
          )}

          {/* In-App Tab */}
          {activeTab === 'inbox' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <code className="text-sm text-gray-900">{template.inbox_icon}</code>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action Label</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <code className="text-sm text-gray-900">{template.inbox_action_label || 'N/A'}</code>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <code className="text-sm text-gray-900">{template.inbox_title_template}</code>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <code className="text-sm text-gray-900 whitespace-pre-wrap">
                    {template.inbox_body_template}
                  </code>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action URL</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <code className="text-sm text-gray-900">{template.inbox_action_url || 'N/A'}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Variables Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Variables</h2>
        <p className="text-sm text-gray-600 mb-4">
          These variables are available for use in the template using Handlebars syntax (e.g., {'{'}{'{'} variable_name {'}'}{'}'}):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(template.variables || {}).map(([key, type]) => (
            <div key={key} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <code className="text-sm font-medium text-gray-900">{key}</code>
              <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">{type as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Template Key</div>
            <code className="text-sm font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded">
              {template.template_key}
            </code>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Can Be Disabled</div>
            <div className="text-sm font-medium text-gray-900">
              {template.can_be_disabled ? 'Yes' : 'No (Always Active)'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Default Enabled</div>
            <div className="text-sm font-medium text-gray-900">
              {template.default_enabled ? 'Yes' : 'No'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Channels</div>
            <div className="text-sm font-medium text-gray-900">
              {template.channels.join(', ')}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Created</div>
            <div className="text-sm font-medium text-gray-900">
              {new Date(template.created_at).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Last Updated</div>
            <div className="text-sm font-medium text-gray-900">
              {new Date(template.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
