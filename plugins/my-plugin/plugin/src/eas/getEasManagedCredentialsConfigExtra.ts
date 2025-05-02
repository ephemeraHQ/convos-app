import { ExpoConfig } from "@expo/config-types"
import { EXTENSION_NAME } from "../constants"

export default function getEasManagedCredentialsConfigExtra(config: ExpoConfig): {
  [k: string]: any
} {
  return {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions: [
              ...(config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? []),
              {
                // keep in sync with native changes in NSE
                targetName: EXTENSION_NAME,
                bundleIdentifier: `${config?.ios?.bundleIdentifier}.${EXTENSION_NAME}`,
                entitlements: {
                  "com.apple.security.application-groups": [
                    `group.${config?.ios?.bundleIdentifier}.nse`,
                  ],
                },
              },
            ],
          },
        },
      },
    },
  }
}
