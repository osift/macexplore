import Foundation

struct HTMLContent {
    static func getHTML() -> String {
        let cssFiles = [
            "Resources/css/theme.css",
            "Resources/css/layout.css",
            "Resources/css/sidebar.css",
            "Resources/css/toolbar.css",
            "Resources/css/components.css",
            "Resources/css/modals.css",
            "Resources/css/alerts.css",
            "Resources/css/toast.css",
            "Resources/css/animations.css"
        ]

        let css = cssFiles.compactMap { filename -> String? in
            guard let path = Bundle.main.path(forResource: filename.replacingOccurrences(of: "Resources/", with: "").replacingOccurrences(of: ".css", with: ""), ofType: "css") else {
                print("Warning: Could not find CSS file: \(filename)")
                return loadLocalFile(filename)
            }
            return try? String(contentsOfFile: path, encoding: .utf8)
        }.joined(separator: "\n")

        let jsFiles = [
            "Resources/js/bridge.js",
            "Resources/js/state.js",
            "Resources/js/utils.js",
            "Resources/js/toast.js",
            "Resources/js/dialogs.js",
            "Resources/js/selection.js",
            "Resources/js/scanning.js",
            "Resources/js/presets.js",
            "Resources/js/browsers.js",
            "Resources/js/navigation.js",
            "Resources/js/itemManager.js",
            "Resources/js/contextMenu.js",
            "Resources/js/trash.js",
            "Resources/js/init.js",
            "Resources/js/logger.js"
        ]

        let js = jsFiles.compactMap { filename -> String? in
            guard let path = Bundle.main.path(forResource: filename.replacingOccurrences(of: "Resources/", with: "").replacingOccurrences(of: ".js", with: ""), ofType: "js") else {
                print("Warning: Could not find JS file: \(filename)")
                return loadLocalFile(filename)
            }
            return try? String(contentsOfFile: path, encoding: .utf8)
        }.joined(separator: "\n\n")

        var html: String
        if let path = Bundle.main.path(forResource: "template", ofType: "html") {
            html = (try? String(contentsOfFile: path, encoding: .utf8)) ?? ""
        } else {
            print("Warning: Could not find template.html in bundle, trying local file")
            html = loadLocalFile("Resources/template.html") ?? ""
        }

        html = html.replacingOccurrences(of: "/* c */", with: css)
        html = html.replacingOccurrences(of: "// j", with: js)

        return html
    }

    private static func loadLocalFile(_ filename: String) -> String? {
        let fileManager = FileManager.default

        if let executablePath = Bundle.main.executablePath {
            let executableDir = (executablePath as NSString).deletingLastPathComponent
            let filePath = (executableDir as NSString).appendingPathComponent(filename)

            if fileManager.fileExists(atPath: filePath) {
                return try? String(contentsOfFile: filePath, encoding: .utf8)
            }

            let parentPath = ((executableDir as NSString).deletingLastPathComponent as NSString).appendingPathComponent(filename)
            if fileManager.fileExists(atPath: parentPath) {
                return try? String(contentsOfFile: parentPath, encoding: .utf8)
            }
        }

        if let executablePath = Bundle.main.executablePath {
            let contentsPath = ((executablePath as NSString).deletingLastPathComponent as NSString).deletingLastPathComponent
            let resourcesPath = (contentsPath as NSString).appendingPathComponent("Resources")
            let filePath = (resourcesPath as NSString).appendingPathComponent(filename.replacingOccurrences(of: "Resources/", with: ""))
            if fileManager.fileExists(atPath: filePath) {
                return try? String(contentsOfFile: filePath, encoding: .utf8)
            }
        }

        let currentPath = fileManager.currentDirectoryPath
        let filePath = (currentPath as NSString).appendingPathComponent(filename)
        if fileManager.fileExists(atPath: filePath) {
            return try? String(contentsOfFile: filePath, encoding: .utf8)
        }

        print("Error: Could not find file: \(filename)")
        return nil
    }
}
