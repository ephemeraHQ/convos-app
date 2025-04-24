import { getTodayNs } from "@/utils/date"
import { TimeUtils } from "@/utils/time.utils"

export const DisappearingMessageDuration = {
  ONE_SECOND: TimeUtils.seconds(1).toNanoseconds(), // 1 second in nanoseconds
  TEN_SECONDS: TimeUtils.seconds(10).toNanoseconds(), // 10 seconds in nanoseconds
  ONE_MINUTE: TimeUtils.minutes(1).toNanoseconds(), // 1 minute in nanoseconds
  ONE_HOUR: TimeUtils.hours(1).toNanoseconds(), // 1 hour in nanoseconds
  EIGHT_HOURS: TimeUtils.hours(8).toNanoseconds(), // 8 hours in nanoseconds
  ONE_DAY: TimeUtils.days(1).toNanoseconds(), // 24 hours in nanoseconds
  ONE_WEEK: TimeUtils.days(7).toNanoseconds(), // 7 days in nanoseconds
  THIRTY_DAYS: TimeUtils.days(30).toNanoseconds(), // 30 days in nanoseconds
  SIXTY_DAYS: TimeUtils.days(60).toNanoseconds(), // 60 days in nanoseconds
}

export type IDisappearingMessageDuration = keyof typeof DisappearingMessageDuration

export type IDisappearingMessageSettings = {
  disappearStartingAtNs: number
  retentionDurationInNs: number
}

export const defaultConversationDisappearingMessageSettings: IDisappearingMessageSettings = {
  disappearStartingAtNs: getTodayNs(),
  retentionDurationInNs: DisappearingMessageDuration.THIRTY_DAYS,
}
