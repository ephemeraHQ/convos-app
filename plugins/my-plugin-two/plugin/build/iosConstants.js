"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NSE_EXT_FILES = exports.NSE_INFO_PLIST_FILE_NAME = exports.NSE_SOURCE_FILES = exports.NSE_TARGET_NAME = exports.IOS_TEAM_ID = exports.APP_GROUP_KEY = exports.DEFAULT_BUNDLE_SHORT_VERSION = exports.DEFAULT_BUNDLE_VERSION = exports.BUNDLE_VERSION_TEMPLATE_REGEX = exports.BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = exports.GROUP_IDENTIFIER_TEMPLATE_REGEX = exports.NSE_PODFILE_REGEX = exports.NSE_PODFILE_SNIPPET = exports.TARGETED_DEVICE_FAMILY = exports.IPHONEOS_DEPLOYMENT_TARGET = void 0;
exports.IPHONEOS_DEPLOYMENT_TARGET = "16.0";
exports.TARGETED_DEVICE_FAMILY = `"1,2"`;
exports.NSE_PODFILE_SNIPPET = `
target 'ConvosNSE' do
  pod 'OneSignalXCFramework', '>= 5.0', '< 6.0'
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
end`;
exports.NSE_PODFILE_REGEX = /target 'ConvosNSE'/;
exports.GROUP_IDENTIFIER_TEMPLATE_REGEX = /{{GROUP_IDENTIFIER}}/gm;
exports.BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = /{{BUNDLE_SHORT_VERSION}}/gm;
exports.BUNDLE_VERSION_TEMPLATE_REGEX = /{{BUNDLE_VERSION}}/gm;
exports.DEFAULT_BUNDLE_VERSION = "1";
exports.DEFAULT_BUNDLE_SHORT_VERSION = "1.0";
exports.APP_GROUP_KEY = "com.apple.security.application-groups";
exports.IOS_TEAM_ID = "FY4NZR34Z3";
exports.NSE_TARGET_NAME = "ConvosNSE";
exports.NSE_SOURCE_FILES = [
    "NotificationService.swift",
    "Utils.swift",
    "Keychain.swift",
    "Logger.swift",
    "MMKV.swift",
];
exports.NSE_INFO_PLIST_FILE_NAME = `${exports.NSE_TARGET_NAME}-Info.plist`;
exports.NSE_EXT_FILES = [`${exports.NSE_TARGET_NAME}.entitlements`, exports.NSE_INFO_PLIST_FILE_NAME];
