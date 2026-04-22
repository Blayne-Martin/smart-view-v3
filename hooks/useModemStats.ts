import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { modemAPI, ModemStat } from '@/api/client'

export const useModemStats = (
  customerId: string
): UseQueryResult<ModemStat> & { isStreaming: boolean } => {
  const query = useQuery({
    queryKey: ['modemStats', customerId],
    queryFn: () => modemAPI.getCurrentStats(customerId),
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!customerId,
    retry: 1,
    refetchInterval: 10_000,
  })

  return { ...query, isStreaming: false }
}

export const calculateHealthStatus = (stat: ModemStat): 'Good' | 'Warn' | 'Bad' => {
  if (stat.health_score) return stat.health_score
  if (stat.latency < 50 && stat.packet_loss < 1 && stat.snr > 30) return 'Good'
  if (stat.latency < 100 && stat.packet_loss < 5 && stat.snr > 20) return 'Warn'
  return 'Bad'
}

export const getHealthColor = (status: 'Good' | 'Warn' | 'Bad') => {
  const colors = {
    Good: '#22c55e',
    Warn: '#eab308',
    Bad: '#ef4444',
  }
  return colors[status]
}
