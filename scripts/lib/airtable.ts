/**
 * Airtable SDK Wrapper Library
 *
 * @module skills/nodak-airtable/scripts/lib/airtable
 * @description
 * SDK 기반 Airtable 클라이언트.
 * - 지연 로딩 패턴으로 초기화
 * - Formula Injection 방지 (escapeFormulaValue)
 * - Rate Limit 대응 (fetchWithRetry)
 * - Metadata API 헬퍼 (fetchMetadata)
 *
 * @example
 * import { getBase, escapeFormulaValue, validateEnv } from './lib/airtable'
 *
 * validateEnv()
 * const base = getBase()
 * const safeInput = escapeFormulaValue(userInput)
 */

import Airtable from 'airtable'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ============================================
// Types
// ============================================

/** bases.json 설정 타입 */
export interface BasesConfig {
  default?: string
  bases: Record<string, { id: string; description?: string }>
}

export interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
  createdTime?: string
}

export interface TableSchema {
  id: string
  name: string
  fields: FieldSchema[]
}

export interface FieldSchema {
  id: string
  name: string
  type: string
  options?: Record<string, unknown>
  description?: string
}

export interface BaseSchema {
  tables: TableSchema[]
}

export interface MetadataResponse {
  tables: Array<{
    id: string
    name: string
    primaryFieldId: string
    fields: Array<{
      id: string
      name: string
      type: string
      options?: Record<string, unknown>
      description?: string
    }>
  }>
}

// ============================================
// Multi-Base Configuration
// ============================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_ROOT = join(__dirname, '..', '..')
const BASES_CONFIG_PATH = join(SKILL_ROOT, 'references', 'bases.json')

let _basesConfig: BasesConfig | null | undefined = undefined

export function loadBasesConfig(): BasesConfig | null {
  if (_basesConfig !== undefined) return _basesConfig

  if (!existsSync(BASES_CONFIG_PATH)) {
    _basesConfig = null
    return null
  }

  try {
    const content = readFileSync(BASES_CONFIG_PATH, 'utf-8')
    _basesConfig = JSON.parse(content) as BasesConfig
    return _basesConfig
  } catch {
    console.error(`[WARN] Failed to parse bases.json at ${BASES_CONFIG_PATH}`)
    _basesConfig = null
    return null
  }
}

export function resolveBaseId(baseArg?: string): { baseId: string; alias?: string } {
  // 1. CLI --base 인자가 있으면 최우선
  if (baseArg) {
    // appXXX 형태면 직접 ID
    if (baseArg.startsWith('app')) {
      return { baseId: baseArg }
    }
    // alias로 간주하고 bases.json에서 찾기
    const config = loadBasesConfig()
    if (config?.bases[baseArg]) {
      return { baseId: config.bases[baseArg].id, alias: baseArg }
    }
    // alias가 없으면 그대로 ID로 사용 시도
    return { baseId: baseArg }
  }

  // 2. bases.json의 default 사용
  const config = loadBasesConfig()
  if (config?.default && config.bases[config.default]) {
    const alias = config.default
    return { baseId: config.bases[alias].id, alias }
  }

  // 3. 환경변수 fallback
  const envBaseId = process.env.AIRTABLE_BASE_ID
  if (envBaseId) {
    return { baseId: envBaseId }
  }

  throw new Error(
    'No base ID found. Provide --base flag, set default in bases.json, or set AIRTABLE_BASE_ID env var.'
  )
}

export function getSchemaDir(alias: string): string {
  return join(SKILL_ROOT, 'references', 'schema', alias)
}

export function listConfiguredBases(): Array<{ alias: string; id: string; description?: string; isDefault: boolean }> {
  const config = loadBasesConfig()
  if (!config) return []
  
  return Object.entries(config.bases).map(([alias, info]) => ({
    alias,
    id: info.id,
    description: info.description,
    isDefault: config.default === alias,
  }))
}

// ============================================
// Environment Validation
// ============================================

export function validateEnv(baseArg?: string): void {
  if (!process.env.AIRTABLE_API_KEY) {
    console.error('[ERROR] Missing required environment variable: AIRTABLE_API_KEY')
    console.error('')
    console.error('Please set: export AIRTABLE_API_KEY="pat_XXXXX..."')
    process.exit(1)
  }

  // baseId 검증은 resolveBaseId에서 처리
  try {
    resolveBaseId(baseArg)
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}`)
    process.exit(1)
  }
}

export function getEnv(baseArg?: string): { apiKey: string; baseId: string; alias?: string } {
  validateEnv(baseArg)
  const { baseId, alias } = resolveBaseId(baseArg)
  return {
    apiKey: process.env.AIRTABLE_API_KEY!,
    baseId,
    alias,
  }
}

// ============================================
// Airtable Client (Lazy Loading with Multi-Base Cache)
// ============================================

type Base = ReturnType<Airtable['base']>
const _baseCache = new Map<string, Base>()

export function getBase(baseArg?: string): Base {
  const { apiKey, baseId } = getEnv(baseArg)
  
  if (!_baseCache.has(baseId)) {
    const airtable = new Airtable({ apiKey })
    _baseCache.set(baseId, airtable.base(baseId))
  }
  
  return _baseCache.get(baseId)!
}

export function table(tableName: string, baseArg?: string) {
  return getBase(baseArg)(tableName)
}

// ============================================
// Security Utilities
// ============================================

/**
 * Airtable Formula Injection 방지를 위한 이스케이프 함수
 *
 * @description
 * 사용자 입력값을 filterByFormula에 사용하기 전에 반드시 이 함수로 이스케이프해야 함.
 * SQL Injection과 유사하게 Formula Injection 공격을 방지.
 *
 * @param value - 이스케이프할 문자열
 * @returns 이스케이프된 안전한 문자열
 *
 * @example
 * const safePhone = escapeFormulaValue(userInput)
 * filterByFormula: `{전화번호} = "${safePhone}"`
 */
export function escapeFormulaValue(value: string): string {
  if (!value) return ''
  return value
    .replace(/\\/g, '\\\\') // 백슬래시 이스케이프
    .replace(/"/g, '\\"') // 큰따옴표 이스케이프
    .replace(/\n/g, '\\n') // 줄바꿈 이스케이프
    .replace(/\r/g, '\\r') // 캐리지 리턴 이스케이프
    .replace(/\t/g, '\\t') // 탭 이스케이프
}

// ============================================
// Rate Limit Handling
// ============================================

const DEFAULT_RETRY_DELAY = 1000 // 1초
const MAX_RETRIES = 5
const JITTER_MAX = 500 // 최대 500ms 랜덤 지터

/**
 * 지수 백오프 + 지터로 딜레이 계산
 */
function calculateBackoff(attempt: number): number {
  const exponentialDelay = DEFAULT_RETRY_DELAY * Math.pow(2, attempt)
  const jitter = Math.random() * JITTER_MAX
  return exponentialDelay + jitter
}

/**
 * Rate Limit (429) 대응 재시도 래퍼
 *
 * @param fn 실행할 함수
 * @param retries 최대 재시도 횟수 (기본 5)
 * @returns 함수 실행 결과
 */
export async function fetchWithRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // 429 Rate Limit 에러인 경우에만 재시도
      const isRateLimited =
        (error as { statusCode?: number }).statusCode === 429 ||
        (error as { message?: string }).message?.includes('RATE_LIMIT')

      if (!isRateLimited || attempt === retries) {
        throw error
      }

      const delay = calculateBackoff(attempt)
      console.error(
        `[WARN] Rate limited. Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${retries})`
      )
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Promise 기반 sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================
// Metadata API Helpers
// ============================================

const METADATA_API_BASE = 'https://api.airtable.com/v0/meta/bases'

export async function fetchMetadata<T>(
  endpoint: string,
  options: RequestInit = {},
  baseArg?: string
): Promise<T> {
  const { apiKey, baseId } = getEnv(baseArg)
  const url = `${METADATA_API_BASE}/${baseId}${endpoint}`

  const response = await fetchWithRetry(() =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Metadata API error (${response.status}): ${errorBody}`)
  }

  return response.json() as Promise<T>
}

export async function getBaseSchema(baseArg?: string): Promise<MetadataResponse> {
  return fetchMetadata<MetadataResponse>('/tables', {}, baseArg)
}

export async function createField(
  tableId: string,
  fieldConfig: {
    name: string
    type: string
    options?: Record<string, unknown>
    description?: string
  },
  baseArg?: string
): Promise<FieldSchema> {
  return fetchMetadata<FieldSchema>(`/tables/${tableId}/fields`, {
    method: 'POST',
    body: JSON.stringify(fieldConfig),
  }, baseArg)
}

// ============================================
// Batch Utilities
// ============================================

/**
 * 배열을 청크로 분할
 * @param array 분할할 배열
 * @param size 청크 크기 (기본 10)
 */
export function chunk<T>(array: T[], size = 10): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// ============================================
// CLI Helpers
// ============================================

/**
 * CLI 인자 파싱 헬퍼
 *
 * @param args process.argv (bun에서는 Bun.argv)
 * @returns 파싱된 옵션 객체
 *
 * @example
 * const opts = parseArgs(Bun.argv)
 * // --table Users --filter '{상태}="활성"'
 * // => { table: 'Users', filter: '{상태}="활성"' }
 *
 * // 값이 @로 시작하고 그 경로에 파일이 있으면 파일 내용으로 치환된다.
 * // 윈도우 PowerShell/CMD에서 JSON 인라인 따옴표가 깨질 때 사용:
 * // --fields @fields.json  =>  { fields: '<fields.json 내용>' }
 */
export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {}
  const scriptArgs = args.slice(2) // bun run script.ts 이후의 인자들

  for (let i = 0; i < scriptArgs.length; i++) {
    const arg = scriptArgs[i]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)

      // 다음 인자가 값인지 또는 다른 플래그인지 확인
      const nextArg = scriptArgs[i + 1]
      if (nextArg && !nextArg.startsWith('--')) {
        // @파일명 → 파일 내용으로 치환 (윈도우 셸 따옴표 이슈 우회용)
        // 예: --fields @fields.json  ← JSON을 파일에 저장해두고 경로만 넘긴다
        if (nextArg.startsWith('@') && existsSync(nextArg.slice(1))) {
          result[key] = readFileSync(nextArg.slice(1), 'utf-8').trim()
        } else {
          result[key] = nextArg
        }
        i++ // 값을 소비했으므로 인덱스 증가
      } else {
        // 값이 없으면 boolean true
        result[key] = true
      }
    }
  }

  return result
}

/**
 * 도움말 출력 헬퍼
 */
export function printHelp(usage: string, options: Array<{ flag: string; desc: string }>): void {
  console.log('')
  console.log('Usage:')
  console.log(`  ${usage}`)
  console.log('')
  console.log('Options:')
  for (const opt of options) {
    console.log(`  ${opt.flag.padEnd(25)} ${opt.desc}`)
  }
  console.log('')
}

/**
 * JSON 결과 출력 (pretty print)
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

/**
 * 에러 출력 후 종료
 */
export function exitWithError(message: string, code = 1): never {
  console.error(`[ERROR] ${message}`)
  process.exit(code)
}
