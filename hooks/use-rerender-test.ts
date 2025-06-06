import { useEffect, useState } from "react"

export function useRerenderTest(args: { milliseconds: number }) {
  const { milliseconds } = args
  const [count, setCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => prev + 1)
    }, milliseconds)

    return () => clearInterval(interval)
  }, [milliseconds])

  return count
}
