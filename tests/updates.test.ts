import assert from "node:assert/strict"
import test from "node:test"
import { compareVersions, freshPackageURL, parseReleaseInfo, checkLatestRelease } from "../到期管家/src/updates.ts"

const release = (version = "2.5.0") => ({
  tag_name: `v${version}`, draft: false, prerelease: false,
  body: "修复与完善", published_at: "2026-09-04T00:00:00Z",
  assets: [{ name: "due-manager.scripting", state: "uploaded", size: 100,
    browser_download_url: `https://github.com/MaroonYS/scripting-due-manager/releases/download/v${version}/due-manager.scripting` }],
})

test("update versions compare numerically and reject malformed releases", () => {
  assert.equal(compareVersions("2.10.0", "2.9.9"), 1)
  assert.equal(compareVersions("v2.5.0", "2.5.0"), 0)
  assert.equal(compareVersions("2.4.2", "2.5.0"), -1)
  for (const version of ["latest", "2.5", "2.5.0-beta", "2.5.-1", "9999999999999999999.0.0"]) {
    assert.throws(() => compareVersions(version, "2.4.2"))
  }
})

test("update package is pinned to the verified stable repo and tag", () => {
  const info = parseReleaseInfo(release())
  assert.equal(info.version, "2.5.0")
  assert.equal(info.notes, "修复与完善")
  const url = freshPackageURL(info, "2.4.2", 100)
  assert.match(url, /\/download\/v2\.5\.0\/due-manager\.scripting\?from=2\.4\.2&t=100$/)
  assert.throws(() => freshPackageURL(info, "2.5.0"), /重复安装或降级/)
  assert.throws(() => freshPackageURL(info, "3.0.0"), /重复安装或降级/)
  assert.throws(() => freshPackageURL({ ...info, packageURL: "https://example.com/file" }, "2.4.2"))
})

test("update response refuses missing packages, drafts and external asset URLs", () => {
  for (const value of [null, {}, { ...release(), draft: true }, { ...release(), prerelease: true },
    { ...release(), assets: [] }, { ...release(), tag_name: "../../main" },
    { ...release(), assets: [{ ...release().assets[0], browser_download_url: "https://evil.invalid/file" }] }]) {
    assert.throws(() => parseReleaseInfo(value))
  }
})

test("failed update checks never silently claim that the current version is latest", async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = (async () => ({ ok: false, status: 403 })) as any
    await assert.rejects(checkLatestRelease(), /限制/)
    globalThis.fetch = (async () => { throw new Error("offline") }) as any
    await assert.rejects(checkLatestRelease(), /offline/)
    globalThis.fetch = (async () => ({ ok: true, json: async () => release() })) as any
    assert.equal((await checkLatestRelease()).version, "2.5.0")
  } finally { globalThis.fetch = original }
})
