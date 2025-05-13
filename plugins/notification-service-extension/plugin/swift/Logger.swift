import Foundation
import os.log

let log: Logging = Logging()

struct Logging {
    private let logger = OSLog(subsystem: "com.convos.nse", category: "NotificationService")

    func debug(_ messages: Any..., logToRemote: Bool = true) {
        let message = messages.map { String(describing: $0) }.joined(separator: " ")
        os_log("[DEBUG] xDEBUG 🐞 %{public}@", log: logger, type: .debug, message)
        #if DEBUG
            if logToRemote {
                LogServer.debug("🐞 \(message)")
            }
        #endif
    }

    func error(_ messages: Any..., error: Error? = nil, logToRemote: Bool = true) {
        var message = messages.map { String(describing: $0) }.joined(separator: " ")
        if let error {
            message += " | Error: \(error)"
        }
        os_log("[ERROR] xDEBUG ❌ %{public}@", log: logger, type: .error, message)
        #if DEBUG
            if logToRemote {
                LogServer.error(" ❌ \(message)")
            }
        #endif
    }

    func warn(_ messages: Any..., Error: Error? = nil, logToRemote: Bool = true) {
        let message = messages.map { String(describing: $0) }.joined(separator: " ")
        os_log("[WARN] xDEBUG ⚠️ %{public}@", log: logger, type: .info, message)
        #if DEBUG
            if logToRemote {
                LogServer.debug("⚠️ \(message)")
            }
        #endif
    }
}

func prettyPrint(dictionary: [AnyHashable: Any]) {
    let prettyPrintedString = getPrettyPrintString(dictionary: dictionary)
    log.debug(prettyPrintedString)
}

func getPrettyPrintString(dictionary: [AnyHashable: Any]) -> String {
    do {
        let serializedData = try JSONSerialization.data(
            withJSONObject: dictionary, options: .prettyPrinted)
        if let asString = String(data: serializedData, encoding: .utf8) {
            return asString
        } else {
            throw NSError(
                domain: "PrettyPrintError",
                code: 0,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Failed to pretty print dictionary. To string failed."
                ])
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

/// Logs the message to a local server. Just for testing during development.
enum LogServer {
    static func debug(_ message: String) {
        sendLog(message: message, isError: false)
    }

    static func error(_ message: String) {
        sendLog(message: message, isError: true)
    }

    private static func sendLog(message: String, isError: Bool) {
        //        guard let url = URL(string: "http://joe-m4max.tailf1b4c.ts.net:3000/log") else { return }
        guard let url = URL(string: "http://192.168.6.66:3000/log") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "message": message,
            "isError": isError,
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                log.error("Failed to send log to server: \(error)", logToRemote: false)
            }
        }.resume()
    }
}
