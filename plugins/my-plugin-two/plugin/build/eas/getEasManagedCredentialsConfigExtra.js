"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getEasManagedCredentialsConfigExtra;
const iosConstants_1 = require("../iosConstants");
function getEasManagedCredentialsConfigExtra(config) {
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
                                targetName: iosConstants_1.NSE_TARGET_NAME,
                                bundleIdentifier: `${config?.ios?.bundleIdentifier}.${iosConstants_1.NSE_TARGET_NAME}`,
                                entitlements: {
                                    'com.apple.security.application-groups': [
                                        `group.${config?.ios?.bundleIdentifier}.nse`
                                    ]
                                },
                            }
                        ]
                    }
                }
            }
        }
    };
}
