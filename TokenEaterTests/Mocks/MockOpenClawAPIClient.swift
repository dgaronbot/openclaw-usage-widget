import Foundation
@testable import TokenEaterApp

final class MockOpenClawAPIClient: OpenClawAPIClientProtocol, @unchecked Sendable {
    var usageToReturn: OpenClawUsageResponse = OpenClawUsageResponse(api: nil, local: nil)
    var errorToThrow: Error?
    var testConnectionResult = ConnectionTestResult(success: true, message: "OK")

    func fetchUsage(baseURL: String, token: String?, timeRange: OpenClawTimeRange) async throws -> OpenClawUsageResponse {
        if let error = errorToThrow { throw error }
        return usageToReturn
    }

    func testConnection(baseURL: String, token: String?) async -> ConnectionTestResult {
        testConnectionResult
    }
}
