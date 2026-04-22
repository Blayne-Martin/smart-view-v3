'use client'

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useDeviceTopology, buildTree, DeviceNode } from '@/hooks/useDevices'
import { ConnectionType } from '@/api/client'
import { DeviceTypeIcon } from './DeviceTypeIcon'

const NODE_WIDTH  = 140
const NODE_HEIGHT = 80
const H_GAP       = 40
const V_GAP       = 80
const H_STEP      = NODE_WIDTH + H_GAP
const V_STEP      = NODE_HEIGHT + V_GAP
const PAD         = 40
const CANVAS_EXTRA = 200

interface EdgeStyle {
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  filter?: string
  label: string
}

const EDGE_STYLES: Record<ConnectionType, EdgeStyle> = {
  ethernet: { stroke: '#374151', strokeWidth: 3, label: 'Ethernet' },
  wifi_2_4: { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '5,5',  label: 'Wi-Fi 2.4 GHz' },
  wifi_5:   { stroke: '#8B5CF6', strokeWidth: 2, strokeDasharray: '8,4',  label: 'Wi-Fi 5 GHz' },
  wifi_6:   { stroke: '#06B6D4', strokeWidth: 2, strokeDasharray: '10,3', filter: 'drop-shadow(0 0 3px #06B6D4)', label: 'Wi-Fi 6' },
}

interface LayoutNode { node: DeviceNode; x: number; y: number; isRoot: boolean }
interface LayoutEdge { parentId: string; childId: string; connectionType: ConnectionType }
interface LayoutResult { nodes: LayoutNode[]; edges: LayoutEdge[]; totalWidth: number; totalHeight: number }

function subtreeLeafCount(node: DeviceNode): number {
  if (node.children.length === 0) return 1
  return node.children.reduce((sum, child) => sum + subtreeLeafCount(child), 0)
}

function assignPositions(
  node: DeviceNode,
  depth: number,
  offsetX: number,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  parentNode: LayoutNode | null,
  isRoot: boolean
): void {
  const leafCount = subtreeLeafCount(node)
  const subtreeWidth = leafCount * H_STEP - H_GAP
  const x = offsetX + subtreeWidth / 2 - NODE_WIDTH / 2
  const y = PAD + depth * V_STEP

  const layoutNode: LayoutNode = { node, x, y, isRoot }
  nodes.push(layoutNode)

  if (parentNode) {
    edges.push({ parentId: parentNode.node.id, childId: node.id, connectionType: node.connection_type })
  }

  let childOffset = offsetX
  for (const child of node.children) {
    const childLeaves = subtreeLeafCount(child)
    assignPositions(child, depth + 1, childOffset, nodes, edges, layoutNode, false)
    childOffset += childLeaves * H_STEP
  }
}

function computeLayout(roots: DeviceNode[]): LayoutResult {
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []
  let offsetX = PAD
  for (const root of roots) {
    const leafCount = subtreeLeafCount(root)
    assignPositions(root, 0, offsetX, nodes, edges, null, true)
    offsetX += leafCount * H_STEP + H_GAP
  }
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + NODE_WIDTH), 0)
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_HEIGHT), 0)
  return { nodes, edges, totalWidth: maxX + PAD + CANVAS_EXTRA, totalHeight: maxY + PAD + CANVAS_EXTRA }
}

interface DragState {
  nodeId: string
  startMouseX: number
  startMouseY: number
  startNodeX: number
  startNodeY: number
  moved: boolean
}

type NodePositions = Map<string, { x: number; y: number }>

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: clientX, y: clientY }
  const inv = ctm.inverse()
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const svgPt = pt.matrixTransform(inv)
  return { x: svgPt.x, y: svgPt.y }
}

interface SvgNodeProps {
  layoutNode: LayoutNode
  position: { x: number; y: number }
  isDragging: boolean
  customerId: string
  navigate: (path: string) => void
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void
  onTouchStart: (e: React.TouchEvent, nodeId: string) => void
}

const SvgNode: React.FC<SvgNodeProps> = ({
  layoutNode, position, isDragging, customerId, navigate, onMouseDown, onTouchStart,
}) => {
  const { node, isRoot } = layoutNode
  const { x, y } = position
  const isOnline     = node.is_online !== 0
  const borderColor  = isOnline ? '#22C55E' : '#EF4444'
  const glowFilter   = isOnline
    ? 'drop-shadow(0 0 4px rgba(34,197,94,0.55))'
    : 'drop-shadow(0 0 4px rgba(239,68,68,0.45))'
  const headerBg     = isRoot ? '#1E293B' : (isOnline ? '#F0FDF4' : '#FEF2F2')
  const headerText   = isRoot ? '#F8FAFC' : '#111827'
  const bodyBg       = isRoot ? '#0F172A' : '#FFFFFF'
  const HEADER_H = 26
  const R        = 10

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onTouchStart={(e) => onTouchStart(e, node.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/customers/${customerId}/devices/${node.id}`)
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${node.name}, ${isOnline ? 'online' : 'offline'}, ${node.connection_type.replace(/_/g, ' ')}`}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', outline: 'none' }}
      filter={glowFilter}
    >
      <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={R} ry={R} fill={bodyBg} stroke={borderColor} strokeWidth={isRoot ? 2.5 : 1.5} />
      <clipPath id={`clip-header-${node.id}`}>
        <rect width={NODE_WIDTH} height={HEADER_H} rx={R} ry={R} />
      </clipPath>
      <rect width={NODE_WIDTH} height={HEADER_H + R} fill={headerBg} clipPath={`url(#clip-header-${node.id})`} />
      <line x1={0} y1={HEADER_H} x2={NODE_WIDTH} y2={HEADER_H} stroke={borderColor} strokeWidth={isRoot ? 2.5 : 1.5} />
      <foreignObject x={6} y={4} width={20} height={20}>
        <div
          // @ts-ignore
          xmlns="http://www.w3.org/1999/xhtml"
          style={{ fontSize: '14px', lineHeight: '20px', textAlign: 'center' }}
        >
          <DeviceTypeIcon type={node.device_type} />
        </div>
      </foreignObject>
      <circle cx={NODE_WIDTH - 10} cy={HEADER_H / 2} r={4} fill={borderColor} aria-hidden="true" />
      <text x={NODE_WIDTH / 2} y={HEADER_H + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill={isRoot ? '#E2E8F0' : '#111827'} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <title>{node.name}</title>
        {node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name}
      </text>
      {node.download_mbps !== null ? (
        <text x={NODE_WIDTH / 2} y={HEADER_H + 32} textAnchor="middle" fontSize={10} fill={isRoot ? '#94A3B8' : '#6B7280'} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          {node.download_mbps?.toFixed(0)} / {node.upload_mbps?.toFixed(0)} Mbps
        </text>
      ) : (
        <text x={NODE_WIDTH / 2} y={HEADER_H + 32} textAnchor="middle" fontSize={10} fill={isRoot ? '#64748B' : '#9CA3AF'} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          No stats
        </text>
      )}
      <text x={NODE_WIDTH / 2} y={HEADER_H + 46} textAnchor="middle" fontSize={9} fill={isRoot ? '#475569' : '#9CA3AF'} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        {node.connection_type.replace(/_/g, ' ')}
      </text>
    </g>
  )
}

const TopologyLegend: React.FC = () => {
  const entries = Object.entries(EDGE_STYLES) as [ConnectionType, EdgeStyle][]
  return (
    <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-xl shadow-sm p-3 text-xs" aria-label="Edge style legend">
      <p className="font-semibold text-gray-700 mb-2 text-[11px] uppercase tracking-wide">Connection type</p>
      <div className="flex flex-col gap-2">
        {entries.map(([type, style]) => (
          <div key={type} className="flex items-center gap-2">
            <svg width={40} height={12} aria-hidden="true">
              <line x1={0} y1={6} x2={40} y2={6} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={style.strokeDasharray} filter={style.filter} />
            </svg>
            <span className="text-gray-600">{style.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const DeviceTopology: React.FC = () => {
  const params = useParams<{ customerId: string }>()
  const customerId = params?.customerId ?? ''
  const router = useRouter()
  const { data: devices, isLoading, isError } = useDeviceTopology(customerId)

  const roots  = useMemo(() => (devices ? buildTree(devices) : []), [devices])
  const layout = useMemo(() => (roots.length > 0 ? computeLayout(roots) : null), [roots])

  const [nodePositions, setNodePositions] = useState<NodePositions>(new Map())

  useEffect(() => {
    if (!layout) return
    const initial = new Map<string, { x: number; y: number }>()
    for (const ln of layout.nodes) {
      initial.set(ln.node.id, { x: ln.x, y: ln.y })
    }
    setNodePositions(initial)
  }, [layout])

  const dragState = useRef<DragState | null>(null)
  const svgRef    = useRef<SVGSVGElement | null>(null)

  const svgWidth  = layout ? Math.max(layout.totalWidth, 600) : 600
  const svgHeight = layout ? Math.max(layout.totalHeight, 200) : 200

  const startDrag = useCallback((nodeId: string, clientX: number, clientY: number) => {
    if (!svgRef.current) return
    const svgCoords = clientToSvg(svgRef.current, clientX, clientY)
    const pos = nodePositions.get(nodeId)
    if (!pos) return
    dragState.current = {
      nodeId,
      startMouseX: svgCoords.x,
      startMouseY: svgCoords.y,
      startNodeX: pos.x,
      startNodeY: pos.y,
      moved: false,
    }
  }, [nodePositions])

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current || !svgRef.current) return
    const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = dragState.current
    const svgCoords = clientToSvg(svgRef.current, clientX, clientY)
    const dx = svgCoords.x - startMouseX
    const dy = svgCoords.y - startMouseY
    if (!dragState.current.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragState.current.moved = true
    }
    if (!dragState.current.moved) return
    setNodePositions(prev => {
      const next = new Map(prev)
      next.set(nodeId, { x: Math.max(0, startNodeX + dx), y: Math.max(0, startNodeY + dy) })
      return next
    })
  }, [])

  const endDrag = useCallback((_clientX?: number, _clientY?: number) => {
    if (!dragState.current) return
    const { nodeId, moved } = dragState.current
    dragState.current = null
    if (!moved && customerId) {
      router.push(`/customers/${customerId}/devices/${nodeId}`)
    }
  }, [customerId, router])

  const handleSvgMouseMove  = useCallback((e: React.MouseEvent<SVGSVGElement>) => moveDrag(e.clientX, e.clientY), [moveDrag])
  const handleSvgMouseUp    = useCallback((e: React.MouseEvent<SVGSVGElement>) => endDrag(e.clientX, e.clientY), [endDrag])
  const handleSvgMouseLeave = useCallback(() => { dragState.current = null }, [])

  const handleSvgTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (touch) moveDrag(touch.clientX, touch.clientY)
  }, [moveDrag])

  const handleSvgTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const touch = e.changedTouches[0]
    endDrag(touch?.clientX, touch?.clientY)
  }, [endDrag])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    startDrag(nodeId, e.clientX, e.clientY)
  }, [startDrag])

  const handleNodeTouchStart = useCallback((e: React.TouchEvent, nodeId: string) => {
    e.stopPropagation()
    const touch = e.touches[0]
    if (touch) startDrag(nodeId, touch.clientX, touch.clientY)
  }, [startDrag])

  const handleResetLayout = useCallback(() => {
    if (!layout) return
    const initial = new Map<string, { x: number; y: number }>()
    for (const ln of layout.nodes) {
      initial.set(ln.node.id, { x: ln.x, y: ln.y })
    }
    setNodePositions(initial)
  }, [layout])

  const activeDragNodeId = dragState.current?.nodeId ?? null

  if (!customerId) return null

  return (
    <main className="min-h-screen bg-gray-100 py-8" role="main" aria-label="Device topology">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-6">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-1">
            <Link href={`/customers/${customerId}`} className="hover:underline text-blue-600">Customer Detail</Link>
            {' / '}
            <Link href={`/customers/${customerId}/devices`} className="hover:underline text-blue-600">Devices</Link>
            {' / '}
            <span>Topology</span>
          </nav>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Network Topology</h1>
            <div className="flex items-center gap-3">
              {layout && (
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  aria-label="Reset node positions to original layout"
                >
                  Reset layout
                </button>
              )}
              <Link href={`/customers/${customerId}/devices`} className="text-sm text-blue-600 hover:underline">
                Back to device list
              </Link>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">Click any device node to view its detail. Drag nodes to reposition them.</p>
        </div>

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-800 mb-6">
            Failed to load topology.
          </div>
        )}

        {isLoading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
            Loading topology...
          </div>
        )}

        {!isLoading && roots.length === 0 && !isError && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
            No devices to display.
          </div>
        )}

        {!isLoading && layout && nodePositions.size > 0 && (
          <div
            className="bg-white border border-gray-200 rounded-2xl overflow-x-auto relative"
            role="region"
            aria-label="Network topology diagram"
          >
            <TopologyLegend />
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              aria-label="Network topology graph. Drag nodes to reposition them."
              style={{ display: 'block', minWidth: 600, userSelect: 'none', WebkitUserSelect: 'none' }}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseLeave}
              onTouchMove={handleSvgTouchMove}
              onTouchEnd={handleSvgTouchEnd}
            >
              <g aria-hidden="true">
                {layout.edges.map((edge) => {
                  const style      = EDGE_STYLES[edge.connectionType]
                  const parentPos  = nodePositions.get(edge.parentId)
                  const childPos   = nodePositions.get(edge.childId)
                  if (!parentPos || !childPos) return null
                  const x1 = parentPos.x + NODE_WIDTH / 2
                  const y1 = parentPos.y + NODE_HEIGHT
                  const x2 = childPos.x  + NODE_WIDTH / 2
                  const y2 = childPos.y
                  const midY = (y1 + y2) / 2
                  return (
                    <path
                      key={`${edge.parentId}-${edge.childId}`}
                      d={`M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`}
                      fill="none"
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.strokeDasharray}
                      filter={style.filter}
                      strokeLinecap="round"
                    />
                  )
                })}
              </g>
              <g>
                {layout.nodes.map((ln) => {
                  const pos = nodePositions.get(ln.node.id)
                  if (!pos) return null
                  return (
                    <SvgNode
                      key={ln.node.id}
                      layoutNode={ln}
                      position={pos}
                      isDragging={activeDragNodeId === ln.node.id}
                      customerId={customerId}
                      navigate={router.push}
                      onMouseDown={handleNodeMouseDown}
                      onTouchStart={handleNodeTouchStart}
                    />
                  )
                })}
              </g>
            </svg>
          </div>
        )}
      </div>
    </main>
  )
}
