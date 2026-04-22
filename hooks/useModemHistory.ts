import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { modemAPI, ModemHistoryResponse } from '@/api/client'

export type TimeRange = 1 | 7 | 30 | 90

export const useModemHistory = (
  customerId: string,
  timeRange: TimeRange = 7,
  limit = 200
): UseQueryResult<ModemHistoryResponse> => {
  return useQuery({
    queryKey: ['modemHistory', customerId, timeRange],
    queryFn: () => modemAPI.getHistory(customerId, timeRange, limit),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!customerId,
    retry: 1,
  })
}

export const useTimeRange = (
  initialRange: TimeRange = 7
): [TimeRange, (range: TimeRange) => void] => {
  const [range, setRange] = useState<TimeRange>(initialRange)
  return [range, setRange]
}

export const formatTimeRange = (days: TimeRange): string => {
  const ranges: Record<TimeRange, string> = {
    1: '24 hours',
    7: '7 days',
    30: '30 days',
    90: '90 days',
  }
  return ranges[days] ?? '7 days'
}

export const getTimeRangeLabel = (days: TimeRange): string => {
  const labels: Record<TimeRange, string> = {
    1: '24h',
    7: '7d',
    30: '30d',
    90: '90d',
  }
  return labels[days] ?? '7d'
}
