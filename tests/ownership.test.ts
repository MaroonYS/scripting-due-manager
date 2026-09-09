// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import * as ownership from "../到期管家/src/ownership.ts"
import { LATEST_PACKAGE_URL } from "../到期管家/src/updates.ts"

const root = new URL("../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), "utf8")
const manifest = JSON.parse(read("到期管家/script.json"))

test("distribution includes byte-identical root and bundled licensing notices", () => {
  for (const name of ["LICENSE", "NOTICE.md"]) {
    assert.equal(read(name), read(`到期管家/${name}`))
    assert.ok(read(name).includes(ownership.LICENSE_ID))
    assert.ok(read(name).includes("MaroonYS"))
  }
})

test("every source and test file retains copyright and restrictive license identifiers", () => {
  const files = (path: string): string[] => readdirSync(new URL(path, root), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)])
  const sources = [...files("到期管家"), ...files("tests")].filter(path => /\.(tsx?|mjs)$/.test(path))
  assert.ok(sources.length > 30)
  for (const path of sources) {
    const firstLines = read(path).split("\n").slice(0, 4).join("\n")
    assert.ok(firstLines.includes("SPDX-FileCopyrightText: 2026 MaroonYS"), path)
    assert.ok(firstLines.includes(`SPDX-License-Identifier: ${ownership.LICENSE_ID}`), path)
  }
})

test("official runtime and host update addresses retain the original fixed endpoint", () => {
  const expected = "https://github.com/MaroonYS/scripting-due-manager/releases/latest/download/due-manager.scripting"
  assert.equal(manifest.remoteResource.url, expected)
  assert.equal(LATEST_PACKAGE_URL, expected)
  assert.equal(ownership.OFFICIAL_RELEASES_URL, "https://github.com/MaroonYS/scripting-due-manager/releases")
})

test("notice links are pinned to the installed version and reject malformed paths", () => {
  assert.equal(ownership.releaseNoticeURL("2.5.9", "LICENSE"),
    "https://github.com/MaroonYS/scripting-due-manager/blob/v2.5.9/LICENSE")
  assert.equal(ownership.releaseNoticeURL("2.5.10", "NOTICE.md"),
    "https://github.com/MaroonYS/scripting-due-manager/blob/v2.5.10/NOTICE.md")
  for (const version of ["", "v2.5.9", "2.5.9/../../main", "2.5.9?x=1", " 2.5.9", "2.5.9\n"]) {
    assert.equal(ownership.releaseNoticeURL(version, "LICENSE"), null, JSON.stringify(version))
  }
})

type Element = { type: string; props: Record<string, unknown>; children: unknown[] }
function renderOwnership(version: string) {
  // Execute the actual view without a native UI or granting storage/network access.
  const source = read("到期管家/src/ownership_view.tsx").split("export function OwnershipView")[1]
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: {
    compilerOptions: { jsx: "react", jsxFactory: "h" },
  } }).transformSync(`function OwnershipView${source}`)
  const denied = () => { throw new Error("Ownership view must not perform storage or network operations") }
  const bindings = {
    ...ownership,
    h: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({ type, props: props ?? {}, children }),
    Script: { metadata: { version } },
    LabeledContent: "LabeledContent", Link: "Link", List: "List", Section: "Section", Text: "Text",
    fetch: denied, Storage: new Proxy({}, { get: () => denied }), Safari: { openURL: denied },
  }
  const view = new Function(...Object.keys(bindings), `${compiled}\nreturn OwnershipView()`)(...Object.values(bindings))
  const nodes: Element[] = []
  const texts: string[] = []
  const visit = (node: unknown) => {
    if (typeof node === "string") { texts.push(node); return }
    if (!node || typeof node !== "object" || !("type" in node)) return
    const element = node as Element
    nodes.push(element)
    element.children.forEach(visit)
    visit(element.props.header)
    visit(element.props.footer)
  }
  visit(view)
  return { nodes, texts }
}

test("copyright view renders restrictions, exceptions and origin links without side effects", () => {
  const { nodes, texts } = renderOwnership(manifest.version)
  assert.ok(texts.includes(ownership.COPYRIGHT_NOTICE))
  assert.ok(texts.includes(ownership.PERSONAL_USE_NOTICE))
  assert.ok(texts.includes(ownership.REUSE_RESTRICTION_NOTICE))
  assert.ok(texts.includes(ownership.RIGHTS_EXCEPTION_NOTICE))
  assert.ok(texts.some(text => text.includes("不联网验证本机代码")))
  assert.deepEqual(nodes.filter(node => node.type === "Link").map(node => node.props.url), [
    ownership.releaseNoticeURL(manifest.version, "LICENSE"),
    ownership.releaseNoticeURL(manifest.version, "NOTICE.md"),
    "https://github.com/sooyaaabo/IconLibrary", "https://github.com/selfhst/icons", "https://creativecommons.org/licenses/by/4.0/",
    ownership.OFFICIAL_REPOSITORY_URL, ownership.OFFICIAL_RELEASES_URL,
  ])
})

test("malformed installed versions still show offline restrictions without unsafe links", () => {
  const { nodes, texts } = renderOwnership("../../main")
  assert.ok(texts.includes(ownership.REUSE_RESTRICTION_NOTICE))
  assert.deepEqual(nodes.filter(node => node.type === "Link").map(node => node.props.url),
    ["https://github.com/sooyaaabo/IconLibrary", "https://github.com/selfhst/icons", "https://creativecommons.org/licenses/by/4.0/", ownership.OFFICIAL_REPOSITORY_URL, ownership.OFFICIAL_RELEASES_URL])
})

test("main app exposes copyright navigation without adding ownership UI to widgets", () => {
  assert.ok(read("到期管家/src/app.tsx").includes('destination={<OwnershipView />}'))
  for (const path of ["到期管家/widget.tsx", "到期管家/src/widget_view.tsx"]) {
    assert.ok(!read(path).includes("OwnershipView"), path)
  }
})

test("release workflow gates official origin and requires notices, checksum and provenance", () => {
  const workflow = read(".github/workflows/publish-release.yml")
  assert.ok(workflow.includes("github.repository == 'MaroonYS/scripting-due-manager'"))
  assert.ok(workflow.includes("github.ref == 'refs/heads/main'"))
  assert.ok(workflow.includes('cmp LICENSE "$package_check_dir/LICENSE"'))
  assert.ok(workflow.includes('cmp NOTICE.md "$package_check_dir/NOTICE.md"'))
  assert.ok(workflow.includes('sha256sum --check SHA256SUMS'))
  assert.ok(workflow.includes('gh attestation verify due-manager.scripting'))
  assert.ok(workflow.includes('--source-digest "$GITHUB_SHA"'))
  assert.ok(workflow.includes('gh release create "$RELEASE_TAG" due-manager.scripting SHA256SUMS'))
  assert.ok(workflow.indexOf("gh attestation verify") < workflow.indexOf("gh release create"))
  for (const match of workflow.matchAll(/uses: ([^\s]+)@([^\s]+)/g)) {
    assert.match(match[2], /^[a-f0-9]{40}$/, match[1])
  }
})
