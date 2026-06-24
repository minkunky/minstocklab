/**
 * api/quotes.js
 * GET /api/quotes?symbols=AAPL,NVDA,005930
 *
 * 복수 종목을 병렬로 일괄 조회합니다.
 * - 최대 20개 종목
 * - 각 종목은 독립적으로 실패/성공 처리 (하나 실패해도 나머지 반환)
 */
import { setCors, getQuote } from './_stock.js'

const MAX_SYMBOLS = 20

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  const raw = (req.query.symbols ?? '').trim()
  if (!raw) return res.status(400).json({ error: 'Missing query parameter: symbols' })

  // 파싱 & 중복 제거
  const symbols = [...new Set(
    raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  )]

  if (symbols.length === 0)
    return res.status(400).json({ error: 'No valid symbols provided' })

  if (symbols.length > MAX_SYMBOLS)
    return res.status(400).json({
      error: `Too many symbols. Max is ${MAX_SYMBOLS}, got ${symbols.length}`,
    })

  // 병렬 조회 (실패해도 개별 error 필드로 반환)
  const settled = await Promise.allSettled(
    symbols.map(sym => getQuote(sym))
  )

  const quotes = settled.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return {
      symbol: symbols[i],
      error:  result.reason?.message ?? 'Unknown error',
    }
  })

  const succeeded = quotes.filter(q => !q.error).length
  const failed    = quotes.length - succeeded

  return res.status(200).json({
    count:     quotes.length,
    succeeded,
    failed,
    quotes,
    fetchedAt: new Date().toISOString(),
  })
}
