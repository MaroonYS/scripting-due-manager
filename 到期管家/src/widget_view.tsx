import {
  Button,
  DateLabel,
  HStack,
  Image,
  Link,
  Script,
  Spacer,
  Text,
  VStack,
  Widget,
} from "scripting"
import { CompleteDueItemIntent, RefreshDueItemsIntent } from "../app_intents"
import { dueStatus, pad2 } from "./date"
import {
  compactUpdateTime,
  displayDate,
  kindColor,
  summaryText,
} from "./presentation"
import type { DisplayDueItem } from "./types"
import { visibleWidgetItems, widgetItemCapacity } from "./widget_layout"

type WidgetDataProps = {
  items: DisplayDueItem[]
  reminderFetchedAt: number | null
  remindersFromCache: boolean
  remindersEnabled: boolean
  reminderError: string | null
  interactionError: string | null
}

export function DueManagerWidget(props: WidgetDataProps) {
  const displayHeight = Widget.displaySize?.height
  if (Widget.family === "systemSmall") {
    return <SmallWidget {...props} />
  }
  if (Widget.family === "systemMedium") {
    return <ListWidget
      {...props}
      limit={widgetItemCapacity("systemMedium", displayHeight)}
    />
  }
  return <ListWidget
    {...props}
    limit={widgetItemCapacity("systemLarge", displayHeight)}
    roomy
  />
}

function WidgetHeader({ items }: { items: DisplayDueItem[] }) {
  return <HStack alignment="center" spacing={7}>
    <Link buttonStyle="plain" url={Script.createRunURLScheme(Script.name)}>
      <VStack alignment="leading" spacing={1}>
        <Text font="headline" fontWeight="semibold" foregroundStyle="systemBlue" lineLimit={1}>
          到期
        </Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
          {items.length > 0 ? summaryText(items) : "所有事项均已完成"}
        </Text>
      </VStack>
    </Link>
    <Spacer />
    <Button buttonStyle="plain" intent={RefreshDueItemsIntent(undefined)}>
      <Image
        systemName="arrow.clockwise"
        font={12}
        foregroundStyle="secondaryLabel"
        frame={{ width: 28, height: 28 }}
      />
    </Button>
  </HStack>
}

function SmallWidget({
  items,
  reminderError,
  remindersFromCache,
  interactionError,
}: WidgetDataProps) {
  const item = items[0]
  if (!item) {
    return <WidgetFrame>
      <Link buttonStyle="plain" url={Script.createRunURLScheme(Script.name)}>
        {interactionError
          ? <ErrorState compact title="操作未完成" detail={interactionError} />
          : reminderError
            ? <ErrorState
              compact
              title="提醒事项读取失败"
              detail={remindersFromCache ? "提醒缓存不可用，请打开主脚本检查" : "请打开主脚本检查提醒事项权限"}
            />
            : <EmptyState compact />}
      </Link>
    </WidgetFrame>
  }

  const status = dueStatus(item)
  const remaining = item.dueTimestamp - Date.now()
  const useLiveTimer = item.includesTime && remaining > 0 && remaining <= 36 * 60 * 60 * 1000

  return <WidgetFrame>
    <VStack
      alignment="leading"
      spacing={5}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <HStack spacing={5}>
        <Link buttonStyle="plain" url={Script.createRunURLScheme(Script.name)}>
          <Text font="caption" fontWeight="semibold" foregroundStyle="systemBlue">到期</Text>
        </Link>
        <Spacer />
        {item.stale || reminderError || interactionError
          ? <Image
            systemName={interactionError ? "exclamationmark.circle.fill" : "exclamationmark.arrow.triangle.2.circlepath"}
            font={11}
            foregroundStyle={interactionError ? "systemRed" : "secondaryLabel"}
          />
          : null}
        <Text font="caption2" foregroundStyle="secondaryLabel">{items.length} 项</Text>
      </HStack>
      <Spacer minLength={1} />
      <HStack alignment="top" spacing={7} frame={{ maxWidth: "infinity" }}>
        <CompletionControl item={item} size={43} symbolSize={24} />
        <Link buttonStyle="plain" url={itemURL(item)}>
          <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity" }}>
            <Text font="headline" fontWeight="semibold" lineLimit={2} minScaleFactor={0.78}>
              {item.title}
            </Text>
            {useLiveTimer
              ? <DateLabel
                date={new Date(item.dueTimestamp)}
                style="timer"
                font="title3"
                fontWeight="bold"
                monospacedDigit
                foregroundStyle="systemOrange"
              />
              : <Text
                font="title3"
                fontWeight="bold"
                foregroundStyle={status.color}
                contentTransition="numericTextCountsUp"
                lineLimit={1}
              >
                {status.label}
              </Text>}
            <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
              {rowDateText(item)}{item.amount ? ` · ${item.amount}` : ""}
            </Text>
          </VStack>
        </Link>
      </HStack>
      <Spacer minLength={0} />
      <HStack spacing={4}>
        <Text
          font={9}
          foregroundStyle={interactionError ? "systemRed" : "tertiaryLabel"}
          lineLimit={1}
        >
          {interactionError ?? (item.stale ? "缓存项目不可在组件完成" : "点圆圈完成本期")}
        </Text>
        <Spacer />
        {items.length > 1
          ? <Text font={9} foregroundStyle="tertiaryLabel">还有 {items.length - 1} 项</Text>
          : null}
      </HStack>
    </VStack>
  </WidgetFrame>
}

function ListWidget({
  items,
  limit,
  reminderFetchedAt,
  remindersFromCache,
  remindersEnabled,
  reminderError,
  interactionError,
  roomy = false,
}: WidgetDataProps & {
  limit: number
  roomy?: boolean
}) {
  const visible = visibleWidgetItems(items, limit)
  return <WidgetFrame padding={roomy ? 14 : 12}>
    <VStack
      alignment="leading"
      spacing={roomy ? 4 : 2}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <WidgetHeader items={items} />
      {visible.length > 0
        ? visible.map(item => (
          <DueItemRow
            key={`${item.source}-${item.id}-${item.completionKey}`}
            item={item}
            roomy={roomy}
          />
        ))
        : <Link buttonStyle="plain" url={Script.createRunURLScheme(Script.name)}>
          {interactionError
            ? <ErrorState title="操作未完成" detail={interactionError} />
            : reminderError
              ? <ErrorState
                title="提醒事项读取失败"
                detail={remindersFromCache ? "缓存不可用，请打开主脚本检查" : "打开主脚本检查提醒事项权限"}
              />
              : <EmptyState />}
        </Link>}
      <HStack spacing={4}>
        <Text
          font={9}
          foregroundStyle={interactionError ? "systemRed" : "tertiaryLabel"}
          lineLimit={1}
        >
          {interactionError ?? reminderFooterText({
            items,
            reminderFetchedAt,
            remindersFromCache,
            remindersEnabled,
            reminderError,
          })}
        </Text>
        <Spacer />
        {items.length > limit
          ? <Text font={9} foregroundStyle="tertiaryLabel">还有 {items.length - limit} 项</Text>
          : null}
      </HStack>
    </VStack>
  </WidgetFrame>
}

function DueItemRow({ item, roomy }: { item: DisplayDueItem; roomy: boolean }) {
  const status = dueStatus(item)
  const remaining = item.dueTimestamp - Date.now()
  const useLiveTimer = item.includesTime && remaining > 0 && remaining <= 24 * 60 * 60 * 1000

  return <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
    <CompletionControl
      item={item}
      size={roomy ? 35 : 32}
      symbolSize={roomy ? 21 : 19}
    />
    <Link buttonStyle="plain" url={itemURL(item)}>
      <VStack alignment="leading" spacing={1} frame={{ maxWidth: "infinity" }}>
        <HStack spacing={5}>
          <Text font={roomy ? "subheadline" : "caption"} fontWeight="semibold" lineLimit={1}>
            {item.title}
          </Text>
          <Spacer />
          {useLiveTimer
            ? <DateLabel
              date={new Date(item.dueTimestamp)}
              style="timer"
              font={roomy ? "caption" : "caption2"}
              fontWeight="semibold"
              monospacedDigit
              foregroundStyle="systemOrange"
            />
            : <Text
              font={roomy ? "caption" : "caption2"}
              fontWeight="semibold"
              foregroundStyle={status.color}
              lineLimit={1}
            >
              {status.label}
            </Text>}
        </HStack>
        <HStack spacing={4}>
          <Text font={9} foregroundStyle="secondaryLabel" lineLimit={1}>
            {rowDateText(item)}
          </Text>
          {item.amount
            ? <Text font={9} foregroundStyle="secondaryLabel" lineLimit={1}>· {item.amount}</Text>
            : null}
          <Spacer />
          {item.stale
            ? <Text font={8} foregroundStyle="tertiaryLabel">缓存</Text>
            : null}
        </HStack>
      </VStack>
    </Link>
  </HStack>
}

function CompletionControl({
  item,
  size,
  symbolSize,
}: {
  item: DisplayDueItem
  size: number
  symbolSize: number
}) {
  if (item.stale) {
    return <Image
      systemName="clock.arrow.circlepath"
      font={symbolSize - 2}
      foregroundStyle="tertiaryLabel"
      frame={{ width: size, height: size }}
    />
  }
  return <Button
    buttonStyle="plain"
    intent={CompleteDueItemIntent({
      source: item.source,
      id: item.id,
      occurrenceKey: item.completionKey,
    })}
  >
    <Image
      systemName="circle"
      font={symbolSize}
      fontWeight="semibold"
      foregroundStyle={kindColor(item.kind)}
      frame={{ width: size, height: size }}
      widgetAccentable
    />
  </Button>
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return <VStack
    alignment="center"
    spacing={6}
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
  >
    <Image
      systemName="checkmark.circle.fill"
      font={compact ? 30 : 25}
      foregroundStyle="systemGreen"
      widgetAccentable
    />
    <Text font={compact ? "headline" : "subheadline"} fontWeight="semibold">全部完成</Text>
    <Text font="caption2" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={2}>
      运行「到期管家」添加事项
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
      font={compact ? 28 : 23}
      foregroundStyle="systemOrange"
      widgetAccentable
    />
    <Text font={compact ? "headline" : "subheadline"} fontWeight="semibold">{title}</Text>
    <Text font="caption2" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={2}>
      {detail}
    </Text>
  </VStack>
}

function WidgetFrame({
  children,
  padding = 12,
}: {
  children: any
  padding?: number
}) {
  return <VStack
    padding={padding}
    frame={Widget.displaySize}
    widgetBackground={{
      light: "#FFFFFF",
      dark: "#1C1C1E",
    }}
  >
    {children}
  </VStack>
}

function rowDateText(item: DisplayDueItem): string {
  const status = dueStatus(item)
  const time = item.includesTime ? ` ${pad2(item.hour)}:${pad2(item.minute)}` : ""
  if (!status.overdue && status.days === 0) return `今天${time}`
  if (!status.overdue && status.days === 1) return `明天${time}`
  return displayDate(item)
}

function itemURL(item: DisplayDueItem): string {
  if (item.source === "reminder") return Script.createRunURLScheme(Script.name)
  return Script.createRunURLScheme(Script.name, { action: "edit", id: item.id })
}

function reminderFooterText({
  items,
  reminderFetchedAt,
  remindersFromCache,
  remindersEnabled,
  reminderError,
}: {
  items: DisplayDueItem[]
  reminderFetchedAt: number | null
  remindersFromCache: boolean
  remindersEnabled: boolean
  reminderError: string | null
}): string {
  if (!remindersEnabled) return "点圆圈完成本期"
  if (reminderError) {
    const usingSnapshot = items.some(item => item.source === "reminder" && item.stale)
    if (usingSnapshot) return `提醒读取失败 · 使用 ${compactUpdateTime(reminderFetchedAt)} 缓存`
    return remindersFromCache
      ? "提醒缓存不可用 · 打开主脚本检查"
      : "提醒读取失败 · 打开主脚本检查权限"
  }
  return `点圆圈完成 · 提醒 ${compactUpdateTime(reminderFetchedAt)}`
}
