import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Plus, Trash2, AlertCircle, CheckCircle, Star, Search } from 'lucide-react';

interface SubjectData {
  subjectOrder: number;
  isPrimary: boolean;
  breedId?: string;
  coatId?: string;
  outfitId?: string;
  position: string;
  sizeProminence: string;
  poseDescription: string;
  gazeDirection?: string;
  expression?: string;
  identifiedByAI: boolean;
  aiConfidence?: number;
  suggestedBreed?: { id: string; name: string; confidence: number };
  suggestedCoat?: { id: string; name: string; confidence: number };
}

interface MultiSubjectEditorProps {
  subjects: SubjectData[];
  onChange: (subjects: SubjectData[]) => void;
  breeds: any[];
  coats: any[];
  outfits: any[];
  isMultiSubject: boolean;
  onMultiSubjectChange: (isMulti: boolean) => void;
}

export function MultiSubjectEditor({
  subjects,
  onChange,
  breeds,
  coats,
  outfits,
  isMultiSubject,
  onMultiSubjectChange
}: MultiSubjectEditorProps) {
  const [expandedSubject, setExpandedSubject] = useState<number | null>(subjects.length > 0 ? 0 : null);
  const [breedSearchTerms, setBreedSearchTerms] = useState<Record<number, string>>({});
  const [coatSearchTerms, setCoatSearchTerms] = useState<Record<number, string>>({});

  const handleAddSubject = () => {
    const newSubject: SubjectData = {
      subjectOrder: subjects.length + 1,
      isPrimary: subjects.length === 0, // First subject is primary
      position: 'center',
      sizeProminence: subjects.length === 0 ? 'primary' : 'equal',
      poseDescription: '',
      identifiedByAI: false
    };

    onChange([...subjects, newSubject]);
    setExpandedSubject(subjects.length);
    if (subjects.length >= 1) {
      onMultiSubjectChange(true);
    }
  };

  const handleRemoveSubject = (index: number) => {
    const newSubjects = subjects.filter((_, i) => i !== index);

    // Re-number remaining subjects
    const renumbered = newSubjects.map((s, i) => ({
      ...s,
      subjectOrder: i + 1,
      isPrimary: i === 0 // First subject becomes primary
    }));

    onChange(renumbered);

    if (renumbered.length <= 1) {
      onMultiSubjectChange(false);
    }

    if (expandedSubject === index) {
      setExpandedSubject(renumbered.length > 0 ? 0 : null);
    }
  };

  const handleUpdateSubject = (index: number, updates: Partial<SubjectData>) => {
    const newSubjects = [...subjects];
    newSubjects[index] = { ...newSubjects[index], ...updates };
    onChange(newSubjects);
  };

  const handleSetPrimary = (index: number) => {
    const newSubjects = subjects.map((s, i) => ({
      ...s,
      isPrimary: i === index
    }));
    onChange(newSubjects);
  };

  const handleAcceptAISuggestion = (index: number, field: 'breed' | 'coat') => {
    const subject = subjects[index];
    if (field === 'breed' && subject.suggestedBreed) {
      handleUpdateSubject(index, { breedId: subject.suggestedBreed.id });
    } else if (field === 'coat' && subject.suggestedCoat) {
      handleUpdateSubject(index, { coatId: subject.suggestedCoat.id });
    }
  };

  // Get filtered and sorted breeds for a subject
  const getFilteredSortedBreeds = (subjectIndex: number) => {
    const searchTerm = breedSearchTerms[subjectIndex] || '';
    return breeds
      .filter((breed: any) => {
        const name = (breed.display_name || breed.name).toLowerCase();
        return name.includes(searchTerm.toLowerCase());
      })
      .sort((a: any, b: any) => {
        const nameA = (a.display_name || a.name).toLowerCase();
        const nameB = (b.display_name || b.name).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  };

  // Get filtered coats based on selected breed
  const getCoatsForBreed = (breedId?: string, subjectIndex?: number) => {
    const searchTerm = subjectIndex !== undefined ? (coatSearchTerms[subjectIndex] || '') : '';
    let filteredCoats = coats;

    if (breedId) {
      filteredCoats = coats.filter((c: any) => c.breed_id === breedId);
    }

    if (searchTerm) {
      filteredCoats = filteredCoats.filter((coat: any) => {
        const name = (coat.display_name || coat.name).toLowerCase();
        return name.includes(searchTerm.toLowerCase());
      });
    }

    return filteredCoats.sort((a: any, b: any) => {
      const nameA = (a.display_name || a.name).toLowerCase();
      const nameB = (b.display_name || b.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Subject Management
          </CardTitle>
          <Badge variant={isMultiSubject ? 'default' : 'secondary'}>
            {subjects.length} {subjects.length === 1 ? 'Subject' : 'Subjects'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Multi-subject indicator */}
        {isMultiSubject && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              This is a multi-subject image. Each subject will be tracked separately and can be used for pair portrait variations.
            </AlertDescription>
          </Alert>
        )}

        {/* Subject List */}
        {subjects.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No subjects defined. Click "Add Subject" to begin.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {subjects.map((subject, index) => (
              <div key={index} className="border rounded-lg overflow-hidden">
                {/* Subject Header */}
                <button
                  onClick={() => setExpandedSubject(expandedSubject === index ? null : index)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Subject {subject.subjectOrder}</span>
                      {subject.isPrimary && (
                        <Badge variant="default" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                      {subject.identifiedByAI && subject.aiConfidence && (
                        <Badge variant="secondary" className="text-xs">
                          AI: {Math.round(subject.aiConfidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    {subject.breedId && (
                      <span className="text-sm text-gray-600">
                        {breeds.find(b => b.id === subject.breedId)?.name || 'Unknown Breed'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {subjects.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSubject(index);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </button>

                {/* Subject Details (Expanded) */}
                {expandedSubject === index && (
                  <div className="p-4 space-y-4 bg-white">
                    {/* Breed Selection */}
                    <div className="space-y-2">
                      <Label htmlFor={`subject-${index}-breed`}>
                        Breed *
                        {subject.suggestedBreed && !subject.breedId && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            AI Suggestion Available
                          </Badge>
                        )}
                      </Label>

                      {subject.suggestedBreed && !subject.breedId && (
                        <Alert className="bg-blue-50 border-blue-200">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="flex items-center justify-between">
                            <span className="text-sm">
                              AI suggests: <strong>{subject.suggestedBreed.name}</strong> ({Math.round(subject.suggestedBreed.confidence * 100)}% confidence)
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcceptAISuggestion(index, 'breed')}
                            >
                              Accept
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Breed Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                          type="text"
                          placeholder="Search breeds..."
                          value={breedSearchTerms[index] || ''}
                          onChange={(e) => setBreedSearchTerms({ ...breedSearchTerms, [index]: e.target.value })}
                          className="pl-10"
                        />
                      </div>

                      <Select
                        value={subject.breedId}
                        onValueChange={(value) => handleUpdateSubject(index, { breedId: value, coatId: undefined })}
                      >
                        <SelectTrigger id={`subject-${index}-breed`}>
                          <SelectValue placeholder="Select breed..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredSortedBreeds(index).map((breed: any) => (
                            <SelectItem key={breed.id} value={breed.id}>
                              {breed.display_name || breed.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Coat Selection */}
                    {subject.breedId && (
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${index}-coat`}>
                          Coat Color/Pattern
                          {subject.suggestedCoat && !subject.coatId && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              AI Suggestion Available
                            </Badge>
                          )}
                        </Label>

                        {subject.suggestedCoat && !subject.coatId && (
                          <Alert className="bg-blue-50 border-blue-200">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="flex items-center justify-between">
                              <span className="text-sm">
                                AI suggests: <strong>{subject.suggestedCoat.name}</strong>
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAcceptAISuggestion(index, 'coat')}
                              >
                                Accept
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Coat Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="Search coats..."
                            value={coatSearchTerms[index] || ''}
                            onChange={(e) => setCoatSearchTerms({ ...coatSearchTerms, [index]: e.target.value })}
                            className="pl-10"
                          />
                        </div>

                        <Select
                          value={subject.coatId}
                          onValueChange={(value) => handleUpdateSubject(index, { coatId: value })}
                        >
                          <SelectTrigger id={`subject-${index}-coat`}>
                            <SelectValue placeholder="Select coat..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getCoatsForBreed(subject.breedId, index).map((coat: any) => (
                              <SelectItem key={coat.id} value={coat.id}>
                                {coat.display_name || coat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Outfit Selection */}
                    <div className="space-y-2">
                      <Label htmlFor={`subject-${index}-outfit`}>Outfit (Optional)</Label>
                      <Select
                        value={subject.outfitId || 'none'}
                        onValueChange={(value) => handleUpdateSubject(index, { outfitId: value === 'none' ? undefined : value })}
                      >
                        <SelectTrigger id={`subject-${index}-outfit`}>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {outfits.map((outfit: any) => (
                            <SelectItem key={outfit.id} value={outfit.id}>
                              {outfit.display_name || outfit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Position & Prominence */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${index}-position`}>Position in Frame</Label>
                        <Select
                          value={subject.position}
                          onValueChange={(value) => handleUpdateSubject(index, { position: value })}
                        >
                          <SelectTrigger id={`subject-${index}-position`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                            <SelectItem value="foreground">Foreground</SelectItem>
                            <SelectItem value="background">Background</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`subject-${index}-prominence`}>Size/Prominence</Label>
                        <Select
                          value={subject.sizeProminence}
                          onValueChange={(value) => handleUpdateSubject(index, { sizeProminence: value })}
                        >
                          <SelectTrigger id={`subject-${index}-prominence`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary (largest)</SelectItem>
                            <SelectItem value="secondary">Secondary</SelectItem>
                            <SelectItem value="equal">Equal</SelectItem>
                            <SelectItem value="dominant">Dominant (much larger)</SelectItem>
                            <SelectItem value="minor">Minor (smaller)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Pose Description */}
                    <div className="space-y-2">
                      <Label htmlFor={`subject-${index}-pose`}>Pose Description</Label>
                      <Input
                        id={`subject-${index}-pose`}
                        value={subject.poseDescription}
                        onChange={(e) => handleUpdateSubject(index, { poseDescription: e.target.value })}
                        placeholder="e.g., sitting, looking at camera"
                      />
                    </div>

                    {/* Set Primary Button */}
                    {subjects.length > 1 && !subject.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(index)}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Set as Primary Subject
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Subject Button */}
        <Button
          variant="outline"
          onClick={handleAddSubject}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Subject
        </Button>

        {/* Help Text */}
        <div className="text-xs text-gray-600 bg-gray-50 border rounded-lg p-3">
          <p className="font-medium mb-1">💡 Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Primary subject is used for single-subject variations</li>
            <li>All subjects are used for multi-pet (pair) portraits</li>
            <li>Position and size help AI maintain correct composition</li>
            <li>Accept AI suggestions or manually select breeds/coats</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
