import { useEffect, useRef } from "react"
import { getEnv } from "@/utils/getEnv"
import { renderLogger } from "@/utils/logger/logger"

export const INFINITE_RENDER_ALLOWED = 9999

export const useRenderCounter = (label: string, maxRenderCount?: number) => {
  if (getEnv() === "production") {
    return
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const counter = useRef(0)

  counter.current++

  if (maxRenderCount && counter.current > maxRenderCount) {
    renderLogger.warn(`${label} rendered ${counter.current} times ❗`)
  } else if (!maxRenderCount) {
    renderLogger.debug(`${label} rendered ${counter.current} times`)
  } else {
    // Render nothing. Because we have maxRenderCount
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return () => {
      counter.current = 0
    }
  }, [])
}
