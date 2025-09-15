'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BatchJob {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  completed_items: number;
  successful_items: number;
  failed_items: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface BatchJobProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  percentage: number;
}

export default function BatchJobsPage() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch('/api/admin/batch-jobs');
      if (response.ok) {
        const jobsData = await response.json();
        setJobs(jobsData);
      }
    } catch (error) {
      console.error('Failed to fetch batch jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Auto-refresh every 10 seconds for running jobs
    const interval = setInterval(() => {
      if (jobs.some(job => job.status === 'running' || job.status === 'pending')) {
        fetchJobs(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [jobs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const calculateDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Batch Jobs</h1>
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Batch Jobs</h1>
          <Button 
            onClick={() => fetchJobs(true)} 
            variant="outline"
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No batch jobs found. Start generating variations to see jobs here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {jobs.map((job) => {
              const progress = job.total_items > 0 ? Math.round((job.completed_items / job.total_items) * 100) : 0;
              const successRate = job.completed_items > 0 ? Math.round((job.successful_items / job.completed_items) * 100) : 0;

              return (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          Job {job.id.slice(0, 8)}...
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {job.job_type} • Created {formatDate(job.created_at)}
                        </p>
                      </div>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progress: {job.completed_items} / {job.total_items} items</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-2 bg-green-50 rounded">
                          <div className="text-lg font-bold text-green-600">{job.successful_items}</div>
                          <div className="text-xs text-green-600">Successful</div>
                        </div>
                        <div className="p-2 bg-red-50 rounded">
                          <div className="text-lg font-bold text-red-600">{job.failed_items}</div>
                          <div className="text-xs text-red-600">Failed</div>
                        </div>
                        <div className="p-2 bg-blue-50 rounded">
                          <div className="text-lg font-bold text-blue-600">
                            {job.completed_items > 0 ? `${successRate}%` : '-'}
                          </div>
                          <div className="text-xs text-blue-600">Success Rate</div>
                        </div>
                      </div>

                      {/* Timing Info */}
                      {job.started_at && (
                        <div className="text-sm text-gray-600">
                          {job.status === 'running' && (
                            <p>⏱️ Running for {calculateDuration(job.started_at)}</p>
                          )}
                          {job.completed_at && (
                            <p>✅ Completed in {calculateDuration(job.started_at, job.completed_at)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}