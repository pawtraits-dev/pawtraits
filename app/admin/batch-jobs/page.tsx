import { redirect } from 'next/navigation';

// The old background batch jobs are replaced by saved variation batches (Gemini Batch API)
export default function BatchJobsPage() {
  redirect('/admin/variation-batches');
}
