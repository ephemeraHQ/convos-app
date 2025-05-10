"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLUGIN_SWIFT_PATH = exports.NSE_EXT_FILES = exports.NSE_INFO_PLIST_FILE_NAME = exports.NSE_SWIFT_SOURCE_FILES = exports.NSE_TARGET_NAME = exports.IOS_TEAM_ID = exports.APP_GROUP_KEY = exports.DEFAULT_BUNDLE_SHORT_VERSION = exports.DEFAULT_BUNDLE_VERSION = exports.TARGETED_DEVICE_FAMILY = exports.IPHONEOS_DEPLOYMENT_TARGET = void 0;
exports.IPHONEOS_DEPLOYMENT_TARGET = "16.0";
exports.TARGETED_DEVICE_FAMILY = `"1,2"`;
exports.DEFAULT_BUNDLE_VERSION = "1";
exports.DEFAULT_BUNDLE_SHORT_VERSION = "1.0";
exports.APP_GROUP_KEY = "com.apple.security.application-groups";
exports.IOS_TEAM_ID = "FY4NZR34Z3";
exports.NSE_TARGET_NAME = "ConvosNSE";
exports.NSE_SWIFT_SOURCE_FILES = [
    "NotificationService.swift",
    "Keychain.swift",
    "Logger.swift",
    "MMKV.swift",
    "XmtpClient.swift",
    "PushNotificationContentFactory.swift",
    "XMTPContentDecoder.swift",
    "Group+MemberNames.swift"
];
exports.NSE_INFO_PLIST_FILE_NAME = `${exports.NSE_TARGET_NAME}-Info.plist`;
exports.NSE_EXT_FILES = [`${exports.NSE_TARGET_NAME}.entitlements`, exports.NSE_INFO_PLIST_FILE_NAME];
exports.PLUGIN_SWIFT_PATH = "plugins/notification-service-extension/plugin/swift";
