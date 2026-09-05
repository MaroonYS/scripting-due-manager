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
  export const Link: any
  export const List: any
  export const Navigation: any
  export const NavigationLink: any
  export const NavigationStack: any
  export const Picker: any
  export const Script: any
  export const Section: any
  export const Spacer: any
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

declare function fetch(url: string, init?: {
  headers?: Record<string, string>
  timeout?: number
}): Promise<{ ok: boolean; status: number; json(): Promise<any> }>

declare const Safari: { openURL(url: string): Promise<boolean> }
declare const Data: { fromString(value: string): unknown | null }
declare const DocumentPicker: {
  exportFiles(options: { files: Array<{ data: unknown; name: string }> }): Promise<string[]>
  pickFiles(options?: { types?: string[]; allowsMultipleSelection?: boolean }): Promise<string[]>
  stopAcessingSecurityScopedResources(): void
}
declare const FileManager: { readAsString(path: string): Promise<string> }

declare namespace JSX {
  interface Element {}
  interface IntrinsicAttributes {
    key?: string | number
  }
  interface ElementChildrenAttribute {
    children: {}
  }
}
