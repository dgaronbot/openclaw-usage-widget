import Foundation

enum OpenClawError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case httpError(Int)
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid OpenClaw gateway URL"
        case .invalidResponse:
            return "Invalid response from OpenClaw gateway"
        case .unauthorized:
            return "OpenClaw auth token is invalid"
        case .httpError(let code):
            return "OpenClaw HTTP error: \(code)"
        case .networkError(let msg):
            return "OpenClaw network error: \(msg)"
        }
    }
}

protocol OpenClawAPIClientProtocol: Sendable {
    func fetchUsage(baseURL: String, token: String?, timeRange: OpenClawTimeRange) async throws -> OpenClawUsageResponse
    func testConnection(baseURL: String, token: String?) async -> ConnectionTestResult
}
