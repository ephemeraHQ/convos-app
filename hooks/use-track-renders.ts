import { useRef } from "react"
import { logger } from "@/utils/logger/logger"

/**
 * Hook to track component re-renders and identify unexpected re-renders
 */
export function useTrackRenders(args: {
  componentName: string
  allowedDependencies: Record<string, any>
}) {
  const { componentName, allowedDependencies } = args

  const renderCountRef = useRef(0)
  const prevDepsRef = useRef<Record<string, any>>({})

  // Increment render count
  renderCountRef.current += 1
  const renderCount = renderCountRef.current

  // First render, just store dependencies
  if (renderCount === 1) {
    prevDepsRef.current = { ...allowedDependencies }
    return {
      renderCount: renderCountRef.current,
    }
  }

  // Check which dependencies changed
  const changedDeps: string[] = []

  Object.entries(allowedDependencies).forEach(([key, value]) => {
    if (prevDepsRef.current[key] !== value) {
      changedDeps.push(key)
    }
  })

  // Store current deps for next render
  prevDepsRef.current = { ...allowedDependencies }

  // If no allowed dependencies changed, this is an unexpected re-render
  if (changedDeps.length === 0) {
    logger.warn(
      `[${componentName}] UNEXPECTED RE-RENDER #${renderCount}. No allowed dependencies changed.`,
      { allowedDependencies },
    )
  }

  return {
    renderCount: renderCountRef.current,
  }
}
