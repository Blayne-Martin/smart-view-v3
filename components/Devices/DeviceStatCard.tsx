'use client'

import React from 'react'

interface DeviceStatCardProps {
  label: string
  value: string | number | null
  unit?: string
  isGood?: boolean
}

export const DeviceStatCard: React.FC<DeviceStatCardProps> = ({ label, value, unit = '', isGood }) => {
  const displayValue = value !== null && value !== undefined ? value : '—'
  const border = isGood === true
    ? 'border-green-200 bg-green-50'
    : isGood === false
      ? 'border-red-200 bg-red-50'
      : 'border-gray-200 bg-white'

  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-1 ${border}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">
        {displayValue}
        {value !== null && value !== undefined && unit && (
          <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
        )}
      </p>
    </div>
  )
}
