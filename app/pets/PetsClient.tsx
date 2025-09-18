'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Camera, 
  Upload, 
  Plus, 
  Heart, 
  Trash2,
  Edit,
  X,
  Check,
  ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import type { UserPetData } from '@/lib/types';
import type { UserProfile } from '@/lib/user-types';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

export default function PetsClient() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pets, setPets] = useState<UserPetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<UserPetData | null>(null);
  const [showPetModal, setShowPetModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<Record<string, number>>({});
  const [editingPet, setEditingPet] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<UserPetData>>({});
  const [deletingPet, setDeletingPet] = useState(false);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      console.log('🔧 STEP 1: Loading user profile using SupabaseService (same as working gallery)...');
      
      // Use EXACT same approach as working gallery page
      const profile = await supabaseService.getCurrentUserProfile();
      console.log('🔧 STEP 2: Profile loaded via SupabaseService:', profile);
      
      setUserProfile(profile);
      
      if (profile) {
        console.log('🔧 STEP 3: Loading pets for user_id:', profile.user_id);
        
        // Use the SupabaseService client for RPC call
        const petsData = await supabaseService.getClient()
          .rpc('get_user_pets', { user_uuid: profile.user_id });
        
        console.log('🔧 STEP 4: Direct RPC result:', petsData);
        setPets(petsData.data || []);
      }
    } catch (error) {
      console.error('🔧 ERROR: Error loading user data with SupabaseService:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePetClick = (pet: UserPetData) => {
    setSelectedPet(pet);
    setEditFormData(pet);
    setEditingPet(false);
    setShowPetModal(true);
  };

  const startEditing = () => {
    if (selectedPet) {
      setEditFormData({ ...selectedPet });
      setEditingPet(true);
    }
  };

  const cancelEditing = () => {
    setEditingPet(false);
    if (selectedPet) {
      setEditFormData(selectedPet);
    }
  };

  const saveChanges = async () => {
    if (!selectedPet || !editFormData.pet_id) return;

    try {
      const { error } = await supabaseService.getClient()
        .from('pets')
        .update({
          name: editFormData.name,
          gender: editFormData.gender,
          age: editFormData.age,
          birthday: editFormData.birthday,
          weight: editFormData.weight,
          special_notes: editFormData.special_notes
        })
        .eq('id', editFormData.pet_id);

      if (error) {
        console.error('Error updating pet:', error);
        alert('Failed to save changes. Please try again.');
      } else {
        console.log('Pet updated successfully');
        setEditingPet(false);
        // Reload pets data to reflect changes
        await loadUserData();
        // Update selected pet with new data
        const updatedPet = pets.find(p => p.pet_id === editFormData.pet_id);
        if (updatedPet) {
          setSelectedPet(updatedPet);
        }
      }
    } catch (error) {
      console.error('Error saving pet changes:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const deletePet = async () => {
    if (!selectedPet) return;

    setDeletingPet(true);

    try {
      // Get the authorization header
      const { data: { session } } = await supabaseService.getClient().auth.getSession();
      if (!session) {
        alert('You must be logged in to delete a pet.');
        return;
      }

      const response = await fetch(`/api/customers/pets/${selectedPet.pet_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Pet deleted successfully:', result);
        
        // Close the modal
        setShowPetModal(false);
        setSelectedPet(null);
        setEditingPet(false);
        
        // Reload pets data to reflect changes
        await loadUserData();
        
        // Show success message
        alert(result.message || 'Pet deleted successfully');
      } else {
        const errorData = await response.json();
        console.error('Failed to delete pet:', errorData);
        alert(`Failed to delete pet: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting pet:', error);
      alert('Failed to delete pet. Please try again.');
    } finally {
      setDeletingPet(false);
    }
  };

  const handlePhotoUpload = async (petId: string, files: FileList | null) => {
    if (!files || files.length === 0 || !userProfile) return;

    // Validate files before upload
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Only image files are allowed.`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadingPetId(petId);

    try {
      const uploadPromises = validFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userProfile.user_id);
        formData.append('petId', petId);

        const response = await fetch('/api/upload/pet-photo', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = `${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.details ? `${errorData.error}: ${errorData.details}` : errorData.error;
            }
          } catch {
            // If JSON parsing fails, use the text response
            const errorText = await response.text();
            if (errorText) errorMessage = errorText;
          }
          console.error(`Upload failed for ${file.name}:`, response.status, errorMessage);
          throw new Error(`Upload failed for ${file.name}: ${errorMessage}`);
        }

        return response.json();
      });

      const uploadResults = await Promise.all(uploadPromises);
      console.log('Photos uploaded successfully:', uploadResults);

      // Reload pets data to get updated photos
      await loadUserData();
      
      // Update selected pet if modal is open
      if (selectedPet && selectedPet.pet_id === petId) {
        const updatedPet = pets.find(p => p.pet_id === petId);
        if (updatedPet) {
          setSelectedPet(updatedPet);
        }
      }

    } catch (error) {
      console.error('Error uploading photos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to upload photos: ${errorMessage}`);
    } finally {
      setUploading(false);
      setUploadingPetId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAgeDisplay = (age?: number) => {
    if (!age) return 'Unknown';
    if (age < 12) return `${age} months`;
    const years = Math.floor(age / 12);
    const months = age % 12;
    if (months === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
    return `${years}y ${months}m`;
  };

  const getCurrentPhotoUrl = (pet: UserPetData) => {
    if (!pet.photo_urls || pet.photo_urls.length === 0) return pet.primary_photo_url || null;
    const currentIndex = currentPhotoIndex[pet.pet_id] || 0;
    return pet.photo_urls[currentIndex] || pet.photo_urls[0];
  };

  const navigatePhoto = (petId: string, direction: 'prev' | 'next', photoCount: number) => {
    setCurrentPhotoIndex(prev => {
      const currentIndex = prev[petId] || 0;
      let newIndex;
      
      if (direction === 'next') {
        newIndex = currentIndex === photoCount - 1 ? 0 : currentIndex + 1;
      } else {
        newIndex = currentIndex === 0 ? photoCount - 1 : currentIndex - 1;
      }
      
      return { ...prev, [petId]: newIndex };
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <CountryProvider>
      <UserAwareNavigation />
      <div className="p-6 space-y-6">
        {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Pets</h1>
          <p className="text-gray-600 mt-1">
            Manage your pets and upload photos for AI portraits
          </p>
        </div>
        <Button 
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={() => window.location.href = '/customer/pets/add'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Pet
        </Button>
      </div>

      {/* Pets Grid */}
      {pets.length === 0 ? (
        <Card className="p-8 text-center">
          <CardContent>
            <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pets yet</h3>
            <p className="text-gray-600 mb-4">
              Add your first pet to start creating AI portraits!
            </p>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-blue-600"
              onClick={() => window.location.href = '/customer/pets/add'}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Pet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pets.map((pet) => (
            <Card key={pet.pet_id} className="group hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-0">
                {/* Pet Photo Section */}
                <div 
                  className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden rounded-t-lg cursor-pointer"
                  onClick={() => handlePetClick(pet)}
                >
                  {getCurrentPhotoUrl(pet) ? (
                    <Image
                      src={getCurrentPhotoUrl(pet)!}
                      alt={pet.name}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Photo navigation arrows */}
                  {pet.photo_urls && pet.photo_urls.length > 1 && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 p-0 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigatePhoto(pet.pet_id, 'prev', pet.photo_urls!.length);
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 p-0 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigatePhoto(pet.pet_id, 'next', pet.photo_urls!.length);
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  
                  {/* Photo count badge */}
                  {pet.photo_urls && pet.photo_urls.length > 0 && (
                    <Badge className="absolute top-2 right-2 bg-white/90 text-gray-700">
                      <ImageIcon className="w-3 h-3 mr-1" />
                      {pet.photo_urls.length > 1 
                        ? `${(currentPhotoIndex[pet.pet_id] || 0) + 1}/${pet.photo_urls.length}`
                        : pet.photo_urls.length
                      }
                    </Badge>
                  )}
                </div>

                {/* Pet Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{pet.name}</h3>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    {pet.breed_name && (
                      <p>Breed: {pet.breed_name}</p>
                    )}
                    {pet.coat_name && (
                      <div className="flex items-center space-x-2">
                        <span>Coat:</span>
                        <div className="flex items-center space-x-1">
                          {pet.coat_hex_color && (
                            <div 
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: pet.coat_hex_color }}
                            ></div>
                          )}
                          <span>{pet.coat_name}</span>
                        </div>
                      </div>
                    )}
                    {pet.gender && (
                      <p>Gender: {pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1)}</p>
                    )}
                    {pet.age && (
                      <p>Age: {getAgeDisplay(pet.age)}</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Added {formatDate(pet.created_at)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePetClick(pet)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Manage
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Add Pet Card */}
          <Card className="group hover:shadow-lg transition-shadow duration-200 border-2 border-dashed border-gray-300 hover:border-purple-300">
            <CardContent className="p-0">
              <div className="aspect-square bg-gradient-to-br from-purple-50 to-blue-50 relative overflow-hidden rounded-t-lg flex items-center justify-center">
                <div className="text-center">
                  <Plus className="w-16 h-16 text-purple-400 mx-auto mb-2" />
                  <p className="text-purple-600 font-medium">Add Another Pet</p>
                </div>
              </div>
              <div className="p-4 text-center">
                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  onClick={() => window.location.href = '/customer/pets/add'}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pet Detail Modal */}
      <Dialog open={showPetModal} onOpenChange={setShowPetModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                  {selectedPet?.name.charAt(0)}
                </div>
                <span>{selectedPet?.name} - {editingPet ? 'Edit Details' : 'Photo Gallery'}</span>
              </div>
              <div className="flex space-x-2">
                {editingPet ? (
                  <>
                    <Button variant="outline" size="sm" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveChanges}>
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={startEditing}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Details
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete Pet
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {selectedPet?.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete {selectedPet?.name} and all their photos from your account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={deletePet}
                            disabled={deletingPet}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deletingPet ? 'Deleting...' : 'Delete Pet'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPet && (
            <div className="space-y-6">
              {/* Upload New Photos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload New Photos</CardTitle>
                  <CardDescription>
                    Add photos of {selectedPet.name} to create better AI portraits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-300 transition-colors">
                    <input
                      type="file"
                      id="photo-upload"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(selectedPet.pet_id, e.target.files)}
                      disabled={uploading}
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      {uploading ? (
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                          <p className="text-lg font-medium text-gray-700">Uploading photos...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="w-12 h-12 text-gray-400 mb-4" />
                          <p className="text-lg font-medium text-gray-700 mb-2">
                            Click to upload photos
                          </p>
                          <p className="text-sm text-gray-500">
                            Or drag and drop images here. Max 10MB per file.
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Current Photos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Photos</CardTitle>
                  <CardDescription>
                    {selectedPet.photo_urls?.length || 0} photo{(selectedPet.photo_urls?.length || 0) !== 1 ? 's' : ''} uploaded
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedPet.photo_urls && selectedPet.photo_urls.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedPet.photo_urls.map((photoUrl, index) => (
                        <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative group">
                          <Image 
                            src={photoUrl} 
                            alt={`${selectedPet.name} photo ${index + 1}`}
                            width={200}
                            height={200}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(photoUrl, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(photoUrl, '_blank')}
                            >
                              <ImageIcon className="w-4 h-4 mr-1" />
                              View Full
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No photos uploaded yet</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Upload some photos to get started with AI portraits!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pet Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pet Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {editingPet ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Name</Label>
                          <Input
                            id="edit-name"
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-gender">Gender</Label>
                          <Select 
                            value={editFormData.gender || 'unknown'} 
                            onValueChange={(value: 'male' | 'female' | 'unknown') => setEditFormData({...editFormData, gender: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-age">Age (months)</Label>
                          <Input
                            id="edit-age"
                            type="number"
                            value={editFormData.age || ''}
                            onChange={(e) => setEditFormData({...editFormData, age: e.target.value ? parseInt(e.target.value) : undefined})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-birthday">Birthday</Label>
                          <Input
                            id="edit-birthday"
                            type="date"
                            value={editFormData.birthday || ''}
                            onChange={(e) => setEditFormData({...editFormData, birthday: e.target.value})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-weight">Weight (lbs)</Label>
                          <Input
                            id="edit-weight"
                            type="number"
                            step="0.1"
                            value={editFormData.weight || ''}
                            onChange={(e) => setEditFormData({...editFormData, weight: e.target.value ? parseFloat(e.target.value) : undefined})}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="edit-notes">Special Notes</Label>
                        <Textarea
                          id="edit-notes"
                          value={editFormData.special_notes || ''}
                          onChange={(e) => setEditFormData({...editFormData, special_notes: e.target.value})}
                          placeholder="Any special notes about your pet"
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        {selectedPet.breed_name && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Breed:</span>
                            <span className="font-medium">{selectedPet.breed_name}</span>
                          </div>
                        )}
                        
                        {selectedPet.coat_name && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Coat:</span>
                            <div className="flex items-center space-x-2">
                              {selectedPet.coat_hex_color && (
                                <div 
                                  className="w-4 h-4 rounded-full border border-gray-300"
                                  style={{ backgroundColor: selectedPet.coat_hex_color }}
                                ></div>
                              )}
                              <span className="font-medium">{selectedPet.coat_name}</span>
                            </div>
                          </div>
                        )}
                        
                        {selectedPet.gender && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Gender:</span>
                            <span className="font-medium">{selectedPet.gender.charAt(0).toUpperCase() + selectedPet.gender.slice(1)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {selectedPet.age && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Age:</span>
                            <span className="font-medium">{getAgeDisplay(selectedPet.age)}</span>
                          </div>
                        )}
                        
                        {selectedPet.birthday && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Birthday:</span>
                            <span className="font-medium">{formatDate(selectedPet.birthday)}</span>
                          </div>
                        )}
                        
                        {selectedPet.weight && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Weight:</span>
                            <span className="font-medium">{selectedPet.weight} lbs</span>
                          </div>
                        )}
                        
                        {selectedPet.created_at && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Added:</span>
                            <span className="font-medium">{formatDate(selectedPet.created_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Personality Traits */}
                  {!editingPet && selectedPet.personality_traits && selectedPet.personality_traits.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 mb-2">Personality Traits</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedPet.personality_traits.map((trait, index) => (
                          <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Special Notes */}
                  {!editingPet && selectedPet.special_notes && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 mb-2">Special Notes</h4>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-700 italic">"{selectedPet.special_notes}"</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </CountryProvider>
  );
}