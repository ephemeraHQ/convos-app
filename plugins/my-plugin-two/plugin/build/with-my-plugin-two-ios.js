"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMyPluginTwoIos = void 0;
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_plugins_1 = require("@expo/config-plugins");
const plist_1 = __importDefault(require("@expo/plist"));
const FileManager_1 = require("./FileManager");
const iosConstants_1 = require("./iosConstants");
const Log_1 = require("./Log");
const withNseFilesAndPlistMods = (config) => {
    (0, assert_1.default)(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.");
    const appGroupId = `group.${config.ios.bundleIdentifier}`;
    const keychainGroup = `$(AppIdentifierPrefix)${appGroupId}`; // Prefix needed for keychain-access-groups
    const KEYCHAIN_ACCESS_GROUP_KEY = "keychain-access-groups";
    const targetName = iosConstants_1.NSE_TARGET_NAME;
    const entitlementsFilename = `${targetName}.entitlements`;
    const infoPlistFilename = iosConstants_1.NSE_INFO_PLIST_FILE_NAME; // Already defined in constants
    return (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (config) => {
            const sourceDir = path.join(config.modRequest.projectRoot, "plugins/my-plugin-two/plugin/swift");
            const platformProjectRoot = config.modRequest.platformProjectRoot;
            const nseDir = path.join(platformProjectRoot, targetName);
            Log_1.Log.log(`Ensuring NSE directory exists: ${nseDir}`);
            fs.mkdirSync(nseDir, { recursive: true });
            Log_1.Log.log(`Copying NSE template files from ${sourceDir} to ${nseDir}`);
            /* --- COPY ALL FILES --- */
            // Copy Swift files
            for (const sourceFileName of iosConstants_1.NSE_SOURCE_FILES) {
                const sourcePath = path.join(sourceDir, sourceFileName);
                const targetFile = path.join(nseDir, sourceFileName);
                await FileManager_1.FileManager.copyFile(sourcePath, targetFile);
            }
            // Copy plist and entitlements templates
            for (const extFile of iosConstants_1.NSE_EXT_FILES) {
                const targetFile = path.join(nseDir, extFile);
                const src = path.join(sourceDir, extFile);
                await FileManager_1.FileManager.copyFile(src, targetFile);
            }
            /* --- END COPY ALL FILES --- */
            /* --- MODIFY ENTITLEMENTS --- */
            const entitlementsPath = path.join(nseDir, entitlementsFilename);
            Log_1.Log.log(`Attempting to modify NSE entitlements file at: ${entitlementsPath}`);
            if (fs.existsSync(entitlementsPath)) {
                let entitlements;
                try {
                    entitlements = plist_1.default.parse(fs.readFileSync(entitlementsPath, "utf8"));
                    entitlements = entitlements || {}; // Ensure entitlements is an object
                    // Add App Group
                    if (!Array.isArray(entitlements[iosConstants_1.APP_GROUP_KEY]))
                        entitlements[iosConstants_1.APP_GROUP_KEY] = [];
                    const appGroups = entitlements[iosConstants_1.APP_GROUP_KEY];
                    if (!appGroups.includes(appGroupId)) {
                        Log_1.Log.log(`Adding App Group '${appGroupId}' to NSE entitlements.`);
                        appGroups.push(appGroupId);
                    }
                    // Add Keychain Access Group
                    if (!Array.isArray(entitlements[KEYCHAIN_ACCESS_GROUP_KEY]))
                        entitlements[KEYCHAIN_ACCESS_GROUP_KEY] = [];
                    const keychainGroups = entitlements[KEYCHAIN_ACCESS_GROUP_KEY];
                    if (!keychainGroups.includes(keychainGroup)) {
                        Log_1.Log.log(`Adding Keychain Group '${keychainGroup}' to NSE entitlements.`);
                        keychainGroups.push(keychainGroup);
                        // Add default group too, might be needed sometimes
                        const defaultKeychainGroup = `$(AppIdentifierPrefix)${config.ios.bundleIdentifier}.${targetName}`;
                        if (!keychainGroups.includes(defaultKeychainGroup)) {
                            keychainGroups.push(defaultKeychainGroup);
                        }
                    }
                    // Add APS Environment if needed for NSE specifically
                    entitlements["aps-environment"] = "production";
                    fs.writeFileSync(entitlementsPath, plist_1.default.build(entitlements));
                    Log_1.Log.log(`Successfully updated ${entitlementsFilename}`);
                }
                catch (e) {
                    Log_1.Log.log(`Error processing NSE entitlements plist: ${e.message}.`);
                }
            }
            else {
                Log_1.Log.log(`NSE entitlements file not found at ${entitlementsPath} after copy. Skipping modification.`);
            }
            /* --- END MODIFY ENTITLEMENTS --- */
            /* --- MODIFY INFO.PLIST --- */
            const infoPlistPath = path.join(nseDir, infoPlistFilename);
            Log_1.Log.log(`Attempting to modify NSE Info.plist at: ${infoPlistPath}`);
            if (fs.existsSync(infoPlistPath)) {
                let infoPlistContents;
                try {
                    infoPlistContents = plist_1.default.parse(fs.readFileSync(infoPlistPath, "utf8"));
                    // Update Bundle Versions
                    const bundleVersion = config.ios?.buildNumber ?? iosConstants_1.DEFAULT_BUNDLE_VERSION;
                    const shortVersion = config.version ?? iosConstants_1.DEFAULT_BUNDLE_SHORT_VERSION;
                    Log_1.Log.log(`Setting CFBundleVersion to ${bundleVersion} in ${infoPlistFilename}`);
                    infoPlistContents.CFBundleVersion = bundleVersion;
                    Log_1.Log.log(`Setting CFBundleShortVersionString to ${shortVersion} in ${infoPlistFilename}`);
                    infoPlistContents.CFBundleShortVersionString = shortVersion;
                    // Set XMTP Environment
                    const expoEnv = process.env.EXPO_ENV?.toLowerCase() || config.extra?.expoEnv || "development";
                    let xmtpEnvironment = "local";
                    if (expoEnv === "production")
                        xmtpEnvironment = "production";
                    else if (expoEnv === "preview")
                        xmtpEnvironment = "dev";
                    else if (expoEnv === "development")
                        xmtpEnvironment = "local";
                    Log_1.Log.log(`Setting XmtpEnvironment in ${infoPlistFilename} to: ${xmtpEnvironment}`);
                    infoPlistContents.XmtpEnvironment = xmtpEnvironment;
                    // Set App Group Identifier
                    Log_1.Log.log(`Setting AppGroupIdentifier in ${infoPlistFilename} to: ${appGroupId}`);
                    infoPlistContents.AppGroupIdentifier = appGroupId;
                    // Set Main App Bundle Identifier
                    Log_1.Log.log(`Setting MainAppBundleIdentifier in ${infoPlistFilename} to: ${config.ios.bundleIdentifier}`);
                    infoPlistContents.MainAppBundleIdentifier = config.ios.bundleIdentifier;
                    fs.writeFileSync(infoPlistPath, plist_1.default.build(infoPlistContents));
                    Log_1.Log.log(`Successfully updated ${infoPlistFilename}`);
                }
                catch (e) {
                    Log_1.Log.log(`Error processing NSE Info.plist: ${e.message}.`);
                }
            }
            else {
                Log_1.Log.log(`NSE Info.plist not found at ${infoPlistPath} after copy. Skipping modification.`);
            }
            /* --- END MODIFY INFO.PLIST --- */
            return config;
        },
    ]);
};
const withXcodeProjectSettings = (config, props) => {
    return (0, config_plugins_1.withXcodeProject)(config, (newConfig) => {
        const xcodeProject = newConfig.modResults;
        // Construct the dynamic App Group ID again here if needed for checks, or rely on config
        (0, assert_1.default)(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.");
        const entitlementsFilename = `${iosConstants_1.NSE_TARGET_NAME}.entitlements`;
        if (!!xcodeProject.pbxTargetByName(iosConstants_1.NSE_TARGET_NAME)) {
            Log_1.Log.log(`${iosConstants_1.NSE_TARGET_NAME} target already exists in project. Skipping...`);
            // Optionally add checks here to ensure existing target has correct App Group
            return newConfig;
        }
        // Create new PBXGroup for the extension
        const extGroup = xcodeProject.addPbxGroup([...iosConstants_1.NSE_EXT_FILES, ...iosConstants_1.NSE_SOURCE_FILES], iosConstants_1.NSE_TARGET_NAME, iosConstants_1.NSE_TARGET_NAME);
        // Add the new PBXGroup to the top level group. This makes the
        // files / folder appear in the file explorer in Xcode.
        const groups = xcodeProject.hash.project.objects["PBXGroup"];
        Object.keys(groups).forEach(function (key) {
            if (typeof groups[key] === "object" &&
                groups[key].name === undefined &&
                groups[key].path === undefined) {
                xcodeProject.addToPbxGroup(extGroup.uuid, key);
            }
        });
        // WORK AROUND for codeProject.addTarget BUG
        const projObjects = xcodeProject.hash.project.objects;
        projObjects["PBXTargetDependency"] = projObjects["PBXTargetDependency"] || {};
        projObjects["PBXContainerItemProxy"] = projObjects["PBXTargetDependency"] || {};
        // Add the NSE target
        const nseTarget = xcodeProject.addTarget(iosConstants_1.NSE_TARGET_NAME, "app_extension", iosConstants_1.NSE_TARGET_NAME, 
        // Use the correct NSE bundle identifier pattern if it differs from main app + NSE_TARGET_NAME
        // Example assumes: com.example.app.ConvosNSE
        `${config.ios?.bundleIdentifier}.${iosConstants_1.NSE_TARGET_NAME}`);
        // Add build phases to the new target
        xcodeProject.addBuildPhase(iosConstants_1.NSE_SOURCE_FILES, "PBXSourcesBuildPhase", "Sources", nseTarget.uuid);
        xcodeProject.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", nseTarget.uuid);
        xcodeProject.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", nseTarget.uuid);
        // Edit the Deployment info of the new Target
        const configurations = xcodeProject.pbxXCBuildConfigurationSection();
        for (const key in configurations) {
            const buildConfig = configurations[key];
            // Ensure we are modifying the NSE target's configurations
            if (buildConfig.buildSettings?.PRODUCT_NAME === `"${iosConstants_1.NSE_TARGET_NAME}"`) {
                const buildSettingsObj = buildConfig.buildSettings;
                buildSettingsObj.DEVELOPMENT_TEAM = iosConstants_1.IOS_TEAM_ID; // Use teamId from config if available
                buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET = iosConstants_1.IPHONEOS_DEPLOYMENT_TARGET;
                buildSettingsObj.TARGETED_DEVICE_FAMILY = iosConstants_1.TARGETED_DEVICE_FAMILY;
                // Ensure entitlements path is correct relative to the project structure
                buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${iosConstants_1.NSE_TARGET_NAME}/${entitlementsFilename}`; // Use variable
                buildSettingsObj.CODE_SIGN_STYLE = "Automatic";
                buildSettingsObj.SWIFT_VERSION = "5.0"; // Ensure this matches your Swift version
            }
        }
        // Add development teams to both your target and the original project
        xcodeProject.addTargetAttribute("DevelopmentTeam", iosConstants_1.IOS_TEAM_ID, nseTarget);
        xcodeProject.addTargetAttribute("DevelopmentTeam", iosConstants_1.IOS_TEAM_ID); // For the main target
        return newConfig;
    });
};
const withPodfile = (config) => {
    return (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
            let podfileContent = fs.readFileSync(podfilePath).toString();
            // Check if the target already exists to avoid duplicates
            if (podfileContent.includes(`target '${iosConstants_1.NSE_TARGET_NAME}'`)) {
                Log_1.Log.log(`${iosConstants_1.NSE_TARGET_NAME} target already exists in Podfile. Skipping...`);
                return config;
            }
            // TODO: Dynamically read this from package.json dependencies/peerDependencies if possible
            const requiredXmtpVersion = "4.0.7";
            const nseTargetBlock = `

target '${iosConstants_1.NSE_TARGET_NAME}' do
  # Use the version required by the installed @xmtp/react-native-sdk
  pod 'XMTP', '${requiredXmtpVersion}', :modular_headers => true

  # NSEs often use static frameworks. Adjust if your setup differs.
  use_frameworks! :linkage => :static
end
`;
            // Append the new target block to the end of the file
            podfileContent += nseTargetBlock;
            fs.writeFileSync(podfilePath, podfileContent);
            return config;
        },
    ]);
};
const withMyPluginTwoIos = (config, props) => {
    // 1. Copy files AND modify copied entitlements/Info.plist
    config = withNseFilesAndPlistMods(config);
    // 2. Set up the Xcode project target, linking files and setting build settings
    config = withXcodeProjectSettings(config, props);
    // 3. Modify the Podfile
    config = withPodfile(config);
    // Optional: These might modify main app settings/entitlements if needed
    // config = withAppEnvironment(config, props);
    // config = withEasManagedCredentials(config, props);
    return config;
};
exports.withMyPluginTwoIos = withMyPluginTwoIos;
