import Foundation
import XMTP

final class SharedAttachmentStorage {
    static let shared = SharedAttachmentStorage()
    
    // NEVER CHANGE THIS PREFIX - must match React Native app
    private static let SHARED_ATTACHMENT_PREFIX = "SHARED_ATTACHMENT_"
    
    private init() {}
    
    private struct SharedAttachmentMetadata: Codable {
        let filename: String
        let mimeType: String?
        let imageSize: ImageSize?
        let mediaType: String
        let mediaURL: String
        let contentLength: Int
        let storedAt: Int64
        let messageId: String
        
        struct ImageSize: Codable {
            let width: Int
            let height: Int
        }
    }
    
    private func getSharedAttachmentDirectory() -> URL? {
        let groupId = Bundle.appGroupIdentifier()
        guard let groupUrl = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: groupId
        ) else {
            return nil
        }
        
        let attachmentDir = groupUrl.appendingPathComponent("attachments")
        
        // Ensure directory exists
        do {
            try FileManager.default.createDirectory(
                at: attachmentDir,
                withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.none]
            )
        } catch {
            return nil
        }
        
        return attachmentDir
    }
    
    func storeRemoteAttachment(
        messageId: String,
        remoteAttachment: RemoteAttachment
    ) async {
        guard let filename = remoteAttachment.filename,
              let sharedDir = getSharedAttachmentDirectory() else {
            return
        }
        
        let metadataFileName = "\(Self.SHARED_ATTACHMENT_PREFIX)\(messageId).json"
        let attachmentFileName = "\(Self.SHARED_ATTACHMENT_PREFIX)\(messageId)_\(filename)"
        
        let metadataPath = sharedDir.appendingPathComponent(metadataFileName)
        let attachmentPath = sharedDir.appendingPathComponent(attachmentFileName)
        
        do {
            // Get the decoded content using the RemoteAttachment's content() method
            let encodedContent = try await remoteAttachment.content()
            let attachment: Attachment = try encodedContent.decoded()
            
            // Write decrypted file
            try attachment.data.write(to: attachmentPath)
            
            // Determine media type and get image size if applicable
            let mimeType = getMimeTypeFromFilename(filename)
            let isImage = isImageMimeType(mimeType)
            let imageSize = isImage ? getImageSize(from: attachmentPath) : nil
            
            // Create metadata
            let metadata = SharedAttachmentMetadata(
                filename: filename,
                mimeType: mimeType,
                imageSize: imageSize,
                mediaType: isImage ? "IMAGE" : "UNSUPPORTED",
                mediaURL: "file://\(attachmentPath.path)",
                contentLength: attachment.data.count,
                storedAt: Int64(Date().timeIntervalSince1970 * 1000),
                messageId: messageId
            )
            
            // Save metadata
            let metadataData = try JSONEncoder().encode(metadata)
            try metadataData.write(to: metadataPath)
            
        } catch {
            // Cleanup on failure
            try? FileManager.default.removeItem(at: attachmentPath)
            try? FileManager.default.removeItem(at: metadataPath)
        }
    }
    
    private func getMimeTypeFromFilename(_ filename: String) -> String? {
        let pathExtension = (filename as NSString).pathExtension.lowercased()
        
        switch pathExtension {
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "mp4":
            return "video/mp4"
        case "mov":
            return "video/quicktime"
        case "pdf":
            return "application/pdf"
        default:
            return nil
        }
    }
    
    private func isImageMimeType(_ mimeType: String?) -> Bool {
        guard let mimeType = mimeType else { return false }
        return mimeType.hasPrefix("image/")
    }
    
    private func getImageSize(from url: URL) -> SharedAttachmentMetadata.ImageSize? {
        guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
              let imageProperties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
              let width = imageProperties[kCGImagePropertyPixelWidth] as? Int,
              let height = imageProperties[kCGImagePropertyPixelHeight] as? Int else {
            return nil
        }
        
        return SharedAttachmentMetadata.ImageSize(width: width, height: height)
    }
} 