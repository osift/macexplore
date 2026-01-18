import Foundation
import AppKit
import AVFoundation

class IconExtractor {
    static let shared = IconExtractor()
    private var cache: [String: String] = [:]

    func extractAppIcon(appPath: String) -> String {
        if let cached = cache[appPath] {
            return cached
        }

        guard let bundle = Bundle(path: appPath),
              let iconFile = bundle.object(forInfoDictionaryKey: "CFBundleIconFile") as? String else {
            return getDefaultAppIcon()
        }

        let resourcesPath = (appPath as NSString).appendingPathComponent("Contents/Resources")
        var iconPath = (resourcesPath as NSString).appendingPathComponent(iconFile)

        if !iconPath.hasSuffix(".icns") {
            iconPath += ".icns"
        }

        guard let image = NSImage(contentsOfFile: iconPath) else {
            return getDefaultAppIcon()
        }

        let size = NSSize(width: 128, height: 128)
        let resized = NSImage(size: size)
        resized.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: size))
        resized.unlockFocus()

        guard let tiffData = resized.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else {
            return getDefaultAppIcon()
        }

        let base64 = pngData.base64EncodedString()
        let result = "data:image/png;base64,\(base64)"
        cache[appPath] = result
        return result
    }

    func getFileIcon(filePath: String) -> String {
        let ext = (filePath as NSString).pathExtension.lowercased()

        if ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].contains(ext) {
            if let thumbnail = generateImageThumbnail(filePath: filePath) {
                return thumbnail
            }
            return getImageIcon()
        }

        if ["mp4", "mov", "avi", "mkv", "m4v"].contains(ext) {
            if let thumbnail = generateVideoThumbnail(filePath: filePath) {
                return thumbnail
            }
            return getVideoIcon()
        }

        if ["doc", "docx", "rtf", "odt"].contains(ext) {
            return getDocumentIcon()
        }

        if ext == "pdf" {
            return getPDFIcon()
        }

        if ["xls", "xlsx", "csv", "ods"].contains(ext) {
            return getSpreadsheetIcon()
        }

        if ["ppt", "pptx", "key", "odp"].contains(ext) {
            return getPresentationIcon()
        }

        if ["zip", "rar", "7z", "tar", "gz", "dmg"].contains(ext) {
            return getArchiveIcon()
        }

        if ["txt", "md", "log"].contains(ext) {
            return getTextIcon()
        }

        if ["py", "js", "jsx", "ts", "tsx", "html", "css", "json", "sh", "c", "cpp", "java", "go", "rs", "php", "rb", "swift"].contains(ext) {
            return getCodeIcon()
        }

        if ["mp3", "wav", "aac", "flac", "m4a"].contains(ext) {
            return getAudioIcon()
        }

        return getGenericFileIcon()
    }

    func getFolderIcon(folderPath: String) -> String {
        let folderName = (folderPath as NSString).lastPathComponent

        switch folderName {
        case "Desktop":
            return getDesktopIcon()
        case "Documents":
            return getDocumentsIcon()
        case "Downloads":
            return getDownloadsIcon()
        case "Pictures":
            return getPicturesIcon()
        case "Music":
            return getMusicIcon()
        case "Movies":
            return getMoviesIcon()
        case "Applications":
            return getApplicationsIcon()
        case "Library":
            return getLibraryIcon()
        default:
            return getGenericFolderIcon()
        }
    }

    private func getGenericFolderIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%2390CAF9' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%2364B5F6' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getDesktopIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%235C6BC0' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%237986CB' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getDocumentsIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23FF9800' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%23FFB74D' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getDownloadsIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%234CAF50' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%2366BB6A' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getPicturesIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23E91E63' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%23EC407A' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getMusicIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%239C27B0' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%23AB47BC' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getMoviesIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23F44336' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%23EF5350' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getApplicationsIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23607D8B' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%2378909C' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getLibraryIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23795548' d='M54 14H30l-4-6H10c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%238D6E63' d='M54 18H10c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h44c2.2 0 4-1.8 4-4V22c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
    }

    private func getImageIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23E3F2FD' x='8' y='8' width='48' height='48' rx='4'/%3E%3Cpath fill='%2342A5F5' d='M52 48L40 36l-8 8-8-8-8 12h36z'/%3E%3Ccircle fill='%23FFC107' cx='20' cy='20' r='4'/%3E%3C/svg%3E"
    }

    private func getVideoIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23424242' x='8' y='16' width='48' height='32' rx='4'/%3E%3Cpath fill='%23FFF' d='M28 38V26l12 6z'/%3E%3C/svg%3E"
    }

    private func getAudioIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%239C27B0' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23D1C4E9' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getPDFIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23F44336' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23FFCDD2' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getDocumentIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%232196F3' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23BBDEFB' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getSpreadsheetIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%234CAF50' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23C8E6C9' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getPresentationIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23FF5722' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23FFCCBC' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getArchiveIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23FF9800' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23FFE0B2' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getTextIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%239E9E9E' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23E0E0E0' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getCodeIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23673AB7' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23D1C4E9' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getGenericFileIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%2378909C' d='M42 4H14c-2.2 0-4 1.8-4 4v48c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V16L42 4z'/%3E%3Cpath fill='%23B0BEC5' d='M42 4v12h12L42 4z'/%3E%3C/svg%3E"
    }

    private func getDefaultAppIcon() -> String {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23607D8B' x='8' y='8' width='48' height='48' rx='8'/%3E%3Crect fill='%23455A64' x='16' y='16' width='32' height='32' rx='4'/%3E%3C/svg%3E"
    }

    private func generateImageThumbnail(filePath: String) -> String? {
        if let cached = cache[filePath] {
            return cached
        }

        guard let image = NSImage(contentsOfFile: filePath) else {
            return nil
        }

        let thumbnailSize = NSSize(width: 128, height: 128)
        let aspectRatio = image.size.width / image.size.height
        var targetSize = thumbnailSize

        if aspectRatio > 1 {
            targetSize.height = thumbnailSize.width / aspectRatio
        } else {
            targetSize.width = thumbnailSize.height * aspectRatio
        }

        let thumbnail = NSImage(size: thumbnailSize)
        thumbnail.lockFocus()

        NSColor(white: 0.1, alpha: 1.0).setFill()
        NSRect(origin: .zero, size: thumbnailSize).fill()

        let x = (thumbnailSize.width - targetSize.width) / 2
        let y = (thumbnailSize.height - targetSize.height) / 2
        let rect = NSRect(x: x, y: y, width: targetSize.width, height: targetSize.height)

        image.draw(in: rect, from: .zero, operation: .copy, fraction: 1.0)
        thumbnail.unlockFocus()

        guard let tiffData = thumbnail.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let jpegData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.7]) else {
            return nil
        }

        let base64 = jpegData.base64EncodedString()
        let result = "data:image/jpeg;base64,\(base64)"
        cache[filePath] = result
        return result
    }

    private func generateVideoThumbnail(filePath: String) -> String? {
        if let cached = cache[filePath] {
            return cached
        }

        let url = URL(fileURLWithPath: filePath)
        let asset = AVAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 128, height: 128)

        let time = CMTime(seconds: 1.0, preferredTimescale: 600)

        guard let cgImage = try? generator.copyCGImage(at: time, actualTime: nil) else {
            return nil
        }

        let thumbnail = NSImage(cgImage: cgImage, size: NSSize(width: 128, height: 128))

        guard let tiffData = thumbnail.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let jpegData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.7]) else {
            return nil
        }

        let base64 = jpegData.base64EncodedString()
        let result = "data:image/jpeg;base64,\(base64)"
        cache[filePath] = result
        return result
    }
}

