'use client';

import { useState, useEffect } from 'react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface MessageTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string;
  variables: any;
  user_types: string[];
}

export default function TestEmailPage() {
  const searchParams = useSearchParams();
  const preselectedTemplate = searchParams.get('template');

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (preselectedTemplate && templates.length > 0) {
      setSelectedTemplate(preselectedTemplate);
      const template = templates.find(t => t.template_key === preselectedTemplate);
      if (template) {
        initializeVariables(template);
      }
    }
  }, [preselectedTemplate, templates]);

  const loadTemplates = async () => {
    try {
      const adminService = new AdminSupabaseService();
      const data = await adminService.getTemplates();
      // Filter to only active templates
      setTemplates((data || []).filter((t: any) => t.is_active));
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const initializeVariables = (template: MessageTemplate) => {
    const vars: Record<string, string> = {};
    Object.keys(template.variables || {}).forEach(key => {
      vars[key] = getSampleValue(key, template.variables[key]);
    });
    setVariables(vars);
  };

  const getSampleValue = (key: string, type: string): string => {
    // Generate sample values based on variable name and type
    if (key.includes('email')) return 'test@example.com';
    if (key.includes('name')) return 'John Doe';
    if (key.includes('amount') || key.includes('price') || key.includes('total')) return '£49.99';
    if (key.includes('date')) return new Date().toLocaleDateString('en-GB');
    if (key.includes('url')) return 'https://pawtraits.pics/example';
    if (key.includes('number') || key.includes('id')) return '12345';
    if (key === 'items') return JSON.stringify([
      { title: 'Golden Retriever Portrait', format: 'Canvas', size: '30x40cm', quantity: 1, price: '£49.99' }
    ]);
    return 'Sample Value';
  };

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = templates.find(t => t.template_key === templateKey);
    if (template) {
      initializeVariables(template);
    }
    setResult(null);
  };

  const handleSendTest = async () => {
    if (!selectedTemplate || !recipientEmail) {
      setResult({ success: false, message: 'Please select a template and enter recipient email' });
      return;
    }

    try {
      setSending(true);
      setResult(null);

      const template = templates.find(t => t.template_key === selectedTemplate);
      if (!template) {
        throw new Error('Template not found');
      }

      // Parse items array if present
      const parsedVariables = { ...variables };
      if (parsedVariables.items && typeof parsedVariables.items === 'string') {
        try {
          parsedVariables.items = JSON.parse(parsedVariables.items);
        } catch (e) {
          console.warn('Failed to parse items array:', e);
        }
      }

      const response = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: selectedTemplate,
          recipientType: template.user_types[0],
          recipientEmail: recipientEmail,
          variables: parsedVariables,
          priority: 'high'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setResult({
        success: true,
        message: `Test email queued successfully! Check ${recipientEmail} for the message.`
      });
    } catch (error) {
      console.error('Failed to send test email:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test email'
      });
    } finally {
      setSending(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.template_key === selectedTemplate);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Email Template</h1>
        <p className="text-gray-600">Send a test email to verify template rendering and delivery</p>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        {/* Template Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            <option value="">Choose a template...</option>
            {templates.map(template => (
              <option key={template.id} value={template.template_key}>
                {template.name} ({template.user_types.join(', ')})
              </option>
            ))}
          </select>
          {selectedTemplateData && (
            <p className="mt-2 text-sm text-gray-600">{selectedTemplateData.description}</p>
          )}
        </div>

        {/* Recipient Email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Email
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          />
        </div>

        {/* Template Variables */}
        {selectedTemplateData && Object.keys(selectedTemplateData.variables || {}).length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Template Variables
            </label>
            <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              {Object.entries(selectedTemplateData.variables || {}).map(([key, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {key} <span className="text-gray-400">({type as string})</span>
                  </label>
                  {key === 'items' ? (
                    <textarea
                      value={variables[key] || ''}
                      onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono"
                      placeholder="JSON array of items"
                    />
                  ) : (
                    <input
                      type="text"
                      value={variables[key] || ''}
                      onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Sample values have been pre-filled. You can modify them as needed.
            </p>
          </div>
        )}

        {/* Result Message */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg ${
            result.success
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-start">
              <svg
                className={`w-5 h-5 mr-3 mt-0.5 ${result.success ? 'text-green-600' : 'text-red-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {result.success ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <p className="text-sm">{result.message}</p>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendTest}
          disabled={sending || !selectedTemplate || !recipientEmail}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {sending ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
          ) : (
            'Send Test Email'
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Testing Notes</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Test emails are sent via the same queue system as production emails</li>
              <li>Check your spam folder if you do not receive the email within a few minutes</li>
              <li>Template variables are replaced with the values you provide</li>
              <li>HTML email templates are rendered using external template files</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
