// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
// macOS SwiftUI reference only; not an iPhone WidgetKit or Scripting screenshot.

import SwiftUI
import AppKit

struct CompletionReference: View {
    let directory: String
    let dark: Bool
    let name: String
    let file: String?
    let markSize: CGFloat
    var body: some View {
        HStack(spacing: 10) {
            Button {} label: {
                Label("Complete: \(name)", systemImage: "creditcard.fill")
                    .labelStyle(.iconOnly)
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())
            .font(.system(size: 17))
            .foregroundStyle(file == nil ? Color.orange : Color.clear)
            .symbolRenderingMode(.hierarchical)
            .frame(width: 40, height: 40)
            .background(alignment: .center) {
                if let file, let image = NSImage(contentsOfFile: "\(directory)/\(file)") {
                    Image(nsImage: image).resizable().renderingMode(.original)
                        .scaledToFit().frame(width: markSize, height: markSize)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 16, weight: .semibold))
                Text(file == nil ? "System fallback · completes item" : "Official mark · completes item")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

struct ReferencePanel: View {
    let directory: String
    let dark: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(dark ? "Dark appearance" : "Light appearance").font(.headline)
            CompletionReference(directory: directory, dark: dark, name: "SafePal 月费", file: dark ? "safepal-light.png" : "safepal-dark.png", markSize: 20)
            CompletionReference(directory: directory, dark: dark, name: "Telegram Premium", file: "telegram.png", markSize: 24)
            CompletionReference(directory: directory, dark: dark, name: "其他品牌／缺失素材", file: nil, markSize: 17)
            Text("40 pt target · 20 / 24 pt marks").font(.system(size: 11)).foregroundStyle(.secondary)
        }
        .padding(20).frame(width: 330)
        .foregroundStyle(dark ? Color.white : Color.black)
        .background(dark ? Color(red: 0.11, green: 0.11, blue: 0.12) : Color(red: 0.95, green: 0.95, blue: 0.97))
        .environment(\.colorScheme, dark ? .dark : .light)
    }
}

@main struct Render {
    @MainActor static func main() throws {
        guard CommandLine.arguments.count == 3 else { fatalError("usage: render <asset directory> <output.png>") }
        let renderer = ImageRenderer(content: HStack(spacing: 0) {
            ReferencePanel(directory: CommandLine.arguments[1], dark: false)
            ReferencePanel(directory: CommandLine.arguments[1], dark: true)
        })
        renderer.scale = 3
        guard let image = renderer.cgImage else { fatalError("No rendered image") }
        let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
        try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        print("Rendered reference: \(CommandLine.arguments[2])")
    }
}
