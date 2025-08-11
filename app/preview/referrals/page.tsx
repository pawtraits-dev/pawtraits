import { Plus } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const referrals = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    status: "Pending",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    status: "Approved",
  },
  {
    id: "3",
    name: "Peter Jones",
    email: "peter.jones@example.com",
    status: "Rejected",
  },
]

export default function ReferralsPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Referrals</h1>
        <Link href="/preview/referrals/create">
          <Button className="bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Referral
          </Button>
        </Link>
      </div>

      {/* Preview Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-amber-800">Preview Mode - Referrals</h3>
            <p className="text-sm text-amber-700">All referral data is simulated for preview purposes</p>
          </div>
          <Link href="/preview">
            <Button variant="outline" size="sm" className="bg-white">
              Back to Preview Menu
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <Table>
          <TableCaption>A list of your referrals.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.map((referral) => (
              <TableRow key={referral.id}>
                <TableCell className="font-medium">{referral.id}</TableCell>
                <TableCell>{referral.name}</TableCell>
                <TableCell>{referral.email}</TableCell>
                <TableCell>{referral.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>{referrals.length} Total</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
