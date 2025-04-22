import { ENS_REGEX, UNS_REGEX } from "@/utils/regex"

/**
 * Validates if a string is a valid ENS name
 */
export function isValidEnsName(name: string | undefined): boolean {
  if (!name) {
    return false
  }
  const trimmed = name.trim()
  if (trimmed.includes(" ")) {
    return false
  }
  return ENS_REGEX.test(trimmed)
}

/**
 * Validates if a string is a valid Base name
 * Base names follow the same pattern as ENS names
 */
export function isValidBaseName(name: string | undefined): boolean {
  if (!name) {
    return false
  }
  const trimmed = name.trim()
  if (trimmed.includes(" ")) {
    return false
  }
  // Base names must end with .eth and contain .base
  return trimmed.includes(".base") && trimmed.endsWith(".eth")
}

/**
 * Validates if a string is a valid Unstoppable Domain name
 */
export function isValidUnstoppableDomainName(name: string | undefined): boolean {
  if (!name) {
    return false
  }
  const trimmed = name.trim()
  if (trimmed.includes(" ")) {
    return false
  }
  return UNS_REGEX.test(trimmed)
}
