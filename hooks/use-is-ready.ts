import { useEffect, useState } from "react"

export const useIsReady = (delay = 0) => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Not working great
    // const interactionPromise = InteractionManager.runAfterInteractions(() => {
    // The setTimeout is necessary for maximum optimization
    // setTimeout(() => setIsReady(true), 0)
    // })

    let timeout: NodeJS.Timeout | null = null

    // Working much better than runAfterInteractions
    requestAnimationFrame(() => {
      timeout = setTimeout(() => setIsReady(true), delay)
    })

    // TODO: Read if this is better, react-navigation is using this
    // useImperativeHandle

    // return () => interactionPromise.cancel()

    return () => {
      if (!!timeout) {
        clearTimeout(timeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return isReady
}
