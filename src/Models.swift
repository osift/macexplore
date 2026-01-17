import Foundation
import SwiftUI

struct FileItem: Identifiable, Hashable {
    let id = UUID()
    let path: String
    let name: String
    let size: Int64
    let sizeStr: String
    let modified: String
    let type: FileType
    let isApp: Bool
    let isProtected: Bool
    var icon: NSImage?

    enum FileType: String, Codable {
        case application = "Application"
        case folder = "Folder"
        case file = "File"
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(path)
    }

    static func == (lhs: FileItem, rhs: FileItem) -> Bool {
        lhs.path == rhs.path
    }

    init(path: String, name: String, size: Int64, sizeStr: String, modified: String, type: FileType, isApp: Bool, isProtected: Bool, icon: NSImage? = nil) {
        self.path = path
        self.name = name
        self.size = size
        self.sizeStr = sizeStr
        self.modified = modified
        self.type = type
        self.isApp = isApp
        self.isProtected = isProtected
        self.icon = icon
    }
}

enum PresetCategory: String, CaseIterable, Identifiable {
    case all = "all"
    case applications = "applications"
    case desktop = "desktop"
    case documents = "documents"
    case downloads = "downloads"
    case startup = "launch_agents"
    case binaries = "binaries"
    case browsers = "browsers"
    case trash = "trash"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .all: return "All Items"
        case .applications: return "Applications"
        case .desktop: return "Desktop"
        case .documents: return "Documents"
        case .downloads: return "Downloads"
        case .startup: return "Startup"
        case .binaries: return "Binaries"
        case .browsers: return "Browsers"
        case .trash: return "Trash"
        }
    }

    var iconName: String {
        switch self {
        case .all: return "list.bullet"
        case .applications: return "square.grid.2x2"
        case .desktop: return "desktopcomputer"
        case .documents: return "doc"
        case .downloads: return "arrow.down.circle"
        case .startup: return "gearshape"
        case .binaries: return "chevron.left.forwardslash.chevron.right"
        case .browsers: return "checkmark.circle"
        case .trash: return "trash"
        }
    }
}

enum SortOption: String, CaseIterable, Identifiable {
    case nameAsc = "name-asc"
    case nameDesc = "name-desc"
    case sizeDesc = "size-desc"
    case sizeAsc = "size-asc"
    case dateDesc = "date-desc"
    case dateAsc = "date-asc"
    case type = "type"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .nameAsc: return "Name (A-Z)"
        case .nameDesc: return "Name (Z-A)"
        case .sizeDesc: return "Size (Largest)"
        case .sizeAsc: return "Size (Smallest)"
        case .dateDesc: return "Date (Newest)"
        case .dateAsc: return "Date (Oldest)"
        case .type: return "Type"
        }
    }
}

struct DiskSpaceInfo {
    let free: String
    let used: String
    let total: String
    let percentUsed: Double
}
