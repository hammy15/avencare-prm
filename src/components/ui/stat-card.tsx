"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "./card"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: {
    value: number
    label?: string
  }
  icon?: React.ReactNode
  trend?: "up" | "down" | "neutral"
}

export function StatCard({
  title,
  value,
  change,
  icon,
  trend,
  className,
  ...props
}: StatCardProps) {
  const trendColors = {
    up: "text-emerald-500",
    down: "text-rose-500",
    neutral: "text-surface-400",
  }

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  }

  return (
    <Card className={cn("relative overflow-hidden", className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-surface-900 dark:text-surface-50">
            {value}
          </p>
          {change && (
            <div className={cn("flex items-center gap-1 text-sm", trend && trendColors[trend])}>
              {trend && trendIcons[trend]}
              <span>{change.value > 0 ? "+" : ""}{change.value}%</span>
              {change.label && (
                <span className="text-surface-400 dark:text-surface-500">
                  {change.label}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-xl bg-primary-500/10 text-primary-500">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
