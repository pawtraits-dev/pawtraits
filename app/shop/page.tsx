import { redirect } from 'next/navigation'

// Shop root should redirect to main browse page
export default function ShopPage() {
  redirect('/browse')
}