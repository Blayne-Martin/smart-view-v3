import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { customerAPI, Customer, PaginatedResponse } from '@/api/client'

/**
 * Custom hook to fetch paginated customer list with caching
 * - Stale time: 30 seconds
 * - Cache time: 5 minutes
 * - Auto-refetch on window focus
 */
export const useCustomers = (
  limit = 50,
  offset = 0,
  searchQuery?: string,
  status?: 'Good' | 'Warn' | 'Bad'
): UseQueryResult<PaginatedResponse<Customer>> => {
  return useQuery({
    queryKey: ['customers', limit, offset, searchQuery, status],
    queryFn: async () => {
      if (searchQuery) {
        return customerAPI.search(searchQuery, limit, status)
      }
      return customerAPI.getAll(limit, offset, status)
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    retry: 2,
  })
}

/**
 * Fetch individual customer details
 */
export const useCustomer = (
  customerId: string
): UseQueryResult<Customer> => {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerAPI.getById(customerId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!customerId,
  })
}
