import Foundation
import os.log

let log: Logging = Logging()

struct Logging {
  private let logger = OSLog(subsystem: "com.convos.nse", category: "NotificationService")

    func debug(_ messages: Any...) {
        let message = messages.map { String(describing: $0) }.joined(separator: " ")
        os_log("[DEBUG] xDEBUG 🐞 %{public}@", log: logger, type: .debug, message)
    }

    func error(_ messages: Any..., error: Error? = nil) {
        var message = messages.map { String(describing: $0) }.joined(separator: " ")
        if let error {
            message += " | Error: \(error)"
        }
        os_log("[ERROR] xDEBUG ❌ %{public}@", log: logger, type: .error, message)
    }

    func warn(_ messages: Any..., Error: Error? = nil) {
        let message = messages.map { String(describing: $0) }.joined(separator: " ")
        os_log("[WARN] xDEBUG ⚠️ %{public}@", log: logger, type: .info, message)
    }
}

func prettyPrint(dictionary: [AnyHashable: Any]) {
    let prettyPrintedString = getPrettyPrintString(dictionary: dictionary)
    log.debug(prettyPrintedString)
}

func getPrettyPrintString(dictionary: [AnyHashable: Any]) -> String {
    do {
        let serializedData = try JSONSerialization.data(withJSONObject: dictionary, options: .prettyPrinted)
        if let asString = String(data: serializedData, encoding: .utf8) {
            return asString
        } else {
            throw NSError(domain: "PrettyPrintError",
                          code: 0,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to pretty print dictionary. To string failed."])
        }
    } catch {
        log.debug("Failed to pretty print dictionary: \(error)")
        return "Failed to pretty print dictionary: \(error)"
    }
}


let logger = OSLog(subsystem: "com.convos.nse", category: "default")

func log(_ message: String, type: OSLogType = .default, category: String? = nil) {
    if let category = category {
        let customLogger = OSLog(subsystem: "com.convos.nse", category: category)
        os_log("%{public}@", log: customLogger, type: type, message)
    } else {
        os_log("%{public}@", log: logger, type: type, message)
    }
}
