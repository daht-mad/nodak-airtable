# 스크립트 상세 사용법

모든 스크립트는 `~/.claude/skills/airtable-sdk/scripts/`에 위치.

## 공통: --base 옵션

모든 스크립트에서 `--base` 옵션으로 대상 베이스 지정 가능:

```bash
--base partners     # bases.json의 alias
--base appXXXXX     # 직접 Base ID
```

생략 시 우선순위: `bases.json` default > `AIRTABLE_BASE_ID` 환경변수

---

## sync-schema.ts

스키마를 Airtable API에서 가져와 JSON으로 캐싱.

```bash
bun run sync-schema.ts                    # default base
bun run sync-schema.ts --base partners    # 특정 base
bun run sync-schema.ts --all              # 모든 bases.json의 bases
bun run sync-schema.ts --list             # 설정된 bases 목록
```

저장 위치:
- Single base (alias 없음): `references/schema-*.json`
- Multi-base (alias 있음): `references/schema/<alias>/schema-*.json`

생성 파일:
- `schema-summary.json` - 테이블/필드명만 (~500 토큰)
- `schema-full.json` - 전체 상세 (타입, 옵션)

---

## create.ts

단일 레코드 생성.

```bash
bun run create.ts [--base <alias>] --table <테이블명> --fields '<JSON>'
```

예시:
```bash
bun run create.ts --table Users --fields '{"이름":"홍길동","이메일":"hong@example.com"}'
bun run create.ts --base partners --table Contacts --fields '{"이름":"김철수"}'
```

출력:
```json
{
  "success": true,
  "recordId": "recXXXXXXXXXXXXXX",
  "fields": { "이름": "홍길동", "이메일": "hong@example.com" }
}
```

---

## read.ts

레코드 조회. Pagination 자동 처리.

```bash
bun run read.ts [--base <alias>] --table <테이블명> [--filter '<formula>'] [--max <N>] [--fields '<JSON>']
```

예시:
```bash
bun run read.ts --table Users
bun run read.ts --base partners --table Contacts --filter '{상태}="활성"' --max 50
bun run read.ts --table Users --fields '["이름","이메일"]'
```

출력:
```json
{
  "success": true,
  "count": 25,
  "records": [
    { "id": "recXXX", "fields": { "이름": "홍길동" } }
  ]
}
```

---

## update.ts

레코드 수정. 10건 초과 시 자동 배치 분할.

```bash
bun run update.ts [--base <alias>] --table <테이블명> --records '<JSON>'
```

예시:
```bash
bun run update.ts --table Users --records '[{"id":"recXXX","fields":{"상태":"비활성"}}]'
bun run update.ts --base partners --table Contacts --records '[{"id":"recYYY","fields":{"등급":"VIP"}}]'
```

출력:
```json
{
  "success": true,
  "updatedCount": 1,
  "recordIds": ["recXXX"]
}
```

---

## delete.ts

레코드 삭제. `--confirm` 필수. 10건 초과 시 자동 배치 분할.

```bash
bun run delete.ts [--base <alias>] --table <테이블명> --ids '<JSON>' --confirm
```

예시:
```bash
bun run delete.ts --table Users --ids '["recXXX","recYYY"]' --confirm
bun run delete.ts --base partners --table Contacts --ids '["recZZZ"]' --confirm
```

출력:
```json
{
  "success": true,
  "deletedCount": 2,
  "recordIds": ["recXXX", "recYYY"]
}
```

---

## create-field.ts

테이블에 필드 추가. 성공 후 자동 스키마 동기화.

```bash
bun run create-field.ts [--base <alias>] --table <테이블명> --field '<JSON>' [--no-sync]
```

필드 타입:
- `singleLineText`, `multilineText`
- `singleSelect`, `multipleSelects` (options.choices 필요)
- `number`, `checkbox`, `date`, `dateTime`
- `email`, `url`, `phoneNumber`

예시:
```bash
# 텍스트 필드
bun run create-field.ts --table Users --field '{"name":"메모","type":"multilineText"}'

# Single select
bun run create-field.ts --table Users --field '{"name":"등급","type":"singleSelect","options":{"choices":[{"name":"일반"},{"name":"프리미엄"}]}}'
```

출력:
```json
{
  "success": true,
  "fieldId": "fldXXXXXXXXXXXXXX",
  "fieldName": "등급",
  "schemaSynced": true
}
```

---

## 공통 옵션

모든 스크립트:
- `--base <alias|id>` - 대상 베이스 지정 (선택)
- `--help` - 도움말 출력
- 환경변수 필요: `AIRTABLE_API_KEY` (필수), `AIRTABLE_BASE_ID` (bases.json 없을 때 필수)

---

## Multi-Base 설정

`references/bases.json` 생성:

```json
{
  "default": "main",
  "bases": {
    "main": { "id": "appXXXXXXXXXXXXXXX", "description": "Main workspace" },
    "partners": { "id": "appYYYYYYYYYYYYYYY", "description": "Partner management" }
  }
}
```

예시 파일: `references/bases.json.example`
