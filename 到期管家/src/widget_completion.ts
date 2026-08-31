import {
  loadState,
  manualItemsForDisplay,
  SHARED_STORAGE_OPTIONS,
} from "./storage"
import type { DisplayDueItem } from "./types"

export const WIDGET_COMPLETION_FEEDBACK_KEY = "due-manager-widget-completion-feedback-v1"

type CompletionFeedbackStore = {
  generation: number
  phase: 0 | 1
}

export type WidgetCompletionTransition = {
  generation: number
  phase: 0 | 1
  /** Kept for source compatibility. Completed items are never rendered again. */
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
 * Advances a lightweight value used by WidgetKit to animate the next timeline
 * entry. No completed item snapshot is retained, so a delayed refresh can never
 * bring an already completed occurrence back into the interactive queue.
 */
export function writeWidgetCompletionFeedback(
  _item: DisplayDueItem,
  _now = Date.now(),
): boolean {
  const current = readCompletionFeedbackStore()
  const generation = current.generation >= Number.MAX_SAFE_INTEGER - 1
    ? 1
    : current.generation + 1
  const phase: 0 | 1 = current.phase === 0 ? 1 : 0
  return Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
    schemaVersion: 3,
    generation,
    phase,
  }, SHARED_STORAGE_OPTIONS)
}

export function clearWidgetCompletionFeedback(
  source?: DisplayDueItem["source"],
  id?: string,
  completionKey?: string,
  _now = Date.now(),
): void {
  if (!source || !id || !completionKey) {
    Storage.remove(WIDGET_COMPLETION_FEEDBACK_KEY, SHARED_STORAGE_OPTIONS)
    Storage.remove(WIDGET_COMPLETION_FEEDBACK_KEY)
    return
  }

  // Schema 3 contains no occurrence-specific data. Preserve the generation so
  // clearing a legacy completed occurrence cannot rewind the animation value.
  const current = readCompletionFeedbackStore()
  Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
    schemaVersion: 3,
    generation: current.generation,
    phase: current.phase,
  }, SHARED_STORAGE_OPTIONS)
}

/** @deprecated Completed occurrences are no longer reinserted into the widget. */
export function readWidgetCompletionFeedback(_now = Date.now()): DisplayDueItem[] {
  return []
}

export function readWidgetCompletionTransition(
  _now = Date.now(),
): WidgetCompletionTransition {
  const current = readCompletionFeedbackStore()
  return {
    generation: current.generation,
    phase: current.phase,
    items: [],
  }
}

/** @deprecated Completion feedback now carries only a generation value. */
export function mergeWidgetCompletionFeedback(
  items: readonly DisplayDueItem[],
  _feedback: readonly DisplayDueItem[],
): DisplayDueItem[] {
  return [...items]
}

function readCompletionFeedbackStore(): CompletionFeedbackStore {
  const shared = Storage.get<unknown>(
    WIDGET_COMPLETION_FEEDBACK_KEY,
    SHARED_STORAGE_OPTIONS,
  )
  const legacy = shared == null
    ? Storage.get<unknown>(WIDGET_COMPLETION_FEEDBACK_KEY)
    : null
  const raw = shared ?? legacy
  if (!isRecord(raw) || (
    raw.schemaVersion !== 1
    && raw.schemaVersion !== 2
    && raw.schemaVersion !== 3
  )) {
    return { generation: 0, phase: 0 }
  }

  const phase: 0 | 1 = raw.phase === 1 ? 1 : 0
  const generation = typeof raw.generation === "number"
    && Number.isSafeInteger(raw.generation)
    && raw.generation >= 0
    ? raw.generation
    : phase

  // Schema 1/2 stored a completed DisplayDueItem for up to 30 seconds. Migrate
  // it immediately to generation-only state and remove any private legacy copy.
  if (legacy != null || raw.schemaVersion !== 3 || "entries" in raw) {
    const migrated = Storage.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
      schemaVersion: 3,
      generation,
      phase,
    }, SHARED_STORAGE_OPTIONS)
    if (migrated && legacy != null) {
      Storage.remove(WIDGET_COMPLETION_FEEDBACK_KEY)
    }
  }

  return { generation, phase }
}

function isRecord(value: unknown): value is Record<string, any> {
  return value != null && typeof value === "object" && !Array.isArray(value)
}
