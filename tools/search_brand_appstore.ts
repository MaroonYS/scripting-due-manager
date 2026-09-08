// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
const output = process.argv[2]
const queries = process.argv.slice(3).map(text => { const [country, ...term] = text.split(":"); return { country, term: term.join(":") } })
let cursor = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while(cursor < queries.length) {
    const {country, term} = queries[cursor++]
    const url = `https://itunes.apple.com/search?${new URLSearchParams({term,entity:"software",country,limit:"4"})}`
    const proc = Bun.spawn(["curl", "-fLsS", "--max-time", "20", url], {stdout:"pipe",stderr:"pipe"})
    try {
      const [status, text] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
      if(status) throw Error("search unavailable")
      const data = JSON.parse(text)
      await Bun.write(`${output}/appstore-${encodeURIComponent(country + "-" + term)}.json`, text)
      console.log(JSON.stringify({term,country,results:data.results.map((r:any)=>({id:r.trackId,name:r.trackName,seller:r.sellerName,site:r.sellerUrl,image:r.artworkUrl512}))}))
    } catch(error) { console.log(term, String(error)) }
  }
}))
