// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
// Native macOS SwiftUI reference; does not claim iPhone WidgetKit tap verification.
import SwiftUI
import AppKit

struct BrandControl: View {
    let directory: String
    let file: String
    let name: String
    let size: CGFloat
    var contentScale: CGFloat { file.hasPrefix("brand-") ? 1.2 : 1 }
    var body: some View {
        Button {} label: {
            ZStack {
                Label("完成事项：\(name)", systemImage: "checkmark.circle")
                    .labelStyle(.iconOnly).foregroundStyle(.clear)
                VStack(spacing: 0) {
                    Image(nsImage: NSImage(contentsOfFile: "\(directory)/\(file)")!)
                        .resizable().renderingMode(.original).scaledToFit()
                        .frame(width: size * contentScale, height: size * contentScale)
                }.frame(width: size, height: size).clipShape(Circle())
            }.frame(width: 40, height: 40).contentShape(Rectangle())
        }.buttonStyle(.plain).frame(width: 40, height: 40).contentShape(Rectangle())
    }
}

struct ControlPanel: View {
    let directory: String
    let dark: Bool
    let rows = [
        ("招商银行", "brand-3e87bc0a97f15971.png"),
        ("Ultra Mobile", "brand-f2b81d85a1003c1d.png"),
        ("Spotify", "brand-7005c0064bda4edb.png"),
        ("Telegram", "telegram.png"),
    ]
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(dark ? "Dark · circular brand buttons" : "Light · circular brand buttons").font(.headline)
            ForEach(rows, id: \.0) { row in
                HStack(spacing: 12) {
                    Image(nsImage: NSImage(contentsOfFile: "\(directory)/\(row.1)")!)
                        .resizable().scaledToFit().frame(width: 24, height: 24)
                    Text("→").font(.caption).foregroundStyle(.secondary)
                    BrandControl(directory: directory, file: row.1, name: row.0, size: 24)
                    Text(row.0).font(.system(size: 15, weight: .semibold))
                    Spacer()
                }
            }
            HStack(spacing: 12) {
                Spacer().frame(width: 48)
                BrandControl(directory: directory, file: dark ? "safepal-light.png" : "safepal-dark.png", name: "SafePal", size: 20)
                Text("SafePal · 20 pt mark").font(.system(size: 15, weight: .semibold))
                Spacer()
            }
            Text("Original square → circular label inside 40 pt target").font(.system(size: 10)).foregroundStyle(.secondary)
        }.padding(20).frame(width: 380)
            .foregroundStyle(dark ? Color.white : Color.black)
            .background(dark ? Color(red: 0.11, green: 0.11, blue: 0.12) : Color(red: 0.95, green: 0.95, blue: 0.97))
            .environment(\.colorScheme, dark ? .dark : .light)
    }
}

@main struct Render {
    @MainActor static func main() throws {
        guard CommandLine.arguments.count == 3 else { fatalError("usage: render <asset directory> <output.png>") }
        let renderer = ImageRenderer(content: HStack(spacing: 0) {
            ControlPanel(directory: CommandLine.arguments[1], dark: false)
            ControlPanel(directory: CommandLine.arguments[1], dark: true)
        })
        renderer.scale = 3
        guard let image = renderer.cgImage else { fatalError("No rendered image") }
        let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
        try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        print("Rendered native SwiftUI button-label reference")
    }
}
