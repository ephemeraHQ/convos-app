import { withPlugins, type ConfigPlugin } from "@expo/config-plugins"
import { withMyPluginTwoIos } from "./with-my-plugin-ios"

export const withMyPluginTwo: ConfigPlugin = (config) => withPlugins(config, [withMyPluginTwoIos])

export default withMyPluginTwo
