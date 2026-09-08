// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
// Deterministic format rendering, not AI drawing or modifying a brand's geometry.

import Foundation
import AppKit
import ImageIO

let input = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: input) as CFURL, nil) else { fatalError("cannot open raster") }
var largest: CGImage?
for index in 0..<CGImageSourceGetCount(source) {
    guard let image = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
    if largest == nil || image.width * image.height > largest!.width * largest!.height { largest = image }
}
guard let image = largest, image.width > 0, image.height > 0, image.width <= 8192, image.height <= 8192 else { fatalError("invalid raster") }
let colorSpace = CGColorSpaceCreateDeviceRGB()
let inspect = CGContext(data: nil, width: 32, height: 32, bitsPerComponent: 8, bytesPerRow: 32 * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
inspect.draw(image, in: CGRect(x: 0, y: 0, width: 32, height: 32))
let pixels = inspect.data!.assumingMemoryBound(to: UInt8.self)
var opaque = 0, visible = 0, luma = 0.0
for i in 0..<1024 {
    let a = Double(pixels[i * 4 + 3])
    if a > 240 { opaque += 1 }
    if a > 50 {
        visible += 1
        luma += (0.2126 * Double(pixels[i * 4]) + 0.7152 * Double(pixels[i * 4 + 1]) + 0.0722 * Double(pixels[i * 4 + 2])) / a
    }
}
guard visible >= 5 else { fatalError("empty/transparent raster") }
let dark = opaque < 970 && luma / Double(visible) > 0.72
let size = 144
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.setFillColor(CGColor(gray: dark ? 0.12 : 1.0, alpha: 1.0))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
let bound = 120.0
let scale = min(bound / Double(image.width), bound / Double(image.height))
let width = Double(image.width) * scale, height = Double(image.height) * scale
ctx.interpolationQuality = .high
ctx.draw(image, in: CGRect(x: (144 - width) / 2, y: (144 - height) / 2, width: width, height: height))
guard let rendered = ctx.makeImage(), let data = NSBitmapImageRep(cgImage: rendered).representation(using: .png, properties: [:]) else { fatalError("cannot encode PNG") }
try data.write(to: URL(fileURLWithPath: output))
let info: [String: Any] = ["width": image.width, "height": image.height, "background": dark ? "#1F1F1F" : "#FFFFFF", "outputSize": size]
print(String(data: try JSONSerialization.data(withJSONObject: info, options: [.sortedKeys]), encoding: .utf8)!)
