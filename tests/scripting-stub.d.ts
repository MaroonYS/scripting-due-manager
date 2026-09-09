// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

declare module "scripting" {
  export const AppIntentManager: {
    register<T = undefined>(definition: {
      name: string
      protocol: any
      perform: (params: T) => void | Promise<void>
    }): (params: T) => any
  }
  export const AppIntentProtocol: any
  export const Button: any
  export const Circle: any
  export const DateLabel: any
  export const DatePicker: any
  export const Device: any
  export const Divider: any
  export const HStack: any
  export const Image: any
  export const Label: any
  export const LabeledContent: any
  export const LazyVGrid: any
  export const Link: any
  export const List: any
  export const Navigation: any
  export const NavigationLink: any
  export const NavigationStack: any
  export const Picker: any
  export const RoundedRectangle: any
  export const Script: any
  export const Section: any
  export const SecureField: any
  export const Spacer: any
  export const SVG: any
  export const Text: any
  export const TextField: any
  export const Toggle: any
  export const VStack: any
  export const Widget: any
  export const ZStack: any

  export function useEffect(effect: () => void | (() => void), dependencies: unknown[]): void
  export function useState<T>(
    initialValue: T | (() => T),
  ): [T, (value: T | ((current: T) => T)) => void]
}

declare const Storage: {
  get<T>(key: string, options?: { shared: boolean }): T | null
  set<T>(key: string, value: T, options?: { shared: boolean }): boolean
  remove(key: string, options?: { shared: boolean }): void
  contains(key: string, options?: { shared: boolean }): boolean
}

declare const Animation: {
  default(): any
  smooth(options?: { duration?: number; extraBounce?: number }): any
  snappy(options?: { duration?: number; extraBounce?: number }): any
}

declare const Device: {
  preferredLanguages?: string[]
  systemLocale?: string
  systemLanguageTag?: string
  systemLanguageCode?: string
  systemCountryCode?: string
  systemScriptCode?: string
}

declare const Reminder: {
  get(identifier: string): Promise<any | null>
  getIncompletes(options?: {
    startDate?: Date
    endDate?: Date
    calendars?: unknown[]
  }): Promise<any[]>
}

declare const Calendar: {
  forReminders(): Promise<any[]>
}

declare const Dialog: {
  alert(options: { title?: string; message: string; buttonLabel?: string }): Promise<void>
  confirm(options: {
    title?: string
    message: string
    cancelLabel?: string
    confirmLabel?: string
  }): Promise<boolean>
}

declare const console: {
  error(...values: unknown[]): void
}

declare function setTimeout(callback: () => void, delay?: number): unknown
declare function clearTimeout(timer: unknown): void

declare function fetch(url: string, init?: {
  headers?: Record<string, string>
  timeout?: number
  handleRedirect?: () => Promise<null>
}): Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string>; data(): Promise<unknown>; expectedContentLength?: number }>

declare const Keychain: {
  get(key: string, options?: { synchronizable: boolean; accessibility: "first_unlock_this_device" }): string | null
  set(key: string, value: string, options?: { synchronizable: boolean; accessibility: "first_unlock_this_device" }): boolean
  remove(key: string, options?: { synchronizable: boolean; accessibility: "first_unlock_this_device" }): boolean
}

declare const Safari: { openURL(url: string): Promise<boolean> }
declare const Data: { fromString(value: string): unknown | null }
declare const DocumentPicker: {
  exportFiles(options: { files: Array<{ data: unknown; name: string }> }): Promise<string[]>
  pickFiles(options?: { types?: string[]; allowsMultipleSelection?: boolean }): Promise<string[]>
  stopAcessingSecurityScopedResources(): void
}
declare const FileManager: {
  readAsString(path: string): Promise<string>
  readAsData(path: string): Promise<unknown>
}
declare class UIImage {
  readonly width: number
  readonly height: number
  static fromData(data: unknown): UIImage | null
  static fromFile(path: string): UIImage | null
  static fromBase64String(value: string): UIImage | null
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicAttributes {
    key?: string | number
  }
  interface ElementChildrenAttribute {
    children: {}
  }
}
