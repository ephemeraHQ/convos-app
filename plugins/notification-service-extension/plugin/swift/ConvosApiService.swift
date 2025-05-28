import Foundation
import XMTP

class ConvosAPIService {
    private let apiBaseURL: String
    private var jwtCache: [String: String] = [:] // ethAddress -> JWT
    private let cacheQueue = DispatchQueue(label: "com.convos.jwt.cache", attributes: .concurrent)
    
    static let shared = ConvosAPIService()
    
    private init() {
        let environment = Bundle.getEnv()
        switch environment {
        case .production:
            apiBaseURL = "https://api.convos-prod.convos-api.xyz"
        case .development, .preview:
            apiBaseURL = "https://api.convos-dev.convos-api.xyz"
        }
        
        SentryManager.shared.addBreadcrumb("ConvosAPIService initialized", extras: [
            "environment": environment.rawValue,
            "apiBaseURL": apiBaseURL
        ])
    }
    
    // MARK: - Authentication Headers
    
    private struct XmtpAuthenticationHeaders {
        let installationId: String
        let inboxId: String
        let signature: String
        let appCheckToken: String
        
        func toDictionary() -> [String: String] {
            return [
                "X-XMTP-InstallationId": installationId,
                "X-XMTP-InboxId": inboxId,
                "X-XMTP-Signature": signature,
                "X-Firebase-AppCheck": appCheckToken
            ]
        }
    }
    
    private struct AuthenticateResponse: Codable {
        let token: String
    }
    
    private func getXmtpAuthenticationHeaders(for ethAddress: String) async throws -> XmtpAuthenticationHeaders {
        SentryManager.shared.addBreadcrumb("Getting XMTP authentication headers", extras: [
            "ethAddress": ethAddress
        ])
        
        do {
            let client = try await XMTP.Client.client(for: ethAddress)
            
            // Using dummy app check token for now, same as TypeScript version
            let appCheckToken = "123"
            
            // Sign the app check token with the installation key
            let signatureData = try client.signWithInstallationKey(message: appCheckToken)
            
            // Convert signature to hex string
            let signatureHex = signatureData.map { String(format: "%02x", $0) }.joined()
            
            // Add 0x prefix to match TypeScript toHex() function behavior
            let signatureHexWithPrefix = "0x" + signatureHex
            
            return XmtpAuthenticationHeaders(
                installationId: client.installationID,
                inboxId: client.inboxID,
                signature: signatureHexWithPrefix,
                appCheckToken: appCheckToken
            )
        } catch {
            SentryManager.shared.trackError(error, extras: [
                "operation": "getXmtpAuthenticationHeaders",
                "ethAddress": ethAddress
            ])
            throw error
        }
    }
    
    private func getCachedJWT(for ethAddress: String) -> String? {
        return cacheQueue.sync {
            return jwtCache[ethAddress]
        }
    }
    
    private func setCachedJWT(_ jwt: String, for ethAddress: String) {
        cacheQueue.async(flags: .barrier) {
            self.jwtCache[ethAddress] = jwt
        }
    }
    
    private func fetchJWT(for ethAddress: String) async throws -> String {
        SentryManager.shared.addBreadcrumb("Fetching new JWT", extras: [
            "ethAddress": ethAddress
        ])
        
        guard let url = URL(string: "\(apiBaseURL)/api/v1/authenticate") else {
            let error = ConvosAPIError.invalidURL
            SentryManager.shared.trackError(error, extras: [
                "operation": "fetchJWT",
                "url": "\(apiBaseURL)/api/v1/authenticate"
            ])
            throw error
        }
        
        do {
            // Get XMTP authentication headers
            let xmtpHeaders = try await getXmtpAuthenticationHeaders(for: ethAddress)
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            // Add XMTP authentication headers
            for (key, value) in xmtpHeaders.toDictionary() {
                request.setValue(value, forHTTPHeaderField: key)
            }
            
            // Send empty JSON object as body to match TypeScript implementation
            request.httpBody = try JSONSerialization.data(withJSONObject: [:], options: [])
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                let error = ConvosAPIError.invalidResponse
                SentryManager.shared.trackError(error, extras: [
                    "operation": "fetchJWT",
                    "ethAddress": ethAddress
                ])
                throw error
            }
            
            guard httpResponse.statusCode == 200 else {
                let error = ConvosAPIError.httpError(statusCode: httpResponse.statusCode)
                
                // Log response body for debugging
                let responseBody = String(data: data, encoding: .utf8) ?? "Unable to decode response"
                SentryManager.shared.trackError(error, extras: [
                    "operation": "fetchJWT",
                    "statusCode": httpResponse.statusCode,
                    "responseBody": responseBody
                ])
                throw error
            }
            
            let decoder = JSONDecoder()
            let authResponse = try decoder.decode(AuthenticateResponse.self, from: data)
            
            // Cache the JWT
            setCachedJWT(authResponse.token, for: ethAddress)
            
            return authResponse.token
        } catch {
            SentryManager.shared.trackError(error, extras: [
                "operation": "fetchJWT",
                "ethAddress": ethAddress
            ])
            throw error
        }
    }
    
    private func getJWT(for ethAddress: String) async throws -> String {
        // Check cache first
        if let cachedJWT = getCachedJWT(for: ethAddress) {
            return cachedJWT
        }
        
        // Fetch new JWT if not cached
        return try await fetchJWT(for: ethAddress)
    }
    
    private func getAuthenticatedHeaders(for ethAddress: String) async throws -> [String: String] {
        let jwt = try await getJWT(for: ethAddress)
        return ["X-Convos-AuthToken": jwt]
    }
    
    // MARK: - Profile API
    
    struct ProfileResponse: Codable {
        let name: String?
        let username: String
    }
    
    func fetchProfile(for inboxId: String) async throws -> ProfileResponse? {
        guard let url = URL(string: "\(apiBaseURL)/api/v1/profiles/public/xmtpId/\(inboxId)") else {
            let error = ConvosAPIError.invalidURL
            SentryManager.shared.trackError(error, extras: [
                "operation": "fetchProfile",
                "inboxId": inboxId
            ])
            throw error
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                let error = ConvosAPIError.invalidResponse
                SentryManager.shared.trackError(error, extras: [
                    "operation": "fetchProfile",
                    "inboxId": inboxId
                ])
                throw error
            }
            
            guard httpResponse.statusCode == 200 else {
                let error = ConvosAPIError.httpError(statusCode: httpResponse.statusCode)
                SentryManager.shared.trackError(error, extras: [
                    "operation": "fetchProfile",
                    "statusCode": httpResponse.statusCode,
                    "inboxId": inboxId
                ])
                throw error
            }
            
            let decoder = JSONDecoder()
            let profile = try decoder.decode(ProfileResponse.self, from: data)
            
            return profile
        } catch {
            SentryManager.shared.trackError(error, extras: [
                "operation": "fetchProfile",
                "inboxId": inboxId
            ])
            throw error
        }
    }
    
    // MARK: - Notifications API
    
    struct UnsubscribeRequest: Codable {
        let installationId: String
        let topics: [String]
    }
    
    func unsubscribeFromTopics(ethAddress: String, topics: [String]) async throws {
        guard let url = URL(string: "\(apiBaseURL)/api/v1/notifications/unsubscribe") else {
            let error = ConvosAPIError.invalidURL
            SentryManager.shared.trackError(error, extras: [
                "operation": "unsubscribeFromTopics",
                "ethAddress": ethAddress
            ])
            throw error
        }
        
        do {
            // Get authenticated headers (JWT)
            let authHeaders = try await getAuthenticatedHeaders(for: ethAddress)
            
            // Get installation ID for the request body
            let client = try await XMTP.Client.client(for: ethAddress)
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            // Add JWT authentication header
            for (key, value) in authHeaders {
                request.setValue(value, forHTTPHeaderField: key)
            }
            
            let requestBody = UnsubscribeRequest(installationId: client.installationID, topics: topics)
            request.httpBody = try JSONEncoder().encode(requestBody)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                let error = ConvosAPIError.invalidResponse
                SentryManager.shared.trackError(error, extras: [
                    "operation": "unsubscribeFromTopics",
                    "ethAddress": ethAddress
                ])
                throw error
            }
            
            guard 200...299 ~= httpResponse.statusCode else {
                let error = ConvosAPIError.httpError(statusCode: httpResponse.statusCode)
                SentryManager.shared.trackError(error, extras: [
                    "operation": "unsubscribeFromTopics",
                    "statusCode": httpResponse.statusCode,
                    "topicsCount": topics.count
                ])
                throw error
            }
            
        } catch {
            SentryManager.shared.trackError(error, extras: [
                "operation": "unsubscribeFromTopics",
                "ethAddress": ethAddress,
                "topicsCount": topics.count
            ])
            throw error
        }
    }
}

enum ConvosAPIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response"
        case .httpError(let statusCode):
            return "HTTP error with status code: \(statusCode)"
        }
    }
}