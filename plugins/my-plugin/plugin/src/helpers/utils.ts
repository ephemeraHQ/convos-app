import { type ExpoConfig } from "@expo/config-types"
import { IOSConfig } from "expo/config-plugins"

export const getAppGroup = (identifier: string) => `group.${identifier}`

export const getAppBundleIdentifier = (config: ExpoConfig) => {
  if (!config.ios?.bundleIdentifier) {
    throw new Error("No bundle identifier")
  }
  return config.ios?.bundleIdentifier
}

export const getShareExtensionBundleIdentifier = (config: ExpoConfig) => {
  return `${getAppBundleIdentifier(config)}.ConvosNSE`
}

export const getShareExtensionName = (config: ExpoConfig) => {
  return `${IOSConfig.XcodeUtils.sanitizedName(config.name)}ConvosNSE`
}

export const getShareExtensionEntitlementsFileName = (config: ExpoConfig) => {
  const name = getShareExtensionName(config)
  return `${name}.entitlements`
}
