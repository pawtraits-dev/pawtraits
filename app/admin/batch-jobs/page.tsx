'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, StopCircle, ChevronDown, ChevronRight, FileText, Settings, Zap } from 'lucide-react';

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
  config?: any;
  target_age?: string;
  original_image_id?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  type: string;
  message: string;
  details?: any;
}

interface BatchJobLogs {
  job: BatchJob;
  items: any[];
  logs: LogEntry[];
  summary: {
    totalLogs: number;
    logTypes: string[];
    levels: string[];
    lastUpdate: string;
  };
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
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [jobLogs, setJobLogs] = useState<Record<string, BatchJobLogs>>({});
  const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set());

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

  const fetchJobLogs = async (jobId: string) => {
    if (loadingLogs.has(jobId)) return;

    setLoadingLogs(prev => new Set([...prev, jobId]));

    try {
      const response = await fetch(`/api/admin/batch-jobs/${jobId}/logs`);
      if (response.ok) {
        const logsData = await response.json();
        setJobLogs(prev => ({ ...prev, [jobId]: logsData }));
      }
    } catch (error) {
      console.error('Failed to fetch job logs:', error);
    } finally {
      setLoadingLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const toggleJobExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
      // Fetch logs when expanding
      if (!jobLogs[jobId]) {
        fetchJobLogs(jobId);
      }
    }
    setExpandedJobs(newExpanded);
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this batch job? This will stop processing any remaining items.')) {
      return;
    }

    setCancelling(jobId);
    
    try {
      const response = await fetch(`/api/admin/batch-jobs?jobId=${jobId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`✅ Job ${jobId} cancelled successfully`);
        // Refresh the jobs list
        await fetchJobs(true);
      } else {
        const errorData = await response.json();
        alert(`Failed to cancel job: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
      alert('Failed to cancel job. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    // Auto-refresh every 10 seconds for running jobs
    const interval = setInterval(() => {
      if (jobs.some(job => job.status === 'running' || job.status === 'pending')) {
        fetchJobs(true);
        // Also refresh logs for expanded running jobs
        expandedJobs.forEach(jobId => {
          const job = jobs.find(j => j.id === jobId);
          if (job && (job.status === 'running' || job.status === 'pending')) {
            fetchJobLogs(jobId);
          }
        });
      }
    }, 5000); // Reduced to 5 seconds for more responsive logging

    return () => clearInterval(interval);
  }, [jobs, expandedJobs]);

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

  const getJobSpecifications = (job: BatchJob) => {
    const config = job.config;
    if (!config) return null;

    const specs = [];
    if (config.variationConfig?.breedCoats?.length) {
      specs.push(`${config.variationConfig.breedCoats.length} breed-coat combinations`);
    }
    if (config.variationConfig?.outfits?.length) {
      specs.push(`${config.variationConfig.outfits.length} outfit variations`);
    }
    if (config.variationConfig?.formats?.length) {
      specs.push(`${config.variationConfig.formats.length} format variations`);
    }

    return {
      variations: specs,
      originalTheme: config.currentTheme || 'N/A',
      originalStyle: config.currentStyle || 'N/A',
      targetAge: job.target_age || 'N/A',
      originalBreed: config.currentBreed || 'N/A'
    };
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
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
              const specs = getJobSpecifications(job);
              const isExpanded = expandedJobs.has(job.id);
              const logs = jobLogs[job.id];

              return (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          Job {job.id.slice(0, 8)}...
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {job.job_type} • Created {formatDate(job.created_at)}
                        </p>

                        {/* Job Specifications */}
                        {specs && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Settings className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">Specifications:</span>
                            </div>
                            <div className="text-sm text-gray-600 ml-6">
                              <p>• Target age: {specs.targetAge}</p>
                              <p>• Original breed: {specs.originalBreed}</p>
                              <p>• Theme/Style: {specs.originalTheme} / {specs.originalStyle}</p>
                              {specs.variations.map((variation, idx) => (
                                <p key={idx}>• {variation}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(job.status === 'pending' || job.status === 'running') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelJob(job.id)}
                            disabled={cancelling === job.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {cancelling === job.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <StopCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </>
                            )}
                          </Button>
                        )}
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.toUpperCase()}
                        </Badge>
                      </div>
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

                      {/* Expandable Logs Section */}
                      <Collapsible open={isExpanded} onOpenChange={() => toggleJobExpansion(job.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            ) : (
                              <ChevronRight className="w-4 h-4 mr-2" />
                            )}
                            <FileText className="w-4 h-4 mr-2" />
                            {isExpanded ? 'Hide Logs' : 'Show Live Logs'}
                            {logs && (
                              <Badge variant="secondary" className="ml-2">
                                {logs.logs.length} entries
                              </Badge>
                            )}
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="mt-4">
                          <div className="border rounded-lg bg-slate-50 p-4 max-h-96 overflow-y-auto">
                            {loadingLogs.has(job.id) ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                                <span className="text-gray-500">Loading logs...</span>
                              </div>
                            ) : logs ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-4 text-sm">
                                  <Zap className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium">Live Processing Logs</span>
                                  <Badge variant="outline" className="text-xs">
                                    {logs.summary.totalLogs} entries
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Updated: {new Date(logs.summary.lastUpdate).toLocaleTimeString()}
                                  </Badge>
                                </div>

                                {logs.logs.length === 0 ? (
                                  <p className="text-gray-500 text-center py-4">No logs available yet</p>
                                ) : (
                                  <div className="font-mono text-xs space-y-1">
                                    {logs.logs.map((logEntry, idx) => (
                                      <div key={idx} className={`p-2 rounded border-l-2 ${
                                        logEntry.level === 'success' ? 'border-l-green-400 bg-green-50' :
                                        logEntry.level === 'error' ? 'border-l-red-400 bg-red-50' :
                                        logEntry.level === 'warning' ? 'border-l-yellow-400 bg-yellow-50' :
                                        'border-l-blue-400 bg-blue-50'
                                      }`}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-500">
                                            {new Date(logEntry.timestamp).toLocaleTimeString()}
                                          </span>
                                          <span className={getLevelColor(logEntry.level)}>
                                            {getLevelIcon(logEntry.level)}
                                          </span>
                                          <span className="font-medium">{logEntry.type}</span>
                                        </div>
                                        <p className="mt-1 text-gray-700">{logEntry.message}</p>
                                        {logEntry.details && (
                                          <div className="mt-1 text-xs text-gray-600">
                                            {Object.entries(logEntry.details).map(([key, value]) => (
                                              <span key={key} className="mr-3">
                                                <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-center py-4">Click to load logs</p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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