/**
 * api/search.js
 * GET /api/search?q=삼성  또는  ?q=AAPL
 *
 * - 한국 종목: 내장 목록에서 심볼·이름 검색
 * - 미국 종목: Finnhub Symbol Search API
 */
import { setCors, isKorean, KOREAN_STOCKS, searchUS } from './_stock.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  const q = (req.query.q ?? '').trim()
  if (!q) return res.status(400).json({ error: 'Missing query parameter: q' })
  if (q.length < 1) return res.status(400).json({ error: 'Query too short' })

  const lower = q.toLowerCase()

  // ── 한국 종목 (로컬 검색) ──────────────────────────────────────────────
  const koreanResults = KOREAN_STOCKS
    .filter(s =>
      s.symbol.startsWith(q) ||
      s.name.toLowerCase().includes(lower)
    )
    .map(s => ({
      symbol:   s.symbol,
      name:     s.name,
      type:     'Common Stock',
      market:   s.market,
      currency: 'KRW',
    }))

  // ── 미국 종목 (Finnhub) — 한국 코드(6자리)면 스킵 ─────────────────────
  let usResults = []
  if (!isKorean(q)) {
    try {
      usResults = await searchUS(q)
    } catch (err) {
      console.error('[search] Finnhub error:', err.message)
      // 한국 결과만이라도 반환
    }
  }

  const results = [...koreanResults, ...usResults]

  return res.status(200).json({
    query:   q,
    count:   results.length,
    results,
  })
}
