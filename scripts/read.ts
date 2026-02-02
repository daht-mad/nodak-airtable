#!/usr/bin/env bun
/**
 * Airtable Record Read Script
 *
 * @description
 * 레코드를 조회합니다. Pagination을 자동 처리합니다.
 *
 * @usage
 * bun run skills/airtable-sdk/scripts/read.ts --table <name> [options]
 * bun run skills/airtable-sdk/scripts/read.ts --help
 *
 * @example
 * bun run skills/airtable-sdk/scripts/read.ts --table Users
 * bun run skills/airtable-sdk/scripts/read.ts --table Users --filter '{상태}="활성"' --max 50
 * bun run skills/airtable-sdk/scripts/read.ts --table Users --fields '["이름","이메일"]'
 */

import type { FieldSet } from 'airtable'
import {
  table,
  validateEnv,
  parseArgs,
  printHelp,
  printJson,
  exitWithError,
  fetchWithRetry,
} from './lib/airtable'

// ============================================
// Types
// ============================================

interface ReadResult {
  success: boolean
  count: number
  records: Array<{
    id: string
    fields: Record<string, unknown>
  }>
}

// ============================================
// Main
// ============================================

const HELP_OPTIONS = [
  { flag: '--base <alias|id>', desc: 'Base alias or ID (optional)' },
  { flag: '--table <name>', desc: '테이블 이름 (필수)' },
  { flag: '--filter <formula>', desc: 'filterByFormula (선택)' },
  { flag: '--max <n>', desc: '최대 레코드 수 (기본: 모든 레코드)' },
  { flag: '--fields <json>', desc: '조회할 필드 배열 (선택)' },
  { flag: '--help', desc: '도움말 출력' },
]

async function main() {
  const args = parseArgs(Bun.argv)

  if (args.help) {
    printHelp(
      'bun run skills/airtable-sdk/scripts/read.ts --table <name> [--filter <formula>] [--max <n>] [--fields <json>]',
      HELP_OPTIONS
    )
    console.log('Examples:')
    console.log('  bun run skills/airtable-sdk/scripts/read.ts --table Users --max 10')
    console.log('  bun run skills/airtable-sdk/scripts/read.ts --table Users --filter \'{상태}="활성"\' --max 50')
    console.log('  bun run skills/airtable-sdk/scripts/read.ts --table Users --fields \'["이름","이메일"]\'')
    console.log('')
    process.exit(0)
  }

  // 필수 인자 검증
  if (!args.table || typeof args.table !== 'string') {
    exitWithError('Missing required argument: --table <name>')
  }

  const baseArg = typeof args.base === 'string' ? args.base : undefined
  validateEnv(baseArg)

  const maxRecords = args.max ? parseInt(args.max as string, 10) : undefined
  const filterByFormula = args.filter as string | undefined

  let fieldsToRetrieve: string[] | undefined
  if (args.fields && typeof args.fields === 'string') {
    try {
      fieldsToRetrieve = JSON.parse(args.fields as string)
      if (!Array.isArray(fieldsToRetrieve)) {
        exitWithError('--fields must be a JSON array of field names')
      }
    } catch (e) {
      exitWithError(`Invalid JSON in --fields: ${(e as Error).message}`)
    }
  }

  try {
    console.error('[INFO] Fetching records...')

    // 쿼리 옵션 구성
    const queryOptions: {
      maxRecords?: number
      filterByFormula?: string
      fields?: string[]
    } = {}
    if (maxRecords) queryOptions.maxRecords = maxRecords
    if (filterByFormula) queryOptions.filterByFormula = filterByFormula
    if (fieldsToRetrieve) queryOptions.fields = fieldsToRetrieve

    const records = await fetchWithRetry(() =>
      table(args.table as string, baseArg).select(queryOptions).all()
    )

    const result: ReadResult = {
      success: true,
      count: records.length,
      records: records.map((r) => ({
        id: r.id,
        fields: r.fields as Record<string, unknown>,
      })),
    }

    printJson(result)
  } catch (error) {
    const err = error as Error & { statusCode?: number; message: string }
    console.error(`[ERROR] Failed to read records: ${err.message}`)
    if (err.statusCode) {
      console.error(`  Status: ${err.statusCode}`)
    }
    process.exit(1)
  }
}

main()
