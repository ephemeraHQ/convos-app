import { getTodayNs } from "@/utils/date"
import { TimeUtils } from "@/utils/time.utils"

// Define the duration configurations
export const DisappearingMessageDuration = {
  ONE_SECOND: { value: TimeUtils.seconds(1).toNanoseconds(), text: "1 second" },
  TEN_SECONDS: { value: TimeUtils.seconds(10).toNanoseconds(), text: "10 seconds" },
  ONE_MINUTE: { value: TimeUtils.minutes(1).toNanoseconds(), text: "1 minute" },
  ONE_HOUR: { value: TimeUtils.hours(1).toNanoseconds(), text: "1 hour" },
  EIGHT_HOURS: { value: TimeUtils.hours(8).toNanoseconds(), text: "8 hours" },
  ONE_DAY: { value: TimeUtils.days(1).toNanoseconds(), text: "24 hours" },
  ONE_WEEK: { value: TimeUtils.days(7).toNanoseconds(), text: "7 days" },
  THIRTY_DAYS: { value: TimeUtils.days(30).toNanoseconds(), text: "30 days" },
  SIXTY_DAYS: { value: TimeUtils.days(60).toNanoseconds(), text: "60 days" },
};

export type IDisappearingMessageDuration = keyof typeof DisappearingMessageDuration

export type IDisappearingMessageSettings = {
  disappearStartingAtNs: number
  retentionDurationInNs: number
}

export const defaultConversationDisappearingMessageSettings: IDisappearingMessageSettings = {
  disappearStartingAtNs: getTodayNs(),
  retentionDurationInNs: DisappearingMessageDuration.THIRTY_DAYS.value,
}

/**
 * Get a formatted display value for a disappearing message duration in nanoseconds
 */
export function getFormattedDisappearingDuration(nanoseconds: number | undefined): string {
  if (!nanoseconds) return "a set period"
  
  // First check if this matches one of our predefined durations
  for (const [_, entry] of Object.entries(DisappearingMessageDuration)) {
    if (entry.value === nanoseconds) {
      return entry.text
    }
  }
  
  // Fall back to dynamic formatting for custom durations (for interoperability)
  const seconds = nanoseconds / 1_000_000_000
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24
  
  if (days >= 1 && days % 7 === 0) {
    const weeks = Math.floor(days / 7)
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`
  }
  
  if (days >= 1) {
    const daysValue = Math.floor(days)
    return `${daysValue} ${daysValue === 1 ? "day" : "days"}`
  }
  
  if (hours >= 1) {
    const hoursValue = Math.floor(hours)
    return `${hoursValue} ${hoursValue === 1 ? "hour" : "hours"}`
  }
  
  if (minutes >= 1) {
    const minutesValue = Math.floor(minutes)
    return `${minutesValue} ${minutesValue === 1 ? "minute" : "minutes"}`
  }
  
  const secondsValue = Math.floor(seconds)
  return `${secondsValue} ${secondsValue === 1 ? "second" : "seconds"}`
}
