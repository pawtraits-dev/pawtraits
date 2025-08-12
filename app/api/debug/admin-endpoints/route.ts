import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    // Check environment variables
    const envCheck = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    };
    
    // Test admin endpoints
    const endpoints = [
      '/api/admin/products',
      '/api/admin/media', 
      '/api/admin/pricing'
    ];
    
    const results = {};
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint}...`);
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const isOk = response.ok;
        const status = response.status;
        const statusText = response.statusText;
        
        let data = null;
        let error = null;
        
        try {
          const text = await response.text();
          if (text) {
            data = JSON.parse(text);
          }
        } catch (parseError) {
          error = `Parse error: ${parseError.message}`;
        }
        
        results[endpoint] = {
          ok: isOk,
          status,
          statusText,
          dataCount: Array.isArray(data) ? data.length : (data ? 1 : 0),
          error: error || (!isOk ? `HTTP ${status}: ${statusText}` : null),
          sampleData: Array.isArray(data) ? data.slice(0, 1) : data
        };
        
      } catch (fetchError) {
        results[endpoint] = {
          ok: false,
          error: `Fetch error: ${fetchError.message}`,
          status: null,
          dataCount: 0
        };
      }
    }
    
    return NextResponse.json({
      baseUrl,
      timestamp: new Date().toISOString(),
      envCheck,
      results
    });
    
  } catch (error: any) {
    console.error('Debug admin endpoints error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}