import { useQuery } from '@tanstack/react-query'
import { deviceAPI, DeviceWithStats, DeviceHistoryRecord } from '@/api/client'

/**
 * Paginated list of devices with current stats for a customer.
 * staleTime: 60s
 */
export function useDevices(customerId: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['devices', customerId, limit, offset],
    queryFn: () => deviceAPI.getAll(customerId, limit, offset),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!customerId,
    retry: 1,
  })
}

/**
 * Full flat device list for topology tree reconstruction.
 * staleTime: 60s
 */
export function useDeviceTopology(customerId: string) {
  return useQuery<DeviceWithStats[]>({
    queryKey: ['deviceTopology', customerId],
    queryFn: () => deviceAPI.getTopology(customerId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!customerId,
    retry: 1,
  })
}

/**
 * Single device with current stats.
 * staleTime: 60s
 */
export function useDevice(customerId: string, deviceId: string) {
  return useQuery<DeviceWithStats>({
    queryKey: ['device', customerId, deviceId],
    queryFn: () => deviceAPI.getById(customerId, deviceId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!customerId && !!deviceId,
    retry: 1,
  })
}

/**
 * Sampled history for a device.
 * staleTime: 2min
 */
export function useDeviceHistory(
  customerId: string,
  deviceId: string,
  days: 1 | 7 | 30 | 90 = 7,
  limit = 200
) {
  return useQuery<{ data: DeviceHistoryRecord[]; samplingApplied: boolean }>({
    queryKey: ['deviceHistory', customerId, deviceId, days, limit],
    queryFn: () => deviceAPI.getHistory(customerId, deviceId, days, limit),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!customerId && !!deviceId,
    retry: 1,
  })
}

/**
 * Build a tree from a flat list of DeviceWithStats.
 * Returns only root nodes; children are nested under .children.
 */
export type DeviceNode = DeviceWithStats & { children: DeviceNode[] }

export function buildTree(devices: DeviceWithStats[]): DeviceNode[] {
  const map = new Map<string, DeviceNode>()
  for (const d of devices) {
    map.set(d.id, { ...d, children: [] })
  }
  const roots: DeviceNode[] = []
  for (const node of map.values()) {
    if (!node.parent_device_id || !map.has(node.parent_device_id)) {
      roots.push(node)
    } else {
      map.get(node.parent_device_id)!.children.push(node)
    }
  }
  return roots
}
