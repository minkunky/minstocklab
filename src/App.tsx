import { useState, useEffect, useRef, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, PieChart, PlusCircle, Settings,
  Clock, RefreshCw, Search, X, ChevronRight,
  Loader2, CheckCircle, AlertCircle,
} from 'lucide-react'
import './styles.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioEntry {
  symbol:   string
  name:     string
  market:   'US' | 'KR'
  currency: 'USD' | 'KRW'
  quantity: number
  avgPrice: number
}

interface QuoteData {
  symbol:        string
  name:          string
  price:         number
  change:        number
  changePercent: number
  currency:      'USD' | 'KRW'
  market:        string
  source?:       string
  updatedAt:     string
  error?:        string
}

interface SearchResult {
  symbol:   string
  name:     string
  market:   string
  currency: 'USD' | 'KRW'
}

type TabId = 'portfolio' | 'add' | 'settings'

// ─── LocalStorage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mystocklab_portfolio_v1'

function loadEntries(): PortfolioEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}

function saveEntries(entries: PortfolioEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiSearch(q: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error(`Search error: ${res.status}`)
  const data = await res.json()
  return (data.results ?? []) as SearchResult[]
}

async function apiQuote(symbol: string): Promise<QuoteData> {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`Quote error: ${res.status}`)
  return res.json()
}

async function apiQuotes(symbols: string[]): Promise<QuoteData[]> {
  if (!symbols.length) return []
  const res = await fetch(`/api/quotes?symbols=${symbols.join(',')}`)
  if (!res.ok) throw new Error(`Quotes error: ${res.status}`)
  const data = await res.json()
  return (data.quotes ?? []) as QuoteData[]
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(price: number, currency: 'USD' | 'KRW') {
  if (currency === 'KRW')
    return `₩${Math.round(price).toLocaleString('ko-KR')}`
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const USD_TO_KRW = 1330

function toKRW(price: number, qty: number, currency: 'USD' | 'KRW') {
  return price * qty * (currency === 'USD' ? USD_TO_KRW : 1)
}

function fmtKRW(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억원`
  if (abs >= 10_000)      return `${sign}${(abs / 10_000).toFixed(1)}만원`
  return `${sign}₩${abs.toLocaleString('ko-KR')}`
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

// ─── Stock Card ───────────────────────────────────────────────────────────────

function StockCard({ entry, quote }: { entry: PortfolioEntry; quote?: QuoteData }) {
  const price  = quote?.price ?? entry.avgPrice
  const pct    = quote?.changePercent ?? 0
  const profit = (price - entry.avgPrice) * entry.quantity
  const isUp   = pct >= 0

  return (
    <div className="stock-card">
      <div className="stock-card-top">
        <div className="stock-info">
          <span className="stock-symbol">{entry.symbol}</span>
          <span className="stock-name">{entry.name}</span>
        </div>
        <div className={`rate-badge ${isUp ? 'up' : 'down'}`}>
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isUp ? '+' : ''}{pct.toFixed(2)}%
        </div>
      </div>

      <div className="stock-price">{fmtPrice(price, entry.currency)}</div>

      <div className="stock-profit" style={{ color: profit >= 0 ? '#2dd4a0' : '#ff6b6b' }}>
        {profit >= 0 ? '+' : ''}{fmtPrice(profit, entry.currency)}
      </div>

      <div className="stock-footer">
        <span className="stock-qty">{entry.quantity}주</span>
        {quote?.updatedAt && (
          <span className="stock-time">
            <Clock size={10} />{fmtTime(quote.updatedAt)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Summary Section ──────────────────────────────────────────────────────────

function SummarySection({ entries, quotes }: { entries: PortfolioEntry[]; quotes: Record<string, QuoteData> }) {
  const totalValue = entries.reduce((s, e) => s + toKRW(quotes[e.symbol]?.price ?? e.avgPrice, e.quantity, e.currency), 0)
  const totalCost  = entries.reduce((s, e) => s + toKRW(e.avgPrice, e.quantity, e.currency), 0)
  const profit = totalValue - totalCost
  const rate   = totalCost ? (profit / totalCost) * 100 : 0

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <span className="summary-label">총 평가금액</span>
        <span className="summary-value">{fmtKRW(totalValue)}</span>
        <span className="summary-sub">원화 환산 기준</span>
      </div>
      <div className="summary-card">
        <span className="summary-label">총 손익</span>
        <span className="summary-value" style={{ color: profit >= 0 ? '#2dd4a0' : '#ff6b6b' }}>
          {profit >= 0 ? '+' : ''}{fmtKRW(profit)}
        </span>
        <span className="summary-sub">매입 대비</span>
      </div>
      <div className="summary-card accent">
        <span className="summary-label">전체 수익률</span>
        <span className="summary-value" style={{ color: rate >= 0 ? '#2dd4a0' : '#ff6b6b' }}>
          {rate >= 0 ? '+' : ''}{rate.toFixed(2)}%
        </span>
        <span className="summary-sub">{entries.length}개 종목</span>
      </div>
    </div>
  )
}

// ─── Portfolio Tab ────────────────────────────────────────────────────────────

interface PortfolioTabProps {
  entries:     PortfolioEntry[]
  quotes:      Record<string, QuoteData>
  refreshing:  boolean
  lastUpdated: Date | null
  onRefresh:   () => void
}

function PortfolioTab({ entries, quotes, refreshing, lastUpdated, onRefresh }: PortfolioTabProps) {
  return (
    <div className="tab-content">
      <div className="section-header">
        <span className="section-title">내 포트폴리오</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {lastUpdated && (
            <span className="update-time">{fmtTime(lastUpdated.toISOString())} 업데이트</span>
          )}
          <button
            className={`icon-btn${refreshing ? ' spinning' : ''}`}
            onClick={onRefresh}
            disabled={refreshing}
            title="새로고침"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="placeholder-tab" style={{ minHeight: '300px' }}>
          <PieChart size={40} className="placeholder-icon" />
          <p className="placeholder-title">보유 종목이 없어요</p>
          <p className="placeholder-desc">종목 추가 탭에서 주식을 추가해보세요.</p>
        </div>
      ) : (
        <>
          <SummarySection entries={entries} quotes={quotes} />
          <div className="section-title" style={{ margin: '1.5rem 0 0.75rem' }}>보유 종목</div>
          <div className="stock-grid">
            {entries.map(e => <StockCard key={e.symbol} entry={e} quote={quotes[e.symbol]} />)}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Add Stock Tab ────────────────────────────────────────────────────────────

function AddStockTab({ onAdd }: { onAdd: (entry: PortfolioEntry) => void }) {
  const [market, setMarket]           = useState<'US' | 'KR'>('US')
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<SearchResult[]>([])
  const [searching, setSearching]     = useState(false)
  const [selected, setSelected]       = useState<SearchResult | null>(null)
  const [preview, setPreview]         = useState<QuoteData | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [quantity, setQuantity]       = useState('')
  const [avgPrice, setAvgPrice]       = useState('')
  const [adding, setAdding]           = useState(false)
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // 디바운스 검색
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const all = await apiSearch(q)
        setResults(all.filter(r => market === 'KR' ? r.currency === 'KRW' : r.currency === 'USD').slice(0, 8))
      } catch { setResults([]) }
      finally  { setSearching(false) }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, market])

  async function handleSelect(r: SearchResult) {
    setSelected(r)
    setResults([])
    setQuery(r.name)
    setLoadingQuote(true)
    setPreview(null)
    try {
      const q = await apiQuote(r.symbol)
      setPreview(q)
      if (q.price) setAvgPrice(String(q.price))
    } catch { setPreview(null) }
    finally { setLoadingQuote(false) }
  }

  function handleClear() {
    setSelected(null); setPreview(null)
    setQuery(''); setResults([])
    setQuantity(''); setAvgPrice('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleMarket(m: 'US' | 'KR') {
    setMarket(m); handleClear()
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2500)
  }

  function handleAdd() {
    if (!selected || !quantity || !avgPrice) return
    const qty = parseFloat(quantity)
    const avg = parseFloat(avgPrice)
    if (qty <= 0 || avg <= 0) return
    setAdding(true)
    try {
      onAdd({
        symbol:   selected.symbol,
        name:     selected.name,
        market:   selected.currency === 'KRW' ? 'KR' : 'US',
        currency: selected.currency,
        quantity: qty,
        avgPrice: avg,
      })
      showToast('success', `${selected.name} 추가 완료!`)
      handleClear()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setAdding(false)
    }
  }

  const canAdd = !!selected && parseFloat(quantity) > 0 && parseFloat(avgPrice) > 0

  return (
    <div className="tab-content">
      <div className="section-title" style={{ marginBottom: '0.85rem' }}>종목 추가</div>

      {/* 토스트 알림 */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success'
            ? <CheckCircle size={14} />
            : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* 시장 선택 */}
      <div className="market-toggle">
        <button className={market === 'US' ? 'active' : ''} onClick={() => handleMarket('US')}>
          🇺🇸 미국
        </button>
        <button className={market === 'KR' ? 'active' : ''} onClick={() => handleMarket('KR')}>
          🇰🇷 국내
        </button>
      </div>

      {/* 검색창 */}
      <div className="search-box">
        <Search size={15} className="search-icon" />
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder={market === 'US' ? 'AAPL, NVDA, Apple...' : '삼성전자, 005930...'}
          value={query}
          onChange={e => { setQuery(e.target.value); if (selected) setSelected(null) }}
        />
        {query && (
          <button className="search-clear" onClick={handleClear}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* 검색 상태 */}
      {searching && (
        <div className="search-status">
          <Loader2 size={14} className="spinning" /> 검색 중...
        </div>
      )}

      {/* 검색 결과 */}
      {!searching && results.length > 0 && (
        <div className="search-results">
          {results.map(r => (
            <button key={r.symbol} className="search-result-item" onClick={() => handleSelect(r)}>
              <div className="result-left">
                <span className="result-symbol">{r.symbol}</span>
                <span className="result-name">{r.name}</span>
              </div>
              <div className="result-right">
                <span className={`market-badge ${r.currency === 'KRW' ? 'kr' : 'us'}`}>
                  {r.market}
                </span>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 현재가 미리보기 */}
      {loadingQuote && (
        <div className="search-status">
          <Loader2 size={14} className="spinning" /> 현재가 조회 중...
        </div>
      )}
      {preview && !loadingQuote && (
        <div className="quote-preview">
          <div className="quote-preview-header">
            <span className="quote-symbol">{preview.symbol}</span>
            <span className="quote-name">{preview.name}</span>
          </div>
          <div className="quote-preview-price">
            <span className="quote-current">
              {fmtPrice(preview.price, preview.currency as 'USD' | 'KRW')}
            </span>
            <span className={`quote-change ${preview.changePercent >= 0 ? 'up' : 'down'}`}>
              {preview.changePercent >= 0 ? '+' : ''}{preview.changePercent.toFixed(2)}%
            </span>
          </div>
          {preview.source && (
            <div className="quote-meta">출처: {preview.source} · {fmtTime(preview.updatedAt)}</div>
          )}
        </div>
      )}

      {/* 수량 / 평균매수가 입력 */}
      {selected && (
        <div className="add-form">
          <div className="form-row">
            <label className="form-label">수량 (주)</label>
            <input
              type="number" className="form-input"
              placeholder="10" min="0" step="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">
              평균 매수가 ({selected.currency === 'KRW' ? '₩' : '$'})
            </label>
            <input
              type="number" className="form-input"
              placeholder={preview ? String(preview.price) : '0'}
              min="0" step="any"
              value={avgPrice}
              onChange={e => setAvgPrice(e.target.value)}
            />
          </div>
          <button className="add-btn" onClick={handleAdd} disabled={!canAdd || adding}>
            {adding
              ? <Loader2 size={15} className="spinning" />
              : <PlusCircle size={15} />}
            포트폴리오에 추가
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="tab-content placeholder-tab">
      <Settings size={48} className="placeholder-icon" />
      <p className="placeholder-title">설정</p>
      <p className="placeholder-desc">API 키 관리, 환율 설정,<br />알림 등을 관리합니다.</p>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'portfolio', label: '포트폴리오', icon: <PieChart   size={16} /> },
  { id: 'add',       label: '종목 추가',  icon: <PlusCircle size={16} /> },
  { id: 'settings',  label: '설정',       icon: <Settings   size={16} /> },
]

const REFRESH_INTERVAL = 60_000 // 1분

export default function App() {
  const [activeTab,    setActiveTab]    = useState<TabId>('portfolio')
  const [entries,      setEntries]      = useState<PortfolioEntry[]>(loadEntries)
  const [quotes,       setQuotes]       = useState<Record<string, QuoteData>>({})
  const [refreshing,   setRefreshing]   = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null)

  // ref 로 최신 entries 참조 (stale closure 방지)
  const entriesRef = useRef(entries)
  useEffect(() => { entriesRef.current = entries }, [entries])

  const refresh = useCallback(async () => {
    const cur = entriesRef.current
    if (!cur.length) return
    setRefreshing(true)
    try {
      const list = await apiQuotes(cur.map(e => e.symbol))
      const map: Record<string, QuoteData> = {}
      list.forEach(q => { if (!q.error) map[q.symbol] = q })
      setQuotes(map)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[refresh]', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  // 최초 마운트 시 시세 조회
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 1분마다 자동 업데이트
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

  function handleAdd(entry: PortfolioEntry) {
    setEntries(prev => {
      const next = prev.some(e => e.symbol === entry.symbol)
        ? prev.map(e => e.symbol === entry.symbol ? entry : e)
        : [...prev, entry]
      saveEntries(next)
      return next
    })
    // 추가된 종목 즉시 시세 갱신
    apiQuote(entry.symbol)
      .then(q => { setQuotes(prev => ({ ...prev, [q.symbol]: q })); setLastUpdated(new Date()) })
      .catch(() => {})
    setActiveTab('portfolio')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <TrendingUp size={22} className="header-icon" />
          <h1 className="header-title">MyStock Lab</h1>
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'portfolio' && (
          <PortfolioTab
            entries={entries} quotes={quotes}
            refreshing={refreshing} lastUpdated={lastUpdated}
            onRefresh={refresh}
          />
        )}
        {activeTab === 'add'      && <AddStockTab onAdd={handleAdd} />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}
