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
    
    log("SharedDefaults initialized with:", type: .debug, category: "userDefaults")
    log("- Standard defaults: \(standardDefaults)", type: .debug, category: "userDefaults")
    log("- Group defaults (\(groupSuiteName)): \(groupDefaults)", type: .debug, category: "userDefaults")
    log("- Bundle defaults (\(bundleSuiteName)): \(bundleDefaults)", type: .debug, category: "userDefaults")
  }

  func string(forKey: String) -> String? {
    log("Fetching value for key: \(forKey)", type: .debug, category: "userDefaults")
    
    if let value = standardDefaults.string(forKey: forKey) {
      log("Found value in standard defaults: \(value)", type: .debug, category: "userDefaults")
      return value
    }else {
      log("No value found in standard defaults", type: .debug, category: "userDefaults")
    }
    
    if let value = groupDefaults.string(forKey: forKey) {
      log("Found value in group defaults: \(value)", type: .debug, category: "userDefaults")
      return value
    }else {
      log("No value found in group defaults", type: .debug, category: "userDefaults")
    }
    
    if let value = bundleDefaults.string(forKey: forKey) {
      log("Found value in bundle defaults: \(value)", type: .debug, category: "userDefaults")
      return value
    } else {
      log("No value found in bundle defaults", type: .debug, category: "userDefaults")
    }
    
    log("No value found for key: \(forKey)", type: .debug, category: "userDefaults")
    return nil
  }
  
  func set(_ value: Any?, forKey defaultName: String) {
    log("Setting value for key: \(defaultName)", type: .debug, category: "userDefaults")
    
    standardDefaults.set(value, forKey: defaultName)
    groupDefaults.set(value, forKey: defaultName)
    bundleDefaults.set(value, forKey: defaultName)
    
    log("Value set in all UserDefaults instances", type: .debug, category: "userDefaults")
  }
}

func getSharedDefaultsValue(key: String) -> String? {
  do {
    let sharedDefaults = try SharedDefaults()
    return sharedDefaults.string(forKey: key)
  } catch {
    log("Failed to initialize SharedDefaults while getting value", type: .error, category: "userDefaults")
    return nil
  }
}

func setSharedDefaultsValue(key: String, value: String) {
  do {
    let sharedDefaults = try SharedDefaults()
    sharedDefaults.set(value, forKey: key)
  } catch {
    log("Failed to initialize SharedDefaults while setting value", type: .error, category: "userDefaults")
    return
  }
}
