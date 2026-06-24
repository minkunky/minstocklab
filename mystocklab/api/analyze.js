/**
 * api/analyze.js — AI 주식 분석 (Groq · llama-3.3-70b-versatile)
 *
 * [기능 1] 종목 분석
 *   GET /api/analyze?symbol=AAPL&name=Apple&price=213.5&avgPrice=200&qty=10
 *
 * [기능 2] 오늘 추천 종목
 *   GET /api/analyze?mode=recommendations
 */

import { setCors } from './_stock.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL        = 'llama-3.3-70b-versatile'

// ─── Groq 호출 헬퍼 ─────────────────────────────────────────────────────────

async function groqChat(messages, { temperature = 0.4, maxTokens = 1024 } = {}) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')

  const res = await fetch(GROQ_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model:       MODEL,
      messages,
      temperature,
      max_tokens:  maxTokens,
      // JSON 모드 강제 — 구조화된 응답을 안정적으로 받음
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`)
  }

  const data    = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`Groq returned invalid JSON: ${content.slice(0, 200)}`)
  }
}

// ─── 기능 1: 종목 분석 ───────────────────────────────────────────────────────

async function analyzeStock({ symbol, name, price, avgPrice, qty }) {
  const priceN    = parseFloat(price)    || 0
  const avgPriceN = parseFloat(avgPrice) || 0
  const qtyN      = parseFloat(qty)      || 0
  const profitPct = avgPriceN > 0 ? ((priceN - avgPriceN) / avgPriceN) * 100 : null

  const profitLine = profitPct !== null
    ? `현재 수익률: ${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}% (평균매수가: ${avgPriceN}, 수량: ${qtyN}주)`
    : '평균매수가 정보 없음'

  const messages = [
    {
      role: 'system',
      content: `당신은 전문 주식 애널리스트입니다.
사용자의 보유 종목 정보를 바탕으로 투자 의견을 제시하세요.
반드시 아래 JSON 형태로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "recommendation": "추가매수" | "유지" | "일부매도" | "전량매도",
  "summary": "한 줄 요약 (30자 이내)",
  "reasons": ["이유1", "이유2", "이유3"],
  "risks": ["리스크1", "리스크2"]
}`,
    },
    {
      role: 'user',
      content: `다음 종목을 분석해주세요.

종목: ${name} (${symbol})
현재가: ${priceN.toLocaleString()}
${profitLine}

최근 시장 흐름과 해당 종목의 섹터·펀더멘털을 고려해 투자 의견을 JSON으로 반환하세요.`,
    },
  ]

  const result = await groqChat(messages, { temperature: 0.3, maxTokens: 512 })

  // 필드 검증 및 기본값 보정
  const validRecs = ['추가매수', '유지', '일부매도', '전량매도']
  return {
    recommendation: validRecs.includes(result.recommendation) ? result.recommendation : '유지',
    summary:        typeof result.summary  === 'string' ? result.summary  : '분석 완료',
    reasons:        Array.isArray(result.reasons) ? result.reasons.slice(0, 3) : [],
    risks:          Array.isArray(result.risks)   ? result.risks.slice(0, 2)   : [],
  }
}

// ─── 기능 2: 오늘 추천 종목 ──────────────────────────────────────────────────

async function getRecommendations() {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const messages = [
    {
      role: 'system',
      content: `당신은 글로벌 주식 투자 전문가입니다.
오늘 날짜 기준으로 주목할 만한 종목을 추천하세요.
반드시 아래 JSON 형태로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "us": [
    {
      "symbol": "티커(대문자)",
      "name": "회사명",
      "reason": "추천 이유 (20자 이내)",
      "theme": "테마/섹터"
    }
  ],
  "kr": [
    {
      "symbol": "6자리 종목코드",
      "name": "회사명",
      "reason": "한 줄 요약 (20자 이내)",
      "theme": "테마/섹터",
      "score": 75,
      "reasons": ["추천 이유1", "추천 이유2"],
      "risks": ["리스크1"]
    }
  ]
}

us 배열: 미국 주식 10개, kr 배열: 한국 주식 10개.
score는 0~100 사이 정수 (투자 매력도). reasons는 2~3개, risks는 1~2개.`,
    },
    {
      role: 'user',
      content: `오늘(${today}) 투자하기 좋은 미국 주식 10개와 한국 주식 10개를 추천해주세요.
AI·반도체·전기차·바이오·방산 등 다양한 테마를 고루 포함해 주세요.
각 종목마다 score(0~100), reasons(2~3개), risks(1~2개)를 반드시 포함하세요.
JSON으로만 응답하세요.`,
    },
  ]

  const result = await groqChat(messages, { temperature: 0.5, maxTokens: 2000 })

  const usStocks = Array.isArray(result.us) ? result.us.slice(0, 10) : []
  const krStocks = Array.isArray(result.kr) ? result.kr.slice(0, 10) : []

  const normalize = (s, market) => ({
    symbol:  market === 'US' ? String(s.symbol || '').toUpperCase() : String(s.symbol || ''),
    name:    String(s.name   || ''),
    reason:  String(s.reason || ''),
    theme:   String(s.theme  || ''),
    score:   Math.min(100, Math.max(0, parseInt(s.score) || 70)),
    reasons: Array.isArray(s.reasons) ? s.reasons.slice(0, 3).map(String) : [],
    risks:   Array.isArray(s.risks)   ? s.risks.slice(0, 2).map(String)   : [],
    market,
  })

  return {
    date: new Date().toISOString().split('T')[0],
    us:   usStocks.map(s => normalize(s, 'US')),
    kr:   krStocks.map(s => normalize(s, 'KR')),
  }
}

// ─── Vercel Serverless Function 핸들러 ──────────────────────────────────────

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).json({})

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mode, symbol, name, price, avgPrice, qty } = req.query ?? {}

  try {
    // ── 모드 분기 ──────────────────────────────────────────────────────────
    if (mode === 'recommendations') {
      const data = await getRecommendations()
      return res.status(200).json(data)
    }

    // ── 종목 분석 ──────────────────────────────────────────────────────────
    if (!symbol) {
      return res.status(400).json({ error: 'symbol 파라미터가 필요합니다.' })
    }

    const analysis = await analyzeStock({
      symbol:   symbol.trim().toUpperCase(),
      name:     name     || symbol,
      price:    price    || '0',
      avgPrice: avgPrice || '0',
      qty:      qty      || '0',
    })

    return res.status(200).json(analysis)

  } catch (err) {
    console.error('[analyze]', err?.message ?? err)
    return res.status(500).json({ error: err?.message ?? 'AI 분석 중 오류가 발생했습니다.' })
  }
}
