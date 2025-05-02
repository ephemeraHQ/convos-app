import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins"
import { getAppBundleIdentifier, getAppGroup } from "./helpers/utils"

export const withAppInfoPlist: ConfigPlugin = (config) => {
  return withInfoPlist(config, (config) => {
    console.log("Starting withAppInfoPlist")

    const bundleIdentifier = getAppBundleIdentifier(config)

    config.modResults["AppGroup"] = getAppGroup(bundleIdentifier)

    console.log("Finished withAppInfoPlist")

    return config
  })
}
