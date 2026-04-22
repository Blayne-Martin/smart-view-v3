import React from 'react'
import { TimeRange, getTimeRangeLabel, formatTimeRange } from '@/hooks/useModemHistory'

export interface TimeRangeSelectorProps {
  selectedRange: TimeRange
  onRangeChange: (range: TimeRange) => void
  ariaLabel?: string
}

/**
 * Time range toggle buttons for chart filtering
 * Supports: 24h, 7d, 30d, 90d
 * 
 * Accessibility:
 * - Role: radiogroup with radio buttons
 * - Keyboard: Tab to focus, Arrow keys to navigate
 * - Respects prefers-reduced-motion
 */
export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  ariaLabel = 'Select time range for chart',
}) => {
  const ranges: TimeRange[] = [1, 7, 30, 90]
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  const handleKeyDown = (
    e: React.KeyboardEvent,
    range: TimeRange,
    index: number
  ) => {
    if (e.key === 'ArrowRight' && index < ranges.length - 1) {
      e.preventDefault()
      onRangeChange(ranges[index + 1])
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      onRangeChange(ranges[index - 1])
    }
  }

  return (
    <fieldset
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg w-fit"
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {ranges.map((range, index) => (
        <button
          key={range}
          role="radio"
          aria-checked={selectedRange === range}
          aria-label={`${formatTimeRange(range)}`}
          onClick={() => onRangeChange(range)}
          onKeyDown={(e) => handleKeyDown(e, range, index)}
          className={`
            px-4 py-2 rounded font-medium text-sm
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            ${
              selectedRange === range
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }
            ${prefersReducedMotion ? '' : 'transform hover:scale-105'}
          `}
        >
          {getTimeRangeLabel(range)}
        </button>
      ))}
    </fieldset>
  )
}
