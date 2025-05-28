import Foundation

class ConvosAPIService {
    private let apiBaseURL: String
    
    static let shared = ConvosAPIService()
    
    private init() {
        let environment = Bundle.getEnv()
        switch environment {
        case .production:
            apiBaseURL = "https://api.convos-prod.convos-api.xyz"
        case .development, .preview:
            apiBaseURL = "https://api.convos-dev.convos-api.xyz"
        }
    }
    
    // MARK: - Profile API
    
    struct ProfileResponse: Codable {
        let name: String?
        let username: String
    }
    
    func fetchProfile(for inboxId: String) async throws -> ProfileResponse? {
        guard let url = URL(string: "\(apiBaseURL)/api/v1/profiles/public/xmtpId/\(inboxId)") else {
            throw ConvosAPIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ConvosAPIError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ConvosAPIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(ProfileResponse.self, from: data)
    }
    
    // MARK: - Notifications API
    
    struct UnsubscribeRequest: Codable {
        let installationId: String
        let topics: [String]
    }
    
    func unsubscribeFromTopics(installationId: String, topics: [String]) async throws {
        guard let url = URL(string: "\(apiBaseURL)/api/v1/notifications/unsubscribe") else {
            throw ConvosAPIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = UnsubscribeRequest(installationId: installationId, topics: topics)
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ConvosAPIError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw ConvosAPIError.httpError(statusCode: httpResponse.statusCode)
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