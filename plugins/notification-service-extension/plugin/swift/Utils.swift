import Foundation
import os.log // Import os.log for potential logging within utils

// Define logger specifically for Utils if needed, or reuse one passed in/global
private let utilsLogger = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "com.convos.nse.utils", category: "Utils")

// Helper function to safely read a String value from the main bundle's Info.plist
func getInfoPlistValue(key: String) -> String? {
  guard let value = Bundle.main.infoDictionary?[key] as? String else {
    os_log("Failed to find or cast Info.plist value for key: %{public}@", log: utilsLogger, type: .error, key)
    return nil
  }
  // Optional: Log success if needed for debugging
  // os_log("Successfully retrieved Info.plist value for key: %{public}@", log: utilsLogger, type: .debug, key)
  return value
}

// You can add other general utility functions here later if needed. 