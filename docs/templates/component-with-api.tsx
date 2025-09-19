'use client';

import { useState, useEffect } from 'react';
import { SupabaseService } from '@/lib/supabase';

// 🏗️ STANDARD COMPONENT TEMPLATE
// Copy this template for components that need data to ensure architectural compliance

interface YourDataType {
  id: string;
  name: string;
  // ... other fields
}

export default function YourComponent() {
  const [data, setData] = useState<YourDataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ STANDARD: Get authenticated user for API calls
      const supabaseService = new SupabaseService();
      const { data: { user } } = await supabaseService.getClient().auth.getUser();

      if (!user?.email) {
        setError('Authentication required');
        return;
      }

      // ✅ STANDARD: API call with proper authentication
      const response = await fetch(`/api/your-endpoint?email=${encodeURIComponent(user.email)}`, {
        credentials: 'include', // ✅ Include cookies
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      setData(result);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (newData: Omit<YourDataType, 'id'>) => {
    try {
      // ✅ STANDARD: API call for data mutations
      const response = await fetch('/api/your-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies
        body: JSON.stringify(newData),
      });

      if (!response.ok) {
        throw new Error(`Create failed: ${response.status}`);
      }

      const created = await response.json();
      setData(prev => [...prev, created]);

    } catch (err) {
      console.error('Error creating data:', err);
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<YourDataType>) => {
    try {
      // ✅ STANDARD: API call for updates
      const response = await fetch(`/api/your-endpoint/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }

      const updated = await response.json();
      setData(prev => prev.map(item => item.id === id ? updated : item));

    } catch (err) {
      console.error('Error updating data:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Your Component</h1>
      {/* Render your data here */}
      {data.map(item => (
        <div key={item.id}>
          <span>{item.name}</span>
          <button onClick={() => handleUpdate(item.id, { name: 'Updated' })}>
            Update
          </button>
        </div>
      ))}
    </div>
  );
}

// 📋 CHECKLIST: Before committing this component
// [ ] No direct supabase.from() calls
// [ ] No createClient imports from @supabase/supabase-js
// [ ] All data access through API endpoints
// [ ] Proper credentials: 'include' on fetch calls
// [ ] Uses SupabaseService only for authentication checks
// [ ] Error handling for API failures
// [ ] Loading states for better UX