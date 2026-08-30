import { parseDateKey } from "./date"
import {
  loadState,
  manualItemsForDisplay,
  SHARED_STORAGE_OPTIONS,
} from "./storage"
import type { DisplayDueItem, ItemKind } from "./types"

export const WIDGET_COMPLETION_FEEDBACK_KEY = "due-manager-widget-completion-feedback-v1"

const COMPLETION_FEEDBACK_TTL_MS = 30_000
const COMPLETION_FEEDBACK_LIMIT = 1

type CompletionFeedbackEntry = {
  createdAt: number
  item: DisplayDueItem
}

type CompletionFeedbackStore = {
  generation: number
  phase: 0 | 1
  entries: CompletionFeedbackEntry[]
}

export type WidgetCompletionTransition = {
  generation: number
  phase: 0 | 1
  items: DisplayDueItem[]
}

export function findManualDisplayItemForCompletion(
  id: string,
  completionKey: string,
): DisplayDueItem | null {
  return manualItemsForDisplay(loadState()).find(item => (
    item.id === id && item.completionKey === completionKey
  )) ?? null
}

/**
 * Stores a short-lived copy of the completed occurrence. The real data is
 * already committed. The phase flips once per interaction so the widget
 * can crossfade between two stable layers after a single timeline reload.
 */
export function writeWidgetCompletionFeedback(
  item: DisplayDueItem,
  now = Date.now(),
): boolean {
  const current = readCompletionFeedbackStore(now)
  const generation = current.generation >= Number.MAX_SAFE_INTEGER - 1
    ? 1
    : current.generation + 1
  const phase: 0 | 1 = current.phase === 0 ? 1 : 0
  const { isCompleting: _ignored, ...itemWithoutCompletionState } = item
  const snapshot = {
    ...itemWithoutCompletionState,
    note: itemWithoutCompletionState.note.slice(0, 120),
  }
  return Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
    schemaVersion: 2,
    generation,
    phase,
    entries: [{ createdAt: now, item: snapshot }],
  }, SHARED_STORAGE_OPTIONS)
}

export function clearWidgetCompletionFeedback(
  source?: DisplayDueItem["source"],
  id?: string,
  completionKey?: string,
  now = Date.now(),
): void {
  if (!source || !id || !completionKey) {
    Storage.remove(WIDGET_COMPLETION_FEEDBACK_KEY, SHARED_STORAGE_OPTIONS)
    Storage.remove(WIDGET_COMPLETION_FEEDBACK_KEY)
    return
  }
  const current = readCompletionFeedbackStore(now)
  const entries = current.entries.filter(entry => !(
    entry.item.source === source
    && entry.item.id === id
    && entry.item.completionKey === completionKey
  ))
  Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
    schemaVersion: 2,
    generation: current.generation,
    phase: current.phase,
    entries,
  }, SHARED_STORAGE_OPTIONS)
}

export function readWidgetCompletionFeedback(now = Date.now()): DisplayDueItem[] {
  return readWidgetCompletionTransition(now).items
}

export function readWidgetCompletionTransition(
  now = Date.now(),
): WidgetCompletionTransition {
  const current = readCompletionFeedbackStore(now)
  return {
    generation: current.generation,
    phase: current.phase,
    items: current.entries.map(entry => ({
      ...entry.item,
      stale: false,
      isCompleting: true,
    })),
  }
}

export function mergeWidgetCompletionFeedback(
  items: readonly DisplayDueItem[],
  feedback: readonly DisplayDueItem[],
): DisplayDueItem[] {
  if (feedback.length === 0) return [...items]
  const completingItems = new Set(feedback.map(item => itemIdentity(item)))
  return [
    ...items.filter(item => !completingItems.has(itemIdentity(item))),
    ...feedback,
  ]
}

function readCompletionFeedbackStore(now: number): CompletionFeedbackStore {
  const shared = Storage.get<unknown>(
    WIDGET_COMPLETION_FEEDBACK_KEY,
    SHARED_STORAGE_OPTIONS,
  )
  const legacy = shared == null
    ? Storage.get<unknown>(WIDGET_COMPLETION_FEEDBACK_KEY)
    : null
  const raw = shared ?? legacy
  if (!isRecord(raw) || !Array.isArray(raw.entries)) {
    return { generation: 0, phase: 0, entries: [] }
  }
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) {
    return { generation: 0, phase: 0, entries: [] }
  }
  if (shared == null && legacy != null) {
    Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, raw, SHARED_STORAGE_OPTIONS)
  }
  const isCurrentSchema = raw.schemaVersion === 2
  const phase: 0 | 1 = isCurrentSchema && raw.phase === 1 ? 1 : 0
  const generation = isCurrentSchema
    && typeof raw.generation === "number"
    && Number.isSafeInteger(raw.generation)
    && raw.generation >= 0
    ? raw.generation
    : phase
  const entries = raw.entries
    .slice(-COMPLETION_FEEDBACK_LIMIT)
    .map(value => normalizeCompletionFeedbackEntry(value, now))
    .filter((entry): entry is CompletionFeedbackEntry => entry != null)
  if (shared != null && entries.length !== raw.entries.length) {
    Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
      schemaVersion: 2,
      generation,
      phase,
      entries,
    }, SHARED_STORAGE_OPTIONS)
  }
  return { generation, phase, entries }
}

function normalizeCompletionFeedbackEntry(
  raw: unknown,
  now: number,
): CompletionFeedbackEntry | null {
  if (!isRecord(raw) || typeof raw.createdAt !== "number" || !Number.isFinite(raw.createdAt)) {
    return null
  }
  const age = now - raw.createdAt
  if (age < -5_000 || age > COMPLETION_FEEDBACK_TTL_MS) return null
  const item = normalizeCompletionFeedbackItem(raw.item)
  return item ? { createdAt: raw.createdAt, item } : null
}

function normalizeCompletionFeedbackItem(raw: unknown): DisplayDueItem | null {
  if (!isRecord(raw)) return null
  const source = raw.source === "manual" || raw.source === "reminder" ? raw.source : null
  const kind = raw.kind === "reminder" || isItemKind(raw.kind) ? raw.kind : null
  const dueDate = typeof raw.dueDate === "string" ? raw.dueDate : ""
  if (
    !source
    || !kind
    || typeof raw.id !== "string"
    || typeof raw.completionKey !== "string"
    || typeof raw.title !== "string"
    || typeof raw.iconName !== "string"
    || typeof raw.iconColor !== "string"
    || !parseDateKey(dueDate)
    || typeof raw.includesTime !== "boolean"
    || typeof raw.dueTimestamp !== "number"
    || !Number.isFinite(raw.dueTimestamp)
  ) {
    return null
  }
  if ((source === "reminder") !== (kind === "reminder")) return null
  return {
    id: raw.id.slice(0, 200),
    source,
    completionKey: raw.completionKey.slice(0, 240),
    title: raw.title.slice(0, 200),
    kind,
    iconName: raw.iconName.slice(0, 100),
    iconColor: raw.iconColor.slice(0, 100),
    dueDate,
    includesTime: raw.includesTime,
    hour: clampInteger(raw.hour, 0, 23, 0),
    minute: clampInteger(raw.minute, 0, 59, 0),
    dueTimestamp: raw.dueTimestamp,
    amount: typeof raw.amount === "string" ? raw.amount.slice(0, 60) : "",
    note: typeof raw.note === "string" ? raw.note.slice(0, 1000) : "",
    priority: clampInteger(raw.priority, 0, 10, 0),
    stale: false,
  }
}

function itemIdentity(item: Pick<DisplayDueItem, "source" | "id">): string {
  return `${item.source}\u0000${item.id}`
}

function isItemKind(value: unknown): value is ItemKind {
  return value === "creditCard"
    || value === "subscription"
    || value === "bill"
    || value === "custom"
}

function isRecord(value: unknown): value is Record<string, any> {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}
