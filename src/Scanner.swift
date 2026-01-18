import Foundation
import CoreServices

class Scanner {
    static let shared = Scanner()

    private var currentScan: [[String: Any]] = []
    private var scanIndex = 0
    private let fileManager = FileManager.default
    private var eventStream: FSEventStreamRef?
    private var monitoredPaths: [String] = []
    private var changeCallback: (() -> Void)?

    func startProgressiveScan(category: String) -> String {
        currentScan = []
        scanIndex = 0

        if category == "trash" {
            let trashPath = NSHomeDirectory() + "/.Trash"
            if (try? fileManager.contentsOfDirectory(atPath: trashPath)) == nil {
                let jsonData = try! JSONSerialization.data(withJSONObject: [
                    "started": false,
                    "error": "permission_denied"
                ])
                return String(data: jsonData, encoding: .utf8)!
            }
        }

        switch category {
        case "all":
            currentScan = scanAll()
        case "applications":
            currentScan = scanApplications()
        case "desktop":
            currentScan = scanDirectory(path: NSHomeDirectory() + "/Desktop")
        case "documents":
            currentScan = scanDirectory(path: NSHomeDirectory() + "/Documents")
        case "downloads":
            currentScan = scanDirectory(path: NSHomeDirectory() + "/Downloads")
        case "launch_agents":
            currentScan = scanLaunchAgents()
        case "binaries":
            currentScan = scanBinaries()
        case "trash":
            currentScan = scanTrashInternal()
        default:
            break
        }

        let jsonData = try! JSONSerialization.data(withJSONObject: [
            "started": true,
            "total": currentScan.count
        ])
        return String(data: jsonData, encoding: .utf8)!
    }

    func getNextBatch(batchSize: Int) -> String {
        if scanIndex >= currentScan.count {
            let jsonData = try! JSONSerialization.data(withJSONObject: [
                "items": [],
                "complete": true
            ])
            return String(data: jsonData, encoding: .utf8)!
        }

        let endIndex = min(scanIndex + batchSize, currentScan.count)
        let batch = Array(currentScan[scanIndex..<endIndex])
        scanIndex = endIndex

        let complete = scanIndex >= currentScan.count
        let jsonData = try! JSONSerialization.data(withJSONObject: [
            "items": batch,
            "complete": complete
        ])
        return String(data: jsonData, encoding: .utf8)!
    }

    private func scanAll() -> [[String: Any]] {
        var items: [[String: Any]] = []
        items.append(contentsOf: scanApplications())
        items.append(contentsOf: scanDirectory(path: NSHomeDirectory() + "/Desktop"))
        items.append(contentsOf: scanDirectory(path: NSHomeDirectory() + "/Documents"))
        items.append(contentsOf: scanDirectory(path: NSHomeDirectory() + "/Downloads"))
        return items
    }

    private func scanApplications() -> [[String: Any]] {
        var items: [[String: Any]] = []
        let appsPaths = ["/Applications", NSHomeDirectory() + "/Applications"]

        for appsPath in appsPaths {
            guard let contents = try? fileManager.contentsOfDirectory(atPath: appsPath) else { continue }
            for item in contents {
                if item.hasSuffix(".app") {
                    let fullPath = (appsPath as NSString).appendingPathComponent(item)
                    if let info = getItemInfo(path: fullPath, isApp: true) {
                        items.append(info)
                    }
                }
            }
        }

        return items
    }

    func scanDirectory(path: String) -> [[String: Any]] {
        var items: [[String: Any]] = []

        guard let contents = try? fileManager.contentsOfDirectory(atPath: path) else {
            return items
        }

        for item in contents {

            if item == "Icon\r" || item == ".DS_Store" || item == ".localized" {
                continue
            }

            let fullPath = (path as NSString).appendingPathComponent(item)
            let isApp = item.hasSuffix(".app")

            if let info = getItemInfo(path: fullPath, isApp: isApp) {
                items.append(info)
            }
        }

        items.sort { (item1, item2) -> Bool in
            let type1 = item1["type"] as? String ?? ""
            let type2 = item2["type"] as? String ?? ""
            let name1 = item1["name"] as? String ?? ""
            let name2 = item2["name"] as? String ?? ""

            if type1 == "Folder" && type2 != "Folder" {
                return true
            } else if type1 != "Folder" && type2 == "Folder" {
                return false
            }

            return name1.localizedCaseInsensitiveCompare(name2) == .orderedAscending
        }

        return items
    }

    private func scanLaunchAgents() -> [[String: Any]] {
        var items: [[String: Any]] = []
        let locations = [
            NSHomeDirectory() + "/Library/LaunchAgents",
            "/Library/LaunchAgents",
            "/System/Library/LaunchAgents"
        ]

        for location in locations {
            guard let contents = try? fileManager.contentsOfDirectory(atPath: location) else { continue }
            for item in contents {
                if item.hasSuffix(".plist") {
                    let fullPath = (location as NSString).appendingPathComponent(item)
                    if let info = getItemInfo(path: fullPath, isApp: false) {
                        items.append(info)
                    }
                }
            }
        }

        return items
    }

    private func scanBinaries() -> [[String: Any]] {
        var items: [[String: Any]] = []
        let binDirs = ["/usr/local/bin", "/opt/homebrew/bin"]

        for binDir in binDirs {
            guard let contents = try? fileManager.contentsOfDirectory(atPath: binDir) else { continue }
            for item in contents {
                let fullPath = (binDir as NSString).appendingPathComponent(item)
                if fileManager.isExecutableFile(atPath: fullPath) {
                    if let info = getItemInfo(path: fullPath, isApp: false) {
                        items.append(info)
                    }
                }
            }
        }

        return items
    }

    private func scanTrashInternal() -> [[String: Any]] {
        let trashPath = NSHomeDirectory() + "/.Trash"
        var items: [[String: Any]] = []
        var seenPaths = Set<String>()

        guard let contents = try? fileManager.contentsOfDirectory(atPath: trashPath) else {
            return items
        }

        for item in contents {

            if item == "Icon\r" || item == ".DS_Store" || item == ".localized" { continue }
            let fullPath = (trashPath as NSString).appendingPathComponent(item)

            if seenPaths.contains(fullPath) {
                continue
            }

            let isApp = item.hasSuffix(".app")
            if let info = getItemInfo(path: fullPath, isApp: isApp) {
                seenPaths.insert(fullPath)
                items.append(info)
            }
        }

        return items
    }

    func scanTrash() -> String {
        let items = scanTrashInternal()
        let jsonData = try! JSONSerialization.data(withJSONObject: items)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func getItemInfo(path: String, isApp: Bool) -> [String: Any]? {
        guard let attrs = try? fileManager.attributesOfItem(atPath: path) else {
            return nil
        }

        let name = (path as NSString).lastPathComponent
        var size: Int64 = 0
        var isDirectory: ObjCBool = false
        var needsSizeCalculation = false

        if fileManager.fileExists(atPath: path, isDirectory: &isDirectory) {
            if isDirectory.boolValue {

                needsSizeCalculation = true
            } else {
                size = attrs[.size] as? Int64 ?? 0
            }
        }

        let type: String
        if isApp {
            type = "Application"
        } else if isDirectory.boolValue {
            type = "Folder"
        } else {
            type = "File"
        }

        let modified = (attrs[.modificationDate] as? Date)?.ISO8601Format() ?? ""

        return [
            "name": name,
            "path": path,
            "size": size,
            "size_str": needsSizeCalculation ? "Loading..." : formatSize(size),
            "type": type,
            "is_app": isApp,
            "modified": modified,
            "needs_size": needsSizeCalculation
        ]
    }

    private func getDirectorySize(path: String) -> Int64 {
        var totalSize: Int64 = 0

        guard let enumerator = fileManager.enumerator(atPath: path) else {
            return 0
        }

        while let file = enumerator.nextObject() as? String {
            let fullPath = (path as NSString).appendingPathComponent(file)
            if let attrs = try? fileManager.attributesOfItem(atPath: fullPath) {
                totalSize += attrs[.size] as? Int64 ?? 0
            }
        }

        return totalSize
    }

    func formatSize(_ size: Int64) -> String {
        let units = ["B", "KB", "MB", "GB", "TB"]
        var size = Double(size)
        var unitIndex = 0

        while size >= 1024.0 && unitIndex < units.count - 1 {
            size /= 1024.0
            unitIndex += 1
        }

        return String(format: "%.1f %@", size, units[unitIndex])
    }

    func getItemSize(path: String) -> String {
        var size: Int64 = 0
        var isDirectory: ObjCBool = false

        if fileManager.fileExists(atPath: path, isDirectory: &isDirectory) {
            if isDirectory.boolValue {
                size = getDirectorySize(path: path)
            } else {
                if let attrs = try? fileManager.attributesOfItem(atPath: path) {
                    size = attrs[.size] as? Int64 ?? 0
                }
            }
        }

        let result: [String: Any] = [
            "size": size,
            "size_str": formatSize(size)
        ]

        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    func getDiskSpace() -> String {
        let homeURL = URL(fileURLWithPath: NSHomeDirectory())

        guard let values = try? homeURL.resourceValues(forKeys: [.volumeTotalCapacityKey, .volumeAvailableCapacityKey]),
              let total = values.volumeTotalCapacity,
              let available = values.volumeAvailableCapacity else {
            return "{\"total\": 0, \"used\": 0, \"free\": 0, \"total_str\": \"0 B\", \"used_str\": \"0 B\", \"free_str\": \"0 B\", \"percent_used\": 0}"
        }

        let used = total - available
        let percentUsed = Double(used) / Double(total) * 100.0

        let result: [String: Any] = [
            "total": total,
            "used": used,
            "free": available,
            "total_str": formatSize(Int64(total)),
            "used_str": formatSize(Int64(used)),
            "free_str": formatSize(Int64(available)),
            "percent_used": round(percentUsed * 10) / 10
        ]

        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    func getCounts() -> String {

        let counts: [String: Int] = [
            "all": countApplications() + countDirectory(NSHomeDirectory() + "/Desktop") + countDirectory(NSHomeDirectory() + "/Documents") + countDirectory(NSHomeDirectory() + "/Downloads"),
            "applications": countApplications(),
            "desktop": countDirectory(NSHomeDirectory() + "/Desktop"),
            "documents": countDirectory(NSHomeDirectory() + "/Documents"),
            "downloads": countDirectory(NSHomeDirectory() + "/Downloads"),
            "launch_agents": countLaunchAgents(),
            "binaries": countBinaries(),
            "trash": countTrash()
        ]

        let jsonData = try! JSONSerialization.data(withJSONObject: counts)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func countApplications() -> Int {
        var count = 0
        for appsPath in ["/Applications", NSHomeDirectory() + "/Applications"] {
            if let contents = try? fileManager.contentsOfDirectory(atPath: appsPath) {
                count += contents.filter { $0.hasSuffix(".app") }.count
            }
        }
        return count
    }

    private func countDirectory(_ path: String) -> Int {
        guard let contents = try? fileManager.contentsOfDirectory(atPath: path) else { return 0 }

        return contents.filter { $0 != "Icon\r" && $0 != ".DS_Store" && $0 != ".localized" }.count
    }

    private func countLaunchAgents() -> Int {
        var count = 0
        for location in [NSHomeDirectory() + "/Library/LaunchAgents", "/Library/LaunchAgents", "/System/Library/LaunchAgents"] {
            if let contents = try? fileManager.contentsOfDirectory(atPath: location) {
                count += contents.filter { $0.hasSuffix(".plist") }.count
            }
        }
        return count
    }

    private func countBinaries() -> Int {
        var count = 0
        for binDir in ["/usr/local/bin", "/opt/homebrew/bin"] {
            if let contents = try? fileManager.contentsOfDirectory(atPath: binDir) {
                count += contents.count
            }
        }
        return count
    }

    private func countTrash() -> Int {
        let trashPath = NSHomeDirectory() + "/.Trash"
        guard let contents = try? fileManager.contentsOfDirectory(atPath: trashPath) else { return 0 }

        return contents.filter { $0 != "Icon\r" && $0 != ".DS_Store" && $0 != ".localized" }.count
    }

    func getDirectoryContents(path: String) -> String {
        let items = scanDirectory(path: path)
        let jsonData = try! JSONSerialization.data(withJSONObject: items)
        return String(data: jsonData, encoding: .utf8)!
    }

    func searchInDirectory(path: String, query: String) -> String {
        var results: [[String: Any]] = []
        let lowercaseQuery = query.lowercased()

        guard let enumerator = fileManager.enumerator(atPath: path) else {
            return "[]"
        }

        while let file = enumerator.nextObject() as? String {
            if file.lowercased().contains(lowercaseQuery) {
                let fullPath = (path as NSString).appendingPathComponent(file)
                let isApp = file.hasSuffix(".app")
                if let info = getItemInfo(path: fullPath, isApp: isApp) {
                    results.append(info)
                }
            }
        }

        let jsonData = try! JSONSerialization.data(withJSONObject: results)
        return String(data: jsonData, encoding: .utf8)!
    }

    func startMonitoring(paths: [String], callback: @escaping () -> Void) {
        stopMonitoring()

        monitoredPaths = paths
        changeCallback = callback

        var context = FSEventStreamContext(
            version: 0,
            info: Unmanaged.passUnretained(self).toOpaque(),
            retain: nil,
            release: nil,
            copyDescription: nil
        )

        let pathsToWatch = paths as CFArray
        let latency: CFTimeInterval = 1.0

        eventStream = FSEventStreamCreate(
            nil,
            { (streamRef, clientCallBackInfo, numEvents, eventPaths, eventFlags, eventIds) in
                guard let info = clientCallBackInfo else { return }
                let scanner = Unmanaged<Scanner>.fromOpaque(info).takeUnretainedValue()
                scanner.handleFileSystemEvent()
            },
            &context,
            pathsToWatch,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            latency,
            UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes)
        )

        if let stream = eventStream {
            FSEventStreamScheduleWithRunLoop(stream, CFRunLoopGetMain(), CFRunLoopMode.defaultMode.rawValue)
            FSEventStreamStart(stream)
        }
    }

    func stopMonitoring() {
        if let stream = eventStream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
            eventStream = nil
        }
        monitoredPaths = []
        changeCallback = nil
    }

    private func handleFileSystemEvent() {
        changeCallback?()
    }

    func restoreFromTrash(_ paths: [String]) -> String {
        var success: [String] = []
        var failed: [[String: String]] = []

        let desktopPath = NSHomeDirectory() + "/Desktop"

        for path in paths {
            let url = URL(fileURLWithPath: path)
            let fileName = url.lastPathComponent

            var destPath = (desktopPath as NSString).appendingPathComponent(fileName)
            var destURL = URL(fileURLWithPath: destPath)

            var counter = 1
            while FileManager.default.fileExists(atPath: destURL.path) {
                let ext = url.pathExtension
                let name = url.deletingPathExtension().lastPathComponent

                if ext.isEmpty {
                    destPath = (desktopPath as NSString).appendingPathComponent("\(name) \(counter)")
                } else {
                    destPath = (desktopPath as NSString).appendingPathComponent("\(name) \(counter).\(ext)")
                }
                destURL = URL(fileURLWithPath: destPath)
                counter += 1
            }

            guard FileManager.default.fileExists(atPath: url.path) else {
                failed.append([
                    "name": fileName,
                    "error": "Source file no longer exists in Trash"
                ])
                continue
            }

            guard FileManager.default.fileExists(atPath: desktopPath) else {
                failed.append([
                    "name": fileName,
                    "error": "Desktop directory not accessible"
                ])
                continue
            }

            do {
                try FileManager.default.moveItem(at: url, to: destURL)
                success.append(path)
            } catch {

                let mvResult = runShellCommand("/bin/mv", arguments: [url.path, destURL.path])
                if mvResult.success {
                    success.append(path)
                } else {

                    if requiresElevation(path: url.path) {
                        let privResult = moveWithPrivileges(from: url.path, to: destURL.path)
                        if privResult.success {
                            success.append(path)
                        } else {
                            failed.append([
                                "name": fileName,
                                "error": privResult.error
                            ])
                        }
                    } else {
                        failed.append([
                            "name": fileName,
                            "error": "Protected or in use - manual restore required"
                        ])
                    }
                }
            }
        }

        let result: [String: Any] = [
            "success": success,
            "failed": failed
        ]

        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }
    func getMonitoringStatus() -> String {
        let result: [String: Any] = [
            "monitoring": eventStream != nil,
            "paths": monitoredPaths
        ]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    func checkFullDiskAccess() -> String {
        let testPaths = [
            NSHomeDirectory() + "/.Trash",
            NSHomeDirectory() + "/Library/Safari",
            NSHomeDirectory() + "/Library/Application Support/Google/Chrome"
        ]

        var hasAccess = true
        for path in testPaths {
            if FileManager.default.fileExists(atPath: path) {
                if (try? FileManager.default.contentsOfDirectory(atPath: path)) == nil {
                    hasAccess = false
                    break
                }
            }
        }

        let result: [String: Any] = [
            "has_access": hasAccess
        ]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func runShellCommand(_ launchPath: String, arguments: [String]) -> (success: Bool, output: String) {
        let task = Process()
        task.launchPath = launchPath
        task.arguments = arguments

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        do {
            try task.run()
            task.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""

            return (task.terminationStatus == 0, output)
        } catch {
            return (false, error.localizedDescription)
        }
    }

    private func requiresElevation(path: String) -> Bool {
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: path),
              let ownerID = attrs[.ownerAccountID] as? UInt else {
            return false
        }
        return ownerID == 0
    }

    private func moveWithPrivileges(from sourcePath: String, to destPath: String) -> (success: Bool, error: String) {
        let escapedSource = sourcePath.replacingOccurrences(of: "'", with: "'\\''")
        let escapedDest = destPath.replacingOccurrences(of: "'", with: "'\\''")

        let script = "do shell script \"mv '\(escapedSource)' '\(escapedDest)'\" with administrator privileges"

        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        task.arguments = ["-e", script]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        let semaphore = DispatchSemaphore(value: 0)

        task.terminationHandler = { _ in
            semaphore.signal()
        }

        do {
            try task.run()
        } catch {
            return (false, "Insufficient permissions - manual restore required")
        }

        let result = semaphore.wait(timeout: .now() + 120)

        if result == .timedOut {
            if task.isRunning {
                task.terminate()
            }
            return (false, "Operation timed out - manual restore required")
        }

        if !FileManager.default.fileExists(atPath: sourcePath) {
            return (true, "")
        }

        return (false, "Administrator password required - manual restore required")
    }
}
