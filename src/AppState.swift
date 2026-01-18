import Foundation
import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {

    @Published var items: [FileItem] = []
    @Published var filteredItems: [FileItem] = []
    @Published var selectedPaths = Set<String>()
    @Published var currentPreset: PresetCategory = .applications
    @Published var sortOption: SortOption = .nameAsc
    @Published var searchQuery: String = ""
    @Published var isLoading: Bool = false
    @Published var showEmptyState: Bool = false

    @Published var counts: [PresetCategory: Int] = [:]

    @Published var diskSpace: DiskSpaceInfo?

    @Published var totalItemsCount: Int = 0
    @Published var selectedCount: Int = 0
    @Published var totalSize: String = "0 B"

    private var allItems: [FileItem] = []
    private var scanCache: [String: [FileItem]] = [:]
    private var cancellables = Set<AnyCancellable>()

    init() {
        setupBindings()
    }

    private func setupBindings() {

        $searchQuery
            .debounce(for: .milliseconds(150), scheduler: DispatchQueue.main)
            .sink { [weak self] query in
                self?.performSearch(query)
            }
            .store(in: &cancellables)

        $sortOption
            .sink { [weak self] _ in
                self?.sortItems()
            }
            .store(in: &cancellables)

        Publishers.CombineLatest($items, $selectedPaths)
            .sink { [weak self] items, selected in
                self?.updateStats()
            }
            .store(in: &cancellables)
    }

    func scanSystem() async {
        isLoading = true
        showEmptyState = false

        let cacheKey = currentPreset.rawValue
        if let cached = scanCache[cacheKey] {
            self.items = cached
            self.allItems = cached
            self.filteredItems = cached
            self.isLoading = false
            performSearch(searchQuery)
            return
        }

        do {
            let result = Scanner.shared.startProgressiveScan(category: currentPreset.rawValue)
            guard let data = result.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let started = json["started"] as? Bool,
                  started else {
                isLoading = false
                showEmptyState = true
                return
            }

            var loadedItems: [FileItem] = []

            while true {
                let batchResult = Scanner.shared.getNextBatch(batchSize: 20)
                guard let batchData = batchResult.data(using: .utf8),
                      let batchJson = try? JSONSerialization.jsonObject(with: batchData) as? [String: Any],
                      let itemsArray = batchJson["items"] as? [[String: Any]] else {
                    break
                }

                let newItems = itemsArray.compactMap { convertToFileItem($0) }
                loadedItems.append(contentsOf: newItems)

                self.items = loadedItems
                self.allItems = loadedItems
                self.filteredItems = loadedItems
                sortItems()

                if let complete = batchJson["complete"] as? Bool, complete {
                    break
                }
            }

            scanCache[cacheKey] = loadedItems

            isLoading = false
            showEmptyState = loadedItems.isEmpty
            performSearch(searchQuery)

            await loadIcons(for: loadedItems)

        } catch {
            print("Scan error: \(error)")
            isLoading = false
            showEmptyState = true
        }
    }

    private func convertToFileItem(_ dict: [String: Any]) -> FileItem? {
        guard let path = dict["path"] as? String,
              let name = dict["name"] as? String,
              let size = dict["size"] as? Int64,
              let sizeStr = dict["size_str"] as? String,
              let modified = dict["modified"] as? String,
              let typeStr = dict["type"] as? String else {
            return nil
        }

        let type = FileItem.FileType(rawValue: typeStr) ?? .file
        let isApp = dict["is_app"] as? Bool ?? false
        let isProtected = isProtectedPath(path)

        return FileItem(
            path: path,
            name: name,
            size: size,
            sizeStr: sizeStr,
            modified: modified,
            type: type,
            isApp: isApp,
            isProtected: isProtected,
            icon: nil
        )
    }

    private func isProtectedPath(_ path: String) -> Bool {
        let protectedPaths = [
            "/System",
            "/Library",
            "/usr",
            "/bin",
            "/sbin",
            "/private",
            "/Applications/Safari.app",
            "/Applications/System Settings.app",
            "/Applications/Finder.app"
        ]
        return protectedPaths.contains { path.hasPrefix($0) }
    }

    private func loadIcons(for items: [FileItem]) async {
        for item in items {

            let iconPath: String
            if item.isApp {
                iconPath = IconExtractor.shared.extractAppIcon(appPath: item.path)
            } else if item.type == .folder {
                iconPath = IconExtractor.shared.getFolderIcon(folderPath: item.path)
            } else {
                iconPath = IconExtractor.shared.getFileIcon(filePath: item.path)
            }

            if let index = self.items.firstIndex(where: { $0.path == item.path }) {
                var updatedItem = self.items[index]
                if !iconPath.isEmpty, let image = NSImage(contentsOfFile: iconPath) {
                    updatedItem.icon = image
                    self.items[index] = updatedItem
                }
            }
        }
    }

    private func performSearch(_ query: String) {
        if query.isEmpty {
            filteredItems = allItems
        } else {
            let lowercased = query.lowercased()
            filteredItems = allItems.filter { $0.name.lowercased().contains(lowercased) }
        }
        sortItems()
    }

    private func sortItems() {
        items.sort { item1, item2 in
            switch sortOption {
            case .nameAsc:
                return item1.name.localizedCaseInsensitiveCompare(item2.name) == .orderedAscending
            case .nameDesc:
                return item1.name.localizedCaseInsensitiveCompare(item2.name) == .orderedDescending
            case .sizeAsc:
                return item1.size < item2.size
            case .sizeDesc:
                return item1.size > item2.size
            case .dateAsc:
                return item1.modified < item2.modified
            case .dateDesc:
                return item1.modified > item2.modified
            case .type:
                if item1.type != item2.type {
                    return item1.type.rawValue < item2.type.rawValue
                }
                return item1.name.localizedCaseInsensitiveCompare(item2.name) == .orderedAscending
            }
        }
    }

    func toggleSelection(path: String) {
        if selectedPaths.contains(path) {
            selectedPaths.remove(path)
        } else {
            selectedPaths.insert(path)
        }
    }

    func selectAll() {
        selectedPaths = Set(items.map { $0.path })
    }

    func deselectAll() {
        selectedPaths.removeAll()
    }

    private func updateStats() {
        totalItemsCount = items.count
        selectedCount = selectedPaths.count

        let totalBytes = items.reduce(0) { $0 + $1.size }
        totalSize = formatSize(totalBytes)
    }

    private func formatSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }

    func deleteSelected() async {
        let pathsToDelete = Array(selectedPaths)
        guard !pathsToDelete.isEmpty else { return }

        let result = Cleaner.shared.deepClean(paths: pathsToDelete, includeAssociated: true)

        items.removeAll { selectedPaths.contains($0.path) }
        allItems.removeAll { selectedPaths.contains($0.path) }
        selectedPaths.removeAll()

        scanCache.removeAll()
    }

    func updateCounts() async {
        do {
            let result = Scanner.shared.getCounts()
            guard let data = result.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Int] else {
                return
            }

            for category in PresetCategory.allCases {
                counts[category] = json[category.rawValue] ?? 0
            }
        }
    }

    func updateDiskSpace() async {
        let result = Scanner.shared.getDiskSpace()
        guard let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let free = json["free_str"] as? String,
              let used = json["used_str"] as? String,
              let total = json["total_str"] as? String,
              let percent = json["percent_used"] as? Double else {
            return
        }

        diskSpace = DiskSpaceInfo(free: free, used: used, total: total, percentUsed: percent)
    }
}

