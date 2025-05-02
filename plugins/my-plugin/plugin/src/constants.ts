// --- Target Naming & Paths ---
export const EXTENSION_NAME = "ConvosNSE" // Your specific NSE Target Name
export const EXTENSION_DIR = "plugin/swift" // Source directory relative to plugin root
export const INFO_PLIST_FILENAME = "Info.plist" // Actual filename in EXTENSION_DIR
export const ENTITLEMENTS_FILENAME = `${EXTENSION_NAME}.entitlements` // Actual filename in EXTENSION_DIR

// --- Xcode Target Configuration ---
export const PRODUCT_TYPE = "app_extension"

// --- Build Settings ---
export const DEPLOYMENT_TARGET = "16.0" // Your chosen minimum iOS target
export const SWIFT_VERSION = "5.0"
export const TARGETED_DEVICE_FAMILY = `"1,2"` // Standard for iPhone/iPad universal apps

// --- Info.plist Keys & Placeholders (Used in withNotificationExtensionFiles) ---
export const CF_BUNDLE_VERSION_KEY = "CFBundleVersion"
export const CF_BUNDLE_SHORT_VERSION_STRING_KEY = "CFBundleShortVersionString"
export const CF_BUNDLE_VERSION_PLACEHOLDER = "{{CONVOS_BUILD_NUMBER}}" // Placeholder in source Info.plist
export const CF_BUNDLE_SHORT_VERSION_STRING_PLACEHOLDER = "{{CONVOS_MARKETING_VERSION}}" // Placeholder in source Info.plist
export const XMTP_ENVIRONMENT_KEY = "XmtpEnvironment" // Custom key for XMTP env

// --- Entitlements Keys (Used in withAppGroupPermissions/withNotificationExtensionFiles) ---
export const APP_GROUP_KEY = "com.apple.security.application-groups"
export const KEYCHAIN_GROUP_KEY = "keychain-access-groups"

// --- Keychain/Storage Keys (Used potentially in Swift) ---
// export const KEYCHAIN_DB_KEY_PREFIX = "LIBXMTP_DB_ENCRYPTION_KEY_"; // Example if needed later

// --- Podfile Constants (Used in withNSEPodfileTarget) ---
export const PODFILE_TARGET_COMMENT = "# Nested target for Notification Service Extension"
export const PODFILE_POD_COMMENT = "# Add any NSE-specific pods here if needed"
export const PODFILE_INHERIT_LINE = "    inherit! :search_paths"
// export const PODFILE_FRAMEWORKS_LINE = "    use_frameworks!"; // Keep commented unless needed
