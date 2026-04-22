import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query'
import { modemAPI, ModemStat } from '@/api/client'
import { useEffect, useState } from 'react'

/**
 * Fetch current modem stats (last recorded measurement)
 * Includes optional SSE streaming for real-time updates
 */
export const useModemStats = (
  customerId: string,
  enableSSE = false
): UseQueryResult<ModemStat> & { isStreaming: boolean } => {
  const [isStreaming, setIsStreaming] = useState(false)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['modemStats', customerId],
    queryFn: () => modemAPI.getCurrentStats(customerId),
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!customerId,
    retry: 1,
  })

  useEffect(() => {
    if (!enableSSE || !customerId) return

    const eventSource = modemAPI.streamStats(customerId)
    setIsStreaming(true)

    const handleMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['modemStats', customerId] })
    }

    const handleError = () => {
      console.error('SSE connection error, falling back to polling')
      setIsStreaming(false)
      eventSource.close()
    }

    eventSource.addEventListener('stats', handleMessage)
    eventSource.addEventListener('error', handleError)

    return () => {
      eventSource.removeEventListener('stats', handleMessage)
      eventSource.removeEventListener('error', handleError)
      eventSource.close()
      setIsStreaming(false)
    }
  }, [customerId, enableSSE, queryClient])

  return { ...query, isStreaming }
}

/**
 * Calculate health status from modem stats
 * Good: latency < 50ms, packet_loss < 1%, snr > 30dB
 * Warn: latency < 100ms, packet_loss < 5%, snr > 20dB
 * Bad: otherwise
 */
export const calculateHealthStatus = (
  stat: ModemStat
): 'Good' | 'Warn' | 'Bad' => {
  if (stat.health_score) {
    return stat.health_score
  }

  if (stat.latency < 50 && stat.packet_loss < 1 && stat.snr > 30) {
    return 'Good'
  }
  if (stat.latency < 100 && stat.packet_loss < 5 && stat.snr > 20) {
    return 'Warn'
  }
  return 'Bad'
}

/**
 * Get color for health status
 */
export const getHealthColor = (status: 'Good' | 'Warn' | 'Bad') => {
  const colors = {
    Good: '#22c55e', // green-500
    Warn: '#eab308', // yellow-500
    Bad: '#ef4444', // red-500
  }
  return colors[status]
}
