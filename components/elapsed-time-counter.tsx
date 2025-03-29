import { memo, useEffect, useRef, useState } from "react"
import { StyleProp, TextStyle } from "react-native"
import { Text } from "@/design-system/Text"
import { ITextProps } from "@/design-system/Text/Text.props"
import { useAppTheme } from "@/theme/use-app-theme"

function formatElapsedTime(elapsedMs: number, showMilliseconds: boolean): string {
  if (elapsedMs < 0) elapsedMs = 0 // Ensure non-negative

  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

  if (showMilliseconds) {
    const milliseconds = elapsedMs % 1000
    return `${timeString}.${String(milliseconds).padStart(3, "0")}`
  }

  return timeString
}

type IElapsedTimeCounterProps = {
  startTimeMs: number // Unix timestamp (ms)
  showMilliseconds?: boolean // Optional: Defaults to true
} & Omit<ITextProps, "children" | "text" | "tx" | "txOptions"> // Inherit Text props, exclude content ones

export const ElapsedTimeCounter = memo(function ElapsedTimeCounter(
  props: IElapsedTimeCounterProps,
) {
  const { startTimeMs, showMilliseconds = true, style: styleProp, ...textProps } = props

  const { themed } = useAppTheme()

  // Use a ref to track the interval ID
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)

  // Use useState for the elapsed time string, respecting showMilliseconds initially
  const [elapsedTimeStr, setElapsedTimeStr] = useState(() =>
    formatElapsedTime(Date.now() - startTimeMs, showMilliseconds),
  )

  useEffect(() => {
    // Determine interval delay based on whether milliseconds are shown
    const intervalDelay = showMilliseconds ? 60 : 1000

    // Clear any existing interval when startTime changes or component unmounts
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
    }

    // Start a new interval with the calculated delay
    intervalIdRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeMs
      // Pass showMilliseconds to formatElapsedTime
      setElapsedTimeStr(formatElapsedTime(elapsed, showMilliseconds))
    }, intervalDelay)

    // Cleanup function to clear interval on unmount or before next effect run
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
      }
    }
    // Add showMilliseconds to dependency array
  }, [startTimeMs, showMilliseconds])

  // Combine base style with tabular-nums variant
  const finalStyle: StyleProp<TextStyle> = [styleProp, { fontVariant: ["tabular-nums"] }]

  return (
    <Text
      {...textProps}
      style={finalStyle}
      {...textProps} // Pass down other props like accessibilityLabel, etc.
    >
      {elapsedTimeStr}
    </Text>
  )
})
