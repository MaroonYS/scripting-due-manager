import {
  DateLabel,
  Divider,
  HStack,
  Image,
  Link,
  Script,
  Spacer,
  Text,
  Toggle,
  VStack,
  Widget,
  ZStack,
} from "scripting"
import { CompleteDueItemIntent } from "../app_intents"
import { dueStatus } from "./date"
import { displayDate } from "./presentation"
import type { DisplayDueItem } from "./types"
import {
  visibleWidgetItems,
  widgetItemCapacity,
  widgetRowHeight,
} from "./widget_layout"

type WidgetDataProps = {
  items: DisplayDueItem[]
  previousItems: DisplayDueItem[] | null
  completionPhase: 0 | 1
  completionGeneration: number
  reminderFetchedAt: number | null
  remindersFromCache: boolean
  remindersEnabled: boolean
  reminderError: string | null
  interactionError: string | null
}

type WidgetIssue = {
  text: string
  color: string
}

// Animation is a Scripting runtime global (like Storage), not a named export.
// Binding it to the persisted generation lets WidgetKit animate entry changes.
const COMPLETION_QUEUE_ANIMATION = Animation.default()

export function DueManagerWidget(props: WidgetDataProps) {
  const displayHeight = Widget.displaySize?.height
  if (Widget.family === "systemSmall") {
    return <SmallWidget {...props} />
  }
  if (Widget.family === "systemMedium") {
    return <ListWidget
      {...props}
      limit={widgetItemCapacity("systemMedium", displayHeight)}
      family="systemMedium"
      displayHeight={displayHeight}
    />
  }
  if (Widget.family === "systemLarge") {
    return <ListWidget
      {...props}
      limit={widgetItemCapacity("systemLarge", displayHeight)}
      family="systemLarge"
      displayHeight={displayHeight}
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
}: {
  items: DisplayDueItem[]
  compact?: boolean
  issue: WidgetIssue | null
  iconName?: string
  iconColor?: string
}) {
  return <Link url={Script.createRunURLScheme(Script.name)}>
    <HStack
      alignment="center"
      spacing={6}
      padding={{
        top: compact ? 3 : 0,
        leading: compact ? 5 : 0,
      }}
      frame={{ maxWidth: "infinity" }}
    >
      <Image
        systemName={iconName}
        font={compact ? 13 : 14}
        foregroundStyle={iconColor}
        symbolRenderingMode="hierarchical"
        contentTransition="symbolEffectReplace"
        widgetAccentable
      />
      <Text
        font={compact ? "subheadline" : "headline"}
        fontWeight="semibold"
        foregroundStyle="label"
        lineLimit={1}
      >
        {compact ? "到期" : "到期管家"}
      </Text>
      <Spacer />
      {issue
        ? <Image
          systemName="exclamationmark.circle.fill"
          font={11}
          foregroundStyle={issue.color}
        />
        : null}
      <Text
        font={compact ? "caption2" : "caption"}
        foregroundStyle="secondaryLabel"
        lineLimit={1}
        monospacedDigit
        contentTransition="numericTextCountsDown"
        padding={{ trailing: compact ? 5 : 0 }}
      >
        {items.length}
      </Text>
    </HStack>
  </Link>
}

function SmallWidget(props: WidgetDataProps) {
  const {
    items,
    previousItems,
    completionPhase,
    completionGeneration,
  } = props
  const item = items[0]
  const nextItem = items[1]
  const previousQueue = previousItems ?? items
  const previousItem = previousQueue[0]
  const previousNextItem = previousQueue[1]
  const layer0Item = completionPhase === 0 ? item : previousItem
  const layer1Item = completionPhase === 1 ? item : previousItem
  const layer0NextItem = completionPhase === 0 ? nextItem : previousNextItem
  const layer1NextItem = completionPhase === 1 ? nextItem : previousNextItem
  const issue = widgetIssue(props)

  return <WidgetFrame contentPadding={11}>
    <VStack
      alignment="leading"
      spacing={0}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      <WidgetHeader
        items={items}
        compact
        issue={issue}
        iconName={item?.iconName}
        iconColor={item?.iconColor}
      />
      <CompletionTransitionLayers
        phase={completionPhase}
        generation={completionGeneration}
        layer0={<SmallWidgetBody
          item={layer0Item}
          nextItem={layer0NextItem}
          issue={issue}
          renderGeneration={completionGeneration}
        />}
        layer1={<SmallWidgetBody
          item={layer1Item}
          nextItem={layer1NextItem}
          issue={issue}
          renderGeneration={completionGeneration}
        />}
      />
    </VStack>
  </WidgetFrame>
}

function SmallWidgetBody({
  item,
  nextItem,
  issue,
  renderGeneration,
}: {
  item: DisplayDueItem | undefined
  nextItem: DisplayDueItem | undefined
  issue: WidgetIssue | null
  renderGeneration: number
}) {
  return item
    ? <SmallDueItem
      item={item}
      nextItem={nextItem}
      renderGeneration={renderGeneration}
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
  renderGeneration,
}: {
  item: DisplayDueItem
  nextItem: DisplayDueItem | undefined
  renderGeneration: number
}) {
  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <HStack
      alignment="top"
      spacing={7}
      padding={{ top: nextItem ? 8 : 12 }}
      frame={{ maxWidth: "infinity" }}
    >
      <CompletionControl
        item={item}
        hitSize={32}
        symbolSize={19}
        renderGeneration={renderGeneration}
      />
      <Link url={itemURL(item)}>
        <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity" }}>
          <Text font="subheadline" fontWeight="semibold" lineLimit={nextItem ? 2 : 3} minScaleFactor={0.85}>
            {item.title}
          </Text>
          {item.amount
            ? <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.8}>
              {item.amount}
            </Text>
            : null}
        </VStack>
      </Link>
    </HStack>
    <Spacer minLength={nextItem ? 3 : 8} />
    {nextItem ? <SmallNextItemPreview item={nextItem} /> : null}
    {nextItem ? <Spacer minLength={3} /> : null}
    <Link url={itemURL(item)}>
      <HStack
        alignment="center"
        spacing={6}
        padding={{ leading: 5, trailing: 5, bottom: 4 }}
        frame={{ maxWidth: "infinity" }}
      >
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
          {displayDate(item)}
        </Text>
        <Spacer />
        <DueStatusLabel item={item} font="caption" />
      </HStack>
    </Link>
  </VStack>
}

function SmallNextItemPreview({ item }: { item: DisplayDueItem }) {
  const status = dueStatus(item)
  return <VStack
    alignment="leading"
    spacing={2}
    frame={{ maxWidth: "infinity" }}
  >
    <Divider padding={{ leading: 39, trailing: 5 }} />
    <Link url={itemURL(item)}>
      <HStack
        alignment="center"
        spacing={4}
        padding={{ leading: 5, trailing: 5 }}
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
        <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>下一项</Text>
        <Text
          font="caption2"
          fontWeight="medium"
          foregroundStyle="secondaryLabel"
          lineLimit={1}
          minScaleFactor={0.75}
        >
          {item.title}
        </Text>
        <Spacer />
        <Text font="caption2" foregroundStyle={status.overdue ? "systemRed" : "tertiaryLabel"} lineLimit={1}>
          {status.label}
        </Text>
      </HStack>
    </Link>
  </VStack>
}

function ListWidget({
  items,
  previousItems,
  completionPhase,
  completionGeneration,
  limit,
  family,
  remindersFromCache,
  reminderError,
  interactionError,
  displayHeight,
}: WidgetDataProps & {
  limit: number
  family: "systemMedium" | "systemLarge"
  displayHeight?: number
}) {
  const issue = widgetIssue({ remindersFromCache, reminderError, interactionError })
  const effectiveLimit = issue ? Math.max(1, limit - 1) : limit
  const visible = visibleWidgetItems(items, effectiveLimit)
  const previousVisible = visibleWidgetItems(previousItems ?? items, effectiveLimit)
  const layer0Visible = completionPhase === 0 ? visible : previousVisible
  const layer1Visible = completionPhase === 1 ? visible : previousVisible
  const roomy = family === "systemLarge"
  const rowHeight = widgetRowHeight(family, displayHeight, effectiveLimit)

  return <WidgetFrame contentPadding={roomy ? 14 : 11}>
    <VStack
      alignment="leading"
      spacing={0}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      <WidgetHeader
        items={items}
        issue={issue}
      />
      <CompletionTransitionLayers
        phase={completionPhase}
        generation={completionGeneration}
        layer0={<ListWidgetBody
          visible={layer0Visible}
          roomy={roomy}
          rowHeight={rowHeight}
          issue={issue}
          renderGeneration={completionGeneration}
        />}
        layer1={<ListWidgetBody
          visible={layer1Visible}
          roomy={roomy}
          rowHeight={rowHeight}
          issue={issue}
          renderGeneration={completionGeneration}
        />}
      />
    </VStack>
  </WidgetFrame>
}

function ListWidgetBody({
  visible,
  roomy,
  rowHeight,
  issue,
  renderGeneration,
}: {
  visible: DisplayDueItem[]
  roomy: boolean
  rowHeight: number
  issue: WidgetIssue | null
  renderGeneration: number
}) {
  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
  >
    {visible.length > 0
      ? <VStack
        alignment="leading"
        spacing={0}
        padding={{ top: roomy ? 6 : 3 }}
        frame={{ maxWidth: "infinity" }}
      >
        {visible.map((item, index) => (
          <VStack
            key={`row-${item.source}-${item.id}-${item.completionKey}`}
            spacing={0}
            frame={{ maxWidth: "infinity" }}
          >
            <DueItemRow
              item={item}
              roomy={roomy}
              height={rowHeight}
              renderGeneration={renderGeneration}
            />
            {index < visible.length - 1
              ? <Divider padding={{ leading: roomy ? 62 : 59 }} />
              : null}
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

function CompletionTransitionLayers({
  phase,
  generation,
  layer0,
  layer1,
}: {
  phase: 0 | 1
  generation: number
  layer0: any
  layer1: any
}) {
  const phase0Active = phase === 0
  const phase1Active = phase === 1
  return <ZStack
    alignment="topLeading"
    animation={{ animation: COMPLETION_QUEUE_ANIMATION, value: generation }}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
  >
    {/* The outgoing layer stays above the incoming one while WidgetKit fades
        it away, so the next row cannot cover the selected completion mark. */}
    <VStack
      key="completion-phase-0"
      opacity={phase0Active ? 1 : 0}
      allowsHitTesting={phase0Active}
      zIndex={phase0Active ? 1 : 2}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      {layer0}
    </VStack>
    <VStack
      key="completion-phase-1"
      opacity={phase1Active ? 1 : 0}
      allowsHitTesting={phase1Active}
      zIndex={phase1Active ? 1 : 2}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
    >
      {layer1}
    </VStack>
  </ZStack>
}

function DueItemRow({
  item,
  roomy,
  height,
  renderGeneration,
}: {
  item: DisplayDueItem
  roomy: boolean
  height: number
  renderGeneration: number
}) {
  return <HStack
    alignment="center"
    spacing={5}
    frame={{ maxWidth: "infinity", height }}
  >
    <CompletionControl
      item={item}
      hitSize={roomy ? 34 : 32}
      symbolSize={roomy ? 20 : 19}
      renderGeneration={renderGeneration}
    />
    <Link url={itemURL(item)}>
      <HStack alignment="center" spacing={6} frame={{ maxWidth: "infinity" }}>
        <Image
          systemName={item.iconName}
          font={roomy ? 14 : 13}
          foregroundStyle={item.iconColor}
          symbolRenderingMode="hierarchical"
          frame={{ width: 17, height: 18 }}
          widgetAccentable
        />
        <VStack alignment="leading" spacing={1} frame={{ maxWidth: "infinity" }}>
          <HStack alignment="center" spacing={5} frame={{ maxWidth: "infinity" }}>
            <Text font="subheadline" fontWeight="semibold" lineLimit={1}>
              {item.title}
            </Text>
            <Spacer />
            <DueStatusLabel item={item} font="caption" />
          </HStack>
          <HStack alignment="center" spacing={4} frame={{ maxWidth: "infinity" }}>
            <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
              {displayDate(item)}
            </Text>
            {item.amount
              ? <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
                · {item.amount}
              </Text>
              : null}
            <Spacer />
          </HStack>
        </VStack>
      </HStack>
    </Link>
  </HStack>
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

function CompletionControl({
  item,
  hitSize,
  symbolSize,
  renderGeneration,
}: {
  item: DisplayDueItem
  hitSize: number
  symbolSize: number
  renderGeneration: number
}) {
  if (item.stale) {
    return <Image
      systemName="clock.arrow.circlepath"
      font={symbolSize - 1}
      foregroundStyle="tertiaryLabel"
      frame={{ width: hitSize, height: hitSize }}
    />
  }
  const completing = item.isCompleting === true
  return <Toggle
    key={`complete-${renderGeneration}-${item.source}-${item.id}-${item.completionKey}`}
    value={completing}
    toggleStyle="button"
    buttonStyle="bordered"
    buttonBorderShape="circle"
    controlSize="mini"
    tint="systemBlue"
    contentShape="circle"
    clipShape="circle"
    frame={{ width: hitSize, height: hitSize }}
    intent={CompleteDueItemIntent({
      source: item.source,
      id: item.id,
      occurrenceKey: item.completionKey,
      renderGeneration,
    })}
  >
    <CompletionSymbol
      name={completing ? "circle.inset.filled" : "circle"}
      symbolSize={symbolSize}
    />
  </Toggle>
}

function CompletionSymbol({
  name,
  symbolSize,
}: {
  name: string
  symbolSize: number
}) {
  return <Image
    systemName={name}
    font={symbolSize}
    foregroundStyle="systemBlue"
    symbolRenderingMode="hierarchical"
    frame={{ width: symbolSize + 2, height: symbolSize + 2 }}
    contentTransition="symbolEffectReplace"
    animation={{ animation: COMPLETION_QUEUE_ANIMATION, value: name }}
    widgetAccentable
  />
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
  contentPadding?: number
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
  if (item.isCompleting) return "tertiaryLabel"
  if (overdue) return "systemRed"
  if (days === 0 || (item.includesTime && remaining > 0 && remaining <= 24 * 60 * 60 * 1000)) {
    return "systemOrange"
  }
  return "secondaryLabel"
}

function widgetIssue(props: {
  remindersFromCache: boolean
  reminderError: string | null
  interactionError: string | null
}): WidgetIssue | null {
  if (props.interactionError) {
    return { text: props.interactionError, color: "systemRed" }
  }
  if (props.reminderError) {
    return {
      text: props.remindersFromCache ? "提醒事项同步失败，正在显示缓存" : "提醒事项读取失败，请打开主脚本检查",
      color: "systemOrange",
    }
  }
  return null
}

function itemURL(item: DisplayDueItem): string {
  if (item.source === "reminder") return Script.createRunURLScheme(Script.name)
  return Script.createRunURLScheme(Script.name, { action: "edit", id: item.id })
}
