import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Edit, Sparkles, CheckCircle } from 'lucide-react';

interface CompositionAnalysisPanelProps {
  compositionAnalysis: string; // Markdown
  variationPromptTemplate: string;
  compositionMetadata: any;
  confidence: number; // 0-1
  onCompositionChange?: (value: string) => void;
  onPromptTemplateChange?: (value: string) => void;
  editable?: boolean;
}

export function CompositionAnalysisPanel({
  compositionAnalysis,
  variationPromptTemplate,
  compositionMetadata,
  confidence,
  onCompositionChange,
  onPromptTemplateChange,
  editable = true
}: CompositionAnalysisPanelProps) {
  const [isEditingComposition, setIsEditingComposition] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [localComposition, setLocalComposition] = useState(compositionAnalysis);
  const [localPrompt, setLocalPrompt] = useState(variationPromptTemplate);

  const handleSaveComposition = () => {
    onCompositionChange?.(localComposition);
    setIsEditingComposition(false);
  };

  const handleSavePrompt = () => {
    onPromptTemplateChange?.(localPrompt);
    setIsEditingPrompt(false);
  };

  const handleCancelComposition = () => {
    setLocalComposition(compositionAnalysis);
    setIsEditingComposition(false);
  };

  const handleCancelPrompt = () => {
    setLocalPrompt(variationPromptTemplate);
    setIsEditingPrompt(false);
  };

  // Parse composition metadata for display
  const metadata = compositionMetadata || {};
  const lighting = metadata.lighting || {};
  const background = metadata.background || {};
  const composition = metadata.composition || {};
  const artisticStyle = metadata.artistic_style || {};
  const subjectDetails = metadata.subject_details || {};

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Composition Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <CheckCircle className="w-3 h-3 mr-1" />
              {Math.round(confidence * 100)}% Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="prompt">Variation Prompt</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          {/* Composition Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Technical Composition (Markdown)
                </p>
                {editable && !isEditingComposition && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingComposition(true)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingComposition ? (
                <div className="space-y-2">
                  <Textarea
                    value={localComposition}
                    onChange={(e) => setLocalComposition(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="Detailed composition analysis in markdown format..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelComposition}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveComposition}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
                      {compositionAnalysis}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium mb-1">💡 Purpose:</p>
              <p>
                This analysis documents the composition for admin review and helps Claude understand what to preserve when generating variations.
              </p>
            </div>
          </TabsContent>

          {/* Variation Prompt Template Tab */}
          <TabsContent value="prompt" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Gemini Variation Prompt Template
                </p>
                {editable && !isEditingPrompt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingPrompt(true)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingPrompt ? (
                <div className="space-y-2">
                  <Textarea
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    rows={16}
                    className="font-mono text-sm"
                    placeholder="Precise instructions for Gemini variation generation..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelPrompt}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSavePrompt}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">
                      {variationPromptTemplate}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium mb-1">🎯 Purpose:</p>
              <p>
                This template tells Gemini AI exactly what to preserve (background, lighting, composition) and what to change (subject breed/coat) when generating customer variations.
              </p>
            </div>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lighting */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold mb-2">💡 Lighting</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Type:</dt>
                    <dd className="font-medium">{lighting.type || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Direction:</dt>
                    <dd className="font-medium">{lighting.direction || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Quality:</dt>
                    <dd className="font-medium">{lighting.quality || 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              {/* Background */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold mb-2">🖼️ Background</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Type:</dt>
                    <dd className="font-medium">{background.type || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Colors:</dt>
                    <dd className="font-medium">
                      {background.colors?.length > 0 ? background.colors.join(', ') : 'N/A'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Elements:</dt>
                    <dd className="font-medium">
                      {background.elements?.length > 0 ? background.elements.join(', ') : 'None'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Composition */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold mb-2">📐 Composition</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Framing:</dt>
                    <dd className="font-medium">{composition.framing || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Subject Placement:</dt>
                    <dd className="font-medium">{composition.subject_placement || 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              {/* Artistic Style */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold mb-2">🎨 Artistic Style</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Medium:</dt>
                    <dd className="font-medium">{artisticStyle.medium || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Texture:</dt>
                    <dd className="font-medium">{artisticStyle.texture || 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              {/* Subject Details */}
              <div className="p-3 bg-gray-50 rounded-lg border col-span-2">
                <h4 className="text-sm font-semibold mb-2">🐕 Subject Details</h4>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Pose:</dt>
                    <dd className="font-medium">{subjectDetails.pose || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Gaze:</dt>
                    <dd className="font-medium">{subjectDetails.gaze || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Expression:</dt>
                    <dd className="font-medium">{subjectDetails.expression || 'N/A'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
