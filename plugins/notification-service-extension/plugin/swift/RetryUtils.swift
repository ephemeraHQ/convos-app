import Foundation

enum RetryError: Error {
    case maxRetriesExceeded(lastError: Error)
    case cancelled
}

struct RetryConfiguration {
    let maxRetries: Int
    let initialDelay: TimeInterval
    let backoffFactor: Double
    let maxDelay: TimeInterval
    let context: String?
    
    init(
        maxRetries: Int = 3,
        initialDelay: TimeInterval = 1.0,
        backoffFactor: Double = 2.0,
        maxDelay: TimeInterval = 30.0,
        context: String? = nil
    ) {
        self.maxRetries = maxRetries
        self.initialDelay = initialDelay
        self.backoffFactor = backoffFactor
        self.maxDelay = maxDelay
        self.context = context
    }
}

func withRetry<T>(
    context: String,
    operation: @escaping () async throws -> T
) async throws -> T {
    return try await withRetry(
        configuration: RetryConfiguration(context: context),
        operation: operation
    )
}

func withRetry<T>(
    configuration: RetryConfiguration = RetryConfiguration(),
    operation: @escaping () async throws -> T
) async throws -> T {
    var attempt = 0
    var currentDelay = configuration.initialDelay
    var lastError: Error?
    
    while attempt < configuration.maxRetries {
        do {
            return try await operation()
        } catch {
            lastError = error
            attempt += 1
            
            if attempt >= configuration.maxRetries {
                break
            }
            
            let contextMessage = configuration.context.map { " - \($0)" } ?? ""
            SentryManager.shared.addBreadcrumb("Retry attempt \(attempt) failed. Retrying in \(currentDelay)s...\(contextMessage)")
            
            try await Task.sleep(nanoseconds: UInt64(currentDelay * 1_000_000_000))
            currentDelay = min(currentDelay * configuration.backoffFactor, configuration.maxDelay)
        }
    }
    
    throw RetryError.maxRetriesExceeded(lastError: lastError ?? RetryError.cancelled)
}
