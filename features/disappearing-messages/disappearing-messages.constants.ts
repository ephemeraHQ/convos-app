import { getTodayNs } from "@/utils/date"
import { DateUtils } from "@/utils/time.utils"

export const DisappearingMessageDuration = {
  TEN_SECONDS: DateUtils.seconds(10).toNanoseconds(), // 10 seconds in nanoseconds
  ONE_MINUTE: DateUtils.minutes(1).toNanoseconds(), // 1 minute in nanoseconds
  ONE_HOUR: DateUtils.hours(1).toNanoseconds(), // 1 hour in nanoseconds
  EIGHT_HOURS: DateUtils.hours(8).toNanoseconds(), // 8 hours in nanoseconds
  ONE_DAY: DateUtils.days(1).toNanoseconds(), // 24 hours in nanoseconds
  ONE_WEEK: DateUtils.days(7).toNanoseconds(), // 7 days in nanoseconds
  SIXTY_DAYS: DateUtils.days(60).toNanoseconds(), // 60 days in nanoseconds
}

export type IDisappearingMessageDuration = keyof typeof DisappearingMessageDuration

export type IDisappearingMessageSettings = {
  disappearStartingAtNs: number
  retentionDurationInNs: number
}

export const defaultConversationDisappearingMessageSettings: IDisappearingMessageSettings = {
  disappearStartingAtNs: getTodayNs(),
  retentionDurationInNs: DisappearingMessageDuration.SIXTY_DAYS,
}
