import assert from "assert"
import { withEntitlementsPlist, type ConfigPlugin } from "@expo/config-plugins"

const APP_GROUP_KEY = "com.apple.security.application-groups"

/**
 * Adds the App Group capability ONLY to the main app target's entitlements.
 * The NSE entitlements are handled by withNotificationExtensionFiles.
 */
export const withAppGroupPermissions: ConfigPlugin = (config) => {
  // --- Determine the App Group Identifier ---
  let appGroupIdentifier: string | undefined
  const existingEntitlementsGroups = config.ios?.entitlements?.[APP_GROUP_KEY]
  if (Array.isArray(existingEntitlementsGroups) && existingEntitlementsGroups.length > 0) {
    appGroupIdentifier = existingEntitlementsGroups[0]
    console.log(
      `[withAppGroupPermissions] Using App Group defined in app.config.ts for main app: ${appGroupIdentifier}`,
    )
  } else {
    assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier'.")
    appGroupIdentifier = `group.${config.ios.bundleIdentifier}`
    console.log(
      `[withAppGroupPermissions] App Group not defined, generating for main app: ${appGroupIdentifier}`,
    )
  }
  assert(appGroupIdentifier, "Could not determine App Group identifier.")
  // --- End Determine ---

  // Modify the main app target's entitlements using the reliable helper
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults[APP_GROUP_KEY] = mod.modResults[APP_GROUP_KEY] || []
    const groups = mod.modResults[APP_GROUP_KEY] as string[]

    if (!groups.includes(appGroupIdentifier!)) {
      groups.push(appGroupIdentifier!)
      console.log(
        `[withAppGroupPermissions] Ensuring App Group ${appGroupIdentifier} is in main app entitlements.`,
      )
    }
    return mod
  })
}
