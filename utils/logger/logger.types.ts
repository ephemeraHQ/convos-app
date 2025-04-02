export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const

export type LogLevel = keyof typeof LOG_LEVELS
