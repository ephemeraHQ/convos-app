import { withPlugins, type ConfigPlugin } from "@expo/config-plugins"
import { withMyPluginTwoIos } from "./with-my-plugin-ios"

export const withMyPluginTwo: ConfigPlugin = function withMyPluginTwo(config) {
  return withPlugins(config, [withMyPluginTwoIos])
}

export default withMyPluginTwo
