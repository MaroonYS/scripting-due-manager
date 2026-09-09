// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Button, HStack, Image, LazyVGrid, Link, List, Navigation, NavigationLink, Picker, RoundedRectangle, Script, Section, SecureField, Spacer, Text, TextField, VStack, ZStack, useEffect, useState } from "scripting"
import { artworkByID } from "./artwork_catalog"
import { loadArtworkPage } from "./artwork_assets"
import type { LoadedArtwork } from "./artwork_assets"
import { ArtworkImage } from "./artwork_image"
import { ICONS8_STYLES, searchOnlineArtwork } from "./online_artwork"
import type { Icons8Style, OnlineArtworkPage } from "./online_artwork"
import { onlineArtworkLabel } from "./online_artwork_ids"
import type { OnlineArtworkProvider } from "./online_artwork_ids"
import { iconKeychainAvailable, readIcons8Key, removeIcons8Key, saveIcons8Key } from "./icon_credentials"
import { recommendIconQueries } from "./icon_recommendations"
import type { ItemKind } from "./types"
import { searchGithubArtwork } from "./github_artwork"
import { iconSubscriptions } from "./icon_subscriptions"
import { IconSubscriptionsView } from "./icon_subscriptions_view"
import { loadState } from "./storage"

type SearchProvider = OnlineArtworkProvider | "github"
interface SearchRequest { provider: SearchProvider; query: string; page: number; style: Icons8Style; sequence: number; refresh?: boolean }

export function ArtworkBrowser({ selectedID = null, onSelected, itemTitle = "", itemKind = "custom" }: {
  selectedID?: string | null; onSelected?: (id: string) => void; itemTitle?: string; itemKind?: ItemKind | "reminder"
}) {
  const dismiss = Navigation.useDismiss()
  const [recommendation] = useState(() => recommendIconQueries(itemTitle, itemKind))
  const initialProvider: SearchProvider = itemTitle && !recommendation.brand ? "fluent" : "github"
  const [sources, setSources] = useState(() => iconSubscriptions(loadState().settings))
  const [visibleView, setVisibleView] = useState(false)
  const [provider, setProvider] = useState<SearchProvider>(initialProvider)
  const [query, setQuery] = useState(itemTitle ? recommendation[initialProvider] : "")
  const [style, setStyle] = useState<Icons8Style>("全部风格")
  const [automatic, setAutomatic] = useState(Boolean(itemTitle))
  const [request, setRequest] = useState<SearchRequest | null>(() => itemTitle ? { provider: initialProvider, query: recommendation[initialProvider], page: 0, style: "全部风格", sequence: 1 } : null)
  const [gate] = useState(() => ({ sequence: 1, selected: false }))
  const [result, setResult] = useState<{ key: string; value: OnlineArtworkPage | null; error: string | null }>({ key: "", value: null, error: null })
  const [previewID, setPreviewID] = useState<string | null>(selectedID)
  const [loaded, setLoaded] = useState<{ key: string; images: Record<string, LoadedArtwork>; complete: boolean }>({ key: "", images: {}, complete: false })
  const [keyText, setKeyText] = useState("")
  const [hasKey, setHasKey] = useState(() => readIcons8Key() != null)
  const [keyMessage, setKeyMessage] = useState<string | null>(null)
  const requestKey = request ? JSON.stringify([request, request.provider === "github" ? sources : null]) : ""
  const currentResult = result.key === requestKey ? result : null
  const page = currentResult?.value
  const loading = request != null && !currentResult
  const visible = page?.icons ?? []
  const pageKey = requestKey + ":" + visible.map(icon => icon.id).join(",")
  const images = loaded.key === pageKey ? loaded.images : {}

  useEffect(() => {
    let active = true
    setLoaded({ key: "", images: {}, complete: false })
    if (!visibleView) { setResult({ key: "", value: null, error: null }); return }
    if (!request) { setResult({ key: "", value: null, error: null }); return }
    const promise = request.provider === "github" ? searchGithubArtwork(request.query, request.page, sources, { refresh: request.refresh, shouldContinue: () => active })
      : searchOnlineArtwork(request.provider, request.query, request.page, request.style)
    void promise.then(value => {
      if (active) setResult({ key: requestKey, value, error: null })
    }).catch(error => {
      if (active) setResult({ key: requestKey, value: null, error: error instanceof Error ? error.message : "在线搜索失败，请重试。" })
    })
    return () => { active = false }
  }, [requestKey, visibleView])
  useEffect(() => {
    let active = true
    if (!visibleView || !visible.length) return
    void loadArtworkPage(visible.map(icon => icon.id), Script.directory, {
      shouldContinue: () => active,
      onImage: (id, image) => {
        if (active) setLoaded(previous => ({ key: pageKey, complete: false, images: { ...(previous.key === pageKey ? previous.images : {}), [id]: image } }))
      },
    }).then(images => {
      if (active) setLoaded({ key: pageKey, images, complete: true })
    }).catch(() => { if (active) setLoaded({ key: pageKey, images: {}, complete: true }) })
    return () => { active = false }
  }, [pageKey, visibleView])

  const search = (nextPage = 0, nextProvider = provider, nextQuery = query, nextStyle = style, refresh = false) => {
    setRequest({ provider: nextProvider, query: nextQuery, page: nextPage, style: nextStyle, sequence: ++gate.sequence, refresh })
  }
  const previewLabel = visible.find(icon => icon.id === previewID)?.label ?? artworkByID(previewID)?.label ?? onlineArtworkLabel(previewID)
  const changeKey = (remove = false) => {
    try {
      if (remove) removeIcons8Key(); else saveIcons8Key(keyText)
      setKeyText(""); setHasKey(readIcons8Key() != null)
      setKeyMessage(remove ? "已清除本机 Icons8 API Key。" : "已安全保存到本机钥匙串。")
      if (provider === "icons8") setRequest(null)
    } catch (error) { setKeyMessage(error instanceof Error ? error.message : "密钥配置失败，请重试。") }
  }

  return <List listStyle="insetGroup" navigationTitle={onSelected ? "在线选择图标" : "在线图标图库"} navigationBarTitleDisplayMode="inline"
    onAppear={() => { gate.selected = false; setVisibleView(true) }} onDisappear={() => { setVisibleView(false); setKeyText("") }}>
    <Section footer={<Text>{onSelected ? "只为当前事项选择；返回编辑页保存后生效。" : "此页只预览，不改变事项。"} {provider === "github" ? "在线更新清单，本机按名称搜索，图片按需联网；搜索词不会发送到 GitHub。" : "搜索词会发送至所选图库，不自动发送备注、金额或日期。"} 原有图标选择继续保留。</Text>}>
      <Picker title="在线图库" value={provider} pickerStyle="menu" onChanged={(value: unknown) => {
        if (value !== "fluent" && value !== "icons8" && value !== "github") return
        setProvider(value); setRequest(null)
        const term = automatic && itemTitle ? recommendation[value] : query
        setQuery(term)
        if (term.trim() || value === "github") search(0, value, term)
      }}>
        <Text tag="github">GitHub 订阅 · 应用与品牌（默认）</Text>
        <Text tag="fluent">Fluent Emoji Flat · 通用事项</Text>
        <Text tag="icons8">Icons8 · 可选补充／需 API Key</Text>
      </Picker>
      {provider === "github" ? <NavigationLink destination={<IconSubscriptionsView onSaved={next => {
          setSources(next); setRequest(null)
        }} />}><Text>管理 GitHub 图库订阅</Text></NavigationLink> : null}
      {provider === "github" ? <Text font="caption" foregroundStyle="secondaryLabel">已启用 {sources.filter(source => source.enabled).length} 个图库 · 清单在本次会话缓存 15 分钟</Text> : null}
      {provider === "github" ? <Button title="立即更新清单并搜索" disabled={loading} action={() => search(0, provider, query, style, true)} /> : null}
      {provider === "icons8" ? <Picker title="Icons8 风格" value={style} pickerStyle="menu" onChanged={(value: unknown) => {
        if (typeof value !== "string" || !ICONS8_STYLES.includes(value as Icons8Style)) return
        setStyle(value as Icons8Style); setRequest(null)
        if (query.trim()) search(0, provider, query, value as Icons8Style)
      }}>
        {ICONS8_STYLES.map(name => <Text key={name} tag={name}>{name}</Text>)}
      </Picker> : null}
      <TextField title="搜索词" value={query} prompt={provider === "fluent" ? "英文关键词，如 clock、card、book" : "应用名称或中英文关键词"}
        onChanged={(value: string) => { setQuery(value); setAutomatic(false); setRequest(null) }} />
      <Button title={loading ? "正在在线搜索…" : "在线搜索"} systemImage="magnifyingglass" disabled={loading || provider !== "github" && !query.trim()} action={() => search()} />
      {itemTitle ? <VStack alignment="leading" spacing={5}>
        <Button title="按事项名称推荐" systemImage="sparkles" action={() => {
          const recommendedProvider = provider === "github" && !recommendation.brand ? "fluent" : provider
          setAutomatic(true); setProvider(recommendedProvider); setQuery(recommendation[recommendedProvider]); search(0, recommendedProvider, recommendation[recommendedProvider])
        }} />
        <Text font="caption" foregroundStyle="secondaryLabel">{recommendation.reason}。仅提取本机词表中的品牌／类别关键词，推荐不会自动覆盖已选图标。</Text>
      </VStack> : null}
      {previewLabel ? <HStack spacing={10}><Text foregroundStyle="secondaryLabel">当前选择</Text><Spacer /><Text lineLimit={2}>{previewLabel}</Text></HStack> : null}
    </Section>

    <Section header={<Text>{loading ? "正在获取在线结果" : page ? `${visible.length} 个结果 · 第 ${page.page + 1} 页` : "在线搜索结果"}</Text>}>
      {page?.warnings?.map((warning, index) => <Text key={index} font="caption" foregroundStyle="secondaryLabel">{warning}</Text>)}
      {currentResult?.error ? <Text foregroundStyle="secondaryLabel">{currentResult.error}</Text> : visible.length ?
        <LazyVGrid columns={[{ size: { type: "adaptive", min: 74, max: 115 }, spacing: 8 }]} spacing={8} padding={{ vertical: 6 }}>
          {visible.map(icon => {
            const selected = icon.id === previewID, image = images[icon.id]
            return <Button key={icon.id} buttonStyle="plain" disabled={onSelected != null && !image} action={() => {
              if (onSelected && !image) return
              if (onSelected && gate.selected) return
              if (onSelected) gate.selected = true
              setPreviewID(icon.id)
              if (onSelected) { onSelected(icon.id); dismiss() }
            }}>
              <ZStack frame={{ maxWidth: "infinity", height: 112 }} contentShape="rect">
                <RoundedRectangle cornerRadius={12}
                  fill={selected ? { light: "#E8F2FF", dark: "#17334F" } : "secondarySystemGroupedBackground"}
                  stroke={selected ? { shapeStyle: "systemBlue", strokeStyle: { lineWidth: 1.5 } } : undefined} />
                <VStack spacing={5} padding={7} frame={{ maxWidth: "infinity" }}>
                  {image ? <ArtworkImage image={image} size={32} /> : <Image systemName={loaded.key === pageKey && loaded.complete ? "photo.badge.exclamationmark" : "photo"} foregroundStyle="tertiaryLabel" frame={{ width: 32, height: 32 }} />}
                  <Text font={11} foregroundStyle="label" lineLimit={2} minScaleFactor={0.8} multilineTextAlignment="center" frame={{ maxWidth: "infinity", height: 29 }}>{icon.label}</Text>
                  <Text font={9} foregroundStyle="secondaryLabel" lineLimit={1}>{icon.detail}</Text>
                </VStack>
              </ZStack>
            </Button>
          })}
        </LazyVGrid> : <Text foregroundStyle="secondaryLabel">{loading ? "请稍候…" : page ? "未找到匹配图标。应用可试英文品牌名或更新订阅；房租、证件等通用事项可切换 Fluent。" : "输入关键词后搜索；GitHub 留空可浏览全部，从事项进入时自动推荐。"}</Text>}
    </Section>
    {visible.length > 0 && loaded.key === pageKey && loaded.complete && Object.keys(images).length < visible.length ? <Section>
      <Text font="caption" foregroundStyle="secondaryLabel">部分图片未能加载，可能是网络、图库权限或额度问题。图片成功显示后才可选择；原有事项及图标不会改变。</Text>
      <Button title="重试当前页" action={() => search(page?.page ?? 0)} />
    </Section> : null}
    {page && (page.page > 0 || page.hasMore) ? <Section><HStack>
      <Button title="上一页" systemImage="chevron.left" disabled={loading || page.page === 0} action={() => search(page.page - 1)} />
      <Spacer /><Text font="caption" foregroundStyle="secondaryLabel">{page.page + 1}</Text><Spacer />
      <Button title="下一页" systemImage="chevron.right" disabled={loading || !page.hasMore} action={() => search(page.page + 1)} />
    </HStack></Section> : null}

    {provider === "icons8" ? <Section header={<Text>Icons8 安全配置</Text>} footer={<Text>API Key 只保存在本机钥匙串，不进入备份、脚本包或公开仓库。API 权限与费用由 Icons8 提供；图片实时加载，不缓存到磁盘。</Text>}>
      <Text font="caption" foregroundStyle="secondaryLabel">{!iconKeychainAvailable() ? "请先更新 Scripting，以启用安全钥匙串。" : hasKey ? "已配置 API Key（不显示原密钥）" : "尚未配置 API Key，Icons8 在线搜索暂不可用。"}</Text>
      <SecureField title="API Key" value={keyText} prompt={hasKey ? "输入新密钥以替换" : "在此输入，不要发送到聊天"} onChanged={setKeyText} />
      <Button title="安全保存 API Key" disabled={!keyText.trim() || !iconKeychainAvailable()} action={() => changeKey()} />
      {hasKey ? <Button title="清除本机 API Key" action={() => changeKey(true)} /> : null}
      {keyMessage ? <Text font="caption" foregroundStyle="secondaryLabel">{keyMessage}</Text> : null}
      <Link url="https://developers.icons8.com/"><Text>前往 Icons8 查看 API 申请与权限</Text></Link>
    </Section> : null}
    <Section footer={<Text>自动适配尺寸、原始比例、留白与深浅色背景，不裁切或重绘图案。联网失败时事项仍可操作，并回退为系统图标。商标归各品牌所有。</Text>}>
      <Link url="https://github.com/sooyaaabo/IconLibrary"><Text>恩秀 App／Emby · sooyaaabo</Text></Link>
      <Link url="https://github.com/selfhst/icons"><Text>Icons by selfh.st/icons · CC BY 4.0</Text></Link>
      <Link url="https://icon-sets.iconify.design/fluent-emoji-flat/"><Text>Fluent Emoji Flat · Microsoft / Iconify · MIT</Text></Link>
      <Link url="https://icons8.com/icons"><Text>Icons8 图库与署名</Text></Link>
    </Section>
  </List>
}
