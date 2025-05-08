import Foundation

// safely read a String value from the Main bundle's Info.plist
func getInfoPlistValue(key: String) -> String? {
  guard let value = Bundle.main.infoDictionary?[key] as? String else {
    log.error("Failed to find or cast Info.plist value for key: \(key)")
    return "com.convos.preview" // TODO: this should be different for production??
  }
  return value
}
