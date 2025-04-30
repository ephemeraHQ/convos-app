"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FileManager_1 = require("./FileManager");
const iosConstants_1 = require("./iosConstants");
const entitlementsFileName = `${iosConstants_1.NSE_TARGET_NAME}.entitlements`;
const plistFileName = `${iosConstants_1.NSE_TARGET_NAME}-Info.plist`;
class NseUpdaterManager {
    constructor(iosPath) {
        this.nsePath = "";
        this.nsePath = `${iosPath}/${iosConstants_1.NSE_TARGET_NAME}`;
    }
    async updateNSEEntitlements(groupIdentifier) {
        const entitlementsFilePath = `${this.nsePath}/${entitlementsFileName}`;
        let entitlementsFile = await FileManager_1.FileManager.readFile(entitlementsFilePath);
        entitlementsFile = entitlementsFile.replace(iosConstants_1.GROUP_IDENTIFIER_TEMPLATE_REGEX, groupIdentifier);
        await FileManager_1.FileManager.writeFile(entitlementsFilePath, entitlementsFile);
    }
    async updateNSEBundleVersion(version) {
        const plistFilePath = `${this.nsePath}/${plistFileName}`;
        let plistFile = await FileManager_1.FileManager.readFile(plistFilePath);
        plistFile = plistFile.replace(iosConstants_1.BUNDLE_VERSION_TEMPLATE_REGEX, version);
        await FileManager_1.FileManager.writeFile(plistFilePath, plistFile);
    }
    async updateNSEBundleShortVersion(version) {
        const plistFilePath = `${this.nsePath}/${plistFileName}`;
        let plistFile = await FileManager_1.FileManager.readFile(plistFilePath);
        plistFile = plistFile.replace(iosConstants_1.BUNDLE_SHORT_VERSION_TEMPLATE_REGEX, version);
        await FileManager_1.FileManager.writeFile(plistFilePath, plistFile);
    }
}
exports.default = NseUpdaterManager;
