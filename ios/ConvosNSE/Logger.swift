// ... existing code ...
import os.log

let logger = OSLog(subsystem: "com.convos.nse", category: "default")

func log(_ message: String, type: OSLogType = .default, category: String? = nil) {
    if let category = category {
        let customLogger = OSLog(subsystem: "com.convos.nse", category: category)
        os_log("%{public}@", log: customLogger, type: type, message)
    } else {
        os_log("%{public}@", log: logger, type: type, message)
    }
}
