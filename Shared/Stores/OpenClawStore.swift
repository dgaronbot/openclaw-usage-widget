import SwiftUI

@MainActor
final class OpenClawStore: ObservableObject {
    @Published var selectedRange: OpenClawTimeRange = .today
    @Published var apiUsage: OpenClawAPIUsage?
    @Published var localUsage: OpenClawLocalUsage?
    @Published var isLoading = false
    @Published var isConnected = false
    @Published var errorMessage: String?
    @Published var lastUpdate: Date?

    // Cached data per time range
    @Published private(set) var cachedToday: OpenClawUsageResponse?
    @Published private(set) var cachedSevenDay: OpenClawUsageResponse?
    @Published private(set) var cachedAllTime: OpenClawUsageResponse?

    private let apiClient: OpenClawAPIClientProtocol
    private var autoRefreshTask: Task<Void, Never>?

    var currentAPIUsage: OpenClawAPIUsage? {
        switch selectedRange {
        case .today: cachedToday?.api
        case .sevenDay: cachedSevenDay?.api
        case .allTime: cachedAllTime?.api
        }
    }

    var currentLocalUsage: OpenClawLocalUsage? {
        switch selectedRange {
        case .today: cachedToday?.local
        case .sevenDay: cachedSevenDay?.local
        case .allTime: cachedAllTime?.local
        }
    }

    var staleness: String? {
        guard let lastUpdate else { return nil }
        let elapsed = Date().timeIntervalSince(lastUpdate)
        if elapsed < 120 { return nil }
        return lastUpdate.formatted(.relative(presentation: .named))
    }

    init(apiClient: OpenClawAPIClientProtocol = OpenClawAPIClient()) {
        self.apiClient = apiClient
    }

    // MARK: - Refresh

    func refresh(baseURL: String, token: String?) async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            // Fetch all three ranges in parallel
            async let todayResponse = apiClient.fetchUsage(baseURL: baseURL, token: token, timeRange: .today)
            async let sevenDayResponse = apiClient.fetchUsage(baseURL: baseURL, token: token, timeRange: .sevenDay)
            async let allTimeResponse = apiClient.fetchUsage(baseURL: baseURL, token: token, timeRange: .allTime)

            let (t, s, a) = try await (todayResponse, sevenDayResponse, allTimeResponse)
            cachedToday = t
            cachedSevenDay = s
            cachedAllTime = a
            lastUpdate = Date()
            isConnected = true
            errorMessage = nil

            // Update current display
            updateDisplay()

            // Persist cache
            saveCache(today: t, sevenDay: s, allTime: a)
        } catch {
            errorMessage = error.localizedDescription
            if lastUpdate == nil {
                isConnected = false
            }
            // On error, still show cached data
            updateDisplay()
        }
    }

    func selectRange(_ range: OpenClawTimeRange) {
        selectedRange = range
        updateDisplay()
    }

    private func updateDisplay() {
        apiUsage = currentAPIUsage
        localUsage = currentLocalUsage
    }

    // MARK: - Auto Refresh

    func startAutoRefresh(baseURL: String, token: String?, interval: TimeInterval = 60) {
        autoRefreshTask?.cancel()
        autoRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await self.refresh(baseURL: baseURL, token: token)
                try? await Task.sleep(for: .seconds(interval))
            }
        }
    }

    func stopAutoRefresh() {
        autoRefreshTask?.cancel()
    }

    // MARK: - Cache Persistence

    private var cacheFileURL: URL {
        let home: String
        if let pw = getpwuid(getuid()) {
            home = String(cString: pw.pointee.pw_dir)
        } else {
            home = NSHomeDirectory()
        }
        return URL(fileURLWithPath: home)
            .appendingPathComponent("Library/Application Support/com.tokeneater.shared")
            .appendingPathComponent("openclaw_cache.json")
    }

    private func saveCache(today: OpenClawUsageResponse, sevenDay: OpenClawUsageResponse, allTime: OpenClawUsageResponse) {
        let cached = CachedOpenClawUsage(today: today, sevenDay: sevenDay, allTime: allTime, fetchDate: Date())
        do {
            let data = try JSONEncoder().encode(cached)
            let dir = cacheFileURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try data.write(to: cacheFileURL, options: .atomic)
        } catch {
            // Cache write failure is non-critical
        }
    }

    func loadCache() {
        guard let data = try? Data(contentsOf: cacheFileURL),
              let cached = try? JSONDecoder().decode(CachedOpenClawUsage.self, from: data) else { return }
        cachedToday = cached.today
        cachedSevenDay = cached.sevenDay
        cachedAllTime = cached.allTime
        lastUpdate = cached.fetchDate
        updateDisplay()
    }

    // MARK: - Test Connection

    func testConnection(baseURL: String, token: String?) async -> ConnectionTestResult {
        await apiClient.testConnection(baseURL: baseURL, token: token)
    }
}
