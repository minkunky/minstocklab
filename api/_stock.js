/**
 * _stock.js — 공유 유틸리티 (Vercel 라우터에서 제외됨: _ 접두사)
 * search.js / quote.js / quotes.js 에서 import 해서 사용합니다.
 */

// ─── 한국 주요 종목 목록 ────────────────────────────────────────────────────

export const KOREAN_STOCKS = [
  // KOSPI 대형주
  { symbol: '005930', name: '삼성전자',        market: 'KOSPI' },
  { symbol: '000660', name: 'SK하이닉스',       market: 'KOSPI' },
  { symbol: '373220', name: 'LG에너지솔루션',   market: 'KOSPI' },
  { symbol: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { symbol: '005490', name: 'POSCO홀딩스',      market: 'KOSPI' },
  { symbol: '005380', name: '현대차',           market: 'KOSPI' },
  { symbol: '000270', name: '기아',             market: 'KOSPI' },
  { symbol: '051910', name: 'LG화학',           market: 'KOSPI' },
  { symbol: '006400', name: '삼성SDI',          market: 'KOSPI' },
  { symbol: '035420', name: 'NAVER',            market: 'KOSPI' },
  { symbol: '035720', name: '카카오',           market: 'KOSPI' },
  { symbol: '055550', name: '신한지주',         market: 'KOSPI' },
  { symbol: '105560', name: 'KB금융',           market: 'KOSPI' },
  { symbol: '086790', name: '하나금융지주',     market: 'KOSPI' },
  { symbol: '032830', name: '삼성생명',         market: 'KOSPI' },
  { symbol: '096770', name: 'SK이노베이션',     market: 'KOSPI' },
  { symbol: '017670', name: 'SK텔레콤',         market: 'KOSPI' },
  { symbol: '030200', name: 'KT',               market: 'KOSPI' },
  { symbol: '066570', name: 'LG전자',           market: 'KOSPI' },
  { symbol: '009150', name: '삼성전기',         market: 'KOSPI' },
  { symbol: '028260', name: '삼성물산',         market: 'KOSPI' },
  { symbol: '011200', name: 'HMM',              market: 'KOSPI' },
  { symbol: '003670', name: '포스코퓨처엠',    market: 'KOSPI' },
  { symbol: '034020', name: '두산에너빌리티',   market: 'KOSPI' },
  { symbol: '018880', name: '한온시스템',       market: 'KOSPI' },
  { symbol: '012330', name: '현대모비스',       market: 'KOSPI' },
  { symbol: '000810', name: '삼성화재',         market: 'KOSPI' },
  { symbol: '033780', name: 'KT&G',             market: 'KOSPI' },
  { symbol: '010950', name: 'S-Oil',            market: 'KOSPI' },
  { symbol: '009830', name: '한화솔루션',       market: 'KOSPI' },
  // KOSDAQ
  { symbol: '247540', name: '에코프로비엠',     market: 'KOSDAQ' },
  { symbol: '086520', name: '에코프로',         market: 'KOSDAQ' },
  { symbol: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ' },
  { symbol: '263750', name: '펄어비스',         market: 'KOSDAQ' },
  { symbol: '112040', name: '위메이드',         market: 'KOSDAQ' },
  { symbol: '293490', name: '카카오게임즈',     market: 'KOSDAQ' },
  { symbol: '035760', name: 'CJ ENM',           market: 'KOSDAQ' },
  { symbol: '041510', name: 'SM엔터테인먼트',   market: 'KOSDAQ' },
  { symbol: '259960', name: '크래프톤',         market: 'KOSPI'  },
  { symbol: '323410', name: '카카오뱅크',       market: 'KOSPI'  },
]

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

/** 6자리 숫자 → 한국 종목 코드 */
export function isKorean(symbol) {
  return /^\d{6}$/.test(symbol.trim())
}

/** 공통 CORS 헤더 */
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ─── 미국 주식 (Finnhub) ────────────────────────────────────────────────────

/**
 * Finnhub 심볼 검색
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchUS(query) {
  const key = process.env.FINNHUB_API_KEY
  if (!key) throw new Error('FINNHUB_API_KEY not set')

  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${key}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub search ${res.status}`)
  const data = await res.json()

  return (data.result || [])
    .filter(r => r.type === 'Common Stock' && !/[.\-]/.test(r.symbol))
    .slice(0, 10)
    .map(r => ({
      symbol: r.symbol,
      name: r.description,
      type: 'Common Stock',
      market: 'US',
      currency: 'USD',
    }))
}

/**
 * Finnhub 실시간 시세
 * @param {string} symbol  대문자 티커 (AAPL, NVDA…)
 * @returns {Promise<object>}
 */
export async function quoteUS(symbol) {
  const key = process.env.FINNHUB_API_KEY
  if (!key) throw new Error('FINNHUB_API_KEY not set')

  // 시세 + 프로필 병렬 요청
  const [quoteRes, profileRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`),
    fetch(`https://finnhub.io/api/v1/profile2?symbol=${symbol}&token=${key}`),
  ])

  if (!quoteRes.ok) throw new Error(`Finnhub quote ${quoteRes.status}`)
  const q = await quoteRes.json()
  if (!q.c) throw new Error(`No price data for ${symbol}`)

  let name = symbol
  if (profileRes.ok) {
    const p = await profileRes.json()
    name = p.name || symbol
  }

  return {
    symbol,
    name,
    price:         q.c,
    change:        q.d  ?? 0,
    changePercent: q.dp ?? 0,
    open:          q.o,
    high:          q.h,
    low:           q.l,
    prevClose:     q.pc,
    currency: 'USD',
    market:   'US',
    source:   'finnhub',
    updatedAt: new Date().toISOString(),
  }
}

// ─── 한국 주식 (네이버 → Yahoo Finance 폴백) ───────────────────────────────

/**
 * 네이버 증권 모바일 API
 */
export async function quoteKoreanNaver(symbol) {
  const url = `https://m.stock.naver.com/api/stock/${symbol}/basic`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyStockLab/1.0)' },
  })
  if (!res.ok) throw new Error(`Naver ${res.status} for ${symbol}`)
  const d = await res.json()

  // 필드명은 네이버 API 버전에 따라 달라질 수 있어 여러 후보를 시도
  const rawPrice   = d.closePrice   ?? d.stockEndPrice  ?? d.currentPrice ?? ''
  const rawChange  = d.compareToPreviousClosePrice ?? d.priceChange ?? '0'
  const rawPct     = d.fluctuationsRatio ?? d.changeRate ?? '0'

  const price         = parseFloat(String(rawPrice).replace(/,/g, ''))
  const change        = parseFloat(String(rawChange).replace(/,/g, ''))
  const changePercent = parseFloat(String(rawPct).replace(/,/g, ''))

  if (!price) throw new Error(`Naver returned no price for ${symbol}`)

  return {
    symbol,
    name:  d.stockName ?? d.itemName ?? symbol,
    price,
    change,
    changePercent,
    open:      parseFloat(String(d.openingPrice  ?? '0').replace(/,/g, '')) || undefined,
    high:      parseFloat(String(d.highPrice     ?? '0').replace(/,/g, '')) || undefined,
    low:       parseFloat(String(d.lowPrice      ?? '0').replace(/,/g, '')) || undefined,
    prevClose: price - change || undefined,
    currency: 'KRW',
    market:   d.marketType?.includes('KOSDAQ') ? 'KOSDAQ' : 'KOSPI',
    source:   'naver',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Yahoo Finance 폴백 (.KS → .KQ 순서로 시도)
 */
export async function quoteKoreanYahoo(symbol) {
  const suffixes = ['.KS', '.KQ']

  for (const suffix of suffixes) {
    try {
      const ticker = `${symbol}${suffix}`
      const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      const res    = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyStockLab/1.0)' },
      })
      if (!res.ok) continue
      const data = await res.json()
      const meta = data?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) continue

      const price     = meta.regularMarketPrice
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
      const change    = price - prevClose
      const changePct = prevClose ? (change / prevClose) * 100 : 0

      return {
        symbol,
        name:  meta.longName ?? meta.shortName ?? symbol,
        price,
        change,
        changePercent: changePct,
        open:      meta.regularMarketOpen,
        high:      meta.regularMarketDayHigh,
        low:       meta.regularMarketDayLow,
        prevClose,
        currency: 'KRW',
        market:   suffix === '.KS' ? 'KOSPI' : 'KOSDAQ',
        source:   `yahoo${suffix}`,
        updatedAt: new Date().toISOString(),
      }
    } catch {
      // 다음 suffix 시도
    }
  }
  throw new Error(`Yahoo Finance fallback failed for ${symbol}`)
}

/**
 * 한국 주식 시세 (네이버 우선, 실패 시 Yahoo 폴백)
 */
export async function quoteKorean(symbol) {
  try {
    return await quoteKoreanNaver(symbol)
  } catch (naverErr) {
    console.warn(`[quote] Naver failed (${symbol}): ${naverErr.message} → Yahoo fallback`)
    return await quoteKoreanYahoo(symbol)
  }
}

/**
 * 시장 자동 판별 후 시세 반환
 */
export async function getQuote(symbol) {
  const s = symbol.trim().toUpperCase()
  return isKorean(s) ? quoteKorean(s) : quoteUS(s)
}
