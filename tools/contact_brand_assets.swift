// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import AppKit
import Foundation
let directory = CommandLine.arguments[1]
let prefix = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "contact"
let rows = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: directory + "/preview.json"))) as! [[String: Any]]
let columns = 8, pageCount = 64, cellW = 170, cellH = 124
for page in 0..<((rows.count + pageCount - 1) / pageCount) {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: cellW * columns, pixelsHigh: cellH * 8, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor(calibratedWhite: 0.9, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: cellW * columns, height: cellH * 8)).fill()
    for offset in 0..<pageCount {
        let index = page * pageCount + offset
        if index >= rows.count { break }
        let row = rows[index], x = (offset % columns) * cellW, y = (7 - offset / columns) * cellH
        let selected = row["selected"] as? [String: Any]
        if let file = selected?["file"] as? String, let image = NSImage(contentsOfFile: file) {
            image.draw(in: NSRect(x: x + 49, y: y + 43, width: 72, height: 72))
        }
        let name = "\(index + 1). \(row["name"] as! String)"
        let textStyle: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12), .foregroundColor: NSColor.black]
        (name as NSString).draw(in: NSRect(x: x + 5, y: y + 19, width: cellW - 10, height: 24), withAttributes: textStyle)
        let source = selected?["sourceType"] as? String ?? "MISSING"
        (source as NSString).draw(at: NSPoint(x: x + 5, y: y + 5), withAttributes: [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.darkGray])
    }
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: directory + "/\(prefix)-\(page + 1).png"))
}
