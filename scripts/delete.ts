#!/usr/bin/env bun
/**
 * Airtable Record Delete Script
 *
 * @description
 * 레코드를 삭제합니다. 10건 초과 시 자동으로 배치 분할합니다.
 * 안전을 위해 --confirm 플래그가 필요합니다.
 *
 * @usage
 * bun run skills/airtable-sdk/scripts/delete.ts --table <name> --ids '<json>' --confirm
 * bun run skills/airtable-sdk/scripts/delete.ts --help
 *
 * @example
 * bun run skills/airtable-sdk/scripts/delete.ts --table Users --ids '["recXXX","recYYY"]' --confirm
 */

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

interface DeleteResult {
  success: boolean
  deletedCount: number
  recordIds: string[]
}

// ============================================
// Main
// ============================================

const HELP_OPTIONS = [
  { flag: '--base <alias|id>', desc: 'Base alias or ID (optional)' },
  { flag: '--table <name>', desc: '테이블 이름 (필수)' },
  { flag: '--ids <json>', desc: '삭제할 레코드 ID 배열 JSON (필수)' },
  { flag: '--confirm', desc: '삭제 확인 플래그 (필수)' },
  { flag: '--help', desc: '도움말 출력' },
]

const BATCH_SIZE = 10 // Airtable 제한

async function main() {
  const args = parseArgs(Bun.argv)

  if (args.help) {
    printHelp(
      'bun run skills/airtable-sdk/scripts/delete.ts --table <name> --ids \'<json>\' --confirm',
      HELP_OPTIONS
    )
    console.log('Example:')
    console.log('  bun run skills/airtable-sdk/scripts/delete.ts --table Users --ids \'["recXXX","recYYY"]\' --confirm')
    console.log('')
    console.log('Note:')
    console.log('  - Maximum 10 records per batch (auto-split if more)')
    console.log('  - --confirm flag is REQUIRED for safety')
    console.log('')
    process.exit(0)
  }

  // 필수 인자 검증
  if (!args.table || typeof args.table !== 'string') {
    exitWithError('Missing required argument: --table <name>')
  }

  if (!args.ids || typeof args.ids !== 'string') {
    exitWithError('Missing required argument: --ids \'<json>\'')
  }

  if (!args.confirm) {
    console.error('[WARNING] 삭제 작업은 되돌릴 수 없습니다!')
    console.error('')
    console.error('삭제를 진행하려면 --confirm 플래그를 추가하세요:')
    console.error(`  bun run skills/airtable-sdk/scripts/delete.ts --table ${args.table} --ids '${args.ids}' --confirm`)
    console.error('')
    process.exit(1)
  }

  const baseArg = typeof args.base === 'string' ? args.base : undefined
  validateEnv(baseArg)

  let recordIds: string[]
  try {
    recordIds = JSON.parse(args.ids as string)
    if (!Array.isArray(recordIds)) {
      exitWithError('--ids must be a JSON array of record IDs')
    }
    // 각 ID가 문자열인지 확인
    for (const id of recordIds) {
      if (typeof id !== 'string' || !id.startsWith('rec')) {
        exitWithError(`Invalid record ID: "${id}" (must be string starting with "rec")`)
      }
    }
  } catch (e) {
    if ((e as Error).message.includes('must') || (e as Error).message.includes('Invalid')) {
      throw e
    }
    exitWithError(`Invalid JSON in --ids: ${(e as Error).message}`)
  }

  if (recordIds.length === 0) {
    exitWithError('No records to delete (empty array)')
  }

  try {
    const deletedIds: string[] = []
    const batches = chunk(recordIds, BATCH_SIZE)

    console.error(`[INFO] Deleting ${recordIds.length} records in ${batches.length} batch(es)...`)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.error(`[INFO] Batch ${i + 1}/${batches.length}: ${batch.length} records`)

      const deleted = await fetchWithRetry(() =>
        table(args.table as string, baseArg).destroy(batch)
      )

      for (const record of deleted) {
        deletedIds.push(record.id)
      }

      // Rate limit 방지 (배치 간 딜레이)
      if (i < batches.length - 1) {
        await sleep(200)
      }
    }

    const result: DeleteResult = {
      success: true,
      deletedCount: deletedIds.length,
      recordIds: deletedIds,
    }

    printJson(result)
  } catch (error) {
    const err = error as Error & { statusCode?: number; message: string }
    console.error(`[ERROR] Failed to delete records: ${err.message}`)
    if (err.statusCode) {
      console.error(`  Status: ${err.statusCode}`)
    }
    process.exit(1)
  }
}

main()
