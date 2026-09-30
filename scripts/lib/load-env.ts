/**
 * 스킬 폴더의 .env 자동 로드
 *
 * 스킬을 어디에 설치했든, 어느 폴더에서 실행하든 `<스킬 폴더>/.env`를 읽는다.
 * (bun은 "실행한 폴더"의 .env만 자동으로 읽기 때문에, 스킬 폴더 밖에서 실행하면 못 읽는다)
 * 이미 환경변수로 들어온 값이 있으면 덮어쓰지 않는다.
 *
 *   <스킬 폴더>/.env
 *   AIRTABLE_API_KEY=patXXXX...
 *   AIRTABLE_BASE_ID=appXXXX...
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export const SKILL_ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env')

if (existsSync(SKILL_ENV_PATH)) {
  for (const raw of readFileSync(SKILL_ENV_PATH, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (process.env[m[1]] === undefined || process.env[m[1]] === '') process.env[m[1]] = val
  }
}
