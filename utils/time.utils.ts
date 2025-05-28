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

// 1000 -> "1 second"
// 60000 -> "1 minute"
// 3600000 -> "1 hour"
// 86400000 -> "1 day"
// 604800000 -> "1 week"
// 2592000000 -> "1 month"
// 31536000000 -> "1 year"
export function getHumanReadableTimeFromMs(ms: number) {
  if (ms < 1000) {
    return "less than a second"
  }

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) {
    return `${years} ${years === 1 ? "year" : "years"}`
  }
  if (months > 0) {
    return `${months} ${months === 1 ? "month" : "months"}`
  }
  if (weeks > 0) {
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`
  }
  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"}`
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`
  }
  if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
  }
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`
}
