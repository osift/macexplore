import Cocoa
import WebKit
import UniformTypeIdentifiers

class FocusableWebView: WKWebView {
    override var acceptsFirstResponder: Bool { true }
    override var canBecomeKeyView: Bool { true }

    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        menu.items.removeAll { item in
            let title = item.title.lowercased()
            return title.contains("reload") || title.contains("back") || title.contains("forward")
        }
        super.willOpenMenu(menu, with: event)
    }

    override func becomeFirstResponder() -> Bool {
        let result = super.becomeFirstResponder()
        DispatchQueue.main.async {
            self.evaluateJavaScript("document.activeElement?.blur(); setTimeout(() => { const input = document.getElementById('searchInput'); if (input) { input.focus(); input.click(); } }, 50);", completionHandler: nil)
        }
        return result
    }

    override func keyDown(with event: NSEvent) {
        super.keyDown(with: event)
    }

    override func mouseDown(with event: NSEvent) {
        self.window?.makeFirstResponder(self)
        super.mouseDown(with: event)
    }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if event.modifierFlags.contains(.command) {
            let chars = event.charactersIgnoringModifiers?.lowercased() ?? ""

            if chars == "c" {
                self.evaluateJavaScript("document.execCommand('copy')", completionHandler: nil)
                return true
            }
            if chars == "x" {
                self.evaluateJavaScript("document.execCommand('cut')", completionHandler: nil)
                return true
            }
            if chars == "v" {

                if let clipboardString = NSPasteboard.general.string(forType: .string) {
                    let escaped = clipboardString.replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "'", with: "\\'")
                        .replacingOccurrences(of: "\n", with: "\\n")
                        .replacingOccurrences(of: "\r", with: "")
                    self.evaluateJavaScript("""
                        (function() {
                            const input = document.activeElement;
                            if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                                const start = input.selectionStart;
                                const end = input.selectionEnd;
                                const text = '\(escaped)';
                                input.value = input.value.substring(0, start) + text + input.value.substring(end);
                                input.selectionStart = input.selectionEnd = start + text.length;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        })();
                    """, completionHandler: nil)
                }
                return true
            }
            if chars == "a" {
                self.evaluateJavaScript("""
                    (function() {
                        const input = document.activeElement;
                        if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                            input.select();
                        } else {

                            if (typeof selectAll === 'function' && typeof allSelected !== 'undefined') {
                                if (allSelected) {
                                    deselectAll();
                                } else {
                                    selectAll();
                                }
                            }
                        }
                    })();
                """, completionHandler: nil)
                return true
            }
            if chars == "z" {
                self.evaluateJavaScript("document.execCommand('undo')", completionHandler: nil)
                return true
            }
        }
        return super.performKeyEquivalent(with: event)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: FocusableWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1500, height: 1000),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "MacExplore"
        window.center()
        window.backgroundColor = NSColor(red: 0.059, green: 0.059, blue: 0.059, alpha: 1.0)

        window.minSize = NSSize(width: 800, height: 700)

        let config = WKWebViewConfiguration()

        #if DEBUG
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        #endif

        config.preferences.setValue(true, forKey: "javaScriptCanOpenWindowsAutomatically")
        if #available(macOS 13.3, *) {
            config.preferences.isElementFullscreenEnabled = true
        }

        let userContentController = WKUserContentController()
        userContentController.add(self, name: "pywebview")
        config.userContentController = userContentController

        webView = FocusableWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.uiDelegate = self
        webView.navigationDelegate = self

        webView.allowsMagnification = true

        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)

        let html = HTMLContent.getHTML()
        webView.loadHTMLString(html, baseURL: nil)

        window.initialFirstResponder = webView

        window.alphaValue = 0
        window.makeKeyAndOrderFront(nil)

        NSApp.activate(ignoringOtherApps: true)

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            _ = self.window.makeFirstResponder(self.webView)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {

        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.3
            self.window.animator().alphaValue = 1.0
        })

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            guard let self = self else { return }
            NSApp.activate(ignoringOtherApps: true)
            self.window.makeKey()
            _ = self.window.makeFirstResponder(self.webView)

            self.webView.evaluateJavaScript("""
                (function() {
                    const input = document.getElementById('searchInput');
                    if (input) {

                        input.removeAttribute('readonly');
                        input.removeAttribute('disabled');


                        if (document.activeElement) {
                            document.activeElement.blur();
                        }


                        input.focus();


                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        input.dispatchEvent(clickEvent);


                        setTimeout(() => {
                            input.focus();
                            input.setSelectionRange(0, 0);
                        }, 100);
                    }
                })();
            """, completionHandler: nil)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {

        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }
}

extension AppDelegate: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let method = body["method"] as? String else { return }

        let params = body["params"] as? [Any] ?? []
        let callbackId = body["callbackId"] as? String

        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.handleAPICall(method: method, params: params)

            if let callbackId = callbackId {
                DispatchQueue.main.async {
                    let js = "window.pywebviewCallbacks['\(callbackId)'](\(result));"
                    self.webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
        }
    }

    func handleAPICall(method: String, params: [Any]) -> String {
        switch method {
        case "start_scan":
            let category = params.first as? String ?? "all"
            return Scanner.shared.startProgressiveScan(category: category)
        case "get_next_batch":
            let batchSize = params.first as? Int ?? 20
            return Scanner.shared.getNextBatch(batchSize: batchSize)
        case "get_disk_space":
            return Scanner.shared.getDiskSpace()
        case "get_counts":
            return Scanner.shared.getCounts()
        case "scan_browsers":
            return BrowserScanner.shared.scanAllBrowsers()
        case "clear_browser_data":
            guard params.count >= 2,
                  let browser = params[0] as? String,
                  let types = params[1] as? [String] else {
                return "{\"success\": [], \"failed\": []}"
            }
            return BrowserScanner.shared.clearData(browser: browser, dataTypes: types)
        case "get_browser_extensions":
            guard let browser = params.first as? String else {
                return "[]"
            }
            return BrowserScanner.shared.getExtensions(browser: browser)
        case "deep_clean":
            guard params.count >= 1,
                  let paths = params[0] as? [String] else {
                return "{\"success\": [], \"failed\": [], \"associated_removed\": [], \"force_quit\": []}"
            }
            let includeAssociated = params.count >= 2 ? (params[1] as? Bool ?? true) : true
            return Cleaner.shared.deepClean(paths: paths, includeAssociated: includeAssociated)
        case "get_associated_files":
            guard let appPath = params.first as? String else {
                return "{\"app_name\": \"\", \"bundle_id\": \"\", \"associated\": {}, \"total_size\": \"0 B\", \"total_files\": 0}"
            }
            return Cleaner.shared.findAssociatedFiles(appPath: appPath)
        case "is_app_running":
            guard let appName = params.first as? String else { return "false" }
            return Cleaner.shared.isAppRunning(appName: appName) ? "true" : "false"
        case "force_quit_app":
            guard let appName = params.first as? String else {
                return "{\"success\": false, \"error\": \"No app name provided\"}"
            }
            return Cleaner.shared.forceQuit(appName: appName)
        case "extract_app_icon":
            guard let appPath = params.first as? String else { return "\"\"" }
            return "\"\(IconExtractor.shared.extractAppIcon(appPath: appPath))\""
        case "get_file_icon":
            guard let filePath = params.first as? String else { return "\"\"" }
            return "\"\(IconExtractor.shared.getFileIcon(filePath: filePath))\""
        case "get_folder_icon":
            guard let folderPath = params.first as? String else { return "\"\"" }
            return "\"\(IconExtractor.shared.getFolderIcon(folderPath: folderPath))\""
        case "reveal_in_finder":
            guard let path = params.first as? String else { return "false" }
            NSWorkspace.shared.selectFile(path, inFileViewerRootedAtPath: "")
            return "true"
        case "open_system_settings":
            guard let urlString = params.first as? String,
                  let url = URL(string: urlString) else { return "false" }
            NSWorkspace.shared.open(url)
            return "true"
        case "get_directory_contents":
            guard let dirPath = params.first as? String else { return "[]" }
            return Scanner.shared.getDirectoryContents(path: dirPath)
        case "search_directory":
            guard params.count >= 2,
                  let dirPath = params[0] as? String,
                  let query = params[1] as? String else { return "[]" }
            return Scanner.shared.searchInDirectory(path: dirPath, query: query)
        case "scan_trash":
            return Scanner.shared.scanTrash()
        case "empty_trash":
            return Cleaner.shared.emptyTrash()
        case "restore_from_trash":
            guard let paths = params.first as? [String] else {
                return "{\"success\": [], \"failed\": []}"
            }
            return Scanner.shared.restoreFromTrash(paths)
        case "permanently_delete":
            guard let paths = params.first as? [String] else {
                return "{\"success\": [], \"failed\": []}"
            }
            return Cleaner.shared.permanentlyDelete(paths: paths)
        case "select_folder":
            return "\"\(selectFolder())\""
        case "start_monitoring":
            guard let paths = params.first as? [String] else {
                return "{\"success\": false}"
            }
            startFileMonitoring(paths: paths)
            return "{\"success\": true}"
        case "stop_monitoring":
            Scanner.shared.stopMonitoring()
            return "{\"success\": true}"
        case "get_monitoring_status":
            return Scanner.shared.getMonitoringStatus()
        case "check_full_disk_access":
            return Scanner.shared.checkFullDiskAccess()
        case "restart_browser":
            guard let browserName = params.first as? String else {
                return "{\"success\": false, \"error\": \"No browser name provided\"}"
            }
            return restartBrowser(browserName)
        case "append_log":
            guard let logContent = params.first as? String else {
                return "false"
            }
            return appendToLog(logContent)
        case "scan_preset_full":
            guard let preset = params.first as? String else {
                return "{\"success\": false, \"error\": \"No preset provided\"}"
            }
            return AppController.shared.scanPreset(preset: preset)
        case "set_search":
            guard let query = params.first as? String else {
                return "{\"success\": false, \"error\": \"No query provided\"}"
            }
            return AppController.shared.setSearchQuery(query: query)
        case "set_sort":
            guard let option = params.first as? String else {
                return "{\"success\": false, \"error\": \"No sort option provided\"}"
            }
            return AppController.shared.setSortOption(option: option)
        case "toggle_selection":
            guard let path = params.first as? String else {
                return "{\"success\": false, \"error\": \"No path provided\"}"
            }
            return AppController.shared.toggleSelection(path: path)
        case "select_all_items":
            return AppController.shared.selectAll()
        case "deselect_all_items":
            return AppController.shared.deselectAll()
        case "delete_selected_items":
            let includeAssociated = params.first as? Bool ?? true
            return AppController.shared.deleteSelected(includeAssociated: includeAssociated)
        case "save_cache":
            guard let cacheData = params.first as? String else {
                return "{\"success\": false, \"error\": \"No data provided\"}"
            }
            return saveCache(cacheData)
        case "load_cache":
            return loadCache()
        case "save_icon_cache":
            guard let iconData = params.first as? String else {
                return "{\"success\": false, \"error\": \"No data provided\"}"
            }
            return saveIconCache(iconData)
        case "load_icon_cache":
            return loadIconCache()
        case "save_size_cache":
            guard let sizeData = params.first as? String else {
                return "{\"success\": false, \"error\": \"No data provided\"}"
            }
            return saveSizeCache(sizeData)
        case "load_size_cache":
            return loadSizeCache()
        case "get_item_size":
            guard let path = params.first as? String else {
                return "{\"size\": 0, \"size_str\": \"0 B\"}"
            }
            return Scanner.shared.getItemSize(path: path)
        case "download_and_install_update":
            guard let downloadUrl = params.first as? String else {
                return "{\"success\": false, \"error\": \"No download URL provided\"}"
            }
            return downloadUpdate(url: downloadUrl)
        case "get_app_version":
            let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
            return "{\"version\": \"\(version)\"}"
        default:
            return "null"
        }
    }

    func downloadUpdate(url: String) -> String {
        guard let downloadUrl = URL(string: url) else {
            return "{\"success\": false, \"error\": \"Invalid URL\"}"
        }

        let downloadsPath = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let destinationPath = downloadsPath.appendingPathComponent("MacExplore-update.dmg")


        try? FileManager.default.removeItem(at: destinationPath)


        let semaphore = DispatchSemaphore(value: 0)
        var resultString = "{\"success\": false, \"error\": \"Download failed\"}"

        let task = URLSession.shared.downloadTask(with: downloadUrl) { tempUrl, response, error in
            defer { semaphore.signal() }

            if let error = error {
                resultString = "{\"success\": false, \"error\": \"\(error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\""))\"}"
                return
            }

            guard let tempUrl = tempUrl else {
                resultString = "{\"success\": false, \"error\": \"No file downloaded\"}"
                return
            }

            do {
                try FileManager.default.moveItem(at: tempUrl, to: destinationPath)
                resultString = "{\"success\": true, \"dmg_path\": \"\(destinationPath.path)\"}"
            } catch {
                resultString = "{\"success\": false, \"error\": \"\(error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\""))\"}"
            }
        }

        task.resume()
        _ = semaphore.wait(timeout: .now() + 120)

        return resultString
    }

    func restartBrowser(_ browserName: String) -> String {
        let runningApps = NSWorkspace.shared.runningApplications
        guard let app = runningApps.first(where: { $0.localizedName == browserName }) else {
            return "{\"success\": false, \"error\": \"Browser not running\"}"
        }

        let bundleIdentifier = app.bundleIdentifier

        app.terminate()

        var terminated = false
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < 5.0 {
            if !app.isTerminated {
                Thread.sleep(forTimeInterval: 0.1)
            } else {
                terminated = true
                break
            }
        }

        if !terminated {

            app.forceTerminate()
            Thread.sleep(forTimeInterval: 0.5)
        }

        guard bundleIdentifier != nil else {
            return "{\"success\": false, \"error\": \"Could not determine bundle identifier\"}"
        }

        let config = NSWorkspace.OpenConfiguration()
        config.activates = true

        NSWorkspace.shared.openApplication(at: app.bundleURL!, configuration: config) { [weak self] app, error in
            if let error = error {
                DispatchQueue.main.async {
                    let js = "window.__restartBrowserCallback?.({success: false, error: '\(error.localizedDescription)'});"
                    self?.webView.evaluateJavaScript(js, completionHandler: nil)
                }
            } else {
                DispatchQueue.main.async {
                    let js = "window.__restartBrowserCallback?.({success: true});"
                    self?.webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
        }

        return "{\"success\": true, \"restarting\": true}"
    }

    func startFileMonitoring(paths: [String]) {
        Scanner.shared.startMonitoring(paths: paths) { [weak self] in
            DispatchQueue.main.async {
                let js = "if (window.onFileSystemChange) window.onFileSystemChange();"
                self?.webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    func selectFolder() -> String {
        var result = ""
        DispatchQueue.main.sync {
            let panel = NSOpenPanel()
            panel.canChooseFiles = false
            panel.canChooseDirectories = true
            panel.allowsMultipleSelection = false
            panel.prompt = "Select"
            panel.message = "Select a folder to browse:"

            if panel.runModal() == .OK, let url = panel.url {
                result = url.path
            }
        }
        return result
    }

    func appendToLog(_ content: String) -> String {
        let logPath = NSHomeDirectory() + "/Downloads/MacExplore_Debug.log"
        let fileURL = URL(fileURLWithPath: logPath)

        do {
            let fileManager = FileManager.default
            if !fileManager.fileExists(atPath: logPath) {
                try content.write(to: fileURL, atomically: true, encoding: .utf8)
            } else {
                let fileHandle = try FileHandle(forWritingTo: fileURL)
                fileHandle.seekToEndOfFile()
                if let data = content.data(using: .utf8) {
                    fileHandle.write(data)
                }
                fileHandle.closeFile()
            }
            return "true"
        } catch {
            print("[appendToLog] Error: \(error)")
            return "false"
        }
    }

    func saveCache(_ cacheData: String) -> String {
        let cachePath = NSHomeDirectory() + "/Library/Caches/com.osift.macexplore"
        let cacheFile = cachePath + "/scan_cache.json"
        do {
            try FileManager.default.createDirectory(atPath: cachePath, withIntermediateDirectories: true)
            try cacheData.write(toFile: cacheFile, atomically: true, encoding: .utf8)
            return "{\"success\": true}"
        } catch {
            let escapedError = error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\"")
            return "{\"success\": false, \"error\": \"\(escapedError)\"}"
        }
    }

    func loadCache() -> String {
        let cacheFile = NSHomeDirectory() + "/Library/Caches/com.osift.macexplore/scan_cache.json"
        guard FileManager.default.fileExists(atPath: cacheFile) else {
            return "{\"found\": false}"
        }
        do {
            let cacheData = try String(contentsOfFile: cacheFile, encoding: .utf8)
            return "{\"found\": true, \"data\": \(cacheData)}"
        } catch {
            let escapedError = error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\"")
            return "{\"found\": false, \"error\": \"\(escapedError)\"}"
        }
    }

    func saveIconCache(_ iconData: String) -> String {
        let cachePath = NSHomeDirectory() + "/Library/Caches/com.osift.macexplore"
        let cacheFile = cachePath + "/icon_cache.json"
        do {
            try FileManager.default.createDirectory(atPath: cachePath, withIntermediateDirectories: true)
            try iconData.write(toFile: cacheFile, atomically: true, encoding: .utf8)
            return "{\"success\": true}"
        } catch {
            let escapedError = error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\"")
            return "{\"success\": false, \"error\": \"\(escapedError)\"}"
        }
    }

    func loadIconCache() -> String {
        let cacheFile = NSHomeDirectory() + "/Library/Caches/com.osift.macexplore/icon_cache.json"
        guard FileManager.default.fileExists(atPath: cacheFile) else {
            return "{\"found\": false}"
        }
        do {
            let iconData = try String(contentsOfFile: cacheFile, encoding: .utf8)
            return "{\"found\": true, \"data\": \(iconData)}"
        } catch {
            let escapedError = error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\"")
            return "{\"found\": false, \"error\": \"\(escapedError)\"}"
        }
    }

    func saveSizeCache(_ sizeData: String) -> String {
        let cachePath = NSHomeDirectory() + "/Library/Caches/com.osift.macexplore"
        let cacheFile = cachePath + "/size_cache.json"
        do {
            try FileManager.default.createDirectory(atPath: cachePath, withIntermediateDirectories: true)
            try sizeData.write(toFile: cacheFile, atomically: true, encoding: .utf8)
            return "{\"success\": true}"
        } catch {
            let escapedError = error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\"")
            return "{\"success\": false, \"error\": \"\(escapedError)\"}"
        }
    }

    func loadSizeCache() -> String {
        let cacheFile = NSHomeDirectory() + "/Library/Caches/com.osift.macexplore/size_cache.json"
        guard FileManager.default.fileExists(atPath: cacheFile) else {
            return "{\"found\": false}"
        }
        do {
            let sizeData = try String(contentsOfFile: cacheFile, encoding: .utf8)
            return "{\"found\": true, \"data\": \(sizeData)}"
        } catch {
            let escapedError = error.localizedDescription.replacingOccurrences(of: "\"", with: "\\\"")
            return "{\"found\": false, \"error\": \"\(escapedError)\"}"
        }
    }
}

@main
struct MacExploreApp {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}
