export const IPHONEOS_DEPLOYMENT_TARGET = "16.0"
export const TARGETED_DEVICE_FAMILY = `"1,2"`

export const DEFAULT_BUNDLE_VERSION = "1"
export const DEFAULT_BUNDLE_SHORT_VERSION = "1.0"

export const APP_GROUP_KEY = "com.apple.security.application-groups"

export const IOS_TEAM_ID = "FY4NZR34Z3"

export const NSE_TARGET_NAME = "ConvosNSE"
export const NSE_SWIFT_SOURCE_FILES = [
  "NotificationService.swift",
  "Utils.swift",
  "Keychain.swift",
  "Logger.swift",
  "MMKV.swift",
  "SharedDefaults.swift",
  "XmtpClient.swift",
  "XmtpDbEncryptionKey.swift",
]
export const NSE_INFO_PLIST_FILE_NAME = `${NSE_TARGET_NAME}-Info.plist`
export const NSE_EXT_FILES = [`${NSE_TARGET_NAME}.entitlements`, NSE_INFO_PLIST_FILE_NAME]

export const PLUGIN_SWIFT_PATH = "plugins/notification-service-extension/plugin/swift"
