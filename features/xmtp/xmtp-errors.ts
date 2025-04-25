export function isXmtpNoNetworkError(error: unknown) {
  return error instanceof Error && error.message.includes(`transport error`)
}
