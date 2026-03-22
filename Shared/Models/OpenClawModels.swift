import Foundation

// MARK: - Time Range

enum OpenClawTimeRange: String, CaseIterable {
    case today
    case sevenDay
    case allTime

    var displayLabel: String {
        switch self {
        case .today: "Today"
        case .sevenDay: "7 Days"
        case .allTime: "All Time"
        }
    }

    var queryParam: String {
        switch self {
        case .today: "today"
        case .sevenDay: "7d"
        case .allTime: "all"
        }
    }
}

// MARK: - API Response

struct OpenClawUsageResponse: Codable {
    let api: OpenClawAPIUsage?
    let local: OpenClawLocalUsage?
}

struct OpenClawAPIUsage: Codable {
    let totalCost: Double
    let models: [OpenClawModelUsage]

    enum CodingKeys: String, CodingKey {
        case totalCost = "total_cost"
        case models
    }
}

struct OpenClawModelUsage: Codable, Identifiable {
    let provider: String
    let model: String
    let inputTokens: Int
    let outputTokens: Int
    let cost: Double

    var id: String { "\(provider)/\(model)" }

    enum CodingKeys: String, CodingKey {
        case provider, model
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case cost
    }

    var totalTokens: Int { inputTokens + outputTokens }
}

struct OpenClawLocalUsage: Codable {
    let models: [OpenClawLocalModelUsage]
}

struct OpenClawLocalModelUsage: Codable, Identifiable {
    let model: String
    let inputTokens: Int
    let outputTokens: Int

    var id: String { model }

    enum CodingKeys: String, CodingKey {
        case model
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
    }

    var totalTokens: Int { inputTokens + outputTokens }
}

// MARK: - Cached OpenClaw Data

struct CachedOpenClawUsage: Codable {
    let today: OpenClawUsageResponse
    let sevenDay: OpenClawUsageResponse
    let allTime: OpenClawUsageResponse
    let fetchDate: Date
}
