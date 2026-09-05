import {
  Button,
  DatePicker,
  Device,
  HStack,
  Image,
  Label,
  LabeledContent,
  Link,
  List,
  Navigation,
  NavigationLink,
  NavigationStack,
  Picker,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
  Widget,
  useEffect,
  useState,
} from "scripting"
import { configureWidgetLocale } from "./src/widget_localization"
import {
  advanceManualItem,
  actionDateKey,
  createRecurrenceRule,
  dateKeyToLocalDate,
  dueStatus,
  humanDate,
  localDateKey,
  MAX_REMIND_BEFORE_DAYS,
  MAX_RECURRENCE_INTERVAL,
  MIN_REMIND_BEFORE_DAYS,
  MIN_RECURRENCE_INTERVAL,
  parseRemindBeforeDaysInput,
  parseRecurrenceIntervalInput,
} from "./src/date"

import {
  DUE_ICON_GROUPS,
  DUE_ICON_OPTIONS,
  resolveDueIcon,
} from "./src/icons"
import { ITEM_KIND_DEFINITIONS, isItemKind } from "./src/item_kinds"
import { recurrenceLabel } from "./src/presentation"
import {
  clearReminderSnapshot,
  loadReminderItems,
  sortDueItems,
} from "./src/reminders"
import {
  createDraftItem,
  completeManualItem,
  deleteItem,
  findItem,
  loadState,
  manualItemsForDisplay,
  normalizeReminderCalendarIDs,
  updateSettings,
  upsertItem,
} from "./src/storage"
import type {
  AppState,
  ItemKind,
  ManualDueItem,
  RecurrenceUnit,
} from "./src/types"
import {
  reloadUserWidgets,
  reloadWidgetsAfterStorageWrite,
} from "./src/widget_refresh"
import { refreshAfterDataChange } from "./src/maintenance"
import { reconcileNotifications } from "./src/notifications"
import { NotificationView } from "./src/notification_view"
import { RecoveryView } from "./src/recovery_view"
import { UpdateView } from "./src/update_view"
import { readRecoveryStatus } from "./src/recovery"
import { WidgetActionStatusView } from "./src/widget_action_view"

configureWidgetLocale(Device)

type ReminderStatus = {
  loading: boolean
  count: number
  fetchedAt: number | null
  live: boolean
  fromCache: boolean
  error: string | null
}

type ReminderCalendarChoice = {
  id: string
  title: string
  sourceTitle: string
  readOnly: boolean
}

const EMPTY_REMINDER_STATUS: ReminderStatus = {
  loading: false,
  count: 0,
  fetchedAt: null,
  live: false,
  fromCache: false,
  error: null,
}

function recurrenceIntervalUnitLabel(unit: RecurrenceUnit): string {
  switch (unit) {
    case "day": return "天"
    case "week": return "周"
    case "month": return "个月"
    case "year": return "年"
  }
}

async function refreshWidgetsWithWarning(title = "设置已保存") {
  try { await reloadWidgetsAfterStorageWrite() }
  catch (error) {
    console.error("Widget refresh failed after a successful operation", error)
    await Dialog.alert({ title, message: "组件刷新请求失败，但已保存的数据不会丢失。请点「刷新桌面组件」重试，无需重复保存。" })
  }
}

function DueManagerApp() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<AppState>(() => loadState())
  const [newItem, setNewItem] = useState<ManualDueItem>(() => createDraftItem())
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus>(EMPTY_REMINDER_STATUS)
  // A stable request token prevents an older refresh from replacing newer scope/status.
  const [reminderRequests] = useState(() => ({ generation: 0 }))

  const refreshState = (nextState?: AppState) => {
    setState(nextState ?? loadState())
  }

  const finishNewItem = (nextState?: AppState) => {
    refreshState(nextState)
    setNewItem(createDraftItem())
  }

  const refreshReminders = async () => {
    const request = ++reminderRequests.generation
    try {
      const current = loadState()
      if (!current.settings.includeReminders) {
        setReminderStatus(EMPTY_REMINDER_STATUS)
        return
      }
      setReminderStatus(status => ({ ...status, loading: true }))
      const result = await loadReminderItems(current.settings.reminderHorizonDays, current.settings.reminderCalendarIDs)
      if (request !== reminderRequests.generation) return
      setReminderStatus({ loading: false, count: result.items.length, fetchedAt: result.fetchedAt,
        live: result.live, fromCache: result.fromCache, error: result.error })
      await refreshWidgetsWithWarning("提醒数据已读取")
    } catch (error) {
      if (request === reminderRequests.generation) {
        setReminderStatus(status => ({ ...status, loading: false, error: String(error) }))
      }
    }
  }

  const refreshRecoveredState = (nextState?: AppState) => {
    refreshState(nextState)
    // A restored backup can change the list scope or disable Reminders entirely.
    // Do not show the previous scope's successful status until a fresh read finishes.
    setReminderStatus(EMPTY_REMINDER_STATUS)
    void refreshReminders()
  }

  useEffect(() => {
    if (state.settings.includeReminders) void refreshReminders()
    else void refreshWidgetsWithWarning("数据已读取")
  }, [])

  const setReminderIntegration = async (enabled: boolean) => {
    ++reminderRequests.generation
    if (!enabled) {
      try {
        const next = updateSettings({ includeReminders: false })
        refreshState(next)
        setReminderStatus(EMPTY_REMINDER_STATUS)
        try { clearReminderSnapshot() }
        catch (error) {
          console.error("Reminders disabled but cache cleanup failed", error)
          await Dialog.alert({ title: "提醒事项显示已关闭", message: "旧缓存清理失败，但不会继续用于当前组件。请稍后重新运行脚本清理。" })
        }
        await refreshWidgetsWithWarning()
      } catch (error) {
        await Dialog.alert({ title: "无法关闭提醒事项", message: String(error) })
      }
      return
    }

    setReminderStatus(status => ({ ...status, loading: true }))
    try {
      const needsCalendarAccess = loadState().settings.reminderCalendarIDs.length > 0
      const granted = needsCalendarAccess
        ? await Script.requestAccess(["calendar", "reminders"])
        : await Script.requestAccess(["reminders"])
      const missingReminderAccess = !granted.includes("reminders")
      const missingCalendarAccess = needsCalendarAccess && !granted.includes("calendar")
      if (missingReminderAccess || missingCalendarAccess) {
        const permissionName = needsCalendarAccess ? "日历与提醒事项" : "提醒事项"
        setReminderStatus({ ...EMPTY_REMINDER_STATUS, error: `未授予${permissionName}权限` })
        await Dialog.alert({
          title: `需要${permissionName}权限`,
          message: needsCalendarAccess
            ? "已选择具体提醒事项列表。请允许该脚本访问日历与提醒事项，才能按列表读取。"
            : "请允许该脚本读取提醒事项，再重试此开关。",
        })
        return
      }

      const next = updateSettings({ includeReminders: true })
      refreshState(next)
      const result = await loadReminderItems(
        next.settings.reminderHorizonDays,
        next.settings.reminderCalendarIDs,
      )
      setReminderStatus({
        loading: false,
        count: result.items.length,
        fetchedAt: result.fetchedAt,
        live: result.live,
        fromCache: result.fromCache,
        error: result.error,
      })
      if (!result.live && !result.fromCache) {
        await Dialog.alert({
          title: "无法读取提醒事项",
          message: `请在 iOS 设置中检查 Scripting 的${needsCalendarAccess ? "日历与提醒事项" : "提醒事项"}权限。\n\n${result.error}`,
        })
      } else if (result.live && result.error) {
        await Dialog.alert({
          title: "提醒事项已读取，但缓存失败",
          message: result.error,
        })
      }
      await refreshWidgetsWithWarning()
    } catch (error) {
      setReminderStatus({ ...EMPTY_REMINDER_STATUS, error: String(error) })
      await Dialog.alert({ title: "授权失败", message: String(error) })
    }
  }

  const setReminderCalendarSelection = async (calendarIDs: string[]) => {
    ++reminderRequests.generation
    const current = loadState()

    if (!current.settings.includeReminders) {
      const next = updateSettings({ reminderCalendarIDs: calendarIDs })
      refreshState(next)
      await refreshWidgetsWithWarning()
      return
    }

    setReminderStatus(status => ({ ...status, loading: true }))
    const result = await loadReminderItems(
      current.settings.reminderHorizonDays,
      calendarIDs,
    )
    setReminderStatus({
      loading: false,
      count: result.items.length,
      fetchedAt: result.fetchedAt,
      live: result.live,
      fromCache: result.fromCache,
      error: result.error,
    })
    if (!result.live && !result.fromCache) {
      try { await reloadWidgetsAfterStorageWrite() } catch (error) { console.error("Widget refresh failed", error) }
      throw new Error(result.error ?? "无法读取所选提醒事项列表")
    }

    const next = updateSettings({ reminderCalendarIDs: calendarIDs })
    refreshState(next)
    await refreshWidgetsWithWarning()
    if (result.live && result.error) {
      await Dialog.alert({
        title: "列表已保存，但缓存失败",
        message: result.error,
      })
    }
  }

  const setShowAmounts = async (showAmounts: boolean) => {
    try {
      const next = updateSettings({ showAmounts })
      refreshState(next)
      await refreshWidgetsWithWarning()
    } catch (error) {
      await Dialog.alert({ title: "设置保存失败", message: String(error) })
    }
  }

  const preview = async (family: "systemSmall" | "systemMedium" | "systemLarge") => {
    try {
      await Widget.preview({ family })
    } catch (error) {
      await Dialog.alert({ title: "预览失败", message: String(error) })
    }
  }

  const sortedIDs = sortDueItems(manualItemsForDisplay(state)).map(item => item.id)
  const activeItems = sortedIDs
    .map(id => state.items.find(item => item.id === id))
    .filter((item): item is ManualDueItem => item != null)
  const overdueItems = activeItems.filter(item => dueStatus(item).overdue)
  const needsActionItems = activeItems.filter(item => {
    const status = dueStatus(item)
    return !status.overdue && status.needsAction
  })
  const upcomingItems = activeItems.filter(item => {
    const status = dueStatus(item)
    return !status.overdue && !status.needsAction
  })
  const inactiveItems = state.items.filter(item => !item.enabled)

  return <NavigationStack>
    <List
      listStyle="insetGroup"
      navigationTitle="到期管家"
      navigationBarTitleDisplayMode="large"
      toolbar={{
        confirmationAction: <Button title="完成" action={() => dismiss()} />,
      }}
    >
      <Section footer={<Text>点击组件左侧图标完成当前一期，点击文字查看详情。周期事项只推进一期；误触后可到「记录与数据安全」撤销手动事项的完成。</Text>}>
        <NavigationLink
          destination={
            <ItemEditor
              item={newItem}
              isNew
              onChanged={finishNewItem}
            />
          }
        >
          <Label title="新增到期事项" systemImage="plus.circle.fill" />
        </NavigationLink>

        {activeItems.length === 0
          ? <VStack alignment="leading" spacing={3} padding={{ vertical: 4 }}>
            <Text foregroundStyle="secondaryLabel">还没有手动事项</Text>
            <Text font="caption" foregroundStyle="tertiaryLabel">添加账单、订阅、还款、保险或其他到期事项。</Text>
          </VStack>
          : null}
      </Section>

      <ManualItemsSection title="已逾期" items={overdueItems} onChanged={refreshState} />
      <ManualItemsSection title="需要处理" items={needsActionItems} onChanged={refreshState} />
      <ManualItemsSection title="接下来" items={upcomingItems} onChanged={refreshState} />

      {inactiveItems.length > 0
        ? <Section header={<Text>已完成或隐藏</Text>}>
          {inactiveItems.map(item => (
            <NavigationLink
              key={item.id}
              destination={<ItemEditor item={item} onChanged={refreshState} />}
            >
              <ManualItemRow item={item} inactive />
            </NavigationLink>
          ))}
        </Section>
        : null}

      <Section
        header={<Text>系统提醒事项</Text>}
        footer={<Text>只读取未完成且有到期日期的提醒；数据缓存在本机 Scripting 共享存储中，不会上传。</Text>}
      >
        <Toggle
          title="显示 Apple 提醒事项"
          systemImage="checklist"
          value={state.settings.includeReminders}
          disabled={reminderStatus.loading}
          onChanged={(value: boolean) => { void setReminderIntegration(value) }}
        />
        {state.settings.includeReminders
          ? <NavigationLink
            destination={
              <ReminderCalendarPicker
                selectedIDs={state.settings.reminderCalendarIDs}
                onChanged={setReminderCalendarSelection}
              />
            }
          >
            <HStack spacing={10}>
              <Image systemName="list.bullet" foregroundStyle="systemBlue" frame={{ width: 24 }} />
              <Text>提醒事项列表</Text>
              <Spacer />
              <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>
                {state.settings.reminderCalendarIDs.length === 0
                  ? "全部列表"
                  : `${state.settings.reminderCalendarIDs.length} 个列表`}
              </Text>
            </HStack>
          </NavigationLink>
          : null}
        {state.settings.includeReminders
          ? <Button
              title={reminderStatus.loading ? "正在更新…" : "立即更新"}
              systemImage="arrow.clockwise"
              action={() => { if (!reminderStatus.loading) void refreshReminders() }}
            />
          : null}
        {state.settings.includeReminders
          ? <ReminderStatusRow status={reminderStatus} />
          : null}
      </Section>

      <Section header={<Text>显示与组件</Text>}>
        <NavigationLink destination={<WidgetActionStatusView />}>
          <Label title="上次组件操作" systemImage="exclamationmark.bubble" />
        </NavigationLink>
        <NavigationLink destination={<NotificationView />}>
          <Label title="通知与提醒" systemImage="bell.badge" />
        </NavigationLink>
        <Toggle
          title="在组件显示金额"
          systemImage="banknote"
          value={state.settings.showAmounts}
          onChanged={(value: boolean) => { void setShowAmounts(value) }}
        />
        <Button title="小号组件预览" systemImage="square" action={() => { void preview("systemSmall") }} />
        <Button title="中号组件预览" systemImage="rectangle" action={() => { void preview("systemMedium") }} />
        <Button title="大号组件预览" systemImage="rectangle.portrait" action={() => { void preview("systemLarge") }} />
        <Button
          title="刷新桌面组件"
          systemImage="arrow.triangle.2.circlepath"
          action={async () => {
            try { await reloadUserWidgets() }
            catch (error) { await Dialog.alert({ title: "组件刷新失败", message: String(error) }) }
          }}
        />
      </Section>

      <Section>
        <NavigationLink destination={<RecoveryView onChanged={refreshRecoveredState} />}>
          <Label title="记录与数据安全" systemImage="clock.arrow.circlepath" />
        </NavigationLink>
      </Section>

      <Section footer={<Text>旧版私有数据会在首次运行时自动迁移；以后更新脚本不需要重新录入事项。数据仍只保存在本机 Scripting 中。</Text>}>
        <HStack spacing={10}>
          <Image systemName="externaldrive.fill.badge.checkmark" foregroundStyle="systemGreen" />
          <VStack alignment="leading" spacing={2}>
            <Text font="subheadline">本机持久存储已启用</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">保存后自动刷新用户小组件</Text>
          </VStack>
        </HStack>
        <HStack>
          <Text>版本</Text>
          <Spacer />
          <Text foregroundStyle="secondaryLabel">{Script.metadata.version}</Text>
        </HStack>
        <NavigationLink destination={<UpdateView />}>
          <Label title="检查并更新版本" systemImage="arrow.down.circle" />
        </NavigationLink>
      </Section>
    </List>
  </NavigationStack>
}

function ItemEditor({
  item,
  isNew = false,
  standalone = false,
  onChanged,
}: {
  item: ManualDueItem
  isNew?: boolean
  standalone?: boolean
  onChanged: (state?: AppState) => void
}) {
  const dismiss = Navigation.useDismiss()
  const initialDate = dateKeyToLocalDate(item.dueDate, true, item.hour, item.minute)
  const [title, setTitle] = useState(item.title)
  const [kind, setKind] = useState<ItemKind>(item.kind)
  const [iconName, setIconName] = useState<string | null>(item.iconName)
  const [dueTimestamp, setDueTimestamp] = useState(initialDate.getTime())
  const [includesTime, setIncludesTime] = useState(item.includesTime)
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit | "none">(
    item.recurrence?.unit ?? "none",
  )
  const [intervalInput, setIntervalInput] = useState(
    String(item.recurrence?.interval ?? MIN_RECURRENCE_INTERVAL),
  )
  const [remindBeforeInput, setRemindBeforeInput] = useState(
    String(item.remindBeforeDays ?? MIN_REMIND_BEFORE_DAYS),
  )
  const [useMonthEnd, setUseMonthEnd] = useState(item.recurrence?.useMonthEnd ?? false)
  const [leapDayPolicy, setLeapDayPolicy] = useState<"feb28" | "mar1">(
    item.recurrence?.leapDayPolicy ?? "feb28",
  )
  const [amount, setAmount] = useState(item.amount)
  const [note, setNote] = useState(item.note)
  const [enabled, setEnabled] = useState(item.enabled)
  const [working, setWorking] = useState(false)
  const [actionGate] = useState(() => ({ busy: false }))
  const runEditorAction = async (action: () => Promise<void>) => {
    if (actionGate.busy) return
    actionGate.busy = true
    setWorking(true)
    try { await action() }
    finally { actionGate.busy = false; setWorking(false) }
  }
  const [expectedUpdatedAt] = useState<number | undefined>(
    () => isNew ? undefined : item.updatedAt,
  )
  const recurrenceInterval = parseRecurrenceIntervalInput(intervalInput)
  const remindBeforeDays = parseRemindBeforeDaysInput(remindBeforeInput)
  const intervalUnitLabel = recurrenceUnit === "none"
    ? ""
    : recurrenceIntervalUnitLabel(recurrenceUnit)

  const validationError = (): { title: string; message: string } | null => {
    if (!title.trim()) {
      return { title: "请输入名称", message: "事项名称不能为空。" }
    }
    if (recurrenceUnit !== "none" && recurrenceInterval == null) {
      return {
        title: "请输入有效间隔",
        message: `间隔必须是 ${MIN_RECURRENCE_INTERVAL}–${MAX_RECURRENCE_INTERVAL} 的正整数。`,
      }
    }
    if (remindBeforeDays == null) {
      return {
        title: "请输入有效的提前天数",
        message: `提前天数必须是 ${MIN_REMIND_BEFORE_DAYS}–${MAX_REMIND_BEFORE_DAYS} 的整数；0 表示不提前。`,
      }
    }
    return null
  }

  const buildItem = (): ManualDueItem | null => {
    const trimmedTitle = title.trim().slice(0, 120)
    if (
      !trimmedTitle
      || (recurrenceUnit !== "none" && recurrenceInterval == null)
      || remindBeforeDays == null
    ) return null
    const selectedDate = new Date(dueTimestamp)
    const dueDate = localDateKey(selectedDate)
    let recurrence = null

    if (recurrenceUnit !== "none") {
      const preserveAnchor = item.recurrence != null
        && item.recurrence.unit === recurrenceUnit
        && item.dueDate === dueDate
      recurrence = preserveAnchor
        ? {
          ...item.recurrence!,
          interval: recurrenceInterval!,
          useMonthEnd,
          leapDayPolicy,
        }
        : createRecurrenceRule(
          recurrenceUnit,
          recurrenceInterval!,
          dueDate,
          useMonthEnd,
          leapDayPolicy,
        )
    }

    return {
      ...item,
      title: trimmedTitle,
      kind,
      iconName,
      dueDate,
      includesTime,
      hour: selectedDate.getHours(),
      minute: selectedDate.getMinutes(),
      remindBeforeDays: remindBeforeDays!,
      recurrence,
      amount: amount.trim().slice(0, 60),
      note: note.trim().slice(0, 1000),
      enabled,
      updatedAt: Date.now(),
    }
  }

  const save = async () => {
    const error = validationError()
    if (error) {
      await Dialog.alert(error)
      return
    }
    const nextItem = buildItem()
    if (!nextItem) return
    try {
      const nextState = upsertItem(nextItem, expectedUpdatedAt)
      onChanged(nextState)
      const warning = await refreshAfterDataChange()
      if (warning) await Dialog.alert({ title: "事项已保存", message: warning })
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "保存失败", message: String(error) })
    }
  }

  const complete = async (skipToFuture = false) => {
    const error = validationError()
    if (error) {
      await Dialog.alert(error)
      return
    }
    const nextItem = buildItem()
    if (!nextItem) return
    let advanced: ManualDueItem
    try {
      advanced = advanceManualItem(nextItem, { skipToFuture })
    } catch (error) {
      await Dialog.alert({ title: "无法推进周期", message: String(error) })
      return
    }

    const currentText = humanDate(nextItem.dueDate, nextItem.includesTime, nextItem.hour, nextItem.minute)
    const targetText = humanDate(advanced.dueDate, advanced.includesTime, advanced.hour, advanced.minute)
    const confirmed = await Dialog.confirm({
      title: skipToFuture ? "跳至未来最近一期？" : "确认完成本期？",
      message: nextItem.recurrence
        ? `当前到期日：${currentText}\n将变更为：${targetText}`
        : "一次性事项将移入「已完成或隐藏」。",
      cancelLabel: "取消",
      confirmLabel: "确认",
    })
    if (!confirmed) return

    try {
      const nextState = completeManualItem(nextItem, expectedUpdatedAt, skipToFuture)
      onChanged(nextState)
      const warning = await refreshAfterDataChange()
      if (warning) await Dialog.alert({ title: "本期已完成", message: warning })
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "保存完成状态失败", message: String(error) })
    }
  }

  const remove = async () => {
    const confirmed = await Dialog.confirm({
      title: "删除这个事项？",
      message: "删除前会自动保留本地快照，可在「记录与数据安全」恢复整份快照；该操作会移除这条手动事项。",
      cancelLabel: "取消",
      confirmLabel: "删除",
    })
    if (!confirmed) return
    try {
      const nextState = deleteItem(item.id, expectedUpdatedAt)
      onChanged(nextState)
      const warning = await refreshAfterDataChange()
      if (warning) await Dialog.alert({ title: "事项已删除", message: warning })
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "删除失败", message: String(error) })
    }
  }

  const currentFormItem = buildItem()
  const currentStatus = currentFormItem ? dueStatus(currentFormItem) : null

  return <List
    listStyle="insetGroup"
    navigationTitle={isNew ? "新增事项" : "编辑事项"}
    navigationBarTitleDisplayMode="inline"
    disabled={working}
    toolbar={{
      cancellationAction: standalone
        ? <Button title="关闭" action={() => dismiss()} />
        : undefined,
      confirmationAction: <Button title={working ? "正在处理…" : "保存"} disabled={working} action={() => { void runEditorAction(save) }} />,
    }}
  >
    <Section header={<Text>基本信息</Text>}>
      <TextField
        title="名称"
        value={title}
        onChanged={setTitle}
        prompt="例如：招商银行信用卡"
      />
      <Picker
        title="类型"
        value={kind}
        onChanged={(value: unknown) => {
          if (isItemKind(value)) setKind(value)
        }}
        pickerStyle="menu"
      >
        {ITEM_KIND_DEFINITIONS.map(definition => (
          <Text key={definition.value} tag={definition.value}>{definition.label}</Text>
        ))}
      </Picker>
      <NavigationLink
        destination={
          <IconPicker
            title={title}
            kind={kind}
            value={iconName}
            onChanged={setIconName}
          />
        }
      >
        <IconSettingRow title={title} kind={kind} value={iconName} />
      </NavigationLink>
      <Toggle
        title="包含具体时间"
        systemImage="clock"
        value={includesTime}
        onChanged={setIncludesTime}
      />
      <DatePicker
        title="到期时间"
        value={dueTimestamp}
        onChanged={setDueTimestamp}
        displayedComponents={includesTime ? ["date", "hourAndMinute"] : ["date"]}
        datePickerStyle="compact"
      />
      <Toggle
        title="在组件中显示"
        systemImage="eye"
        value={enabled}
        onChanged={setEnabled}
      />
    </Section>

    <Section
      header={<Text>重复</Text>}
      footer={
        <Text>{`间隔可输入 ${MIN_RECURRENCE_INTERVAL}–${MAX_RECURRENCE_INTERVAL} 的正整数。提前提醒可输入 ${MIN_REMIND_BEFORE_DAYS}–${MAX_REMIND_BEFORE_DAYS} 天，0 表示不提前；提前处理从提前日零点开始。真实到期日、月末规则和周期锚点保持不变。需要横幅通知，请在主界面的「通知与提醒」中开启。`}</Text>
      }
    >
      <Picker
        title="周期"
        value={recurrenceUnit}
        onChanged={setRecurrenceUnit as any}
        pickerStyle="menu"
      >
        <Text tag="none">不重复</Text>
        <Text tag="day">按天</Text>
        <Text tag="week">按周</Text>
        <Text tag="month">按月</Text>
        <Text tag="year">按年</Text>
      </Picker>
      {recurrenceUnit !== "none"
        ? <LabeledContent title="间隔">
          <HStack spacing={6}>
            <TextField
              title="间隔数值"
              value={intervalInput}
              onChanged={setIntervalInput}
              prompt={`${MIN_RECURRENCE_INTERVAL}–${MAX_RECURRENCE_INTERVAL}`}
              keyboardType="numberPad"
              labelsHidden={true}
              multilineTextAlignment="trailing"
              frame={{ width: 72, alignment: "trailing" }}
            />
            <Text foregroundStyle="secondaryLabel">{intervalUnitLabel}</Text>
          </HStack>
        </LabeledContent>
        : null}
      <LabeledContent title="提前提醒">
        <HStack spacing={6}>
          <TextField
            title="提前天数"
            value={remindBeforeInput}
            onChanged={setRemindBeforeInput}
            prompt={`${MIN_REMIND_BEFORE_DAYS}–${MAX_REMIND_BEFORE_DAYS}`}
            keyboardType="numberPad"
            labelsHidden={true}
            multilineTextAlignment="trailing"
            frame={{ width: 72, alignment: "trailing" }}
          />
          <Text foregroundStyle="secondaryLabel">天</Text>
        </HStack>
      </LabeledContent>
      {currentFormItem && currentFormItem.remindBeforeDays > 0 ? <LabeledContent title="开始处理">
        <Text font="subheadline" foregroundStyle="secondaryLabel">
          {humanDate(actionDateKey(currentFormItem.dueDate, currentFormItem.remindBeforeDays), true, 0, 0)}
        </Text>
      </LabeledContent> : null}
      {recurrenceUnit === "month"
        ? <Toggle
          title="始终使用月末"
          value={useMonthEnd}
          onChanged={setUseMonthEnd}
        />
        : null}
      {recurrenceUnit === "year"
        ? <Picker
          title="非闰年的 2 月 29 日"
          value={leapDayPolicy}
          onChanged={setLeapDayPolicy as any}
          pickerStyle="menu"
        >
          <Text tag="feb28">使用 2 月 28 日</Text>
          <Text tag="mar1">使用 3 月 1 日</Text>
        </Picker>
        : null}
    </Section>

    <Section header={<Text>可选信息</Text>}>
      <TextField
        title="金额"
        value={amount}
        onChanged={setAmount}
        prompt="例如：HK$ 888"
      />
      <TextField
        title="备注"
        value={note}
        onChanged={setNote}
        prompt="卡号尾号、套餐或其他说明"
        axis="vertical"
        lineLimit={{ min: 2, max: 5 }}
      />
    </Section>

    {!isNew
      ? <Section
        header={<Text>本期操作</Text>}
        footer={recurrenceUnit !== "none"
          ? <Text>「完成本期」只推进一次；若积累多期逾期，可选择直接跳至未来最近一期。</Text>
          : undefined}
      >
        <Button
          title={recurrenceUnit !== "none" ? "完成本期" : "标记完成"}
          systemImage="checkmark.circle"
          action={() => { void runEditorAction(() => complete(false)) }}
        />
        {recurrenceUnit !== "none" && currentStatus?.overdue
          ? <Button
            title="跳至未来最近一期"
            systemImage="forward.end"
            action={() => { void runEditorAction(() => complete(true)) }}
          />
          : null}
      </Section>
      : null}

    {!isNew
      ? <Section>
        <Button
          title="删除事项"
          systemImage="trash"
          role="destructive"
          action={() => { void runEditorAction(remove) }}
        />
      </Section>
      : null}
  </List>
}

function ManualItemsSection({
  title,
  items,
  onChanged,
}: {
  title: string
  items: ManualDueItem[]
  onChanged: (state?: AppState) => void
}) {
  if (items.length === 0) return null
  return <Section header={<Text>{title}</Text>}>
    {items.map(item => (
      <NavigationLink
        key={item.id}
        destination={<ItemEditor item={item} onChanged={onChanged} />}
      >
        <ManualItemRow item={item} />
      </NavigationLink>
    ))}
  </Section>
}

function ManualItemRow({ item, inactive = false }: { item: ManualDueItem; inactive?: boolean }) {
  const status = dueStatus(item)
  const icon = resolveDueIcon(item.title, item.kind, item.iconName)
  return <HStack spacing={10}>
    <Image
      systemName={icon.name}
      foregroundStyle={inactive ? "tertiaryLabel" : icon.color}
      frame={{ width: 24 }}
    />
    <VStack alignment="leading" spacing={2}>
      <Text fontWeight="semibold" lineLimit={1} foregroundStyle={inactive ? "secondaryLabel" : "label"}>
        {item.title}
      </Text>
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>
        {humanDate(item.dueDate, item.includesTime, item.hour, item.minute)} · {recurrenceLabel(item.recurrence)}
        {item.remindBeforeDays > 0 ? ` · 提前 ${item.remindBeforeDays} 天` : ""}
      </Text>
    </VStack>
    <Spacer />
    <Text
      font="caption"
      fontWeight="semibold"
      foregroundStyle={inactive ? "tertiaryLabel" : status.color}
      lineLimit={1}
    >
      {inactive ? "已隐藏" : status.label}
    </Text>
  </HStack>
}

function IconSettingRow({
  title,
  kind,
  value,
}: {
  title: string
  kind: ItemKind
  value: string | null
}) {
  const icon = resolveDueIcon(title, kind, value)
  return <HStack spacing={10}>
    <Image systemName={icon.name} foregroundStyle={icon.color} frame={{ width: 24 }} />
    <Text>图标</Text>
    <Spacer />
    <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>
      {value == null ? `自动 · ${icon.label}` : icon.label}
    </Text>
  </HStack>
}

function IconPicker({
  title,
  kind,
  value,
  onChanged,
}: {
  title: string
  kind: ItemKind
  value: string | null
  onChanged: (value: string | null) => void
}) {
  const dismiss = Navigation.useDismiss()
  const automatic = resolveDueIcon(title, kind)

  const choose = (next: string | null) => {
    onChanged(next)
    dismiss()
  }

  return <List
    listStyle="insetGroup"
    navigationTitle="选择图标"
    navigationBarTitleDisplayMode="inline"
  >
    <Section footer={<Text>自动匹配只在本机根据名称和类型判断，不会上传事项名称。</Text>}>
      <Button buttonStyle="plain" action={() => choose(null)}>
        <IconChoiceRow
          name={automatic.name}
          color={automatic.color}
          title="自动匹配"
          detail={`当前：${automatic.label}`}
          selected={value == null}
        />
      </Button>
    </Section>
    {DUE_ICON_GROUPS.map(group => (
      <Section key={group} header={<Text>{group}</Text>}>
        {DUE_ICON_OPTIONS
          .filter(option => option.group === group)
          .map(option => (
            <Button
              key={option.name}
              buttonStyle="plain"
              action={() => choose(option.name)}
            >
              <IconChoiceRow
                name={option.name}
                color={option.color}
                title={option.label}
                selected={value === option.name}
              />
            </Button>
          ))}
      </Section>
    ))}
  </List>
}

function IconChoiceRow({
  name,
  color,
  title,
  detail,
  selected,
}: {
  name: string
  color: string
  title: string
  detail?: string
  selected: boolean
}) {
  return <HStack spacing={12}>
    <Image systemName={name} foregroundStyle={color} frame={{ width: 26 }} />
    <VStack alignment="leading" spacing={1}>
      <Text foregroundStyle="label">{title}</Text>
      {detail
        ? <Text font="caption" foregroundStyle="secondaryLabel">{detail}</Text>
        : null}
    </VStack>
    <Spacer />
    {selected
      ? <Image systemName="checkmark" foregroundStyle="systemBlue" fontWeight="semibold" />
      : null}
  </HStack>
}

function ReminderCalendarPicker({
  selectedIDs,
  onChanged,
}: {
  selectedIDs: string[]
  onChanged: (calendarIDs: string[]) => Promise<void>
}) {
  const dismiss = Navigation.useDismiss()
  const [selection, setSelection] = useState<string[]>(
    () => normalizeReminderCalendarIDs(selectedIDs),
  )
  const [calendars, setCalendars] = useState<ReminderCalendarChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadCalendars = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const granted = await Script.requestAccess(["calendar", "reminders"])
      if (!granted.includes("calendar") || !granted.includes("reminders")) {
        throw new Error("需要日历与提醒事项权限，才能读取可选列表。")
      }
      const available = await Calendar.forReminders()
      const byIdentifier = new Map<string, ReminderCalendarChoice>()
      for (const calendar of available) {
        const id = typeof calendar?.identifier === "string"
          ? calendar.identifier.trim()
          : ""
        if (!id || byIdentifier.has(id)) continue
        byIdentifier.set(id, {
          id,
          title: String(calendar.title || "未命名列表").slice(0, 100),
          sourceTitle: String(calendar.source?.title || "").slice(0, 100),
          readOnly: calendar.allowsContentModifications === false,
        })
      }
      setCalendars([...byIdentifier.values()].sort((left, right) => {
        const sourceOrder = left.sourceTitle.localeCompare(right.sourceTitle, "zh-Hans-CN")
        return sourceOrder || left.title.localeCompare(right.title, "zh-Hans-CN")
      }))
    } catch (error) {
      setLoadError(String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCalendars()
  }, [])

  const toggleCalendar = (id: string) => {
    const knownIDs = new Set(calendars.map(calendar => calendar.id))
    const current = selection.filter(identifier => knownIDs.has(identifier))
    setSelection(normalizeReminderCalendarIDs(
      current.includes(id)
        ? current.filter(identifier => identifier !== id)
        : [...current, id],
    ))
  }

  const availableIDs = new Set(calendars.map(calendar => calendar.id))
  const unavailableCount = selection.filter(identifier => !availableIDs.has(identifier)).length

  const save = async () => {
    if (saving || loading || loadError) return
    if (unavailableCount > 0) {
      await Dialog.alert({
        title: "无法保存列表选择",
        message: `有 ${unavailableCount} 个原先选择的列表已不可用。请改选现有列表，或选择“全部列表”后再保存。`,
      })
      return
    }
    setSaving(true)
    try {
      await onChanged(normalizeReminderCalendarIDs(selection))
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "列表设置保存失败", message: String(error) })
    } finally {
      setSaving(false)
    }
  }

  return <List
    listStyle="insetGroup"
    navigationTitle="提醒事项列表"
    navigationBarTitleDisplayMode="inline"
    toolbar={{
      confirmationAction: <Button
        title={saving ? "正在保存…" : "完成"}
        action={() => { void save() }}
      />,
    }}
  >
    <Section footer={<Text>不选择具体列表时会读取全部列表；也可以同时选择多个列表。</Text>}>
      <Button buttonStyle="plain" action={() => setSelection([])}>
        <ReminderCalendarRow
          title="全部列表"
          detail="包含所有账户中的提醒事项"
          selected={selection.length === 0}
          iconName="tray.full.fill"
        />
      </Button>
    </Section>

    <Section
      header={<Text>具体列表</Text>}
      footer={unavailableCount > 0
        ? <Text foregroundStyle="systemOrange">有 {unavailableCount} 个原先选择的列表已不可用；请选择现有列表或改为全部列表。</Text>
        : undefined}
    >
      {loading
        ? <HStack spacing={10}>
          <Image systemName="arrow.clockwise" foregroundStyle="secondaryLabel" />
          <Text foregroundStyle="secondaryLabel">正在读取列表…</Text>
        </HStack>
        : null}
      {!loading && loadError
        ? <Button
          title="读取失败，点此重试"
          systemImage="exclamationmark.triangle"
          action={() => { void loadCalendars() }}
        />
        : null}
      {!loading && !loadError && calendars.length === 0
        ? <Text foregroundStyle="secondaryLabel">没有可用的提醒事项列表</Text>
        : null}
      {!loading && !loadError
        ? calendars.map(calendar => (
          <Button
            key={calendar.id}
            buttonStyle="plain"
            action={() => toggleCalendar(calendar.id)}
          >
            <ReminderCalendarRow
              title={calendar.title}
              detail={[
                calendar.sourceTitle,
                calendar.readOnly ? "只读" : "",
              ].filter(Boolean).join(" · ") || undefined}
              selected={selection.includes(calendar.id)}
              iconName="list.bullet.circle.fill"
            />
          </Button>
        ))
        : null}
    </Section>
  </List>
}

function ReminderCalendarRow({
  title,
  detail,
  selected,
  iconName,
}: {
  title: string
  detail?: string
  selected: boolean
  iconName: string
}) {
  return <HStack spacing={12}>
    <Image systemName={iconName} foregroundStyle="systemBlue" frame={{ width: 26 }} />
    <VStack alignment="leading" spacing={1}>
      <Text foregroundStyle="label">{title}</Text>
      {detail
        ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{detail}</Text>
        : null}
    </VStack>
    <Spacer />
    {selected
      ? <Image systemName="checkmark" foregroundStyle="systemBlue" fontWeight="semibold" />
      : null}
  </HStack>
}

function ReminderStatusRow({ status }: { status: ReminderStatus }) {
  let title = `${status.count} 项有到期日期的未完成提醒`
  let color = "secondaryLabel"
  let icon = "checkmark.circle"
  if (status.loading) {
    title = "正在读取提醒事项…"
    icon = "arrow.clockwise"
  } else if (status.error) {
    title = status.live
      ? `已读取 ${status.count} 项，但缓存保存失败`
      : status.fromCache && status.count > 0
        ? `使用缓存：${status.count} 项`
        : "读取失败或缓存已过期，请检查权限"
    color = "systemOrange"
    icon = "exclamationmark.triangle"
  }
  return <VStack alignment="leading" spacing={5}>
    <HStack>
      <Image systemName={icon} foregroundStyle={color} />
      <Text font="caption" foregroundStyle={color} lineLimit={2}>{title}</Text>
    </HStack>
    <Text font="caption" foregroundStyle="secondaryLabel">
      {status.fetchedAt ? `上次成功读取：${new Date(status.fetchedAt).toLocaleString()}` : "尚无成功同步记录"}
    </Text>
    {status.error ? <Text font="caption" foregroundStyle="systemOrange" lineLimit={5}>
      {status.error}。可点「立即更新」重试；若列表已失效，请在「提醒事项列表」重新选择。
    </Text> : null}
  </VStack>
}

function StartupRecoveryView({ onRecovered }: { onRecovered: () => void }) {
  const dismiss = Navigation.useDismiss()
  return <RecoveryView recoveryMode onChanged={() => { onRecovered(); dismiss() }} />
}

async function run() {
  // The recovery screen must not require a successful loadState() to mount.
  const recovery = readRecoveryStatus()
  if (recovery.status !== "ready" && recovery.status !== "missing") {
    let recovered = false
    await Navigation.present({ element: <NavigationStack>
      <StartupRecoveryView onRecovered={() => { recovered = true }} />
    </NavigationStack> })
    if (!recovered) { Script.exit(); return }
  }
  const notificationRefresh = reconcileNotifications([], { loadItems: () => loadState().items })
  const action = typeof Script.queryParameters?.action === "string"
    ? Script.queryParameters.action
    : ""
  const id = typeof Script.queryParameters?.id === "string"
    ? Script.queryParameters.id
    : ""
  const directItem = action === "edit" && id ? findItem(id) : null

  if (action === "widget-status") {
    await Navigation.present({ element: <NavigationStack><WidgetActionStatusView standalone /></NavigationStack> })
  } else if (directItem) {
    await Navigation.present({
      element: <NavigationStack>
        <ItemEditor item={directItem} standalone onChanged={() => undefined} />
      </NavigationStack>,
    })
  } else {
    await Navigation.present({ element: <DueManagerApp /> })
  }
  await notificationRefresh
  Script.exit()
}

run().catch(async error => {
  await Dialog.alert({ title: "到期管家运行失败", message: String(error) })
  Script.exit()
})
