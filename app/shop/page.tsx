import { redirect } from 'next/navigation'

// Shop root should redirect to customer shop
export default function ShopPage() {
  redirect('/customer/shop')
}