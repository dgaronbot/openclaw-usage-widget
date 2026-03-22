import SwiftUI

struct OpenClawSectionView: View {
    @EnvironmentObject private var openClawStore: OpenClawStore
    @EnvironmentObject private var settingsStore: SettingsStore

    @State private var lastUpdateText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                sectionTitle("OpenClaw")
                Spacer()
                if openClawStore.isLoading {
                    ProgressView()
                        .scaleEffect(0.5)
                        .frame(width: 16, height: 16)
                }
                if !lastUpdateText.isEmpty {
                    Text("Updated \(lastUpdateText)")
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.3))
                }
            }

            if !settingsStore.openClawEnabled {
                unconfiguredCard
            } else {
                // Time range picker
                timeRangePicker

                // Error banner
                if let error = openClawStore.errorMessage {
                    errorBanner(error)
                }

                // Staleness warning
                if let stale = openClawStore.staleness, openClawStore.errorMessage != nil {
                    Label("Last updated \(stale)", systemImage: "clock.arrow.circlepath")
                        .font(.system(size: 10))
                        .foregroundStyle(.orange.opacity(0.7))
                }

                // API Usage Panel
                apiPanel

                // Local MLX Panel
                localPanel
            }

            Spacer()
        }
        .padding(24)
        .task {
            refreshLastUpdateText()
            if settingsStore.openClawEnabled {
                openClawStore.loadCache()
                await openClawStore.refresh(
                    baseURL: settingsStore.openClawGatewayURL,
                    token: settingsStore.openClawAuthToken.isEmpty ? nil : settingsStore.openClawAuthToken
                )
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                refreshLastUpdateText()
            }
        }
        .onChange(of: openClawStore.lastUpdate) { _, _ in
            refreshLastUpdateText()
        }
    }

    private func refreshLastUpdateText() {
        if let date = openClawStore.lastUpdate {
            lastUpdateText = date.formatted(.relative(presentation: .named))
        }
    }

    // MARK: - Unconfigured

    private var unconfiguredCard: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("OpenClaw Gateway", systemImage: "network")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
                Text("Enable OpenClaw in Settings to see API and local MLX usage.")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))
                Button("Open Settings") {
                    NotificationCenter.default.post(
                        name: .navigateToSection,
                        object: nil,
                        userInfo: ["section": AppSection.settings.rawValue]
                    )
                }
                .font(.system(size: 12, weight: .medium))
                .buttonStyle(.plain)
                .foregroundStyle(.blue)
            }
        }
    }

    // MARK: - Time Range Picker

    private var timeRangePicker: some View {
        HStack(spacing: 0) {
            ForEach(OpenClawTimeRange.allCases, id: \.rawValue) { range in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        openClawStore.selectRange(range)
                    }
                } label: {
                    Text(range.displayLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(openClawStore.selectedRange == range ? .white : .white.opacity(0.4))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(openClawStore.selectedRange == range ? .white.opacity(0.12) : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: 9)
                .fill(.white.opacity(0.04))
        )
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.orange)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - API Usage Panel

    private var apiPanel: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("API Usage", systemImage: "cloud.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    if let api = openClawStore.apiUsage {
                        Text(formatCost(api.totalCost))
                            .font(.system(size: 16, weight: .black, design: .rounded))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }

                if let api = openClawStore.apiUsage, !api.models.isEmpty {
                    Divider().overlay(Color.white.opacity(0.08))
                    ForEach(api.models) { model in
                        modelRow(
                            provider: model.provider,
                            model: model.model,
                            tokens: model.totalTokens,
                            cost: model.cost
                        )
                    }
                } else if settingsStore.openClawEnabled && openClawStore.apiUsage == nil && !openClawStore.isLoading {
                    Text("No API usage data")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.3))
                }
            }
        }
    }

    private func modelRow(provider: String, model: String, tokens: Int, cost: Double) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(model)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1)
                Text(provider)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.35))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(formatCost(cost))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.7))
                Text(formatTokens(tokens))
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.35))
            }
        }
    }

    // MARK: - Local MLX Panel

    private var localPanel: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Local MLX", systemImage: "desktopcomputer")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    if let local = openClawStore.localUsage {
                        let total = local.models.reduce(0) { $0 + $1.totalTokens }
                        Text(formatTokens(total))
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }

                if let local = openClawStore.localUsage, !local.models.isEmpty {
                    Divider().overlay(Color.white.opacity(0.08))
                    ForEach(local.models) { model in
                        localModelRow(model: model.model, input: model.inputTokens, output: model.outputTokens)
                    }
                } else if settingsStore.openClawEnabled && openClawStore.localUsage == nil && !openClawStore.isLoading {
                    Text("No local usage data")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.3))
                }
            }
        }
    }

    private func localModelRow(model: String, input: Int, output: Int) -> some View {
        HStack {
            Text(model)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.8))
                .lineLimit(1)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(formatTokens(input + output))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.7))
                HStack(spacing: 6) {
                    Text("in: \(formatTokens(input))")
                    Text("out: \(formatTokens(output))")
                }
                .font(.system(size: 9, design: .monospaced))
                .foregroundStyle(.white.opacity(0.35))
            }
        }
    }

    // MARK: - Formatters

    private func formatCost(_ cost: Double) -> String {
        if cost < 0.01 { return "$0.00" }
        if cost < 1.00 { return String(format: "$%.2f", cost) }
        return String(format: "$%.2f", cost)
    }

    private func formatTokens(_ count: Int) -> String {
        if count < 1_000 { return "\(count) tok" }
        if count < 1_000_000 { return String(format: "%.1fK tok", Double(count) / 1_000) }
        return String(format: "%.2fM tok", Double(count) / 1_000_000)
    }
}
