import { hoursToMilliseconds, minutesToMilliseconds, secondsToMilliseconds } from "date-fns"

// Helper functions to create a fluent API
const createDays = (days: number) => ({
  toMilliseconds: () => days * 24 * 60 * 60 * 1000,
  toNanoseconds: () => days * 24 * 60 * 60 * 1000 * 1000000,
  toSeconds: () => days * 24 * 60 * 60,
})

const createHours = (hours: number) => ({
  toMilliseconds: () => hoursToMilliseconds(hours),
  toNanoseconds: () => hoursToMilliseconds(hours) * 1000000,
  toSeconds: () => hours * 60 * 60,
})

const createMinutes = (minutes: number) => ({
  toMilliseconds: () => minutesToMilliseconds(minutes),
  toNanoseconds: () => minutesToMilliseconds(minutes) * 1000000,
  toSeconds: () => minutes * 60,
})

const createSeconds = (seconds: number) => ({
  toMilliseconds: () => secondsToMilliseconds(seconds),
  toNanoseconds: () => secondsToMilliseconds(seconds) * 1000000,
  toSeconds: () => seconds,
})

export const nowNano = () => {
  return Date.now() * 1000000
}

// Re-export the functions we need
// This gives us a central place to manage time utilities
// and we can easily add our own helpers if needed
export const TimeUtils = {
  seconds: createSeconds,
  days: createDays,
  hours: createHours,
  minutes: createMinutes,
} as const
