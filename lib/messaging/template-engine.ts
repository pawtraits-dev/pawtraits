// =====================================================
// TEMPLATE ENGINE - HANDLEBARS
// =====================================================
// Renders message templates with dynamic variables

import Handlebars from 'handlebars';

// Register custom helpers
Handlebars.registerHelper('currency', function(amount: number, currency: string = 'GBP') {
  const symbols: Record<string, string> = {
    'GBP': '£',
    'USD': '$',
    'EUR': '€',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${(amount / 100).toFixed(2)}`;
});

Handlebars.registerHelper('formatDate', function(date: string | Date, format: string = 'short') {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'short') {
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  if (format === 'long') {
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  if (format === 'time') {
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return d.toLocaleDateString('en-GB');
});

Handlebars.registerHelper('uppercase', function(text: string) {
  return text?.toUpperCase() || '';
});

Handlebars.registerHelper('lowercase', function(text: string) {
  return text?.toLowerCase() || '';
});

Handlebars.registerHelper('capitalize', function(text: string) {
  return text?.charAt(0).toUpperCase() + text?.slice(1).toLowerCase() || '';
});

/**
 * Render a template with variables
 *
 * @param template - Handlebars template string
 * @param variables - Variables to inject into template
 * @returns Rendered string
 *
 * @example
 * ```typescript
 * const result = renderTemplate(
 *   'Hello {{customer_name}}, your order {{order_number}} total is {{currency total_amount "GBP"}}',
 *   {
 *     customer_name: 'John Doe',
 *     order_number: 'ORD-12345',
 *     total_amount: 4999 // in pence
 *   }
 * );
 * // Result: "Hello John Doe, your order ORD-12345 total is £49.99"
 * ```
 */
export function renderTemplate(
  template: string,
  variables: Record<string, any>
): string {
  try {
    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(variables);
  } catch (error) {
    console.error('Template rendering error:', error);
    throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate that all required variables are present
 *
 * @param template - Template string to check
 * @param variables - Variables provided
 * @param requiredVars - List of required variable names
 * @returns Validation result with missing variables
 */
export function validateTemplateVariables(
  template: string,
  variables: Record<string, any>,
  requiredVars?: string[]
): { valid: boolean; missing: string[] } {
  // Extract variable names from template
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const matches = template.matchAll(variablePattern);
  const templateVars = new Set<string>();

  for (const match of matches) {
    // Extract variable name, handling helpers like {{currency amount}}
    const varName = match[1].trim().split(' ')[0];
    if (varName && !varName.startsWith('#') && !varName.startsWith('/')) {
      templateVars.add(varName);
    }
  }

  // Check if required variables are provided
  const varsToCheck = requiredVars || Array.from(templateVars);
  const missing: string[] = [];

  for (const varName of varsToCheck) {
    if (!(varName in variables)) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Precompile a template for reuse
 * Useful for frequently used templates
 *
 * @param template - Template string
 * @returns Compiled template function
 */
export function precompileTemplate(template: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(template);
}

/**
 * Render multiple templates at once (batch processing)
 *
 * @param templates - Array of template strings
 * @param variables - Variables to inject
 * @returns Array of rendered strings
 */
export function renderBatch(
  templates: string[],
  variables: Record<string, any>
): string[] {
  return templates.map(template => renderTemplate(template, variables));
}

/**
 * Extract all variable names from a template
 * Useful for documentation and validation
 *
 * @param template - Template string
 * @returns Array of unique variable names
 */
export function extractVariables(template: string): string[] {
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const matches = template.matchAll(variablePattern);
  const variables = new Set<string>();

  for (const match of matches) {
    const varName = match[1].trim().split(' ')[0];
    if (varName && !varName.startsWith('#') && !varName.startsWith('/')) {
      variables.add(varName);
    }
  }

  return Array.from(variables);
}

/**
 * Test template rendering with sample data
 * Returns both result and any errors
 *
 * @param template - Template string
 * @param sampleData - Sample variables
 * @returns Test result with rendered output or error
 */
export function testTemplate(
  template: string,
  sampleData: Record<string, any>
): { success: boolean; output?: string; error?: string } {
  try {
    const output = renderTemplate(template, sampleData);
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
