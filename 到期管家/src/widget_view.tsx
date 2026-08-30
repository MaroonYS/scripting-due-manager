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
      spacing={compact ? 5 : 6}
      padding={{
        top: compact ? 2 : 0,
        leading: compact ? 5 : 0,
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
        font={compact ? 13 : "headline"}
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
    completionGeneration,
  } = props
  const item = items[0]
  const nextItem = items[1]
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
      <CompletionContent
        generation={completionGeneration}
      >
        <SmallWidgetBody
          item={item}
          nextItem={nextItem}
          issue={issue}
        />
      </CompletionContent>
    </VStack>
  </WidgetFrame>
}

function SmallWidgetBody({
  item,
  nextItem,
  issue,
}: {
  item: DisplayDueItem | undefined
  nextItem: DisplayDueItem | undefined
  issue: WidgetIssue | null
}) {
  return item
    ? <SmallDueItem
      item={item}
      nextItem={nextItem}
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
}: {
  item: DisplayDueItem
  nextItem: DisplayDueItem | undefined
}) {
  return <VStack
    alignment="leading"
    spacing={0}
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <VStack
      alignment="leading"
      spacing={0}
      frame={{ maxWidth: "infinity", height: 70, alignment: "topLeading" }}
    >
      <HStack
        alignment="top"
        spacing={7}
        padding={{ top: nextItem ? 10 : 12 }}
        frame={{ maxWidth: "infinity" }}
      >
        <CompletionControl
          item={item}
          hitSize={32}
          symbolSize={19}
        />
        <Link url={itemURL(item)}>
          <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
            <Text font={16} fontWeight="semibold" lineLimit={item.amount ? 2 : 3} minScaleFactor={0.9}>
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
    </VStack>
    <Spacer minLength={nextItem ? 4 : 8} />
    {nextItem ? <SmallNextItemPreview item={nextItem} /> : null}
    {nextItem ? <Spacer minLength={0} /> : null}
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
    padding={{ top: 2 }}
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
      <CompletionContent
        generation={completionGeneration}
      >
        <ListWidgetBody
          visible={visible}
          roomy={roomy}
          rowHeight={rowHeight}
          issue={issue}
        />
      </CompletionContent>
    </VStack>
  </WidgetFrame>
}

function ListWidgetBody({
  visible,
  roomy,
  rowHeight,
  issue,
}: {
  visible: DisplayDueItem[]
  roomy: boolean
  rowHeight: number
  issue: WidgetIssue | null
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
}: {
  item: DisplayDueItem
  roomy: boolean
  height: number
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
}: {
  item: DisplayDueItem
  hitSize: number
  symbolSize: number
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
  return <Button
    buttonStyle="plain"
    contentShape="circle"
    intent={CompleteDueItemIntent({
      source: item.source,
      id: item.id,
      occurrenceKey: item.completionKey,
    })}
  >
    <CompletionSymbol
      name={completing ? "circle.inset.filled" : "circle"}
      hitSize={hitSize}
      symbolSize={symbolSize}
    />
  </Button>
}

function CompletionSymbol({
  name,
  hitSize,
  symbolSize,
}: {
  name: string
  hitSize: number
  symbolSize: number
}) {
  return <Image
    systemName={name}
    font={symbolSize}
    foregroundStyle="systemBlue"
    symbolRenderingMode="hierarchical"
    frame={{ width: hitSize, height: hitSize }}
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
