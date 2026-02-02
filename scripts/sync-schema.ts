#!/usr/bin/env bun

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync } from 'fs'
import {
  getBaseSchema,
  validateEnv,
  parseArgs,
  printHelp,
  resolveBaseId,
  getSchemaDir,
  listConfiguredBases,
  type MetadataResponse,
} from './lib/airtable'

// ============================================
// Types
// ============================================

interface SchemaSummary {
  tables: Array<{
    id: string
    name: string
    fields: string[] // 필드명만
  }>
  lastSynced: string
}

interface SchemaFull {
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
  lastSynced: string
}

// ============================================
// Main
// ============================================

const HELP_OPTIONS = [
  { flag: '--base <alias|id>', desc: 'Base alias (from bases.json) or direct Base ID' },
  { flag: '--all', desc: 'Sync all bases configured in bases.json' },
  { flag: '--list', desc: 'List configured bases' },
  { flag: '--help', desc: 'Show help' },
]

async function main() {
  const args = parseArgs(Bun.argv)

  if (args.help) {
    printHelp('bun run sync-schema.ts [--base <alias>] [--all] [--list]', HELP_OPTIONS)
    process.exit(0)
  }

  if (args.list) {
    const bases = listConfiguredBases()
    if (bases.length === 0) {
      console.log('[INFO] No bases configured. Create references/bases.json to configure bases.')
    } else {
      console.log('Configured bases:')
      for (const b of bases) {
        const marker = b.isDefault ? ' (default)' : ''
        console.log(`  - ${b.alias}: ${b.id}${marker}${b.description ? ` - ${b.description}` : ''}`)
      }
    }
    process.exit(0)
  }

  const baseArg = typeof args.base === 'string' ? args.base : undefined
  
  if (args.all) {
    const bases = listConfiguredBases()
    if (bases.length === 0) {
      console.error('[ERROR] No bases configured in bases.json')
      process.exit(1)
    }
    
    console.log(`[INFO] Syncing ${bases.length} bases...`)
    for (const b of bases) {
      await syncSingleBase(b.alias)
    }
    console.log('[SUCCESS] All bases synced.')
    process.exit(0)
  }

  validateEnv(baseArg)
  await syncSingleBase(baseArg)
}

async function syncSingleBase(baseArg?: string) {
  const { baseId, alias } = resolveBaseId(baseArg)
  const displayName = alias || baseId
  
  console.log(`[INFO] Fetching schema for "${displayName}"...`)

  try {
    const schema = await getBaseSchema(baseArg)
    const now = new Date().toISOString()
    const summary = transformToSummary(schema, now)
    const full = transformToFull(schema, now)

    const __dirname = dirname(fileURLToPath(import.meta.url))
    let outputDir: string

    if (alias) {
      outputDir = getSchemaDir(alias)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }
    } else {
      outputDir = resolve(__dirname, '../references')
    }

    const summaryPath = resolve(outputDir, 'schema-summary.json')
    const fullPath = resolve(outputDir, 'schema-full.json')

    await Bun.write(summaryPath, JSON.stringify(summary, null, 2))
    await Bun.write(fullPath, JSON.stringify(full, null, 2))

    console.log(`[SUCCESS] Schema synced for "${displayName}"`)
    console.log(`  - Location: ${outputDir}`)
    console.log(`  - Tables: ${summary.tables.length}`)
    console.log(`  - Total fields: ${full.tables.reduce((acc, t) => acc + t.fields.length, 0)}`)
    console.log('')
    console.log('Tables:')
    for (const table of summary.tables) {
      console.log(`  - ${table.name} (${table.fields.length} fields)`)
    }

  } catch (error) {
    console.error(`[ERROR] Failed to sync "${displayName}":`, (error as Error).message)
    throw error
  }
}

// ============================================
// Transform Functions
// ============================================

function transformToSummary(schema: MetadataResponse, timestamp: string): SchemaSummary {
  return {
    tables: schema.tables.map((table) => ({
      id: table.id,
      name: table.name,
      fields: table.fields.map((f) => f.name),
    })),
    lastSynced: timestamp,
  }
}

function transformToFull(schema: MetadataResponse, timestamp: string): SchemaFull {
  return {
    tables: schema.tables.map((table) => ({
      id: table.id,
      name: table.name,
      primaryFieldId: table.primaryFieldId,
      fields: table.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        ...(f.options && { options: f.options }),
        ...(f.description && { description: f.description }),
      })),
    })),
    lastSynced: timestamp,
  }
}

// ============================================
// Export for use by other scripts (create-field.ts)
// ============================================

export async function syncSchema(baseArg?: string): Promise<{ summary: SchemaSummary; full: SchemaFull; outputDir: string }> {
  validateEnv(baseArg)
  const { alias } = resolveBaseId(baseArg)
  const schema = await getBaseSchema(baseArg)
  const now = new Date().toISOString()
  
  const summary = transformToSummary(schema, now)
  const full = transformToFull(schema, now)

  const __dirname = dirname(fileURLToPath(import.meta.url))
  let outputDir: string

  if (alias) {
    outputDir = getSchemaDir(alias)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }
  } else {
    outputDir = resolve(__dirname, '../references')
  }

  await Bun.write(resolve(outputDir, 'schema-summary.json'), JSON.stringify(summary, null, 2))
  await Bun.write(resolve(outputDir, 'schema-full.json'), JSON.stringify(full, null, 2))

  return { summary, full, outputDir }
}

// Run if executed directly (not when imported)
// Bun에서는 import.meta.main으로 직접 실행 여부 확인
if (import.meta.main) {
  main()
}
