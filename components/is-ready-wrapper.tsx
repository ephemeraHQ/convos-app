import { useIsReady } from "@/hooks/use-is-ready"

/**
 * Often used when we want to render a component only after other more important components have been rendered.
 */
export function IsReadyWrapper({
  children,
  NotReadyElement,
  delay,
}: {
  children: React.ReactNode
  NotReadyElement?: React.ReactNode
  delay?: number
}) {
  const isReady = useIsReady(delay)

  if (!isReady && NotReadyElement) {
    return <>{NotReadyElement}</>
  }

  if (!isReady) {
    return null
  }

  return <>{children}</>
}

export function IsReadyWrapperCallback({
  children,
}: {
  children: (isReady: boolean) => React.ReactNode
}) {
  const isReady = useIsReady()
  return <>{children(isReady)}</>
}
