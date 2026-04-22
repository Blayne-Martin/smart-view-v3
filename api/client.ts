import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => {
    if (response.data && response.data.data !== undefined) {
      return {
        ...response,
        data: response.data.data,
        metadata: {
          pagination: response.data.pagination,
          samplingApplied: response.data.samplingApplied,
        },
      }
    }
    return response
  },
  (error) => {
    const url: string = error.config?.url ?? ''
    const is401 = error.response?.status === 401
    const isAuthMe = url.includes('/auth/me')
    const isAuthLogin = url.includes('/auth/login')
    if (is401 && !isAuthMe && !isAuthLogin) {
      window.location.href = '/login'
    }
    if (!(is401 && isAuthMe)) {
      console.error('API Error:', error.response?.data || error.message)
    }
    return Promise.reject(error)
  }
)

export type Customer = {
  id: string
  name: string
  email: string
  created_at: string
  updated_at: string
  health_score?: 'Good' | 'Warn' | 'Bad'
}

export type ModemStat = {
  id: string
  customer_id: string
  latency: number
  jitter: number
  packet_loss: number
  snr: number
  health_score: 'Good' | 'Warn' | 'Bad'
  recorded_at: string
}

export type ModemHistoryResponse = {
  data: ModemStat[]
  samplingApplied: boolean
  originalCount?: number
  dataPoints?: number
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

export const customerAPI = {
  getAll: async (limit = 50, offset = 0, status?: 'Good' | 'Warn' | 'Bad'): Promise<PaginatedResponse<Customer>> => {
    const response = await apiClient.get('/customers', { params: { limit, offset, status } }) as any
    const pagination = response.metadata?.pagination
    return { data: response.data as Customer[], total: pagination?.total ?? 0, limit: pagination?.limit ?? limit, offset: pagination?.offset ?? offset }
  },
  getById: async (id: string): Promise<Customer> => {
    const response = await apiClient.get<Customer>(`/customers/${id}`)
    return response.data
  },
  search: async (query: string, limit = 50, status?: 'Good' | 'Warn' | 'Bad'): Promise<PaginatedResponse<Customer>> => {
    const response = await apiClient.get('/customers', { params: { search: query, limit, status } }) as any
    const pagination = response.metadata?.pagination
    return { data: response.data as Customer[], total: pagination?.total ?? 0, limit: pagination?.limit ?? limit, offset: pagination?.offset ?? 0 }
  },
}

export const modemAPI = {
  getCurrentStats: async (customerId: string) => {
    const response = await apiClient.get<ModemStat>(`/modems/${customerId}/stats`)
    return response.data
  },
  getHistory: async (customerId: string, days: 1 | 7 | 30 | 90 = 7, limit = 200): Promise<ModemHistoryResponse> => {
    const response = await apiClient.get(`/modems/${customerId}/history`, { params: { days, limit } }) as any
    return { data: response.data as ModemStat[], samplingApplied: response.metadata?.samplingApplied ?? false }
  },
}

export type DeviceType = 'laptop' | 'desktop' | 'phone' | 'tablet' | 'games_console' | 'smart_tv' | 'wifi_extender' | 'router' | 'iot' | 'other'
export type ConnectionType = 'ethernet' | 'wifi_2_4' | 'wifi_5' | 'wifi_6'

export type Device = {
  id: string
  customer_id: string
  parent_device_id: string | null
  name: string
  device_type: DeviceType
  connection_type: ConnectionType
  mac_address: string | null
  created_at: string
}

export type DeviceStat = {
  id: string
  device_id: string
  is_online: number
  rssi_dbm: number | null
  upload_mbps: number
  download_mbps: number
  latency_ms: number
  recorded_at: string
}

export type DeviceWithStats = Device & {
  is_online: number | null
  rssi_dbm: number | null
  upload_mbps: number | null
  download_mbps: number | null
  latency_ms: number | null
  stats_recorded_at: string | null
}

export type DeviceHistoryRecord = {
  id: string
  device_id: string
  is_online: number
  rssi_dbm: number | null
  upload_mbps: number
  download_mbps: number
  latency_ms: number
  recorded_at: string
}

export const deviceAPI = {
  getAll: async (customerId: string, limit = 50, offset = 0): Promise<{ data: DeviceWithStats[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const response = await apiClient.get(`/customers/${customerId}/devices`, { params: { limit, offset } }) as any
    return { data: response.data as DeviceWithStats[], pagination: response.metadata?.pagination ?? { total: 0, limit, offset, hasMore: false } }
  },
  getTopology: async (customerId: string): Promise<DeviceWithStats[]> => {
    const response = await apiClient.get<DeviceWithStats[]>(`/customers/${customerId}/devices/topology`)
    return response.data
  },
  getById: async (customerId: string, deviceId: string): Promise<DeviceWithStats> => {
    const response = await apiClient.get<DeviceWithStats>(`/customers/${customerId}/devices/${deviceId}`)
    return response.data
  },
  getHistory: async (customerId: string, deviceId: string, days: 1 | 7 | 30 | 90 = 7, limit = 200): Promise<{ data: DeviceHistoryRecord[]; samplingApplied: boolean }> => {
    const response = await apiClient.get(`/customers/${customerId}/devices/${deviceId}/history`, { params: { days, limit } }) as any
    return { data: response.data as DeviceHistoryRecord[], samplingApplied: response.metadata?.samplingApplied ?? false }
  },
}

export const fleetAPI = {
  getWorstPerformers: async (limit = 10, status?: 'Good' | 'Warn' | 'Bad') => {
    const response = await apiClient.get<ModemStat[]>('/fleet/worst-performers', { params: { limit, status } })
    return response.data
  },
  getSummary: async () => {
    const response = await apiClient.get<{ total: number; healthy: number; warning: number; critical: number }>('/fleet/summary')
    return response.data
  },
  getNetworkHistory: async (days: 7 | 30 | 90 = 30) => {
    const response = await apiClient.get<any>('/fleet/network-history', { params: { days } })
    return response.data
  },
  getDistribution: async () => {
    const response = await apiClient.get<{ total: number; latency: number[]; packet_loss: number[]; jitter: number[]; snr: number[] }>('/fleet/distribution')
    return response.data
  },
}
