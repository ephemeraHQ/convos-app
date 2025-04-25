export function isXmtpNoNetworkError(error: unknown) {
  return error instanceof Error && error.message.includes(`transport error`)
}

export function isXmtpDbEncryptionKeyError(error: unknown) {
  return error instanceof Error && error.message.includes("PRAGMA key or salt has incorrect value")
}
