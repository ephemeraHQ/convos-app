import Foundation
import os.log

struct SharedDefaults {
    var standardDefaults: UserDefaults
    var groupDefaults: UserDefaults
    var bundleDefaults: UserDefaults

    init() throws {
        let bundleId = try! getInfoPlistValue(key: "MainAppBundleIdentifier")
        standardDefaults = UserDefaults.standard

        let groupSuiteName = "group.\(bundleId)"
        groupDefaults = UserDefaults(suiteName: groupSuiteName)!

        let bundleSuiteName = bundleId
        bundleDefaults = UserDefaults(suiteName: bundleSuiteName)!

        log.debug("SharedDefaults initialized with:")
        log.debug("- Standard defaults: \(standardDefaults)")
        log.debug("- Group defaults (\(groupSuiteName)): \(groupDefaults)")
        log.debug("- Bundle defaults (\(bundleSuiteName)): \(bundleDefaults)")
    }

    func string(forKey: String) -> String? {
        log.debug("Fetching value for key: \(forKey)")

        if let value = standardDefaults.string(forKey: forKey) {
            log.debug("Found value in standard defaults: \(value)")
            return value
        } else {
            log.error("No value found in standard defaults")
        }

        if let value = groupDefaults.string(forKey: forKey) {
            log.debug("Found value in group defaults: \(value)")
            return value
        } else {
            log.error("No value found in group defaults")
        }

        if let value = bundleDefaults.string(forKey: forKey) {
            log.debug("Found value in bundle defaults: \(value)")
            return value
        } else {
            log.error("No value found in bundle defaults")
        }

        log.error("No value found for key: \(forKey)")
        return nil
    }

    func set(_ value: Any?, forKey defaultName: String) {
        log.debug("Setting value for key: \(defaultName)")

        standardDefaults.set(value, forKey: defaultName)
        groupDefaults.set(value, forKey: defaultName)
        bundleDefaults.set(value, forKey: defaultName)

        log.debug("Value set in all UserDefaults instances")
    }
}

func getSharedDefaultsValue(key: String) -> String? {
    do {
        let sharedDefaults = try SharedDefaults()
        return sharedDefaults.string(forKey: key)
    } catch {
        log.error("Failed to initialize SharedDefaults while getting value")
        return nil
    }
}

func setSharedDefaultsValue(key: String, value: String) {
    do {
        let sharedDefaults = try SharedDefaults()
        sharedDefaults.set(value, forKey: key)
    } catch {
        log.error("Failed to initialize SharedDefaults while setting value")
        return
    }
}
