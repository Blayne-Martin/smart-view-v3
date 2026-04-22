import React from 'react'

export type HealthStatus = 'All' | 'Good' | 'Warn' | 'Bad'

export interface HealthStatusFilterProps {
  selectedStatus: HealthStatus
  onStatusChange: (status: HealthStatus) => void
  counts?: {
    all: number
    good: number
    warn: number
    bad: number
  }
  ariaLabel?: string
}

const STATUS_CONFIG = {
  All: { color: 'bg-gray-600', label: 'All', icon: '∗' },
  Good: { color: 'bg-green-600', label: 'Healthy', icon: '✓' },
  Warn: { color: 'bg-yellow-600', label: 'Warning', icon: '⚠' },
  Bad: { color: 'bg-red-600', label: 'Critical', icon: '✕' },
}

/**
 * Health status filter chips for fleet dashboard and customer list
 * 
 * Features:
 * - Visual status indicators with colors
 * - Optional count badges
 * - Keyboard navigation with Arrow keys
 * - prefers-reduced-motion support
 * - WCAG 2.1 AA accessible
 */
export const HealthStatusFilter: React.FC<HealthStatusFilterProps> = ({
  selectedStatus,
  onStatusChange,
  counts,
  ariaLabel = 'Filter by health status',
}) => {
  const statuses: HealthStatus[] = ['All', 'Good', 'Warn', 'Bad']
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  const handleKeyDown = (
    e: React.KeyboardEvent,
    status: HealthStatus,
    index: number
  ) => {
    if (e.key === 'ArrowRight' && index < statuses.length - 1) {
      e.preventDefault()
      onStatusChange(statuses[index + 1])
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      onStatusChange(statuses[index - 1])
    }
  }

  return (
    <fieldset
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg w-fit"
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {statuses.map((status, index) => {
        const config = STATUS_CONFIG[status]
        const count = counts ? counts[status.toLowerCase() as keyof typeof counts] : undefined

        return (
          <button
            key={status}
            role="radio"
            aria-checked={selectedStatus === status}
            aria-label={`${config.label}${count !== undefined ? ` (${count})` : ''}`}
            onClick={() => onStatusChange(status)}
            onKeyDown={(e) => handleKeyDown(e, status, index)}
            className={`
              relative px-4 py-2 rounded-full font-medium text-sm
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              flex items-center gap-2
              ${
                selectedStatus === status
                  ? `${config.color} text-white shadow-lg`
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
              ${prefersReducedMotion ? '' : 'transform hover:scale-105'}
            `}
          >
            <span className="text-lg" aria-hidden="true">
              {config.icon}
            </span>
            <span>{config.label}</span>
            {count !== undefined && (
              <span
                className={`
                  ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
                  ${
                    selectedStatus === status
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-200 text-gray-900'
                  }
                `}
                aria-label={`count: ${count}`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </fieldset>
  )
}
