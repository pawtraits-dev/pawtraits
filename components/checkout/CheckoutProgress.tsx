'use client'

import { Progress } from '@/components/ui/progress'

interface Step {
  number: number
  title: string
  completed: boolean
}

interface CheckoutProgressProps {
  currentStep: number
  steps: Step[]
}

export default function CheckoutProgress({ currentStep, steps }: CheckoutProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step.completed
                  ? "bg-green-600 text-white"
                  : currentStep === step.number
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              {step.completed ? "✓" : step.number}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                currentStep === step.number ? "text-green-600" : "text-gray-600"
              }`}
            >
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4">
                <div className={`h-1 rounded ${step.completed ? "bg-green-600" : "bg-gray-200"}`} />
              </div>
            )}
          </div>
        ))}
      </div>
      <Progress value={(currentStep / steps.length) * 100} className="h-2" />
    </div>
  )
}