#!/usr/bin/env bun
/**
 * Airtable Record Create Script
 *
 * @description
 * 단일 레코드를 생성합니다.
 *
 * @usage
 * bun run skills/airtable-sdk/scripts/create.ts --table <name> --fields '<json>'
 * bun run skills/airtable-sdk/scripts/create.ts --help
 *
 * @example
 * bun run skills/airtable-sdk/scripts/create.ts --table Users --fields '{"이름":"홍길동","이메일":"hong@example.com"}'
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

interface CreateResult {
  success: boolean
  recordId: string
  fields: Record<string, unknown>
}

// ============================================
// Main
// ============================================

const HELP_OPTIONS = [
  { flag: '--base <alias|id>', desc: 'Base alias or ID (optional)' },
  { flag: '--table <name>', desc: '테이블 이름 (필수)' },
  { flag: '--fields <json>', desc: '필드 값 JSON (필수)' },
  { flag: '--help', desc: '도움말 출력' },
]

async function main() {
  const args = parseArgs(Bun.argv)

  if (args.help) {
    printHelp(
      'bun run skills/airtable-sdk/scripts/create.ts --table <name> --fields \'<json>\'',
      HELP_OPTIONS
    )
    console.log('Example:')
    console.log('  bun run skills/airtable-sdk/scripts/create.ts --table Users --fields \'{"이름":"홍길동"}\'')
    console.log('')
    process.exit(0)
  }

  // 필수 인자 검증
  if (!args.table || typeof args.table !== 'string') {
    exitWithError('Missing required argument: --table <name>')
  }

  if (!args.fields || typeof args.fields !== 'string') {
    exitWithError('Missing required argument: --fields \'<json>\'')
  }

  const baseArg = typeof args.base === 'string' ? args.base : undefined
  validateEnv(baseArg)

  let fields: Record<string, unknown>
  try {
    fields = JSON.parse(args.fields as string)
  } catch (e) {
    exitWithError(`Invalid JSON in --fields: ${(e as Error).message}`)
  }

  try {
    const records = await fetchWithRetry(() =>
      table(args.table as string, baseArg).create([{ fields: fields as FieldSet }])
    )

    const created = Array.isArray(records) ? records[0] : records
    const result: CreateResult = {
      success: true,
      recordId: created.id,
      fields: created.fields as Record<string, unknown>,
    }

    printJson(result)
  } catch (error) {
    const err = error as Error & { statusCode?: number; message: string }
    console.error(`[ERROR] Failed to create record: ${err.message}`)
    if (err.statusCode) {
      console.error(`  Status: ${err.statusCode}`)
    }
    process.exit(1)
  }
}

main()
