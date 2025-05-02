import fs from "fs"
import path from "path"
import { ConfigPlugin, withDangerousMod } from "expo/config-plugins"
import { getShareExtensionName } from "./helpers/utils"

export const withPodfile: ConfigPlugin = (config) => {
  const targetName = getShareExtensionName(config)
  return withDangerousMod(config, [
    "ios",
    (config) => {
      console.log("Starting withPodfile")

      const podFilePath = path.join(config.modRequest.platformProjectRoot, "Podfile")
      let podfileContent = fs.readFileSync(podFilePath).toString()

      //       const postInstallBuildSettings = `    installer.pods_project.targets.each do |target|
      //       unless target.name == 'Sentry'
      //         target.build_configurations.each do |config|
      //           config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'No'
      //         end
      //       end
      //     end`;

      //       podfileContent = mergeContents({
      //         tag: "post-install-build-settings",
      //         src: podfileContent,
      //         newSrc: postInstallBuildSettings,
      //         anchor: `react_native_post_install`,
      //         offset: 7,
      //         comment: "#",
      //       }).contents;

      //       // we always want to exclude expo-updates because it throws this error when the share extension is triggered
      //       // EXUpdates/AppController.swift:151: Assertion failed: AppController.sharedInstace was called before the module was initialized
      //       const exclude = excludedPackages?.length
      //         ? Array.from(new Set(["expo-updates", ...excludedPackages]))
      //         : ["expo-updates"];

      //       const useExpoModules = `exclude = ["${exclude.join(`", "`)}"]
      //   use_expo_modules!(exclude: exclude)`;

      //       const expoVersion = semver.parse(config.sdkVersion);
      //       const majorVersion = expoVersion?.major ?? 0;

      const shareExtensionTarget = `
target '${targetName}' do
  use_frameworks! :linkage => :static
  pod 'XMTP', '4.2.0-dev.b10e719', :modular_headers => true
end`

      // Find the very last 'end' in the file
      const lastEndIndex = podfileContent.lastIndexOf("end")
      if (lastEndIndex === -1) {
        throw new Error("Could not find the last 'end' in Podfile")
      }

      // Insert the share extension target after the last 'end'
      podfileContent =
        podfileContent.slice(0, lastEndIndex + 3) + // +3 to include "end"
        shareExtensionTarget +
        podfileContent.slice(lastEndIndex + 3)

      fs.writeFileSync(podFilePath, podfileContent)

      console.log("Finished withPodfile")

      return config
    },
  ])
}
