// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

/** Only for optional reads. A deadline never cancels or retries a state mutation. */
export class ReadDeadlineError extends Error {
  constructor() { super("可选资源读取超时") }
}

export function withReadDeadline<T>(read: () => Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true; reject(new ReadDeadlineError())
    }, milliseconds)
    Promise.resolve().then(read).then(value => {
      if (settled) return
      settled = true; clearTimeout(timer); resolve(value)
    }, error => {
      if (settled) return
      settled = true; clearTimeout(timer); reject(error)
    })
  })
}
