import Foundation

class BrowserScanner {
    static let shared = BrowserScanner()
    private let fileManager = FileManager.default
    private let homeDir = NSHomeDirectory()

    func scanAllBrowsers() -> String {
        var browsers: [[String: Any]] = []

        if let safariData = scanSafari() {
            browsers.append(safariData)
        }

        let chromiumBrowsers: [(String, String, String)] = [
            ("Chrome", "\(homeDir)/Library/Application Support/Google/Chrome", "/Applications/Google Chrome.app"),
            ("Brave", "\(homeDir)/Library/Application Support/BraveSoftware/Brave-Browser", "/Applications/Brave Browser.app"),
            ("Arc", "\(homeDir)/Library/Application Support/Arc", "/Applications/Arc.app"),
            ("Edge", "\(homeDir)/Library/Application Support/Microsoft Edge", "/Applications/Microsoft Edge.app")
        ]

        for (name, dataPath, appPath) in chromiumBrowsers {
            if fileManager.fileExists(atPath: appPath) {
                browsers.append(scanChromiumBrowser(name: name, dataPath: dataPath, appPath: appPath))
            }
        }

        if fileManager.fileExists(atPath: "/Applications/Firefox.app") {
            browsers.append(scanFirefox())
        }

        let jsonData = try! JSONSerialization.data(withJSONObject: browsers)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func scanSafari() -> [String: Any]? {
        let safariDir = "\(homeDir)/Library/Safari"
        let safariPaths = ["/Applications/Safari.app", "/System/Applications/Safari.app"]

        guard let safariPath = safariPaths.first(where: { fileManager.fileExists(atPath: $0) }) else {
            return nil
        }

        guard fileManager.isReadableFile(atPath: safariDir) else {
            return [
                "name": "Safari",
                "icon": IconExtractor.shared.extractAppIcon(appPath: safariPath),
                "history_size": "N/A",
                "cookies_count": "N/A",
                "extensions": "N/A",
                "cache_size": "N/A",
                "passwords_count": "N/A",
                "autofill_count": "N/A",
                "total_size": "N/A",
                "needs_permission": true
            ]
        }

        let historySize = getFileSize(path: "\(safariDir)/History.db")
        let cookiesSize = getFileSize(path: "\(safariDir)/Cookies.binarycookies")
        let cacheSize = getDirectorySize(path: "\(homeDir)/Library/Caches/com.apple.Safari")
        let totalSize = historySize + cookiesSize + cacheSize

        return [
            "name": "Safari",
            "icon": IconExtractor.shared.extractAppIcon(appPath: safariPath),
            "history_size": Scanner.shared.formatSize(historySize),
            "cookies_count": cookiesSize > 0 ? "\(cookiesSize / 200)" : "0",
            "extensions": 0,
            "cache_size": Scanner.shared.formatSize(cacheSize),
            "passwords_count": "Protected",
            "autofill_count": "Protected",
            "total_size": Scanner.shared.formatSize(totalSize)
        ]
    }

    private func scanChromiumBrowser(name: String, dataPath: String, appPath: String) -> [String: Any] {
        guard fileManager.fileExists(atPath: dataPath) else {
            return emptyBrowserData(name: name, appPath: appPath)
        }

        let defaultProfile = (dataPath as NSString).appendingPathComponent("Default")
        var historySize: Int64 = 0
        var cacheSize: Int64 = 0
        var cookiesSize: Int64 = 0
        var extensionsCount = 0
        var passwordsCount = 0
        var autofillCount = 0

        if fileManager.fileExists(atPath: defaultProfile) {
            historySize = getFileSize(path: (defaultProfile as NSString).appendingPathComponent("History"))
            cookiesSize = getFileSize(path: (defaultProfile as NSString).appendingPathComponent("Cookies"))

            let cacheDirs = [
                (defaultProfile as NSString).appendingPathComponent("Cache"),
                (defaultProfile as NSString).appendingPathComponent("Code Cache"),
                (defaultProfile as NSString).appendingPathComponent("GPUCache"),
                (dataPath as NSString).appendingPathComponent("ShaderCache")
            ]

            for cacheDir in cacheDirs {
                cacheSize += getDirectorySize(path: cacheDir)
            }

            let extensionsDir = (defaultProfile as NSString).appendingPathComponent("Extensions")
            extensionsCount = countExtensions(path: extensionsDir)

            passwordsCount = countPasswords(dbPath: (defaultProfile as NSString).appendingPathComponent("Login Data"))

            autofillCount = countAutofill(dbPath: (defaultProfile as NSString).appendingPathComponent("Web Data"))
        }

        let totalSize = historySize + cacheSize + cookiesSize
        let cookieCount = cookiesSize > 0 ? cookiesSize / 120 : 0

        return [
            "name": name,
            "icon": IconExtractor.shared.extractAppIcon(appPath: appPath),
            "history_size": Scanner.shared.formatSize(historySize),
            "cookies_count": "\(cookieCount)",
            "extensions": extensionsCount,
            "cache_size": Scanner.shared.formatSize(cacheSize),
            "passwords_count": "\(passwordsCount)",
            "autofill_count": "\(autofillCount)",
            "total_size": Scanner.shared.formatSize(totalSize)
        ]
    }

    private func scanFirefox() -> [String: Any] {
        let dataPath = "\(homeDir)/Library/Application Support/Firefox"
        let appPath = "/Applications/Firefox.app"

        guard fileManager.fileExists(atPath: dataPath) else {
            return emptyBrowserData(name: "Firefox", appPath: appPath)
        }

        var cacheSize: Int64 = 0
        let cacheDir = "\(homeDir)/Library/Caches/Firefox"
        if fileManager.fileExists(atPath: cacheDir) {
            cacheSize = getDirectorySize(path: cacheDir)
        }

        return [
            "name": "Firefox",
            "icon": IconExtractor.shared.extractAppIcon(appPath: appPath),
            "history_size": "Protected",
            "cookies_count": "Protected",
            "extensions": 0,
            "cache_size": Scanner.shared.formatSize(cacheSize),
            "passwords_count": "Protected",
            "autofill_count": "Protected",
            "total_size": Scanner.shared.formatSize(cacheSize)
        ]
    }

    private func emptyBrowserData(name: String, appPath: String) -> [String: Any] {
        return [
            "name": name,
            "icon": IconExtractor.shared.extractAppIcon(appPath: appPath),
            "history_size": "0 B",
            "cookies_count": "0",
            "extensions": 0,
            "cache_size": "0 B",
            "passwords_count": "0",
            "autofill_count": "0",
            "total_size": "0 B"
        ]
    }

    private func countExtensions(path: String) -> Int {
        guard let contents = try? fileManager.contentsOfDirectory(atPath: path) else {
            return 0
        }

        var count = 0
        for extDir in contents {
            if extDir.hasPrefix(".") { continue }

            let extPath = (path as NSString).appendingPathComponent(extDir)
            guard let versions = try? fileManager.contentsOfDirectory(atPath: extPath) else { continue }

            for version in versions {
                let manifestPath = ((extPath as NSString).appendingPathComponent(version) as NSString).appendingPathComponent("manifest.json")
                if fileManager.fileExists(atPath: manifestPath) {
                    count += 1
                    break
                }
            }
        }

        return count
    }

    func getExtensions(browser: String) -> String {
        let browserPaths: [String: String] = [
            "Chrome": "\(homeDir)/Library/Application Support/Google/Chrome/Default/Extensions",
            "Brave": "\(homeDir)/Library/Application Support/BraveSoftware/Brave-Browser/Default/Extensions",
            "Arc": "\(homeDir)/Library/Application Support/Arc/Default/Extensions",
            "Edge": "\(homeDir)/Library/Application Support/Microsoft Edge/Default/Extensions"
        ]

        guard let extPath = browserPaths[browser],
              fileManager.fileExists(atPath: extPath),
              let contents = try? fileManager.contentsOfDirectory(atPath: extPath) else {
            return "[]"
        }

        var extensions: [[String: Any]] = []

        for extDir in contents {
            if extDir.hasPrefix(".") { continue }

            let extDirPath = (extPath as NSString).appendingPathComponent(extDir)
            guard let versions = try? fileManager.contentsOfDirectory(atPath: extDirPath) else { continue }

            for version in versions {
                let versionPath = (extDirPath as NSString).appendingPathComponent(version)
                let manifestPath = (versionPath as NSString).appendingPathComponent("manifest.json")

                if fileManager.fileExists(atPath: manifestPath),
                   let data = try? Data(contentsOf: URL(fileURLWithPath: manifestPath)),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {

                    var name = json["name"] as? String ?? "Unknown"
                    let ver = json["version"] as? String ?? "Unknown"
                    let size = getDirectorySize(path: versionPath)

                    if name.contains("__MSG_") || name.hasPrefix("_") {
                        if let webName = fetchExtensionNameFromWeb(extensionId: extDir) {
                            name = webName
                        } else {
                            name = "Extension \(extDir.prefix(8))"
                        }
                    }

                    extensions.append([
                        "id": extDir,
                        "name": name,
                        "version": ver,
                        "path": versionPath,
                        "size": Scanner.shared.formatSize(size)
                    ])
                    break
                }
            }
        }

        let jsonData = try! JSONSerialization.data(withJSONObject: extensions)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func fetchExtensionNameFromWeb(extensionId: String) -> String? {
        let urlString = "https://chrome.google.com/webstore/detail/\(extensionId)"
        guard let url = URL(string: urlString) else { return nil }

        var name: String?
        let semaphore = DispatchSemaphore(value: 0)

        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            defer { semaphore.signal() }

            guard let data = data,
                  let html = String(data: data, encoding: .utf8) else { return }

            if let range = html.range(of: "<title>([^<]+)</title>", options: .regularExpression) {
                var title = String(html[range])
                title = title.replacingOccurrences(of: "<title>", with: "")
                title = title.replacingOccurrences(of: "</title>", with: "")
                title = title.replacingOccurrences(of: " - Chrome Web Store", with: "")
                name = title.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        task.resume()
        _ = semaphore.wait(timeout: .now() + 3.0)

        return name
    }

    func clearData(browser: String, dataTypes: [String]) -> String {
        let browserPaths: [String: String] = [
            "Chrome": "\(homeDir)/Library/Application Support/Google/Chrome/Default",
            "Brave": "\(homeDir)/Library/Application Support/BraveSoftware/Brave-Browser/Default",
            "Arc": "\(homeDir)/Library/Application Support/Arc/Default",
            "Edge": "\(homeDir)/Library/Application Support/Microsoft Edge/Default",
            "Safari": "\(homeDir)/Library/Safari"
        ]

        guard let profilePath = browserPaths[browser] else {
            return "{\"success\": [], \"failed\": []}"
        }

        var success: [String] = []
        var failed: [String] = []

        for dataType in dataTypes {
            do {
                switch dataType {
                case "history":
                    let historyPath = (profilePath as NSString).appendingPathComponent("History")
                    if fileManager.fileExists(atPath: historyPath) {
                        try fileManager.removeItem(atPath: historyPath)
                        success.append("history")
                    }
                case "cache":
                    let cachePaths = [
                        (profilePath as NSString).appendingPathComponent("Cache"),
                        (profilePath as NSString).appendingPathComponent("Code Cache"),
                        (profilePath as NSString).appendingPathComponent("GPUCache")
                    ]
                    for cachePath in cachePaths {
                        if fileManager.fileExists(atPath: cachePath) {
                            try fileManager.removeItem(atPath: cachePath)
                        }
                    }
                    success.append("cache")
                case "cookies":
                    let cookiesPath = (profilePath as NSString).appendingPathComponent("Cookies")
                    if fileManager.fileExists(atPath: cookiesPath) {
                        try fileManager.removeItem(atPath: cookiesPath)
                        success.append("cookies")
                    }
                default:
                    break
                }
            } catch {
                failed.append(dataType)
            }
        }

        let result = ["success": success, "failed": failed] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        return String(data: jsonData, encoding: .utf8)!
    }

    private func getFileSize(path: String) -> Int64 {
        guard let attrs = try? fileManager.attributesOfItem(atPath: path) else {
            return 0
        }
        return attrs[.size] as? Int64 ?? 0
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

    private func countPasswords(dbPath: String) -> Int {
        guard fileManager.fileExists(atPath: dbPath) else {
            return 0
        }

        let tempPath = NSTemporaryDirectory() + "temp_login_\(UUID().uuidString).db"

        do {
            try fileManager.copyItem(atPath: dbPath, toPath: tempPath)
            defer { try? fileManager.removeItem(atPath: tempPath) }

            let count = queryCount(dbPath: tempPath, table: "logins")
            return count
        } catch {
            return 0
        }
    }

    private func countAutofill(dbPath: String) -> Int {
        guard fileManager.fileExists(atPath: dbPath) else {
            return 0
        }

        let tempPath = NSTemporaryDirectory() + "temp_webdata_\(UUID().uuidString).db"

        do {
            try fileManager.copyItem(atPath: dbPath, toPath: tempPath)
            defer { try? fileManager.removeItem(atPath: tempPath) }

            let count = queryCount(dbPath: tempPath, table: "autofill")
            return count
        } catch {
            return 0
        }
    }

    private func queryCount(dbPath: String, table: String) -> Int {
        let task = Process()
        task.launchPath = "/usr/bin/sqlite3"
        task.arguments = [dbPath, "SELECT COUNT(*) FROM \(table);"]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = Pipe()

        do {
            try task.run()
            task.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
               let count = Int(output) {
                return count
            }
        } catch {
            return 0
        }

        return 0
    }
}