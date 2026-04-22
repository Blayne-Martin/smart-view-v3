import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { fleetAPI, ModemStat } from '@/api/client'

export type FleetSummary = {
  total: number
  healthy: number
  warning: number
  critical: number
}

/**
 * Fetch fleet-wide summary statistics
 * - Total customers
 * - Count by health status
 */
export const useFleetSummary = (): UseQueryResult<FleetSummary> => {
  return useQuery({
    queryKey: ['fleetSummary'],
    queryFn: () => fleetAPI.getSummary(),
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

/**
 * Fetch worst performing modems with optional status filter
 */
export const useWorstPerformers = (
  status?: 'Good' | 'Warn' | 'Bad',
  limit = 10
): UseQueryResult<ModemStat[]> => {
  return useQuery({
    queryKey: ['worstPerformers', status, limit],
    queryFn: () => fleetAPI.getWorstPerformers(limit, status),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

export type FleetDistribution = {
  total: number
  latency: number[]
  packet_loss: number[]
  jitter: number[]
  snr: number[]
}

export const useNetworkHistory = (days: 7 | 30 | 90 = 30) => {
  return useQuery({
    queryKey: ['networkHistory', days],
    queryFn: () => fleetAPI.getNetworkHistory(days),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })
}

export const useFleetDistribution = (): UseQueryResult<FleetDistribution> => {
  return useQuery({
    queryKey: ['fleetDistribution'],
    queryFn: () => fleetAPI.getDistribution(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}
