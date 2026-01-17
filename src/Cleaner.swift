import Foundation
import AppKit

class Cleaner {
    static let shared = Cleaner()
    private let fileManager = FileManager.default
    private let trashPath = NSHomeDirectory() + "/.Trash"

    func deepClean(paths: [String], includeAssociated: Bool) -> String {
        var success: [String] = []
        var permanentlyDeleted: [String] = []  
        var failed: [[String: String]] = []
        var associatedRemoved: [String] = []
        var forceQuit: [String] = []

        for pathStr in paths {
            let path = pathStr

            guard fileManager.fileExists(atPath: path) else {
                failed.append(["name": (path as NSString).lastPathComponent, "error": "File not found"])
                continue
            }

            if path.hasSuffix(".app") {
                let appName = ((path as NSString).lastPathComponent as NSString).deletingPathExtension
                if isAppRunning(appName: appName) {
                    let quitResult = forceQuitInternal(appName: appName)
                    if quitResult["success"] as? Bool == true {
                        forceQuit.append(appName)
                        Thread.sleep(forTimeInterval: 0.5)
                    } else {
                        failed.append([
                            "name": (path as NSString).lastPathComponent,
                            "error": "Could not quit app. Please quit \(appName) manually first."
                        ])
                        continue
                    }
                }
            }

            if includeAssociated && path.hasSuffix(".app") {
                if let associatedData = findAssociatedFilesInternal(appPath: path) {
                    if let associated = associatedData["associated"] as? [String: [[String: Any]]] {
                        for (_, files) in associated {
                            for file in files {
                                if let filePath = file["path"] as? String {
                                    try? fileManager.removeItem(atPath: filePath)
                                    associatedRemoved.append(filePath)
                                }
                            }
                        }
                    }
                }
            }

            var trashDestination = (trashPath as NSString).appendingPathComponent((path as NSString).lastPathComponent)

            var counter = 1
            while fileManager.fileExists(atPath: trashDestination) {
                let baseName = ((path as NSString).lastPathComponent as NSString).deletingPathExtension
                let ext = (path as NSString).pathExtension
                trashDestination = (trashPath as NSString).appendingPathComponent("\(baseName)_\(counter).\(ext)")
                counter += 1
            }

            do {
                try fileManager.moveItem(atPath: path, toPath: trashDestination)
                success.append((path as NSString).lastPathComponent)
            } catch {

                if requiresElevation(path: path) {
                    let privResult = deleteWithPrivileges(path: path)
                    if privResult.success {

                        permanentlyDeleted.append((path as NSString).lastPathComponent)
                    } else {
                        failed.append([
                            "name": (path as NSString).lastPathComponent,
                            "error": privResult.error
                        ])
                    }
                } else {
                    failed.append([
                        "name": (path as NSString).lastPathComponent,
                        "error": "Could not delete - manual deletion required"
                    ])
                }
            }
        }

        let result: [String: Any] = [
            "success": success,
            "permanently_deleted": permanentlyDeleted,
            "failed": failed,
            "associated_removed": associatedRemoved,
            "force_quit": forceQuit
        ]

        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    func findAssociatedFiles(appPath: String) -> String {
        guard let data = findAssociatedFilesInternal(appPath: appPath) else {
            return "{\"app_name\": \"\", \"bundle_id\": \"\", \"associated\": {}, \"total_size\": \"0 B\", \"total_files\": 0}"
        }

        let jsonData = try! JSONSerialization.data(withJSONObject: data)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func findAssociatedFilesInternal(appPath: String) -> [String: Any]? {
        let appName = ((appPath as NSString).lastPathComponent as NSString).deletingPathExtension
        let bundleId = getBundleId(appPath: appPath)

        var associated: [String: [[String: Any]]] = [
            "app_support": [],
            "preferences": [],
            "caches": [],
            "logs": [],
            "saved_state": [],
            "containers": [],
            "other": []
        ]

        let homeDir = NSHomeDirectory()
        let searchDirs: [(String, String)] = [
            ("\(homeDir)/Library/Application Support", "app_support"),
            ("\(homeDir)/Library/Preferences", "preferences"),
            ("\(homeDir)/Library/Caches", "caches"),
            ("\(homeDir)/Library/Logs", "logs"),
            ("\(homeDir)/Library/Saved Application State", "saved_state"),
            ("\(homeDir)/Library/Containers", "containers"),
            ("\(homeDir)/Library/Group Containers", "containers")
        ]

        for (dir, category) in searchDirs {
            guard let contents = try? fileManager.contentsOfDirectory(atPath: dir) else { continue }

            for item in contents {
                let itemName = item.lowercased()
                let appNameLower = appName.lowercased()

                if itemName.contains(appNameLower) || (bundleId != nil && itemName.contains(bundleId!.lowercased())) {
                    let fullPath = (dir as NSString).appendingPathComponent(item)
                    let size = Scanner.shared.formatSize(getSize(path: fullPath))

                    associated[category]?.append([
                        "path": fullPath,
                        "size": getSize(path: fullPath),
                        "size_str": size
                    ])
                }
            }
        }

        var totalSize: Int64 = 0
        var totalFiles = 0

        for (_, files) in associated {
            for file in files {
                totalSize += file["size"] as? Int64 ?? 0
                totalFiles += 1
            }
        }

        return [
            "app_name": appName,
            "bundle_id": bundleId ?? "Unknown",
            "associated": associated,
            "total_size": Scanner.shared.formatSize(totalSize),
            "total_files": totalFiles
        ]
    }

    private func getBundleId(appPath: String) -> String? {
        let plistPath = (appPath as NSString).appendingPathComponent("Contents/Info.plist")

        guard let dict = NSDictionary(contentsOfFile: plistPath),
              let bundleId = dict["CFBundleIdentifier"] as? String else {
            return nil
        }

        return bundleId
    }

    private func getSize(path: String) -> Int64 {
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: path, isDirectory: &isDirectory) else {
            return 0
        }

        if isDirectory.boolValue {
            var totalSize: Int64 = 0
            if let enumerator = fileManager.enumerator(atPath: path) {
                while let file = enumerator.nextObject() as? String {
                    let fullPath = (path as NSString).appendingPathComponent(file)
                    if let attrs = try? fileManager.attributesOfItem(atPath: fullPath) {
                        totalSize += attrs[.size] as? Int64 ?? 0
                    }
                }
            }
            return totalSize
        } else {
            if let attrs = try? fileManager.attributesOfItem(atPath: path) {
                return attrs[.size] as? Int64 ?? 0
            }
        }

        return 0
    }

    func emptyTrash() -> String {
        var successCount = 0
        var failedCount = 0
        var privilegedCount = 0

        guard let contents = try? fileManager.contentsOfDirectory(atPath: trashPath) else {
            return "{\"success\": 0, \"failed\": 0, \"privileged\": 0}"
        }

        for item in contents {
            if item.hasPrefix(".") { continue }

            let fullPath = (trashPath as NSString).appendingPathComponent(item)
            do {
                try fileManager.removeItem(atPath: fullPath)
                successCount += 1
            } catch {

                let privResult = deleteWithPrivileges(path: fullPath)
                if privResult.success {
                    privilegedCount += 1
                } else {
                    failedCount += 1
                }
            }
        }

        let result: [String: Int] = ["success": successCount, "failed": failedCount, "privileged": privilegedCount]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    func isAppRunning(appName: String) -> Bool {
        let runningApps = NSWorkspace.shared.runningApplications
        return runningApps.contains { app in
            app.localizedName?.lowercased().contains(appName.lowercased()) == true
        }
    }

    func forceQuit(appName: String) -> String {
        let result = forceQuitInternal(appName: appName)
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func forceQuitInternal(appName: String) -> [String: Any] {
        let runningApps = NSWorkspace.shared.runningApplications

        for app in runningApps {
            if app.localizedName?.lowercased().contains(appName.lowercased()) == true {
                let terminated = app.terminate()
                if !terminated {
                    _ = app.forceTerminate()
                }

                Thread.sleep(forTimeInterval: 0.5)

                if !isAppRunning(appName: appName) {
                    return ["success": true]
                }
            }
        }

        let task = Process()
        task.launchPath = "/usr/bin/killall"
        task.arguments = [appName]
        task.launch()
        task.waitUntilExit()

        Thread.sleep(forTimeInterval: 0.5)

        if !isAppRunning(appName: appName) {
            return ["success": true]
        }

        return ["success": false, "error": "Could not quit app"]
    }

    func permanentlyDelete(paths: [String]) -> String {
        var success: [String] = []
        var failed: [[String: String]] = []

        for path in paths {
            do {
                try fileManager.removeItem(atPath: path)
                success.append(path)
            } catch {

                if requiresElevation(path: path) {
                    let privResult = deleteWithPrivileges(path: path)
                    if privResult.success {
                        success.append(path)
                    } else {
                        failed.append([
                            "name": (path as NSString).lastPathComponent,
                            "error": privResult.error
                        ])
                    }
                } else {
                    failed.append([
                        "name": (path as NSString).lastPathComponent,
                        "error": "Could not delete - manual deletion required"
                    ])
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

    private func requiresElevation(path: String) -> Bool {
        guard let attrs = try? fileManager.attributesOfItem(atPath: path),
              let ownerID = attrs[.ownerAccountID] as? UInt else {
            return false
        }
        return ownerID == 0 
    }

    private func deleteWithPrivileges(path: String) -> (success: Bool, error: String) {
        let escapedPath = path.replacingOccurrences(of: "'", with: "'\\''")
        let script = "do shell script \"rm -rf '\(escapedPath)'\" with administrator privileges"

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
            return (false, "Insufficient permissions - manual deletion required")
        }

        let result = semaphore.wait(timeout: .now() + 120)

        if result == .timedOut {
            if task.isRunning {
                task.terminate()
            }
            return (false, "Operation timed out - manual deletion required")
        }

        if !fileManager.fileExists(atPath: path) {
            return (true, "")
        }

        return (false, "Administrator password required - manual deletion required")
    }

}
