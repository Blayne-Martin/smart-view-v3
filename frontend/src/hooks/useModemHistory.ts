import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { modemAPI, ModemHistoryResponse } from '@/api/client'

export type TimeRange = 1 | 7 | 30 | 90

/**
 * Fetch modem history with time-range filtering
 * - Server applies sampling to cap at 200 data points
 * - Stale time: 60 seconds
 * - Data refreshes when time range changes
 */
export const useModemHistory = (
  customerId: string,
  timeRange: TimeRange = 7,
  limit = 200
): UseQueryResult<ModemHistoryResponse> => {
  return useQuery({
    queryKey: ['modemHistory', customerId, timeRange],
    queryFn: () => modemAPI.getHistory(customerId, timeRange, limit),
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!customerId,
    retry: 1,
  })
}

/**
 * Hook to manage time range state with URL persistence
 * Integrates with URL search params for deep linking
 */
export const useTimeRange = (
  initialRange: TimeRange = 7
): [TimeRange, (range: TimeRange) => void] => {
  const params = new URLSearchParams(window.location.search)
  const urlRange = params.get('timeRange')
  const range = (urlRange ? parseInt(urlRange) : initialRange) as TimeRange

  const setTimeRange = (newRange: TimeRange) => {
    const newParams = new URLSearchParams(window.location.search)
    newParams.set('timeRange', newRange.toString())
    window.history.replaceState(null, '', `?${newParams.toString()}`)
  }

  return [range, setTimeRange]
}

/**
 * Format time range for display
 */
export const formatTimeRange = (days: TimeRange): string => {
  const ranges = {
    1: '24 hours',
    7: '7 days',
    30: '30 days',
    90: '90 days',
  }
  return ranges[days] || '7 days'
}

/**
 * Get label for time range button
 */
export const getTimeRangeLabel = (days: TimeRange): string => {
  const labels = {
    1: '24h',
    7: '7d',
    30: '30d',
    90: '90d',
  }
  return labels[days] || '7d'
}
