import Foundation

final class OpenClawAPIClient: OpenClawAPIClientProtocol, @unchecked Sendable {

    private func makeRequest(baseURL: String, token: String?, path: String) throws -> URLRequest {
        guard let url = URL(string: baseURL)?.appendingPathComponent(path) else {
            throw OpenClawError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 10
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    func fetchUsage(baseURL: String, token: String?, timeRange: OpenClawTimeRange) async throws -> OpenClawUsageResponse {
        var request = try makeRequest(baseURL: baseURL, token: token, path: "/v1/usage")
        // Add time range query parameter
        if let url = request.url,
           var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.queryItems = [URLQueryItem(name: "range", value: timeRange.queryParam)]
            request.url = components.url
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw OpenClawError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200:
            return try JSONDecoder().decode(OpenClawUsageResponse.self, from: data)
        case 401, 403:
            throw OpenClawError.unauthorized
        default:
            throw OpenClawError.httpError(httpResponse.statusCode)
        }
    }

    func testConnection(baseURL: String, token: String?) async -> ConnectionTestResult {
        do {
            let request = try makeRequest(baseURL: baseURL, token: token, path: "/v1/health")
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                return ConnectionTestResult(success: false, message: "Invalid response")
            }
            if httpResponse.statusCode == 200 {
                return ConnectionTestResult(success: true, message: "Connected to OpenClaw gateway")
            } else if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
                return ConnectionTestResult(success: false, message: "Auth token rejected (\(httpResponse.statusCode))")
            } else {
                return ConnectionTestResult(success: false, message: "HTTP \(httpResponse.statusCode)")
            }
        } catch {
            return ConnectionTestResult(success: false, message: error.localizedDescription)
        }
    }
}
