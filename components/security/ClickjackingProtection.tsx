/**
 * SECURITY CRITICAL: Clickjacking Protection Component
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'

export const ClickjackingProtection: React.FC<{
  children: React.ReactNode
  sensitiveAction?: boolean
}> = ({ children, sensitiveAction = false }) => {
  const [isInFrame, setIsInFrame] = useState(false)
  const [opacity, setOpacity] = useState(1)
  const componentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check if in iframe
    if (window.self !== window.top) {
      setIsInFrame(true)
      if (sensitiveAction) {
        setOpacity(0) // Hide sensitive content
      }
    }

    // Monitor visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden && sensitiveAction) {
        setOpacity(0)
      } else {
        setOpacity(1)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [sensitiveAction])

  if (isInFrame && sensitiveAction) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-700">This action cannot be performed in a frame for security reasons.</p>
      </div>
    )
  }

  return (
    <div ref={componentRef} style={{ opacity, transition: 'opacity 0.3s' }}>
      {children}
    </div>
  )
}