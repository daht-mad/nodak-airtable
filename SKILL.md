---
name: nodak-airtable
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

**의존성 정합 (머신마다 1회, lock 갱신 pull 후엔 다시)**:

```bash
cd <skill-dir> && bun install   # lock 기준 정합. 이미 일치하면 ~0.1초라 부담 없음
```

> lock 파일의 보안 패치는 **pull만 받으면 반영 안 된다** — 각 머신의 `node_modules`는
> 재설치 전까지 구버전 그대로다. (2026-07-23 lodash 4.18.1 보안 패치가 실제 사례:
> lock은 올라갔지만 타 머신 실행본은 4.17.23으로 남는 갭. 상세 = 루트 `FOLDER-MAP.md`)

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
cat <skill-dir>/references/schema-summary.json

# Multi-base (alias별)
cat <skill-dir>/references/schema/partners/schema-summary.json
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

스크립트 경로: 이 스킬의 `scripts/` 폴더 (상대경로 사용)

**윈도우(PowerShell/CMD)에서는 JSON 인라인 인자 금지** — 따옴표가 깨진다.
JSON을 임시 파일로 저장하고 `@경로`로 넘길 것 (모든 스크립트의 모든 JSON 인자 공통, 맥에서도 동작):

```powershell
'{"이름":"홍길동"}' | Out-File -Encoding utf8 fields.json
bun run create.ts --table Users --fields @fields.json
```

### 5. 에러 복구

필드 에러 발생 시:
1. `sync-schema.ts --base <alias>` 실행
2. `schema-summary.json`에서 올바른 필드명 확인
3. 재시도

## 필수 규칙

0. **윈도우에선 JSON 인자를 `@파일`로**: PowerShell/CMD에서 인라인 JSON은 따옴표가 깨진다. 파일로 저장 → `--fields @fields.json`
1. **사용자 입력 이스케이프**: filterByFormula에 사용자 입력 넣을 때 `escapeFormulaValue()` 적용
2. **스키마 먼저**: 작업 전 `schema-summary.json` 읽어서 테이블/필드명 확인
3. **삭제 확인**: `delete.ts`는 반드시 `--confirm` 플래그 필요
4. **API로 삭제 안 되는 건 이름 앞에 `(삭제)` 붙이기** (닿 지시 2026-08-18): Airtable API는 (a) 필드/테이블 삭제, (b) 기존 singleSelect/multipleSelect 옵션의 편집·삭제(추가·이름·색·제거 전부)를 지원하지 않는다 — 시도하면 422 `"Changing a field's type..."`. 이런 걸 정리할 땐 지우지 말고 **이름(필드명·옵션명) 앞에 `(삭제) `를 붙여** 사용자가 UI에서 지우도록 표시. 필드명 rename은 `updateField` PATCH `{"name":"(삭제) ..."}`로 API 가능. 선택 필드를 옵션·색까지 새로 짜야 하면 **새 필드를 `createField`로 만들고**(생성 시엔 choices+color 지정 가능) 옛 필드에 `(삭제)` 접두.

## 참조 문서

- **스크립트 상세 사용법**: [references/script-usage.md](references/script-usage.md)
- **API 규칙 및 제약사항**: [references/llm-rules.md](references/llm-rules.md)
- **스키마 요약**: [references/schema-summary.json](references/schema-summary.json)
