import Foundation

class AppController {
    static let shared = AppController()

    private var currentPreset: String = "applications"
    private var currentPath: String?
    private var selectedItems: Set<String> = []
    private var allItems: [[String: Any]] = []
    private var filteredItems: [[String: Any]] = []
    private var searchQuery: String = ""
    private var sortOption: String = "name-asc"

    func scanPreset(preset: String) -> String {
        currentPreset = preset
        currentPath = nil

        let startResult = Scanner.shared.startProgressiveScan(category: preset)

        guard let data = startResult.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let started = json["started"] as? Bool, started else {
            return "{\"success\": false, \"error\": \"Failed to start scan\"}"
        }

        var items: [[String: Any]] = []
        var complete = false

        while !complete {
            let batchResult = Scanner.shared.getNextBatch(batchSize: 100)

            guard let batchData = batchResult.data(using: .utf8),
                  let batchJson = try? JSONSerialization.jsonObject(with: batchData) as? [String: Any],
                  let itemsArray = batchJson["items"] as? [[String: Any]] else {
                break
            }

            complete = batchJson["complete"] as? Bool ?? false
            items.append(contentsOf: itemsArray)
        }

        allItems = items
        applyFiltersAndSort()

        let result: [String: Any] = [
            "success": true,
            "items": filteredItems,
            "total": items.count
        ]

        return jsonString(from: result)
    }

    func setSearchQuery(query: String) -> String {
        searchQuery = query
        applyFiltersAndSort()

        let result: [String: Any] = [
            "success": true,
            "items": filteredItems
        ]

        return jsonString(from: result)
    }

    func setSortOption(option: String) -> String {
        sortOption = option
        applyFiltersAndSort()

        let result: [String: Any] = [
            "success": true,
            "items": filteredItems
        ]

        return jsonString(from: result)
    }

    func toggleSelection(path: String) -> String {
        if selectedItems.contains(path) {
            selectedItems.remove(path)
        } else {
            selectedItems.insert(path)
        }

        let result: [String: Any] = [
            "success": true,
            "selectedCount": selectedItems.count,
            "selected": Array(selectedItems)
        ]

        return jsonString(from: result)
    }

    func selectAll() -> String {
        selectedItems = Set(filteredItems.compactMap { $0["path"] as? String })

        let result: [String: Any] = [
            "success": true,
            "selectedCount": selectedItems.count,
            "selected": Array(selectedItems)
        ]

        return jsonString(from: result)
    }

    func deselectAll() -> String {
        selectedItems.removeAll()

        let result: [String: Any] = [
            "success": true,
            "selectedCount": 0,
            "selected": []
        ]

        return jsonString(from: result)
    }

    func deleteSelected(includeAssociated: Bool = true) -> String {
        let paths = Array(selectedItems)

        guard !paths.isEmpty else {
            return "{\"success\": false, \"error\": \"No items selected\"}"
        }

        let result = Cleaner.shared.deepClean(paths: paths, includeAssociated: includeAssociated)

        selectedItems.removeAll()

        scanPreset(preset: currentPreset)

        return result
    }

    private func applyFiltersAndSort() {
        var items = allItems

        if !searchQuery.isEmpty {
            items = items.filter { item in
                guard let name = item["name"] as? String else { return false }
                return name.localizedCaseInsensitiveContains(searchQuery)
            }
        }

        items = sortItems(items)

        filteredItems = items
    }

    private func sortItems(_ items: [[String: Any]]) -> [[String: Any]] {
        switch sortOption {
        case "name-asc":
            return items.sorted { item1, item2 in
                let name1 = item1["name"] as? String ?? ""
                let name2 = item2["name"] as? String ?? ""
                return name1.localizedCaseInsensitiveCompare(name2) == .orderedAscending
            }
        case "name-desc":
            return items.sorted { item1, item2 in
                let name1 = item1["name"] as? String ?? ""
                let name2 = item2["name"] as? String ?? ""
                return name1.localizedCaseInsensitiveCompare(name2) == .orderedDescending
            }
        case "size-desc":
            return items.sorted { item1, item2 in
                let size1 = item1["size"] as? Int64 ?? 0
                let size2 = item2["size"] as? Int64 ?? 0
                return size1 > size2
            }
        case "size-asc":
            return items.sorted { item1, item2 in
                let size1 = item1["size"] as? Int64 ?? 0
                let size2 = item2["size"] as? Int64 ?? 0
                return size1 < size2
            }
        case "date-desc":
            return items.sorted { item1, item2 in
                let date1 = item1["modified"] as? String ?? ""
                let date2 = item2["modified"] as? String ?? ""
                return date1 > date2
            }
        case "date-asc":
            return items.sorted { item1, item2 in
                let date1 = item1["modified"] as? String ?? ""
                let date2 = item2["modified"] as? String ?? ""
                return date1 < date2
            }
        case "type":
            return items.sorted { item1, item2 in
                let type1 = item1["type"] as? String ?? ""
                let type2 = item2["type"] as? String ?? ""
                return type1.localizedCaseInsensitiveCompare(type2) == .orderedAscending
            }
        default:
            return items
        }
    }

    private func jsonString(from dict: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let string = String(data: data, encoding: .utf8) else {
            return "{\"success\": false}"
        }
        return string
    }
}
