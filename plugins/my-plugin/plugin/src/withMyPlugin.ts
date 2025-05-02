import { withPlugins, type ConfigPlugin } from "@expo/config-plugins"
import { withAppEntitlements } from "./with-app-entitlements"
import { withAppInfoPlist } from "./with-app-info-plist"
import { withNSEEntitlements } from "./with-nse-entitlements"
import { withNSEInfoPlist } from "./with-nse-extension-info-plist"
import { withNSETarget } from "./with-nse-target"
import { withPodfile } from "./with-podfile"

export const withNotificationExtension: ConfigPlugin = (config) =>
  withPlugins(config, [
    // withExpoConfig,
    withAppEntitlements,
    withAppInfoPlist,
    withPodfile,
    withNSEInfoPlist,
    withNSEEntitlements,
    withNSETarget,
  ])

export default withNotificationExtension
