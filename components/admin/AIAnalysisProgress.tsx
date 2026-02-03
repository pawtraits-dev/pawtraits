import { Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export type AnalysisStage = 'idle' | 'uploading' | 'analyzing' | 'processing' | 'complete' | 'error';

interface AIAnalysisProgressProps {
  stage: AnalysisStage;
  progress?: number; // 0-100
  message?: string;
  error?: string;
}

export function AIAnalysisProgress({ stage, progress = 0, message, error }: AIAnalysisProgressProps) {
  if (stage === 'idle') {
    return null;
  }

  const getStageIcon = () => {
    switch (stage) {
      case 'uploading':
      case 'analyzing':
      case 'processing':
        return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Sparkles className="w-6 h-6 text-primary" />;
    }
  };

  const getStageMessage = () => {
    if (message) return message;

    switch (stage) {
      case 'uploading':
        return 'Uploading image...';
      case 'analyzing':
        return 'Analyzing composition with Claude AI...';
      case 'processing':
        return 'Processing analysis results...';
      case 'complete':
        return 'Analysis complete!';
      case 'error':
        return error || 'Analysis failed';
      default:
        return 'Preparing...';
    }
  };

  const getStageDescription = () => {
    switch (stage) {
      case 'uploading':
        return 'Preparing image for analysis';
      case 'analyzing':
        return 'Claude AI is examining the image composition, identifying breeds, and analyzing artistic elements. This may take 10-15 seconds.';
      case 'processing':
        return 'Matching AI suggestions to database...';
      case 'complete':
        return 'Review and edit the AI-generated analysis below';
      case 'error':
        return 'Please try again or contact support if the issue persists';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Icon and Main Message */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">{getStageIcon()}</div>
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-lg">{getStageMessage()}</p>
              <p className="text-sm text-gray-600">{getStageDescription()}</p>

              {/* Progress Bar */}
              {(stage === 'uploading' || stage === 'analyzing' || stage === 'processing') && (
                <div className="mt-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-gray-500 mt-2">
                    {progress > 0 ? `${Math.round(progress)}% complete` : 'Processing...'}
                  </p>
                </div>
              )}

              {/* Success Details */}
              {stage === 'complete' && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Analysis Successful</span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    Marketing description, composition analysis, and breed identification generated.
                  </p>
                </div>
              )}

              {/* Error Details */}
              {stage === 'error' && error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Analysis Failed</span>
                  </div>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stage Indicators */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
            <StageIndicator label="Upload" active={stage === 'uploading'} complete={['analyzing', 'processing', 'complete'].includes(stage)} />
            <div className="flex-1 h-px bg-gray-200" />
            <StageIndicator label="Analyze" active={stage === 'analyzing'} complete={['processing', 'complete'].includes(stage)} />
            <div className="flex-1 h-px bg-gray-200" />
            <StageIndicator label="Process" active={stage === 'processing'} complete={stage === 'complete'} />
            <div className="flex-1 h-px bg-gray-200" />
            <StageIndicator label="Complete" active={stage === 'complete'} complete={stage === 'complete'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StageIndicatorProps {
  label: string;
  active: boolean;
  complete: boolean;
}

function StageIndicator({ label, active, complete }: StageIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          complete
            ? 'bg-green-600 text-white'
            : active
            ? 'bg-primary text-white'
            : 'bg-gray-200 text-gray-400'
        }`}
      >
        {complete ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-white' : 'bg-gray-400'}`} />
        )}
      </div>
      <span className={`text-xs font-medium ${active || complete ? 'text-gray-900' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}
