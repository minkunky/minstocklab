import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parse as parseUrl } from 'node:url'

export default defineConfig(({ mode }) => {
  // ── .env 로드 → process.env 주입 ─────────────────────────────────────
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    process.env[k] ??= v
  }

  return {
    plugins: [
      react(),

      // ── 로컬 API 미들웨어 ────────────────────────────────────────────
      {
        name: 'vite-plugin-api-dev',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/')) return next()

            const parsed    = parseUrl(req.url, true)
            const pathname  = parsed.pathname ?? ''
            const routeName = pathname.replace(/^\/api\//, '').replace(/\/$/, '')

            if (!routeName || routeName.startsWith('_') || routeName.includes('/')) {
              return next()
            }

            const apiFile = path.resolve(process.cwd(), 'api', `${routeName}.js`)
            if (!fs.existsSync(apiFile)) return next()

            try {
              // ── Node.js res 에 Express 호환 메서드 추가 ──────────────
              const r = res as any

              r.status = (code: number) => {
                r.statusCode = code
                return r
              }

              r.json = (data: unknown) => {
                if (!r.headersSent) {
                  r.setHeader('Content-Type', 'application/json')
                }
                r.end(JSON.stringify(data))
              }

              // Vercel 핸들러용 req.query 주입
              ;(req as any).query = Object.fromEntries(
                Object.entries(parsed.query ?? {}).map(([k, v]) => [k, v ?? ''])
              )

              const fileUrl = pathToFileURL(apiFile).href
              const mod     = await import(fileUrl)
              const handler = mod.default

              if (typeof handler !== 'function') return next()

              await handler(req, r)
            } catch (err: any) {
              console.error(`[API /${routeName}]`, err?.message ?? err)
              if (!res.headersSent) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message ?? 'Internal server error' }))
              }
            }
          })
        },
      },
    ],

    server: { port: 5173 },
  }
})
