'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">UI Components Test</h1>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              This is a test to verify that our UI components are working properly.
            </p>
            
            <div className="flex space-x-2">
              <Badge>Active</Badge>
              <Badge variant="secondary">Inactive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            
            <div className="flex space-x-2">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}