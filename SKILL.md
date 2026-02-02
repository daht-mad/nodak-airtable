---
name: airtable-sdk
description: SDK 스크립트 기반 Airtable CRUD 및 스키마 관리. MCP 없이 토큰 효율적으로 Airtable을 조작한다. 사용자가 "에어테이블", "airtable", "레코드 생성/조회/수정/삭제", "테이블 필드 추가" 등을 언급할 때 사용. 환경변수 AIRTABLE_API_KEY 필수. Multi-base 지원 (bases.json 또는 AIRTABLE_BASE_ID).
---

# Airtable SDK Skill

스크립트로 Airtable CRUD 수행. 스키마를 JSON으로 캐싱하여 토큰 절약.

## 워크플로우

### 1. 사전 확인

```bash
echo $AIRTABLE_API_KEY
```

없으면 PAT 발급 안내: https://airtable.com/create/tokens

### 2. Multi-Base 설정 (선택)

여러 베이스 사용 시 `references/bases.json` 생성:
```json
{
  "default": "main",
  "bases": {
    "main": { "id": "appXXXXXXXXXXXXXXX", "description": "Main workspace" },
    "partners": { "id": "appYYYYYYYYYYYYYYY", "description": "Partner management" }
  }
}
```

Base 우선순위: `--base` CLI > `bases.json` default > `AIRTABLE_BASE_ID` env

### 3. 스키마 확인

```bash
# Single base (기본)
cat ~/.claude/skills/airtable-sdk/references/schema-summary.json

# Multi-base (alias별)
cat ~/.claude/skills/airtable-sdk/references/schema/partners/schema-summary.json
```

스키마 동기화:
```bash
bun run sync-schema.ts              # default base
bun run sync-schema.ts --base partners  # 특정 base
bun run sync-schema.ts --all        # 모든 bases
bun run sync-schema.ts --list       # 설정된 bases 목록
```

### 4. CRUD 실행

모든 스크립트에 `--base <alias|id>` 옵션 지원:

| 작업 | 스크립트 | 예시 |
|------|----------|------|
| 생성 | `create.ts` | `--base partners --table Users --fields '{"이름":"홍길동"}'` |
| 조회 | `read.ts` | `--base partners --table Users --filter '{상태}="활성"'` |
| 수정 | `update.ts` | `--table Users --records '[{"id":"recXXX","fields":{...}}]'` |
| 삭제 | `delete.ts` | `--table Users --ids '["recXXX"]' --confirm` |
| 필드 추가 | `create-field.ts` | `--table Users --field '{"name":"등급","type":"singleSelect"}'` |

스크립트 경로: `~/.claude/skills/airtable-sdk/scripts/`

### 5. 에러 복구

필드 에러 발생 시:
1. `sync-schema.ts --base <alias>` 실행
2. `schema-summary.json`에서 올바른 필드명 확인
3. 재시도

## 필수 규칙

1. **사용자 입력 이스케이프**: filterByFormula에 사용자 입력 넣을 때 `escapeFormulaValue()` 적용
2. **스키마 먼저**: 작업 전 `schema-summary.json` 읽어서 테이블/필드명 확인
3. **삭제 확인**: `delete.ts`는 반드시 `--confirm` 플래그 필요

## 참조 문서

- **스크립트 상세 사용법**: [references/script-usage.md](references/script-usage.md)
- **API 규칙 및 제약사항**: [references/llm-rules.md](references/llm-rules.md)
- **스키마 요약**: [references/schema-summary.json](references/schema-summary.json)
