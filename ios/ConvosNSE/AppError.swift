import Foundation

// Custom Error struct conforming to standard Swift error protocols
// and CustomNSError for better NSError bridging if needed by other systems.
public struct AppError: Error, LocalizedError, CustomNSError {
    public let domain: String
    public let code: Int
    public let message: String

    // Provides a human-readable description of the error.
    // Conforms to LocalizedError.
    public var errorDescription: String? {
        return message
    }

    // Specifies the domain for this error type.
    // Conforms to CustomNSError.
    public static var errorDomain: String {
        // You can customize this to a more specific domain for your app,
        // e.g., "com.yourcompany.yourapp.ErrorDomain"
        return "com.convos.AppErrorDomain"
    }

    // Specifies the error code.
    // Conforms to CustomNSError.
    public var errorCode: Int {
        return code
    }

    // Provides the userInfo dictionary, primarily for NSLocalizedDescriptionKey.
    // Conforms to CustomNSError.
    public var errorUserInfo: [String : Any] {
        return [NSLocalizedDescriptionKey: message]
    }

    // Public initializer for creating an AppError instance.
    public init(domain: String, code: Int = -1, message: String) {
        self.domain = domain
        self.code = code
        self.message = message
    }
}

// Enum acting as a factory for creating AppError instances.
public enum ErrorFactory {
    /// Creates a standardized AppError instance.
    /// - Parameters:
    ///   - domain: A string identifying the error domain (e.g., "NotificationService", "APIService").
    ///   - code: An integer code for the error (defaults to -1).
    ///   - description: A human-readable description of what went wrong.
    /// - Returns: An AppError instance.
    public static func create(domain: String, code: Int = -1, description: String) -> AppError {
        return AppError(domain: domain, code: code, message: description)
    }
}