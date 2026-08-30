import {
  Button,
  DatePicker,
  HStack,
  Image,
  Label,
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
import {
  advanceManualItem,
  createRecurrenceRule,
  dateKeyToLocalDate,
  dueStatus,
  humanDate,
  localDateKey,
} from "./src/date"
import {
  DUE_ICON_GROUPS,
  DUE_ICON_OPTIONS,
  resolveDueIcon,
} from "./src/icons"
import { recurrenceLabel } from "./src/presentation"
import {
  clearReminderSnapshot,
  loadReminderItems,
  sortDueItems,
} from "./src/reminders"
import {
  createDraftItem,
  deleteItem,
  findItem,
  loadState,
  manualItemsForDisplay,
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

type ReminderStatus = {
  loading: boolean
  count: number
  fetchedAt: number | null
  fromCache: boolean
  error: string | null
}

const EMPTY_REMINDER_STATUS: ReminderStatus = {
  loading: false,
  count: 0,
  fetchedAt: null,
  fromCache: false,
  error: null,
}

function DueManagerApp() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<AppState>(() => loadState())
  const [newItem, setNewItem] = useState<ManualDueItem>(() => createDraftItem())
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus>(EMPTY_REMINDER_STATUS)

  const refreshState = (nextState?: AppState) => {
    setState(nextState ?? loadState())
  }

  const finishNewItem = (nextState?: AppState) => {
    refreshState(nextState)
    setNewItem(createDraftItem())
  }

  const refreshReminders = async () => {
    if (!loadState().settings.includeReminders) {
      setReminderStatus(EMPTY_REMINDER_STATUS)
      return
    }
    setReminderStatus(status => ({ ...status, loading: true }))
    const current = loadState()
    const result = await loadReminderItems(current.settings.reminderHorizonDays)
    setReminderStatus({
      loading: false,
      count: result.items.length,
      fetchedAt: result.fetchedAt,
      fromCache: result.fromCache,
      error: result.error,
    })
    await reloadWidgetsAfterStorageWrite()
  }

  useEffect(() => {
    if (state.settings.includeReminders) void refreshReminders()
    else void reloadWidgetsAfterStorageWrite()
  }, [])

  const setReminderIntegration = async (enabled: boolean) => {
    if (!enabled) {
      try {
        const next = updateSettings({ includeReminders: false })
        clearReminderSnapshot()
        refreshState(next)
        setReminderStatus(EMPTY_REMINDER_STATUS)
        await reloadWidgetsAfterStorageWrite()
      } catch (error) {
        await Dialog.alert({ title: "无法关闭提醒事项", message: String(error) })
      }
      return
    }

    setReminderStatus(status => ({ ...status, loading: true }))
    try {
      const granted = await Script.requestAccess(["reminders"])
      if (!granted.includes("reminders")) {
        setReminderStatus({ ...EMPTY_REMINDER_STATUS, error: "未授予提醒事项权限" })
        await Dialog.alert({
          title: "需要提醒事项权限",
          message: "请允许该脚本读取提醒事项，再重试此开关。",
        })
        return
      }

      const next = updateSettings({ includeReminders: true })
      refreshState(next)
      const result = await loadReminderItems(next.settings.reminderHorizonDays)
      setReminderStatus({
        loading: false,
        count: result.items.length,
        fetchedAt: result.fetchedAt,
        fromCache: result.fromCache,
        error: result.error,
      })
      if (result.error && !result.fromCache) {
        await Dialog.alert({
          title: "无法读取提醒事项",
          message: "请在 iOS 设置中检查 Scripting 的提醒事项权限。\n\n" + result.error,
        })
      }
      await reloadWidgetsAfterStorageWrite()
    } catch (error) {
      setReminderStatus({ ...EMPTY_REMINDER_STATUS, error: String(error) })
      await Dialog.alert({ title: "授权失败", message: String(error) })
    }
  }

  const setShowAmounts = async (showAmounts: boolean) => {
    try {
      const next = updateSettings({ showAmounts })
      refreshState(next)
      await reloadWidgetsAfterStorageWrite()
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
  const todayItems = activeItems.filter(item => {
    const status = dueStatus(item)
    return !status.overdue && status.days === 0
  })
  const upcomingItems = activeItems.filter(item => {
    const status = dueStatus(item)
    return !status.overdue && status.days > 0
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
      <Section footer={<Text>组件左侧圆圈用于完成当前一期；周期事项只推进一期，不会自动跳过逾期记录。</Text>}>
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
            <Text font="caption" foregroundStyle="tertiaryLabel">添加信用卡、订阅、账单或其他周期日期。</Text>
          </VStack>
          : null}
      </Section>

      <ManualItemsSection title="已逾期" items={overdueItems} onChanged={refreshState} />
      <ManualItemsSection title="今天" items={todayItems} onChanged={refreshState} />
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
        footer={<Text>只读取未完成且有到期日期的提醒；数据仅保存在当前 Scripting 脚本中。</Text>}
      >
        <Toggle
          title="显示 Apple 提醒事项"
          systemImage="checklist"
          value={state.settings.includeReminders}
          onChanged={(value: boolean) => { void setReminderIntegration(value) }}
        />
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
          action={async () => await reloadUserWidgets()}
        />
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
  const [interval, setInterval] = useState(item.recurrence?.interval ?? 1)
  const [useMonthEnd, setUseMonthEnd] = useState(item.recurrence?.useMonthEnd ?? false)
  const [leapDayPolicy, setLeapDayPolicy] = useState<"feb28" | "mar1">(
    item.recurrence?.leapDayPolicy ?? "feb28",
  )
  const [amount, setAmount] = useState(item.amount)
  const [note, setNote] = useState(item.note)
  const [enabled, setEnabled] = useState(item.enabled)

  const buildItem = (): ManualDueItem | null => {
    const trimmedTitle = title.trim().slice(0, 120)
    if (!trimmedTitle) return null
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
          interval,
          useMonthEnd,
          leapDayPolicy,
        }
        : createRecurrenceRule(
          recurrenceUnit,
          interval,
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
      recurrence,
      amount: amount.trim().slice(0, 60),
      note: note.trim().slice(0, 1000),
      enabled,
      updatedAt: Date.now(),
    }
  }

  const save = async () => {
    const nextItem = buildItem()
    if (!nextItem) {
      await Dialog.alert({ title: "请输入名称", message: "事项名称不能为空。" })
      return
    }
    try {
      const nextState = upsertItem(nextItem)
      onChanged(nextState)
      await reloadWidgetsAfterStorageWrite()
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "保存失败", message: String(error) })
    }
  }

  const complete = async (skipToFuture = false) => {
    const nextItem = buildItem()
    if (!nextItem) {
      await Dialog.alert({ title: "请输入名称", message: "事项名称不能为空。" })
      return
    }
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
      const nextState = upsertItem(advanced)
      onChanged(nextState)
      await reloadWidgetsAfterStorageWrite()
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "保存完成状态失败", message: String(error) })
    }
  }

  const remove = async () => {
    const confirmed = await Dialog.confirm({
      title: "删除这个事项？",
      message: "此操作无法撤销。",
      cancelLabel: "取消",
      confirmLabel: "删除",
    })
    if (!confirmed) return
    try {
      const nextState = deleteItem(item.id)
      onChanged(nextState)
      await reloadWidgetsAfterStorageWrite()
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "删除失败", message: String(error) })
    }
  }

  const intervals = [
    ...Array.from({ length: 12 }, (_, index) => index + 1),
    ...(interval > 12 ? [interval] : []),
  ]
  const currentFormItem = buildItem()
  const currentStatus = currentFormItem ? dueStatus(currentFormItem) : null

  return <List
    listStyle="insetGroup"
    navigationTitle={isNew ? "新增事项" : "编辑事项"}
    navigationBarTitleDisplayMode="inline"
    toolbar={{
      cancellationAction: standalone
        ? <Button title="关闭" action={() => dismiss()} />
        : undefined,
      confirmationAction: <Button title="保存" action={() => { void save() }} />,
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
        onChanged={setKind as any}
        pickerStyle="menu"
      >
        <Text tag="creditCard">信用卡</Text>
        <Text tag="subscription">订阅</Text>
        <Text tag="bill">账单</Text>
        <Text tag="custom">其他</Text>
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
      footer={<Text>月末规则会正确处理 28/29/30/31 号。编辑到期日期会同时把它设为后续周期的新锚点。</Text>}
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
        ? <Picker
          title="间隔"
          value={interval}
          onChanged={setInterval as any}
          pickerStyle="menu"
        >
          {intervals.map(value => <Text key={value} tag={value}>{value}</Text>)}
        </Picker>
        : null}
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
        footer={currentFormItem?.recurrence
          ? <Text>「完成本期」只推进一次；若积累多期逾期，可选择直接跳至未来最近一期。</Text>
          : undefined}
      >
        <Button
          title={currentFormItem?.recurrence ? "完成本期" : "标记完成"}
          systemImage="checkmark.circle"
          action={() => { void complete(false) }}
        />
        {currentFormItem?.recurrence && currentStatus?.overdue
          ? <Button
            title="跳至未来最近一期"
            systemImage="forward.end"
            action={() => { void complete(true) }}
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
          action={() => { void remove() }}
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

function ReminderStatusRow({ status }: { status: ReminderStatus }) {
  let title = `${status.count} 项有到期日期的未完成提醒`
  let color = "secondaryLabel"
  let icon = "checkmark.circle"
  if (status.loading) {
    title = "正在读取提醒事项…"
    icon = "arrow.clockwise"
  } else if (status.error) {
    title = status.fromCache && status.count > 0
      ? `使用缓存：${status.count} 项`
      : "读取失败或缓存已过期，请检查权限"
    color = "systemOrange"
    icon = "exclamationmark.triangle"
  }
  return <HStack>
    <Image systemName={icon} foregroundStyle={color} />
    <Text font="caption" foregroundStyle={color} lineLimit={2}>{title}</Text>
  </HStack>
}

async function run() {
  const action = typeof Script.queryParameters?.action === "string"
    ? Script.queryParameters.action
    : ""
  const id = typeof Script.queryParameters?.id === "string"
    ? Script.queryParameters.id
    : ""
  const directItem = action === "edit" && id ? findItem(id) : null

  if (directItem) {
    await Navigation.present({
      element: <NavigationStack>
        <ItemEditor item={directItem} standalone onChanged={() => undefined} />
      </NavigationStack>,
    })
  } else {
    await Navigation.present({ element: <DueManagerApp /> })
  }
  Script.exit()
}

run().catch(async error => {
  await Dialog.alert({ title: "到期管家运行失败", message: String(error) })
  Script.exit()
})
