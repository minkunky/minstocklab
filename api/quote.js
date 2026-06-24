/**
 * api/quote.js
 * GET /api/quote?symbol=AAPL
 * GET /api/quote?symbol=005930
 *
 * - 미국: Finnhub quote + profile2
 * - 한국: 네이버 증권 우선 → 실패 시 Yahoo Finance (.KS/.KQ) 폴백
 */
import { setCors, getQuote } from './_stock.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  const symbol = (req.query.symbol ?? '').trim()
  if (!symbol) return res.status(400).json({ error: 'Missing query parameter: symbol' })

  try {
    const quote = await getQuote(symbol)
    return res.status(200).json(quote)
  } catch (err) {
    console.error(`[quote] ${symbol}:`, err.message)
    return res.status(502).json({
      error:   'Failed to fetch quote',
      symbol,
      detail:  err.message,
    })
  }
}
