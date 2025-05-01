<h1 align="center">Welcome to the expo-notification-service-extension-plugin 👋</h1>
<p>
  <a href="https://www.npmjs.com/package/expo-notification-service-extension-plugin" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/expo-notification-service-extension-plugin.svg">
  </a>
  <a href="https://github.com/nikwebr/expo-notification-service-extension-plugin#readme" target="_blank">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
  </a>
  <a href="https://github.com/nikwebr/expo-notification-service-extension-plugin/graphs/commit-activity" target="_blank">
    <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
  </a>
  <a href="https://twitter.com/nwebr_de" target="_blank">
    <img alt="Twitter: nwebr_de" src="https://img.shields.io/twitter/follow/nwebr_de.svg?style=social" />
  </a>
</p>

> The Expo Notification Service Extension plugin allows you to add a Notification Service Extension file while staying in the managed workflow.

* 🏠 [Homepage](https://checkokay.com/blog/nse)
* 🖤 [npm](https://www.npmjs.com/package/expo-notification-service-extension-plugin)

## Overview
This plugin is an [Expo Config Plugin](https://docs.expo.dev/guides/config-plugins/). It extends the Expo config to allow customizing the prebuild phase of managed workflow builds (no need to eject to a bare workflow).

You can find a blog post demonstrating its usage [here](https://checkokay.com/blog/nse).

## Supported environments:
* [The Expo run commands](https://docs.expo.dev/workflow/customizing/) (`expo run:[android|ios]`)
* [Custom clients](https://blog.expo.dev/introducing-custom-development-clients-5a2c79a9ddf8)
* [EAS Build](https://docs.expo.dev/build/introduction/)

---

## Install

```sh
npx expo install expo-notification-service-extension-plugin

# npm
npm install expo-notification-service-extension-plugin

# yarn
yarn add expo-notification-service-extension-plugin
```

## Configuration in app.json / app.config.js
### Plugin
Add the plugin to the **front** of the [plugin array](https://docs.expo.dev/versions/latest/config/app/). Configure any desired plugin props:

**app.json**
```json
{
  "plugins": [
    [
      "expo-notification-service-extension-plugin",
      {
        "mode": "development",
        "iosNSEFilePath": "./assets/NotificationService.m"
      }
    ]
  ]
}
```

or

**app.config.js**
```js
export default {
  ...
  plugins: [
    [
      "expo-notification-service-extension-plugin",
      {
        mode: "development", 
        iosNSEFilePath: "./assets/NotificationService.m"
      }
    ]
  ]
};
```

#### Plugin Prop
You can pass props to the plugin config object to configure:

| Plugin Prop              |          |                                                                                                                                                                                                                                                                                                                                |
|--------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `mode`                   | **required** | Used to configure  [APNs environment](https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment)  entitlement.  `"development"` or  `"production"`                                                                                                                                            |
| `iosNSEFilePath`         | **required** | The local path to a custom Notification Service Extension (NSE), written in Objective-C. The NSE will typically start as a copy of the [default NSE](https://github.com/OneSignal/onesignal-expo-plugin/blob/main/support/serviceExtensionFiles/NotificationService.m), then altered to support any custom logic required.  e.g: `"./assets/NotificationService.m"`. |
| `filtering`              | optional | This will enable the Notification Service Extension to filter and modify incoming push notifications before they appear on the user's device. Requires com.apple.developer.usernotifications.filtering entitlement. `true` or `false` |
| `devTeam`                | optional | Used to configure Apple Team ID. You can find your Apple Team ID by running `expo credentials:manager`  e.g: `"91SW8A37CR"`                                                                                                                                                                                                    |
| `iPhoneDeploymentTarget` | optional | Target `IPHONEOS_DEPLOYMENT_TARGET` value to be used when adding the iOS [NSE](https://documentation.onesignal.com/docs/service-extensions). A deployment target is nothing more than the minimum version of the operating system the application can run on. This value should match the value in your Podfile e.g: `"12.0"`. |

## Prebuild (optional)
Prebuilding in Expo will result in the generation of the native runtime code for the project (and `ios` and `android` directories being built). By prebuilding, we automatically link and configure the native modules that have implemented CocoaPods, autolinking, and other config plugins. You can think of prebuild like a native code bundler.

When you run `expo prebuild` we enter into a custom managed workflow which provides most of the benefits of bare workflows and managed workflows at the same time.

#### Why should I prebuild?
It may make sense to prebuild locally to inspect config plugin changes and help in debugging issues.

#### Run
```sh
npx expo prebuild
```

```sh
# nukes changes and rebuilds
npx expo prebuild --clean
```

**EAS Note:** if you choose to stay in a fully managed workflow by not prebuilding, EAS will still run `npx expo prebuild` at build time. You can also prebuild locally but remain in a fully managed workflow by adding the `android` and `ios` directories to your .gitignore.

## Run
The following commands will prebuild *and* run your application. Note that for iOS, push notifications will **not** work in the Simulator.
```sh
# Build and run your native iOS project
npx expo run:ios

# Build and run your native Android project
npx expo run:android
```


## Publishing new version
```sh
npm publish --access public 
```

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/nikwebr/expo-notification-service-extension-plugin/issues).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

This project is [MIT](https://github.com/nikwebr/expo-notification-service-extension-plugin/blob/main/LICENSE) licensed.
