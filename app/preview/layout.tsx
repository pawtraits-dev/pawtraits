import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard Preview - Pawtraits Partner",
  description: "Preview the groomer partner dashboard without logging in",
}

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
