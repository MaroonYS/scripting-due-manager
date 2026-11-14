// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import {
  Button,
  HStack,
  Image,
  Link,
  Script,
  Spacer,
  Text,
  VStack,
  Widget,
} from "scripting"
import { CompleteDueItemIntent } from "../app_intents"
import { DueSymbol, DueSymbolLabel } from "./due_symbol"
import { dueStatus, localDateKey } from "./date"
import { dueIconLabel } from "./icons"
import type { DisplayDueItem } from "./types"
import {
  currentWidgetLocale,
  formatWidgetDate,
  formatWidgetItemTime,
  formatWidgetLastSync,
  formatWidgetWeekday,
  localizeWidgetActionError,
  widgetCompletionLabel,
  widgetItemDateKey,
  widgetLanguage,
  widgetText,
} from "./widget_localization"
import {
  agendaWidgetLayout,
  smallWidgetLayout,
  widgetTitleFitsOneLine,
  type AgendaWidgetLayout,
  type HomeWidgetFamily,
  type SmallWidgetLayout,
} from "./widget_layout"

type WidgetDataProps = {
  items: DisplayDueItem[]
  completionGeneration: number
  reminderFetchedAt: number | null
  remindersLive: boolean
  remindersFromCache: boolean
  remindersEnabled: boolean
  reminderError: string | null
  interactionError: string | null
}

type WidgetIssue = {
  text: string
  compactText: string
  statusText: string
  color: string
  url: string
}

// Read after the entry point configures the explicitly imported Device API.
// This avoids freezing the host process locale during module initialization.
function widgetRuntimeLocale(): string { return currentWidgetLocale() }
function widgetRuntimeLanguage() { return widgetLanguage(widgetRuntimeLocale()) }

// Animation and Transition are Scripting runtime globals (like Storage), not
// named exports. A persisted generation drives one WidgetKit timeline diff.
declare const Transition: any
const {
  animation: COMPLETION_QUEUE_ANIMATION,
  transition: QUEUE_SLOT_TRANSITION,
} = completionMotion()

function completionMotion(): { animation?: any; transition?: any } {
  // Cosmetic timeline differences must not make valid items or their controls
  // unavailable on a host without these animation APIs. No JS timer or extra
  // timeline entry is needed: WidgetKit animates its old and new native views.
  try {
    if (typeof Animation === "undefined" || typeof Transition === "undefined") return {}
    return {
      animation: Animation.smooth({ duration: 0.46, extraBounce: 0 }),
      transition: Transition.asymmetric(
        Transition.opacity().animation(Animation.easeIn(0.32).delay(0.08)),
        Transition.opacity().animation(Animation.easeOut(0.46)),
      ),
    }
  } catch {
    return {}
  }
}

export function DueManagerWidget(props: WidgetDataProps) {
  const displaySize = Widget.displaySize
  const displayHeight = displaySize?.height
  const displayWidth = displaySize?.width
  const family = Widget.family
  if (family === "systemSmall") {
    return <SmallWidget {...props} displayWidth={displayWidth} displayHeight={displayHeight} />
  }
  if (family === "systemMedium" || family === "systemLarge" || family === "systemExtraLargePortrait") {
    return <AgendaWidget {...props} family={family} displayWidth={displayWidth} displayHeight={displayHeight} />
  }
  return <AccessoryFallback items={props.items} />
}

function WidgetHeader({
  item,
  issue,
  height,
  locale,
  now,
}: {
  item: DisplayDueItem | undefined
  issue: WidgetIssue | null
  height: number
  locale: string
  now: Date
}) {
  const url = item ? itemURL(item) : Script.createRunURLScheme(Script.name)
  return <HStack spacing={4} frame={{ maxWidth: "infinity", height }}>
    <Link url={url}>
      <HStack
        spacing={4}
        frame={{ maxWidth: "infinity", height, alignment: "leading" }}
        contentShape="rect"
      >
        <Text font={12} fontWeight="semibold" foregroundStyle="label" lineLimit={1} minScaleFactor={0.8}
          frame={{ maxWidth: "infinity", alignment: "leading" }}>
          {item ? dueIconLabel(item.iconName, widgetRuntimeLanguage()) : widgetText("due", locale)}
        </Text>
        {item ? <Text font={11} fontWeight="semibold" foregroundStyle="secondaryLabel" lineLimit={1}
          layoutPriority={1} minScaleFactor={0.8} monospacedDigit contentTransition="opacity">
          {formatWidgetDate(widgetItemDateKey(item), locale, { now })}
        </Text> : null}
      </HStack>
    </Link>
    {issue ? <Link url={issue.url}>
      <Image systemName="exclamationmark.circle.fill" font={11} foregroundStyle={issue.color}
        frame={{ width: 18, height }} />
    </Link> : null}
  </HStack>
}

function SmallWidget(props: WidgetDataProps & { displayWidth?: number; displayHeight?: number }) {
  const { items, completionGeneration, displayWidth, displayHeight } = props
  const [item, nextItem] = items
  const issue = widgetIssue(props)
  const detail = item ? listItemSupportingText(item) : ""
  const options = {
    hasDetail: !!item && (!!detail || item.includesTime || !!issue),
    hasNext: !!nextItem,
  }
  const compactLayout = smallWidgetLayout(displayWidth, displayHeight, options)
  const titleWidth = compactLayout.contentWidth - compactLayout.hitSize
  const layout = item && compactLayout.titleLines === 2 && !widgetTitleFitsOneLine(item.title, titleWidth * 1.85, 15)
    ? smallWidgetLayout(displayWidth, displayHeight, { ...options, preferThreeLines: true })
    : compactLayout
  const locale = widgetRuntimeLocale()
  const now = new Date()

  return <WidgetFrame contentPadding={layout.padding}>
    <VStack alignment="leading" spacing={layout.gap}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
      {layout.headerHeight > 0 ? <WidgetHeader item={item} issue={issue} height={layout.headerHeight}
        locale={locale} now={now} /> : null}
      <CompletionContent generation={completionGeneration}>
        {item && layout.titleHeight > 0 ? <SmallDueItem item={item} nextItem={nextItem} issue={issue}
          detail={detail} layout={layout} locale={locale} now={now} />
          : <WidgetEmptyContent compact issue={issue} />}
      </CompletionContent>
    </VStack>
  </WidgetFrame>
}

function SmallDueItem({
  item,
  nextItem,
  issue,
  detail,
  layout,
  locale,
  now,
}: {
  item: DisplayDueItem
  nextItem: DisplayDueItem | undefined
  issue: WidgetIssue | null
  detail: string
  layout: SmallWidgetLayout
  locale: string
  now: Date
}) {
  const titleWidth = Math.max(0, layout.contentWidth - layout.hitSize)
  const titleFont = widgetTitleFitsOneLine(item.title, titleWidth, 17) ? 17 : 15
  const titleHeight = Math.max(1, Math.floor(layout.titleHeight / layout.titleLines) - 3)
  const preview = layout.previewHeight > 0 ? nextItem : undefined
  return <VStack key={widgetItemIdentity(item)}
    alignment="leading" spacing={layout.gap}
    contentTransition="opacity" transition={QUEUE_SLOT_TRANSITION}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    <HStack alignment="center" spacing={0}
      frame={{ maxWidth: "infinity", height: layout.titleHeight, alignment: "leading" }}>
      <ListCompletionIcon item={item} hitSize={layout.hitSize} symbolSize={17} />
      <Link url={itemURL(item)}>
        <Text font={Math.min(titleFont, titleHeight)} fontWeight="semibold" lineLimit={layout.titleLines}
          minScaleFactor={0.85} truncationMode="tail" multilineTextAlignment="leading"
          frame={{ maxWidth: "infinity", height: layout.titleHeight, alignment: "leading" }} contentShape="rect">
          {item.title}
        </Text>
      </Link>
    </HStack>
    {/* The footer shares the remaining height; its links occupy only their own bands. */}
    {layout.detailHeight > 0 || preview ? <VStack alignment="leading" spacing={layout.gap}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "bottomLeading" }}>
      {layout.detailHeight > 0 ? <SmallCurrentDetail item={item} detail={detail} issue={issue}
        height={layout.detailHeight} locale={locale} /> : null}
      {preview ? <SmallNextItemPreview item={preview}
        width={layout.contentWidth} height={layout.previewHeight} locale={locale} now={now} /> : null}
    </VStack> : null}
  </VStack>
}

function SmallCurrentDetail({
  item, detail, issue, height, locale,
}: {
  item: DisplayDueItem
  detail: string
  issue: WidgetIssue | null
  height: number
  locale: string
}) {
  const time = formatWidgetItemTime(item, locale)
  const text = issue?.compactText ?? detail
  return <Link url={issue ? issue.url : itemURL(item)}>
    <HStack spacing={5} frame={{ maxWidth: "infinity", height, alignment: "leading" }} contentShape="rect">
      {text ? <Text font={11} foregroundStyle={issue?.color ?? "secondaryLabel"} lineLimit={1}
        minScaleFactor={0.85} truncationMode="middle" allowsTightening
        frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {text}
      </Text> : null}
      {time ? <Text font={11} fontWeight="medium" foregroundStyle="secondaryLabel" lineLimit={1}
        minScaleFactor={0.82} layoutPriority={1} monospacedDigit>{time}</Text> : null}
    </HStack>
  </Link>
}

function SmallNextItemPreview({ item, width, height, locale, now }: {
  item: DisplayDueItem
  width: number
  height: number
  locale: string
  now: Date
}) {
  const date = formatWidgetDate(widgetItemDateKey(item), locale, { now })
  const showDate = widgetTitleFitsOneLine(date, width * 0.39, 10)
  return <Link url={itemURL(item)}>
    <HStack spacing={4} frame={{ maxWidth: "infinity", height, alignment: "leading" }} contentShape="rect">
      <DueSymbol name={item.iconName} color={item.iconColor} size={11} slotSize={13} widget />
      <Text font={11} fontWeight="medium" foregroundStyle="secondaryLabel" lineLimit={1}
        truncationMode="tail" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.title}</Text>
      {showDate ? <Text font={10} foregroundStyle="secondaryLabel" lineLimit={1}
        layoutPriority={1} monospacedDigit>{date}</Text> : null}
    </HStack>
  </Link>
}

type AgendaFamily = Exclude<HomeWidgetFamily, "systemSmall">

function AgendaWidget(props: WidgetDataProps & {
  family: AgendaFamily
  displayWidth?: number
  displayHeight?: number
}) {
  const { items, family, completionGeneration, displayWidth, displayHeight } = props
  const issue = widgetIssue(props)
  const locale = widgetRuntimeLocale()
  const now = new Date()
  const positions = agendaWidgetLayout(family, displayWidth, displayHeight, { itemCount: items.length, hasIssue: !!issue })
  const available = items.slice(0, positions.capacity)
  const actionFlags = family === "systemMedium" ? [] : available.map(item => dueStatus(item, now).needsAction)
  const layout = family === "systemMedium" ? positions : agendaWidgetLayout(family, displayWidth, displayHeight, {
    itemCount: available.length,
    hasIssue: !!issue,
    actionFlags,
  })
  const visible = available.slice(0, layout.capacity)
  const roomy = family !== "systemMedium"

  return <WidgetFrame contentPadding={layout.padding}>
    <CompletionContent generation={completionGeneration}>
      <VStack alignment="leading" spacing={0}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
        {layout.headerHeight > 0 ? <AgendaHeader item={visible[0]} roomy={roomy}
          height={layout.headerHeight} locale={locale} now={now} /> : null}
        {layout.queueGap > 0 ? <Spacer minLength={layout.queueGap} frame={{ height: layout.queueGap }} /> : null}
        <AgendaQueue items={visible} actionFlags={actionFlags} roomy={roomy} layout={layout}
          issue={issue} locale={locale} now={now} />
        <Spacer minLength={0} />
        {visible.length > 0 && issue && layout.issueHeight > 0
          ? <WidgetIssueLink issue={issue} height={layout.issueHeight} />
          : null}
      </VStack>
    </CompletionContent>
  </WidgetFrame>
}

function AgendaHeader({ item, roomy, height, locale, now }: {
  item: DisplayDueItem | undefined
  roomy: boolean
  height: number
  locale: string
  now: Date
}) {
  const dateKey = item ? widgetItemDateKey(item) : localDateKey(now)
  const date = formatWidgetDate(dateKey, locale, { now })
  const weekday = formatWidgetWeekday(dateKey, locale)
  const todayKey = localDateKey(now)
  const url = roomy && item ? itemURL(item) : Script.createRunURLScheme(Script.name)
  if (!roomy || height < 40) return <Link url={url}>
    <HStack spacing={8} frame={{ maxWidth: "infinity", height, alignment: "leading" }} contentShape="rect">
      <Text font={13} fontWeight="semibold" lineLimit={1} foregroundStyle="label"
        frame={{ maxWidth: "infinity", alignment: "leading" }}>{widgetText("appName", locale)}</Text>
      <Text font={11} fontWeight="semibold" lineLimit={1} minScaleFactor={0.8} layoutPriority={1}
        foregroundStyle="secondaryLabel" contentTransition="opacity">{[weekday, date].filter(Boolean).join(" · ")}</Text>
    </HStack>
  </Link>

  const day = Number(dateKey.slice(-2))
  return <Link url={url}>
    <HStack alignment="center" spacing={10}
      frame={{ maxWidth: "infinity", height, alignment: "leading" }} contentShape="rect">
      {Number.isInteger(day) && day >= 1 && day <= 31
        ? <Text font={Math.min(35, height - 8)} fontWeight="semibold" foregroundStyle="label" lineLimit={1}
          monospacedDigit contentTransition="numericTextCountsDown">{day}</Text> : null}
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={11} fontWeight="semibold" foregroundStyle="secondaryLabel" lineLimit={1}>
          {widgetText(dateKey === todayKey ? "today" : dateKey < todayKey ? "due" : "nextDue", locale)}
        </Text>
        <Text font={14} fontWeight="semibold" foregroundStyle="label" lineLimit={1} minScaleFactor={0.8}
          contentTransition="opacity">{[weekday, date].filter(Boolean).join(" · ")}</Text>
      </VStack>
    </HStack>
  </Link>
}

function AgendaQueue({ items, actionFlags, roomy, layout, issue, locale, now }: {
  items: DisplayDueItem[]
  actionFlags: readonly boolean[]
  roomy: boolean
  layout: AgendaWidgetLayout
  issue: WidgetIssue | null
  locale: string
  now: Date
}) {
  const sections: Array<{ id: "recent" | "action" | "upcoming"; title: string; items: DisplayDueItem[] }> = []
  if (roomy && items.length > 0) {
    const action: DisplayDueItem[] = [], upcoming: DisplayDueItem[] = []
    items.forEach((item, index) => (actionFlags[index] ? action : upcoming).push(item))
    if (layout.sectionCount === 2) {
      sections.push({ id: "action", title: widgetText("needsAction", locale), items: action })
      sections.push({ id: "upcoming", title: widgetText("nextItems", locale), items: upcoming })
    } else if (action.length === 0) {
      sections.push({ id: "upcoming", title: widgetText("nextItems", locale), items })
    } else if (upcoming.length === 0) {
      sections.push({ id: "action", title: widgetText("needsAction", locale), items })
    } else {
      sections.push({ id: "recent", title: widgetText("recentItems", locale), items })
    }
  }

  return <VStack key={roomy ? "large-item-queue" : "medium-item-queue"}
    alignment="leading" spacing={roomy ? layout.sectionGap : layout.rowGap}
    frame={{ maxWidth: "infinity", maxHeight: items.length === 0 ? "infinity" : undefined }}>
    {items.length === 0 ? <WidgetEmptyContent issue={issue} />
      : roomy ? sections.map(section => <VStack key={"large-section-" + section.id} alignment="leading"
        spacing={0} transition={QUEUE_SLOT_TRANSITION} frame={{ maxWidth: "infinity" }}>
        {layout.sectionHeaderHeight > 0
          ? <Text font={11} fontWeight="semibold" foregroundStyle="secondaryLabel" lineLimit={1}
            frame={{ maxWidth: "infinity", height: layout.sectionHeaderHeight, alignment: "leading" }}>
            {section.title}
          </Text> : null}
        <VStack alignment="leading" spacing={layout.rowGap}>
          {section.items.map(item => <AgendaOccurrence key={widgetItemIdentity(item)} item={item}
            roomy layout={layout} locale={locale} now={now} />)}
        </VStack>
      </VStack>)
        : items.map(item => <AgendaOccurrence key={widgetItemIdentity(item)} item={item}
          roomy={false} layout={layout} locale={locale} now={now} />)}
  </VStack>
}

function AgendaOccurrence({ item, roomy, layout, locale, now }: {
  item: DisplayDueItem
  roomy: boolean
  layout: AgendaWidgetLayout
  locale: string
  now: Date
}) {
  return <VStack key={widgetItemIdentity(item)} spacing={0} contentTransition="opacity"
    transition={QUEUE_SLOT_TRANSITION} frame={{ maxWidth: "infinity" }}>
    <DueItemRow item={item} roomy={roomy} layout={layout} locale={locale} now={now} />
  </VStack>
}

function WidgetEmptyContent({
  compact = false,
  issue,
}: {
  compact?: boolean
  issue: WidgetIssue | null
}) {
  return <Link
    key="queue-empty-state"
    url={issue?.url ?? Script.createRunURLScheme(Script.name)}
    transition={QUEUE_SLOT_TRANSITION}
  >
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      {issue
        ? <ErrorState compact={compact} title={widgetText("unableToLoad", widgetRuntimeLocale())} detail={issue.text} />
        : <EmptyState compact={compact} />}
    </VStack>
  </Link>
}

function CompletionContent({
  generation,
  children,
}: {
  generation: number
  children: any
}) {
  return <VStack
    key="completion-active-layer"
    alignment="leading"
    contentTransition="opacity"
    animation={COMPLETION_QUEUE_ANIMATION
      ? { animation: COMPLETION_QUEUE_ANIMATION, value: generation }
      : undefined}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
  >
    {/* Only one AppIntent tree is mounted. Transparent overlapping controls
        can still intercept taps in a Home Screen widget. */}
    {children}
  </VStack>
}

function DueItemRow({ item, roomy, layout, locale, now }: {
  item: DisplayDueItem
  roomy: boolean
  layout: AgendaWidgetLayout
  locale: string
  now: Date
}) {
  const { hitSize, rowHeight } = layout
  const titleFont = Math.min(roomy ? 15 : 14, Math.max(1, rowHeight - 4))
  const twoLines = rowHeight >= (roomy ? 38 : 35)
  const supportingText = listItemSupportingText(item)
  const date = formatWidgetDate(widgetItemDateKey(item), locale, { now })
  const time = formatWidgetItemTime(item, locale)
  const metadataStatus = item.stale ? "clock.arrow.circlepath" : !item.canComplete ? "lock.fill" : null
  const railWidth = layout.metadataWidth - (metadataStatus ? 11 : 0)
  const dateFitsRail = widgetTitleFitsOneLine(date, railWidth, 9)
    && (!time || widgetTitleFitsOneLine(time, layout.metadataWidth, 9))
  const inlineDate = twoLines && !dateFitsRail
  const metadataWidth = inlineDate ? 0 : layout.metadataWidth
  const metadataGap = inlineDate ? 0 : layout.metadataGap
  const titleFits = widgetTitleFitsOneLine(item.title, layout.titleWidth, titleFont)
  const showSupporting = metadataWidth > 0 && titleFits && twoLines && !!supportingText
  const secondaryMetadata = time || (!showSupporting && twoLines && item.amount
    && widgetTitleFitsOneLine(item.amount, metadataWidth, 10) ? item.amount : "")
  return <HStack alignment="center" spacing={0} contentTransition="opacity"
    frame={{ maxWidth: "infinity", height: rowHeight }}>
    <ListCompletionIcon item={item} hitSize={hitSize} symbolSize={roomy ? 18 : 17} />
    <Link url={itemURL(item)}>
      <HStack alignment="center" spacing={metadataGap}
        frame={{ maxWidth: "infinity", height: rowHeight }} contentShape="rect">
        <VStack alignment="leading" spacing={1} layoutPriority={1}
          frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={titleFont} fontWeight="semibold"
            lineLimit={!twoLines || showSupporting || (inlineDate && rowHeight < 52) ? 1 : 2}
            minScaleFactor={0.9} truncationMode="tail" multilineTextAlignment="leading"
            frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.title}</Text>
          {inlineDate ? <HStack spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            {metadataStatus ? <Image systemName={metadataStatus} font={8} foregroundStyle="secondaryLabel" /> : null}
            <Text font={10} foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.82}
              truncationMode="tail" monospacedDigit>{[date, time].filter(Boolean).join(" · ")}</Text>
          </HStack> : showSupporting ? <Text font={10} foregroundStyle="secondaryLabel" lineLimit={1}
            truncationMode="middle" allowsTightening frame={{ maxWidth: "infinity", alignment: "leading" }}>
            {supportingText}
          </Text> : null}
        </VStack>
        {metadataWidth > 0 ? <VStack alignment="trailing" spacing={1}
          frame={{ width: metadataWidth, alignment: "trailing" }}>
          <HStack spacing={3} frame={{ maxWidth: "infinity", alignment: "trailing" }}>
            {metadataStatus ? <Image systemName={metadataStatus} font={8} foregroundStyle="secondaryLabel" /> : null}
            <Text font={Math.min(11, titleFont)} fontWeight="medium" foregroundStyle="label" lineLimit={1}
              minScaleFactor={0.78} monospacedDigit>{date}</Text>
          </HStack>
          {secondaryMetadata && twoLines ? <Text font={10} foregroundStyle="secondaryLabel" lineLimit={1}
            minScaleFactor={0.82} monospacedDigit>{secondaryMetadata}</Text> : null}
        </VStack> : null}
      </HStack>
    </Link>
  </HStack>
}

function ListCompletionIcon({
  item,
  hitSize,
  symbolSize,
}: {
  item: DisplayDueItem
  hitSize: number
  symbolSize: number
}) {
  if (hitSize < 8) return null
  const size = Math.min(symbolSize, hitSize)
  if (!item.canComplete || item.stale) {
    return <ListCompletionSymbol
      item={item}
      hitSize={hitSize}
      symbolSize={size}
      enabled={false}
    />
  }
  return <Button
    key={widgetItemIdentity(item)}
    buttonStyle="plain"
    frame={{ width: hitSize, height: hitSize }}
    intent={CompleteDueItemIntent({
      source: item.source,
      id: item.id,
      occurrenceKey: item.completionKey,
    })}
  >
    <DueSymbolLabel
      title={widgetCompletionLabel(item, widgetRuntimeLocale())}
      name={item.iconName}
      color={item.iconColor}
      size={size}
      slotSize={hitSize}
      widget
    />
  </Button>
}

function ListCompletionSymbol({
  item,
  hitSize,
  symbolSize,
  enabled,
}: {
  item: DisplayDueItem
  hitSize: number
  symbolSize: number
  enabled: boolean
}) {
  return <DueSymbol
    name={item.iconName}
    color={enabled ? item.iconColor : "tertiaryLabel"}
    size={symbolSize}
    slotSize={hitSize}
    replace
    widget
  />
}

function listItemSupportingText(item: DisplayDueItem): string {
  return [item.amount, item.note]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ")
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return <VStack
    alignment="center"
    spacing={6}
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <Image
      systemName="checkmark.circle.fill"
      font={compact ? 28 : 24}
      foregroundStyle="systemGreen"
      widgetAccentable
    />
    <Text font={compact ? "subheadline" : "headline"} fontWeight="semibold">
      {widgetText("allDone", widgetRuntimeLocale())}
    </Text>
    <Text font="caption2" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={2}>
      {widgetText("openAppToAdd", widgetRuntimeLocale())}
    </Text>
  </VStack>
}

function ErrorState({
  compact = false,
  title,
  detail,
}: {
  compact?: boolean
  title: string
  detail: string
}) {
  return <VStack
    alignment="center"
    spacing={6}
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <Image
      systemName="exclamationmark.triangle.fill"
      font={compact ? 25 : 22}
      foregroundStyle="systemOrange"
      widgetAccentable
    />
    <Text font={compact ? "subheadline" : "headline"} fontWeight="semibold">{title}</Text>
    <Text font="caption2" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={2}>
      {detail}
    </Text>
  </VStack>
}

function AccessoryFallback({ items }: { items: DisplayDueItem[] }) {
  return <WidgetFrame contentPadding={8}>
    <Link url={Script.createRunURLScheme(Script.name)}>
      <VStack alignment="center" spacing={3} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <Image systemName="calendar.badge.clock" font={18} foregroundStyle="systemOrange" widgetAccentable />
        <Text font="caption" fontWeight="semibold" lineLimit={1}>{items.length}</Text>
      </VStack>
    </Link>
  </WidgetFrame>
}

function WidgetFrame({
  children,
  contentPadding = 11,
}: {
  children: any
  contentPadding?: number | {
    top: number
    bottom: number
    leading: number
    trailing: number
  }
}) {
  return <VStack
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    widgetBackground="systemBackground"
  >
    <VStack
      padding={contentPadding}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      {children}
    </VStack>
  </VStack>
}

function WidgetIssueLink({ issue, height }: { issue: WidgetIssue; height: number }) {
  return <Link url={issue.url}>
    <HStack spacing={4} frame={{ maxWidth: "infinity", height, alignment: "leading" }} contentShape="rect">
      <Image systemName="exclamationmark.circle.fill" font={10} foregroundStyle={issue.color} />
      <Text font={10} foregroundStyle="label" lineLimit={1} minScaleFactor={0.82}>{issue.statusText}</Text>
    </HStack>
  </Link>
}

function widgetIssue(props: {
  remindersLive: boolean
  remindersFromCache: boolean
  reminderFetchedAt: number | null
  reminderError: string | null
  interactionError: string | null
}): WidgetIssue | null {
  if (props.interactionError) {
    return {
      text: localizeWidgetActionError(props.interactionError, widgetRuntimeLocale()),
      compactText: widgetText("reviewAction", widgetRuntimeLocale()),
      statusText: widgetText("reviewAction", widgetRuntimeLocale()),
      color: "systemRed",
      url: Script.createRunURLScheme(Script.name, { action: "widget-status" }),
    }
  }
  if (props.reminderError) {
    return {
      text: props.remindersLive
        ? widgetText("reminderReadCacheFailed", widgetRuntimeLocale())
        : props.remindersFromCache
          ? widgetText("reminderSyncCached", widgetRuntimeLocale())
          : widgetText("reminderReadFailed", widgetRuntimeLocale()),
      compactText: widgetText("retrySync", widgetRuntimeLocale()),
      statusText: `${widgetText("retrySync", widgetRuntimeLocale())} · ${formatWidgetLastSync(props.reminderFetchedAt, widgetRuntimeLocale())}`,
      color: "systemOrange",
      url: Script.createRunURLScheme(Script.name),
    }
  }
  if (props.remindersFromCache) {
    return {
      text: widgetText("cachedItems", widgetRuntimeLocale()),
      compactText: widgetText("retrySync", widgetRuntimeLocale()),
      statusText: `${widgetText("retrySync", widgetRuntimeLocale())} · ${formatWidgetLastSync(props.reminderFetchedAt, widgetRuntimeLocale())}`,
      color: "systemOrange",
      url: Script.createRunURLScheme(Script.name),
    }
  }
  return null
}

function itemURL(item: DisplayDueItem): string {
  if (item.source === "reminder") {
    // Render the exact reminder's notes in the foreground; external navigation
    // is an explicit action on that page, not a prerequisite for reading notes.
    return Script.createRunURLScheme(Script.name, { action: "reminder-notes", id: item.id })
  }
  return Script.createRunURLScheme(Script.name, { action: "edit", id: item.id })
}

function widgetItemIdentity(item: DisplayDueItem): string {
  return JSON.stringify([item.source, item.id, item.completionKey])
}
