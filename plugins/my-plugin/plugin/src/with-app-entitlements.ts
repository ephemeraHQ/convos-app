import { ConfigPlugin, withEntitlementsPlist } from "@expo/config-plugins"
import { getAppBundleIdentifier, getAppGroup } from "./helpers/utils"

export const withAppEntitlements: ConfigPlugin = (config) => {
  return withEntitlementsPlist(config, (config) => {
    console.log("Starting withAppEntitlements")

    const bundleIdentifier = getAppBundleIdentifier(config)

    if (config.ios?.entitlements?.["com.apple.security.application-groups"]) {
      return config
    }

    config.modResults["com.apple.security.application-groups"] = [getAppGroup(bundleIdentifier)]

    console.log("Finished withAppEntitlements")

    return config
  })
}
