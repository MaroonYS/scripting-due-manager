// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
// Native macOS image decoding and 40 pt layout reference, not iPhone WidgetKit QA.
import AppKit
import ImageIO
import Foundation
let root = CommandLine.arguments[1], output = CommandLine.arguments[2]
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: root + "/assets/brands/manifest.json"))) as! [String: Any]
let rows = manifest["assets"] as! [[String: Any]]
var images: [String: NSImage] = [:]
for row in rows {
    for file in row["outputs"] as! [[String: Any]] {
        let path = file["path"] as! String
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: root + "/" + path) as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil), image.width >= 144, image.height >= 144 else {
            fatalError("Cannot decode bundled PNG: \(path)")
        }
        images[path] = NSImage(cgImage: image, size: NSSize(width: image.width, height: image.height))
    }
}
let columns = 8, perPage = 64, cellW = 170, cellH = 104
for page in 0..<((rows.count + perPage - 1) / perPage) {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: cellW * columns * 2, pixelsHigh: cellH * 8 * 2,
                                 bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                 colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.current = context
    context.cgContext.scaleBy(x: 2, y: 2)
    NSColor(calibratedWhite: 0.9, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: cellW * columns, height: cellH * 8)).fill()
    for offset in 0..<perPage {
        let index = page * perPage + offset
        if index >= rows.count { break }
        let row = rows[index], files = row["outputs"] as! [[String: Any]]
        let x = Double((offset % columns) * cellW), y = Double((7 - offset / columns) * cellH)
        let size = row["name"] as! String == "SafePal / Fiat24" ? 20.0 : 24.0
        for dark in [false, true] {
            let left = x + (dark ? 94.0 : 30.0), bottom = y + 44.0
            NSColor(calibratedWhite: dark ? 0.11 : 0.98, alpha: 1).setFill()
            NSBezierPath(roundedRect: NSRect(x: left, y: bottom, width: 40, height: 40), xRadius: 6, yRadius: 6).fill()
            let path = files[dark && files.count == 2 ? 1 : 0]["path"] as! String
            images[path]!.draw(in: NSRect(x: left + (40-size)/2, y: bottom + (40-size)/2, width: size, height: size))
        }
        let name = "\(index + 1). \(row["name"] as! String)"
        (name as NSString).draw(in: NSRect(x: x + 4, y: y + 6, width: 162, height: 32), withAttributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.black])
    }
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output + "/bundled-light-dark-\(page+1).png"))
}
print("Decoded \(images.count) PNG files for \(rows.count) brands; rendered light/dark 40 pt reference slots")
