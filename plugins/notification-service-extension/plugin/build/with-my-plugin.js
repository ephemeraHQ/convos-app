"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMyPluginTwo = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const with_my_plugin_ios_1 = require("./with-my-plugin-ios");
const withMyPluginTwo = (config) => (0, config_plugins_1.withPlugins)(config, [with_my_plugin_ios_1.withMyPluginTwoIos]);
exports.withMyPluginTwo = withMyPluginTwo;
exports.default = exports.withMyPluginTwo;
