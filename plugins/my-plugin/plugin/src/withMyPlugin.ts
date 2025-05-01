import { withPlugins, type ConfigPlugin } from "@expo/config-plugins"
import { withAppGroupPermissions } from "./withAppGroupPermissions"
import { withNotificationExtensionFiles } from "./withNotificationExtensionFiles"
import { withNotificationExtensionTarget } from "./withNotificationExtensionTarget"

export const withNotificationExtension: ConfigPlugin = (config) =>
  withPlugins(config, [
    // 1. Copy files AND modify NSE entitlements
    withNotificationExtensionFiles,
    // 2. Add target
    withNotificationExtensionTarget,
    // 3. Add app group permissions to MAIN APP ONLY
    withAppGroupPermissions,
  ])

export default withNotificationExtension
