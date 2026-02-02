#!/usr/bin/env bun
/**
 * Airtable Record Update Script
 *
 * @description
 * 레코드를 수정합니다. 10건 초과 시 자동으로 배치 분할합니다.
 *
 * @usage
 * bun run skills/airtable-sdk/scripts/update.ts --table <name> --records '<json>'
 * bun run skills/airtable-sdk/scripts/update.ts --help
 *
 * @example
 * bun run skills/airtable-sdk/scripts/update.ts --table Users --records '[{"id":"recXXX","fields":{"상태":"비활성"}}]'
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
  chunk,
  sleep,
} from './lib/airtable'

// ============================================
// Types
// ============================================

interface UpdateRecord {
  id: string
  fields: Record<string, unknown>
}

interface UpdateResult {
  success: boolean
  updatedCount: number
  recordIds: string[]
}

// ============================================
// Main
// ============================================

const HELP_OPTIONS = [
  { flag: '--base <alias|id>', desc: 'Base alias or ID (optional)' },
  { flag: '--table <name>', desc: '테이블 이름 (필수)' },
  { flag: '--records <json>', desc: '수정할 레코드 배열 JSON (필수)' },
  { flag: '--help', desc: '도움말 출력' },
]

const BATCH_SIZE = 10 // Airtable 제한

async function main() {
  const args = parseArgs(Bun.argv)

  if (args.help) {
    printHelp(
      'bun run skills/airtable-sdk/scripts/update.ts --table <name> --records \'<json>\'',
      HELP_OPTIONS
    )
    console.log('Example:')
    console.log('  bun run skills/airtable-sdk/scripts/update.ts --table Users --records \'[{"id":"recXXX","fields":{"상태":"비활성"}}]\'')
    console.log('')
    console.log('Note: Maximum 10 records per batch (auto-split if more)')
    console.log('')
    process.exit(0)
  }

  // 필수 인자 검증
  if (!args.table || typeof args.table !== 'string') {
    exitWithError('Missing required argument: --table <name>')
  }

  if (!args.records || typeof args.records !== 'string') {
    exitWithError('Missing required argument: --records \'<json>\'')
  }

  const baseArg = typeof args.base === 'string' ? args.base : undefined
  validateEnv(baseArg)

  let records: UpdateRecord[]
  try {
    records = JSON.parse(args.records as string)
    if (!Array.isArray(records)) {
      exitWithError('--records must be a JSON array')
    }
    // 각 레코드 구조 검증
    for (const r of records) {
      if (!r.id || typeof r.id !== 'string') {
        exitWithError('Each record must have an "id" string field')
      }
      if (!r.fields || typeof r.fields !== 'object') {
        exitWithError('Each record must have a "fields" object field')
      }
    }
  } catch (e) {
    if ((e as Error).message.includes('must')) {
      throw e
    }
    exitWithError(`Invalid JSON in --records: ${(e as Error).message}`)
  }

  if (records.length === 0) {
    exitWithError('No records to update (empty array)')
  }

  try {
    const updatedIds: string[] = []
    const batches = chunk(records, BATCH_SIZE)

    console.error(`[INFO] Updating ${records.length} records in ${batches.length} batch(es)...`)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.error(`[INFO] Batch ${i + 1}/${batches.length}: ${batch.length} records`)

      const updated = await fetchWithRetry(() =>
        table(args.table as string, baseArg).update(
          batch.map((r) => ({
            id: r.id,
            fields: r.fields as Partial<FieldSet>,
          }))
        )
      )

      for (const record of updated) {
        updatedIds.push(record.id)
      }

      // Rate limit 방지 (배치 간 딜레이)
      if (i < batches.length - 1) {
        await sleep(200)
      }
    }

    const result: UpdateResult = {
      success: true,
      updatedCount: updatedIds.length,
      recordIds: updatedIds,
    }

    printJson(result)
  } catch (error) {
    const err = error as Error & { statusCode?: number; message: string }
    console.error(`[ERROR] Failed to update records: ${err.message}`)
    if (err.statusCode) {
      console.error(`  Status: ${err.statusCode}`)
    }
    process.exit(1)
  }
}

main()
