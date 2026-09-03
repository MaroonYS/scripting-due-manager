import {
  Button,
  DateLabel,
  Divider,
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
import { dueStatus, humanDate } from "./date"
import { dueIconLabel } from "./icons"
import { displayDate, kindLabel } from "./presentation"
import type { DisplayDueItem } from "./types"
import {
  largeWidgetLayout,
  listItemTitleFontSize,
  smallItemTitleFontSize,
  visibleWidgetItems,
  widgetItemCapacity,
  widgetRowHeight,
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
  color: string
}

// Animation and Transition are Scripting runtime globals (like Storage), not
// named exports. A persisted generation drives one WidgetKit timeline diff.
declare const Transition: any
const COMPLETION_QUEUE_ANIMATION = Animation.smooth({
  duration: 0.32,
  extraBounce: 0,
})
const QUEUE_SLOT_TRANSITION = Transition
  .asymmetric(
    Transition.move("bottom").combined(Transition.opacity()),
    Transition.opacity(),
  )
  .animation(COMPLETION_QUEUE_ANIMATION)

export function DueManagerWidget(props: WidgetDataProps) {
  const displaySize = Widget.displaySize
  const displayHeight = displaySize?.height
  const displayWidth = displaySize?.width
  if (Widget.family === "systemSmall") {
    return <SmallWidget {...props} displayWidth={displayWidth} />
  }
  if (Widget.family === "systemMedium") {
    return <ListWidget
      {...props}
      limit={widgetItemCapacity("systemMedium", displayHeight)}
      family="systemMedium"
      displayHeight={displayHeight}
      displayWidth={displayWidth}
    />
  }
  if (Widget.family === "systemLarge") {
    return <ListWidget
      {...props}
      limit={widgetItemCapacity("systemLarge", displayHeight)}
      family="systemLarge"
      displayHeight={displayHeight}
      displayWidth={displayWidth}
    />
  }
  return <AccessoryFallback items={props.items} />
}

function WidgetHeader({
  items,
  compact = false,
  issue,
  iconName = "calendar.badge.clock",
  iconColor = "systemOrange",
  compactTitle,
}: {
  items: DisplayDueItem[]
  compact?: boolean
  issue: WidgetIssue | null
  iconName?: string
  iconColor?: string
  compactTitle?: string
}) {
  return <Link url={Script.createRunURLScheme(Script.name)}>
    <HStack
      alignment="center"
      spacing={5}
      padding={{
        top: compact ? 8 : 4,
        bottom: compact ? -6 : -2,
        leading: 5,
        trailing: 5,
      }}
      frame={{ maxWidth: "infinity" }}
    >
      <Image
        systemName={iconName}
        font={compact ? 12 : 14}
        foregroundStyle={iconColor}
        symbolRenderingMode="hierarchical"
        contentTransition="symbolEffectReplace"
        widgetAccentable
      />
      <Text
        font={compact ? 13 : 15}
        fontWeight="semibold"
        foregroundStyle="label"
        lineLimit={1}
        minScaleFactor={compact ? 0.65 : 1}
      >
        {compact ? compactTitle ?? "到期" : "到期管家"}
      </Text>
      <Spacer />
      {issue
        ? <Image
          systemName="exclamationmark.circle.fill"
          font={11}
          foregroundStyle={issue.color}
        />
        : null}
      {compact
        ? <Text
          font="caption2"
          foregroundStyle="secondaryLabel"
          lineLimit={1}
          minScaleFactor={0.65}
          fixedSize={{ horizontal: true, vertical: false }}
          monospacedDigit
          contentTransition="numericTextCountsDown"
        >
          {items[0] ? humanDate(items[0].dueDate) : items.length}
        </Text>
        : null}
    </HStack>
  </Link>
}

function LargeSummaryHeader({
  item,
  issue,
  height,
}: {
  item: DisplayDueItem | undefined
  issue: WidgetIssue | null
  height: number
}) {
  const date = largeSummaryDate(item)
  const context = largeSummaryContext(item)
  const subtitle = `${date.month} · ${context}`
  return <Link url={Script.createRunURLScheme(Script.name)}>
    <VStack
      alignment="leading"
      spacing={0}
      frame={{ maxWidth: "infinity", height, alignment: "topLeading" }}
    >
      <HStack
        alignment="center"
        spacing={8}
        padding={{ leading: 5, trailing: 5 }}
        frame={{ maxWidth: "infinity", height: 61 }}
      >
        <VStack
          alignment="leading"
          spacing={0}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          <Text
            font={30}
            fontWeight="bold"
            foregroundStyle="label"
            lineLimit={1}
            monospacedDigit
            contentTransition="numericTextCountsDown"
          >
            {date.day}
          </Text>
          <Text
            font={14}
            fontWeight="semibold"
            foregroundStyle={item?.iconColor ?? "systemOrange"}
            lineLimit={1}
            minScaleFactor={0.68}
          >
            {subtitle}
          </Text>
        </VStack>
        {issue
          ? <Image
            systemName="exclamationmark.circle.fill"
            font={12}
            foregroundStyle={issue.color}
          />
          : null}
        <Image
          systemName={item?.iconName ?? "calendar.badge.clock"}
          font={26}
          foregroundStyle={item?.iconColor ?? "systemOrange"}
          symbolRenderingMode="hierarchical"
          frame={{ width: 40, height: 40 }}
          contentTransition="symbolEffectReplace"
          widgetAccentable
        />
      </HStack>
      <Spacer minLength={0} />
      <Divider padding={{ leading: 5, trailing: 5 }} />
    </VStack>
  </Link>
}

function largeSummaryDate(item: DisplayDueItem | undefined): { day: string; month: string } {
  const match = item?.dueDate.match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (match) {
    return {
      day: String(Number(match[2])),
      month: `${Number(match[1])}月`,
    }
  }
  const now = new Date()
  return { day: String(now.getDate()), month: `${now.getMonth() + 1}月` }
}

function largeSummaryContext(item: DisplayDueItem | undefined): string {
  if (!item) return "到期管家"
  if (item.source === "reminder") {
    const listName = item.note.replace(/\s+/g, " ").trim()
    return listName || "提醒事项"
  }
  return kindLabel(item.kind)
}

function SmallWidget(props: WidgetDataProps & { displayWidth?: number }) {
  const {
    items,
    completionGeneration,
    displayWidth,
  } = props
  const item = items[0]
  const nextItem = items[1]
  const issue = widgetIssue(props)

  return <WidgetFrame contentPadding={11}>
    <VStack
      alignment="leading"
      spacing={0}
      padding={{ leading: 3, trailing: 3 }}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      <WidgetHeader
        items={items}
        compact
        issue={issue}
        iconName={item?.iconName}
        iconColor={item?.iconColor}
        compactTitle={item ? dueIconLabel(item.iconName) : "到期"}
      />
      <CompletionContent
        generation={completionGeneration}
      >
        <SmallWidgetBody
          item={item}
          nextItem={nextItem}
          issue={issue}
          displayWidth={displayWidth}
        />
      </CompletionContent>
    </VStack>
  </WidgetFrame>
}

function SmallWidgetBody({
  item,
  nextItem,
  issue,
  displayWidth,
}: {
  item: DisplayDueItem | undefined
  nextItem: DisplayDueItem | undefined
  issue: WidgetIssue | null
  displayWidth?: number
}) {
  return item
    ? <SmallDueItem
      item={item}
      nextItem={nextItem}
      displayWidth={displayWidth}
    />
    : <Link url={Script.createRunURLScheme(Script.name)}>
      <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        {issue
          ? <ErrorState compact title="暂时无法读取" detail={issue.text} />
          : <EmptyState compact />}
      </VStack>
    </Link>
}

function SmallDueItem({
  item,
  nextItem,
  displayWidth,
}: {
  item: DisplayDueItem
  nextItem: DisplayDueItem | undefined
  displayWidth?: number
}) {
  const detail = smallItemDetail(item)
  const titleFontSize = smallItemTitleFontSize(item.title, displayWidth)

  return <VStack
    alignment="leading"
    spacing={0}
    contentTransition="opacity"
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <VStack
      alignment="leading"
      spacing={0}
      frame={{ maxWidth: "infinity", height: 76, alignment: "topLeading" }}
    >
      <HStack
        alignment="top"
        spacing={0}
        padding={{ top: 15 }}
        frame={{ maxWidth: "infinity", alignment: "leading" }}
      >
        <VStack
          spacing={0}
          padding={{ top: -5, bottom: 5 }}
        >
          <ListCompletionIcon
            item={item}
            hitSize={40}
            symbolSize={17}
          />
        </VStack>
        <Link url={itemURL(item)}>
          <Text
            font={titleFontSize}
            fontWeight="semibold"
            lineLimit={3}
            minScaleFactor={0.9}
            fixedSize={{ horizontal: false, vertical: true }}
            padding={{ top: 6, bottom: -6 }}
            frame={{ maxWidth: 105, alignment: "leading" }}
          >
            {item.title}
          </Text>
        </Link>
      </HStack>
    </VStack>
    <Spacer minLength={4} />
    {detail
      ? <SmallCurrentDetail item={item} detail={detail} />
      : <VStack frame={{ maxWidth: "infinity", height: 19, alignment: "leading" }} />}
    <Spacer minLength={0} />
    {nextItem
      ? <SmallNextItemPreview item={nextItem} />
      : <VStack frame={{ maxWidth: "infinity", height: 18, alignment: "leading" }} />}
  </VStack>
}

function smallItemDetail(item: DisplayDueItem): string {
  return [item.amount, item.note]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ")
}

function SmallCurrentDetail({
  item,
  detail,
}: {
  item: DisplayDueItem
  detail: string
}) {
  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", height: 19, alignment: "leading" }}
  >
    <Link url={itemURL(item)}>
      <HStack
        alignment="center"
        spacing={0}
        padding={{ top: 4, leading: 5, trailing: 5 }}
        frame={{ maxWidth: "infinity" }}
      >
        <Text
          font={13}
          foregroundStyle="secondaryLabel"
          lineLimit={1}
          minScaleFactor={0.8}
          fixedSize={{ horizontal: false, vertical: true }}
          frame={{ maxWidth: 135, alignment: "leading" }}
        >
          {detail}
        </Text>
        <Spacer />
      </HStack>
    </Link>
  </VStack>
}

function SmallNextItemPreview({ item }: { item: DisplayDueItem }) {
  const status = dueStatus(item)
  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", height: 18, alignment: "leading" }}
  >
    <Link url={itemURL(item)}>
      <HStack
        alignment="center"
        spacing={4}
        padding={{ top: -5, leading: 5, trailing: 5, bottom: 9 }}
        frame={{ maxWidth: "infinity" }}
      >
        <Image
          systemName={item.iconName}
          font={11}
          foregroundStyle={item.iconColor}
          symbolRenderingMode="hierarchical"
          frame={{ width: 12, height: 12 }}
          widgetAccentable
        />
        <Text
          font="caption2"
          fontWeight="medium"
          foregroundStyle="secondaryLabel"
          lineLimit={1}
          minScaleFactor={0.75}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          {item.title}
        </Text>
        <Text font="caption2" foregroundStyle={status.overdue ? "systemRed" : "tertiaryLabel"} lineLimit={1}>
          {status.label}
        </Text>
      </HStack>
    </Link>
  </VStack>
}

function ListWidget({
  items,
  completionGeneration,
  limit,
  family,
  remindersLive,
  remindersFromCache,
  reminderError,
  interactionError,
  displayHeight,
  displayWidth,
}: WidgetDataProps & {
  limit: number
  family: "systemMedium" | "systemLarge"
  displayHeight?: number
  displayWidth?: number
}) {
  const issue = widgetIssue({
    remindersLive,
    remindersFromCache,
    reminderError,
    interactionError,
  })
  const effectiveLimit = issue ? Math.max(1, limit - 1) : limit
  const visible = visibleWidgetItems(items, effectiveLimit)
  const roomy = family === "systemLarge"
  const largeLayout = roomy ? largeWidgetLayout(displayHeight) : null
  const largeSectionCount = largeLayout
    ? largeWidgetSectionCount(visible, largeLayout.maximumSections)
    : undefined
  // Keep the row rhythm stable when one slot is reserved for an issue message.
  const rowHeight = widgetRowHeight(family, displayHeight, limit, largeSectionCount)

  if (roomy && largeLayout) {
    return <WidgetFrame contentPadding={11}>
      <VStack
        alignment="leading"
        spacing={0}
        padding={{ leading: 3, trailing: 3 }}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      >
        <CompletionContent generation={completionGeneration}>
          <VStack
            alignment="leading"
            spacing={0}
            frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
          >
            <LargeSummaryHeader
              item={items[0]}
              issue={issue}
              height={largeLayout.summaryHeight}
            />
            <LargeListWidgetBody
              visible={visible}
              rowHeight={rowHeight}
              issue={issue}
              maximumSections={largeLayout.maximumSections}
              sectionHeaderHeight={largeLayout.sectionHeaderHeight}
              displayWidth={displayWidth}
            />
          </VStack>
        </CompletionContent>
      </VStack>
    </WidgetFrame>
  }

  return <WidgetFrame contentPadding={11}>
    <VStack
      alignment="leading"
      spacing={0}
      padding={{ leading: 3, trailing: 3 }}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      <WidgetHeader
        items={items}
        issue={issue}
      />
      <CompletionContent
        generation={completionGeneration}
      >
        <ListWidgetBody
          visible={visible}
          rowHeight={rowHeight}
          issue={issue}
          displayWidth={displayWidth}
        />
      </CompletionContent>
    </VStack>
  </WidgetFrame>
}

function ListWidgetBody({
  visible,
  rowHeight,
  issue,
  displayWidth,
}: {
  visible: DisplayDueItem[]
  rowHeight: number
  issue: WidgetIssue | null
  displayWidth?: number
}) {
  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
  >
    {visible.length > 0
      ? <VStack
        alignment="leading"
        spacing={1}
        padding={{ top: 3 }}
        frame={{ maxWidth: "infinity" }}
      >
        {visible.map((item, index) => (
          <VStack
            key={`queue-slot-${index}`}
            spacing={0}
            contentTransition="opacity"
            transition={QUEUE_SLOT_TRANSITION}
            frame={{ maxWidth: "infinity" }}
          >
            <DueItemRow
              item={item}
              roomy={false}
              height={rowHeight}
              displayWidth={displayWidth}
            />
          </VStack>
        ))}
      </VStack>
      : <Link url={Script.createRunURLScheme(Script.name)}>
        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
          {issue
            ? <ErrorState title="暂时无法读取" detail={issue.text} />
            : <EmptyState />}
        </VStack>
      </Link>}
    <Spacer minLength={0} />
    {visible.length > 0 && issue
      ? <Text font="caption2" foregroundStyle={issue.color} lineLimit={1} padding={{ top: 3 }}>
        {issue.text}
      </Text>
      : null}
  </VStack>
}

function LargeListWidgetBody({
  visible,
  rowHeight,
  issue,
  maximumSections,
  sectionHeaderHeight,
  displayWidth,
}: {
  visible: DisplayDueItem[]
  rowHeight: number
  issue: WidgetIssue | null
  maximumSections: 1 | 2
  sectionHeaderHeight: number
  displayWidth?: number
}) {
  const indexedItems = visible.map((item, index) => {
    const status = dueStatus(item)
    return { item, index, needsAction: status.overdue || status.days === 0 }
  })
  const needsAction = indexedItems.filter(row => row.needsAction)
  const upcoming = indexedItems.filter(row => !row.needsAction)
  const sections: Array<{
    title: string
    rows: Array<{ item: DisplayDueItem; index: number }>
  }> = maximumSections === 1
    ? [{ title: "近期事项", rows: indexedItems }]
    : []
  if (maximumSections === 2 && needsAction.length > 0) {
    sections.push({ title: "需要处理", rows: needsAction })
  }
  if (maximumSections === 2 && upcoming.length > 0) {
    sections.push({ title: "接下来", rows: upcoming })
  }

  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
  >
    {visible.length > 0
      ? <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity" }}>
        {sections.map(section => (
          <LargeWidgetSection
            key={`large-section-${section.title}`}
            title={section.title}
            rows={section.rows}
            rowHeight={rowHeight}
            headerHeight={sectionHeaderHeight}
            displayWidth={displayWidth}
          />
        ))}
      </VStack>
      : <Link url={Script.createRunURLScheme(Script.name)}>
        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
          {issue
            ? <ErrorState title="暂时无法读取" detail={issue.text} />
            : <EmptyState />}
        </VStack>
      </Link>}
    <Spacer minLength={0} />
    {visible.length > 0 && issue
      ? <Text font="caption2" foregroundStyle={issue.color} lineLimit={1} padding={{ top: 3 }}>
        {issue.text}
      </Text>
      : null}
  </VStack>
}

function LargeWidgetSection({
  title,
  rows,
  rowHeight,
  headerHeight,
  displayWidth,
}: {
  title: string
  rows: Array<{ item: DisplayDueItem; index: number }>
  rowHeight: number
  headerHeight: number
  displayWidth?: number
}) {
  return <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity" }}>
    <HStack
      alignment="center"
      spacing={0}
      padding={{ bottom: 3, leading: 5, trailing: 5 }}
      frame={{ maxWidth: "infinity", height: headerHeight, alignment: "bottomLeading" }}
    >
      <Text font={13} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>
        {title}
      </Text>
      <Spacer />
    </HStack>
    {rows.map(({ item, index }) => (
      <VStack
        key={`queue-slot-${index}`}
        spacing={0}
        contentTransition="opacity"
        transition={QUEUE_SLOT_TRANSITION}
        frame={{ maxWidth: "infinity" }}
      >
        <DueItemRow
          item={item}
          roomy
          height={rowHeight}
          displayWidth={displayWidth}
        />
      </VStack>
    ))}
  </VStack>
}

function largeWidgetSectionCount(
  items: DisplayDueItem[],
  maximumSections: 1 | 2,
): number {
  if (maximumSections === 1 || items.length === 0) return 1
  let hasNeedsAction = false
  let hasUpcoming = false
  for (const item of items) {
    const status = dueStatus(item)
    if (status.overdue || status.days === 0) hasNeedsAction = true
    else hasUpcoming = true
  }
  return hasNeedsAction && hasUpcoming ? 2 : 1
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
    animation={{ animation: COMPLETION_QUEUE_ANIMATION, value: generation }}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
  >
    {/* Only one AppIntent tree is mounted. Transparent overlapping controls
        can still intercept taps in a Home Screen widget. */}
    {children}
  </VStack>
}

function DueItemRow({
  item,
  roomy,
  height,
  displayWidth,
}: {
  item: DisplayDueItem
  roomy: boolean
  height: number
  displayWidth?: number
}) {
  const hitSize = Math.min(height, roomy ? 40 : 38)
  const metadataWidth = roomy ? 124 : 116
  const supportingText = listItemSupportingText(item)
  const titleFontSize = listItemTitleFontSize(
    item.title,
    roomy ? "systemLarge" : "systemMedium",
    displayWidth,
  )
  return <HStack
    alignment="center"
    spacing={0}
    contentTransition="opacity"
    frame={{ maxWidth: "infinity", height }}
  >
    <ListCompletionIcon
      item={item}
      hitSize={hitSize}
      symbolSize={roomy ? 18 : 17}
    />
    <Link url={itemURL(item)}>
      <HStack
        alignment="center"
        spacing={8}
        frame={{ maxWidth: "infinity" }}
      >
        <Text
          font={titleFontSize}
          fontWeight="semibold"
          lineLimit={2}
          minScaleFactor={0.85}
          multilineTextAlignment="leading"
          fixedSize={{ horizontal: false, vertical: true }}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          {item.title}
        </Text>
        <VStack
          alignment="trailing"
          spacing={0}
          frame={{ width: metadataWidth, alignment: "trailing" }}
        >
          <VStack
            alignment="trailing"
            spacing={0}
            frame={{ maxWidth: "infinity", height: 13, alignment: "trailing" }}
          >
            {supportingText
              ? <Text
                font="caption2"
                foregroundStyle="secondaryLabel"
                lineLimit={1}
                minScaleFactor={0.72}
                frame={{ maxWidth: "infinity", alignment: "trailing" }}
              >
                {supportingText}
              </Text>
              : null}
          </VStack>
          <HStack
            alignment="center"
            spacing={4}
            frame={{ maxWidth: "infinity", alignment: "trailing" }}
          >
            <Text
              font="caption2"
              foregroundStyle="secondaryLabel"
              lineLimit={1}
              minScaleFactor={0.72}
            >
              {displayDate(item)}
            </Text>
            {item.stale
              ? <Image
                systemName="clock.arrow.circlepath"
                font={9}
                foregroundStyle="tertiaryLabel"
              />
              : !item.canComplete
                ? <Image systemName="lock.fill" font={9} foregroundStyle="tertiaryLabel" />
                : null}
            <DueStatusLabel item={item} font={roomy ? "caption" : "caption2"} />
          </HStack>
        </VStack>
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
  if (!item.canComplete || item.stale) {
    return <ListCompletionSymbol
      item={item}
      hitSize={hitSize}
      symbolSize={symbolSize}
      enabled={false}
    />
  }
  return <Button
    buttonStyle="plain"
    contentShape="rectangle"
    intent={CompleteDueItemIntent({
      source: item.source,
      id: item.id,
      occurrenceKey: item.completionKey,
    })}
  >
    <ListCompletionSymbol
      item={item}
      hitSize={hitSize}
      symbolSize={symbolSize}
      enabled
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
  return <Image
    systemName={item.iconName}
    font={symbolSize}
    foregroundStyle={enabled ? item.iconColor : "tertiaryLabel"}
    symbolRenderingMode="hierarchical"
    frame={{ width: hitSize, height: hitSize }}
    contentTransition="symbolEffectReplace"
    widgetAccentable
  />
}

function listItemSupportingText(item: DisplayDueItem): string {
  return [item.amount, item.note]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ")
}

function DueStatusLabel({
  item,
  font,
}: {
  item: DisplayDueItem
  font: "caption" | "caption2"
}) {
  const status = dueStatus(item)
  const remaining = item.dueTimestamp - Date.now()
  const useLiveTimer = item.includesTime
    && remaining > 0
    && remaining <= 24 * 60 * 60 * 1000
  const color = widgetStatusColor(item, status.overdue, status.days, remaining)

  if (useLiveTimer) {
    return <DateLabel
      date={new Date(item.dueTimestamp)}
      style="timer"
      font={font}
      fontWeight="semibold"
      monospacedDigit
      foregroundStyle={color}
    />
  }
  return <Text font={font} fontWeight="semibold" foregroundStyle={color} lineLimit={1}>
    {status.label}
  </Text>
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
    <Text font={compact ? "subheadline" : "headline"} fontWeight="semibold">全部完成</Text>
    <Text font="caption2" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={2}>
      打开「到期管家」添加事项
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
    widgetBackground="secondarySystemBackground"
  >
    <VStack
      padding={contentPadding}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      {children}
    </VStack>
  </VStack>
}

function widgetStatusColor(
  item: DisplayDueItem,
  overdue: boolean,
  days: number,
  remaining: number,
): string {
  if (overdue) return "systemRed"
  if (days === 0 || (item.includesTime && remaining > 0 && remaining <= 24 * 60 * 60 * 1000)) {
    return "systemOrange"
  }
  return "secondaryLabel"
}

function widgetIssue(props: {
  remindersLive: boolean
  remindersFromCache: boolean
  reminderError: string | null
  interactionError: string | null
}): WidgetIssue | null {
  if (props.interactionError) {
    return { text: props.interactionError, color: "systemRed" }
  }
  if (props.reminderError) {
    return {
      text: props.remindersLive
        ? "提醒事项已读取，但缓存保存失败"
        : props.remindersFromCache
          ? "提醒事项同步失败，正在显示缓存"
          : "提醒事项读取失败，请打开主脚本检查",
      color: "systemOrange",
    }
  }
  return null
}

function itemURL(item: DisplayDueItem): string {
  if (item.source === "reminder") return Script.createRunURLScheme(Script.name)
  return Script.createRunURLScheme(Script.name, { action: "edit", id: item.id })
}
