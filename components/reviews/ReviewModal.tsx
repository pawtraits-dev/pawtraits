'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import StarRating from './StarRating';
import type { CreateReviewResponse } from '@/lib/types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: string;
  imageUrl: string;
  imageTitle: string;
  productName: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  orderItemId,
  imageUrl,
  imageTitle,
  productName,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (rating < 1 || rating > 5) {
      setError('Please select a rating');
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length < 10) {
      setError('Please write at least 10 characters');
      return;
    }

    if (trimmedComment.length > 1000) {
      setError('Comment must be 1000 characters or less');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/shop/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          order_item_id: orderItemId,
          rating,
          comment: trimmedComment,
        }),
      });

      const data: CreateReviewResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setSuccess(true);
      setAutoApproved(data.review?.is_auto_approved || false);

      // Call callback after short delay
      setTimeout(() => {
        if (onReviewSubmitted) {
          onReviewSubmitted();
        }
        handleClose();
      }, 2000);

    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setRating(5);
      setComment('');
      setError(null);
      setSuccess(false);
      setAutoApproved(false);
      onClose();
    }
  };

  const characterCount = comment.length;
  const characterLimit = 1000;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Leave a Review</DialogTitle>
          <DialogDescription>
            Share your experience with this portrait
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Thank you for your review!</h3>
            <p className="text-gray-600">
              {autoApproved
                ? 'Your review has been published and will appear on our homepage.'
                : 'Your review will be published after admin approval.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Product Preview */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                <Image
                  src={imageUrl}
                  alt={imageTitle}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{imageTitle}</h4>
                <p className="text-sm text-gray-600">{productName}</p>
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating *
              </label>
              <StarRating
                rating={rating}
                onChange={setRating}
                size="lg"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Review *
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about this portrait... What did you love? How did it turn out?"
                rows={6}
                className="resize-none"
                disabled={submitting}
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Minimum 10 characters
                </p>
                <p className={`text-xs ${characterCount > characterLimit ? 'text-red-500' : 'text-gray-500'}`}>
                  {characterCount} / {characterLimit}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || characterCount < 10 || characterCount > characterLimit}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
