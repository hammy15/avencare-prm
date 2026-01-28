import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

// Format currency
export function formatCurrency(num: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

// Format percentage
export function formatPercent(num: number, decimals = 1): string {
  return `${num.toFixed(decimals)}%`
}

// Format date
export function formatDate(date: Date | string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid Date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(d)
}

// Format date and time
export function formatDateTime(date: Date | string | null): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid Date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

// Format relative time (e.g., "2 hours ago")
export function formatRelative(date: Date | string | null): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid Date'

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(d)
}

// Format person name
export function formatName(first?: string | null, last?: string | null): string {
  const parts = [first, last].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Unknown'
}

// Format phone number
export function formatPhone(phone?: string | null): string {
  if (!phone) return 'N/A'
  // Remove non-digits
  const digits = phone.replace(/\D/g, '')
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

// Check if date is expiring soon (within N days)
export function isExpiringSoon(date: Date | string | null, days = 30): boolean {
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return false
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const diffDays = diff / (1000 * 60 * 60 * 24)
  return diffDays > 0 && diffDays <= days
}

// Truncate text
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Sleep/delay
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Generate random ID
export function generateId(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length)
}
