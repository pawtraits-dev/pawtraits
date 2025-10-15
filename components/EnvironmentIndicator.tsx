'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Beaker, Code } from 'lucide-react';

/**
 * Environment Indicator Component
 *
 * Shows a banner at the top of the page indicating the current environment.
 * - Production: No banner (clean user experience)
 * - Staging: Yellow banner with warning
 * - Preview: Blue banner with branch name
 *
 * Usage: Add to root layout or any layout component
 */
export default function EnvironmentIndicator() {
  const [environment, setEnvironment] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.VERCEL_ENV;
    const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;

    setEnvironment(env || 'development');
    setBranchName(branch || null);
  }, []);

  // Don't show anything in production
  if (environment === 'production') {
    return null;
  }

  // Staging environment
  if (environment === 'staging') {
    return (
      <div className="bg-yellow-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center space-x-2 sticky top-0 z-50">
        <AlertTriangle className="w-4 h-4" />
        <span>
          STAGING ENVIRONMENT - Using production database with test Stripe keys
        </span>
        <AlertTriangle className="w-4 h-4" />
      </div>
    );
  }

  // Preview environment (feature branches)
  if (environment === 'preview') {
    return (
      <div className="bg-blue-600 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center space-x-2 sticky top-0 z-50">
        <Code className="w-4 h-4" />
        <span>
          PREVIEW ENVIRONMENT
          {branchName && ` - Branch: ${branchName}`}
          {' - Using production database with test Stripe keys'}
        </span>
        <Code className="w-4 h-4" />
      </div>
    );
  }

  // Development environment (local)
  if (environment === 'development') {
    return (
      <div className="bg-green-600 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center space-x-2 sticky top-0 z-50">
        <Beaker className="w-4 h-4" />
        <span>
          DEVELOPMENT ENVIRONMENT - Local development server
        </span>
        <Beaker className="w-4 h-4" />
      </div>
    );
  }

  return null;
}
