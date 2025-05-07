import Foundation

struct SharedDefaults {
  var sharedDefaults: UserDefaults

  init() throws {
    sharedDefaults = UserDefaults(suiteName: "group.\(try! getInfoPlistValue(key: "MainAppBundleIdentifier"))")!
  }

  func string(forKey: String) -> String? {
    return sharedDefaults.string(forKey: forKey)
  }
  
  func set(_ value: Any?, forKey defaultName: String) {
    return sharedDefaults.set(value, forKey: defaultName)
  }
}

func getSharedDefaultsValue(key: String) -> String? {
  do {
    let sharedDefaults = try SharedDefaults()
    return sharedDefaults.string(forKey: key)
  } catch {
    return nil
  }
}

func setSharedDefaultsValue(key: String, value: String) {
  do {
    let sharedDefaults = try SharedDefaults()
    sharedDefaults.set(value, forKey: key)
  } catch {
    // If initialization fails, we can't set the value
    return
  }
}
