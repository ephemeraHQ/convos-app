import Foundation

final class AppGroupFileManager {
  static let shared = AppGroupFileManager()
  
  private let groupId: String
  private let groupUrl: URL?
  
  private init() {
    self.groupId = Bundle.appGroupIdentifier()
    self.groupUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId)
    
    if groupUrl == nil {
      SentryManager.shared.trackError(ErrorFactory.create(
        domain: "AppGroupFileManager",
        description: "Failed to get App Group container URL during initialization"
      ))
    } else {
      SentryManager.shared.addBreadcrumb("AppGroupFileManager initialized with groupId: \(groupId)")
    }
  }
  
  func readFile(fileName: String) -> String? {
    guard let groupUrl = groupUrl else {
      SentryManager.shared.trackError(ErrorFactory.create(
        domain: "AppGroupFileManager",
        description: "App Group container URL not available for reading file: \(fileName)"
      ))
      return nil
    }
    
    let fileUrl = groupUrl.appendingPathComponent(fileName)
    
    do {
      let content = try String(contentsOf: fileUrl, encoding: .utf8)
      SentryManager.shared.addBreadcrumb("Successfully read file: \(fileName)")
      return content
    } catch {
      SentryManager.shared.addBreadcrumb("Failed to read file: \(fileName) - \(error.localizedDescription)")
      return nil
    }
  }
  
  func writeFile(fileName: String, content: String) -> Bool {
    guard let groupUrl = groupUrl else {
      SentryManager.shared.trackError(ErrorFactory.create(
        domain: "AppGroupFileManager",
        description: "App Group container URL not available for writing file: \(fileName)"
      ))
      return false
    }
    
    let fileUrl = groupUrl.appendingPathComponent(fileName)
    
    do {
      try content.write(to: fileUrl, atomically: true, encoding: .utf8)
      SentryManager.shared.addBreadcrumb("Successfully wrote file: \(fileName)")
      return true
    } catch {
      SentryManager.shared.trackError(ErrorFactory.create(
        domain: "AppGroupFileManager",
        description: "Failed to write file: \(fileName) - \(error.localizedDescription)"
      ))
      return false
    }
  }
  
  func fileExists(fileName: String) -> Bool {
    guard let groupUrl = groupUrl else {
      return false
    }
    
    let fileUrl = groupUrl.appendingPathComponent(fileName)
    return FileManager.default.fileExists(atPath: fileUrl.path)
  }
  
  func deleteFile(fileName: String) -> Bool {
    guard let groupUrl = groupUrl else {
      SentryManager.shared.trackError(ErrorFactory.create(
        domain: "AppGroupFileManager",
        description: "App Group container URL not available for deleting file: \(fileName)"
      ))
      return false
    }
    
    let fileUrl = groupUrl.appendingPathComponent(fileName)
    
    do {
      try FileManager.default.removeItem(at: fileUrl)
      SentryManager.shared.addBreadcrumb("Successfully deleted file: \(fileName)")
      return true
    } catch {
      SentryManager.shared.addBreadcrumb("Failed to delete file: \(fileName) - \(error.localizedDescription)")
      return false
    }
  }
} 