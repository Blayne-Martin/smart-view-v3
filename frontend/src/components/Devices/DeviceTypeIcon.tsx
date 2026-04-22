import React from 'react'
import { DeviceType } from '@/api/client'

const ICONS: Record<DeviceType, { symbol: string; label: string }> = {
  laptop:        { symbol: '\u{1F4BB}', label: 'Laptop' },
  desktop:       { symbol: '\u{1F5A5}', label: 'Desktop' },
  phone:         { symbol: '\u{1F4F1}', label: 'Phone' },
  tablet:        { symbol: '\u{1F4F2}', label: 'Tablet' },
  games_console: { symbol: '\u{1F3AE}', label: 'Games Console' },
  smart_tv:      { symbol: '\u{1F4FA}', label: 'Smart TV' },
  wifi_extender: { symbol: '\u{1F4E1}', label: 'WiFi Extender' },
  router:        { symbol: '\u{1F310}', label: 'Router' },
  iot:           { symbol: '\u{1F4A1}', label: 'IoT Device' },
  other:         { symbol: '\u{2753}',  label: 'Other' },
}

interface DeviceTypeIconProps {
  type: DeviceType
  className?: string
  /** If true, renders the label text alongside the icon */
  showLabel?: boolean
}

export const DeviceTypeIcon: React.FC<DeviceTypeIconProps> = ({ type, className = '', showLabel = false }) => {
  const { symbol, label } = ICONS[type] ?? ICONS.other
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={label}>
      <span aria-hidden="true">{symbol}</span>
      {showLabel && <span className="text-sm text-gray-700">{label}</span>}
    </span>
  )
}
