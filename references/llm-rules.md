# LLM Agent Rules - Airtable SDK Scripts

SDK 스크립트 기반 Airtable 작업 시 LLM 에이전트가 따라야 할 규칙입니다.

## API 제약사항

### Rate Limits
- **제한**: 5 requests/second per base
- **위반 시**: HTTP 429 에러
- **스크립트 대응**: `fetchWithRetry()`가 자동으로 지수 백오프 + 재시도

### Pagination
- **기본**: 100 records per request
- **최대**: 100 records (증가 불가)
- **스크립트 대응**: `read.ts`가 자동으로 offset 순회

### Batch Operations
- **update.ts**: 최대 10건/호출 (자동 분할)
- **delete.ts**: 최대 10건/호출 (자동 분할)
- **create.ts**: 단일 레코드 (여러 건은 반복 호출)

---

## 스크립트 사용법

### 스키마 동기화

**작업 전 항상 스키마 확인**:
```bash
# 스키마 파일 존재 확인
cat skills/airtable-sdk/references/schema-summary.json

# 없거나 오래된 경우 동기화
bun run skills/airtable-sdk/scripts/sync-schema.ts
```

### CRUD 스크립트

| 스크립트 | 용도 | 예시 |
|----------|------|------|
| `create.ts` | 레코드 생성 | `--table Users --fields '{"이름":"홍길동"}'` |
| `read.ts` | 레코드 조회 | `--table Users --filter '{상태}="활성"'` |
| `update.ts` | 레코드 수정 | `--table Users --records '[{"id":"recXXX","fields":{...}}]'` |
| `delete.ts` | 레코드 삭제 | `--table Users --ids '["recXXX"]' --confirm` |
| `create-field.ts` | 필드 생성 | `--table Users --field '{"name":"등급","type":"singleSelect"}'` |

---

## Formula Injection 방지 (필수!)

### escapeFormulaValue 사용

**사용자 입력을 filterByFormula에 사용할 때 반드시 이스케이프**:

```typescript
import { escapeFormulaValue } from './lib/airtable'

// 사용자 입력
const userInput = '홍길동"OR(1=1)' // 악의적 입력 예시

// 안전하게 이스케이프
const safeInput = escapeFormulaValue(userInput)
// => '홍길동\"OR(1=1)'

// read.ts에 전달
bun run read.ts --table Users --filter `{이름}="${safeInput}"`
```

**이스케이프 대상 문자**:
- `\` → `\\`
- `"` → `\"`
- 개행 → `\n`
- 캐리지 리턴 → `\r`
- 탭 → `\t`

---

## 스키마 참조 규칙

### 작업 전 체크리스트

1. **schema-summary.json 읽기** (필드명 확인용):
```bash
cat skills/airtable-sdk/references/schema-summary.json
```

2. **필드 타입 상세가 필요한 경우** (옵션, 링크 등):
```bash
cat skills/airtable-sdk/references/schema-full.json
```

3. **필드명 오타 주의**: 스키마에 있는 정확한 필드명 사용

### 스키마 동기화 시점

| 상황 | 동작 |
|------|------|
| 작업 시작 시 | `schema-summary.json` 읽기 |
| 필드 에러 발생 시 | `sync-schema.ts` 실행 후 재시도 |
| `create-field.ts` 실행 후 | 자동으로 스키마 갱신됨 |
| 사용자가 "스키마 싱크" 요청 | `sync-schema.ts` 실행 |

---

## 에러 복구 절차

### 필드 관련 에러

```
UNKNOWN_FIELD_NAME: "fld123" is not a valid field name
```

**복구 절차**:
1. `sync-schema.ts` 실행하여 스키마 갱신
2. `schema-summary.json`에서 올바른 필드명 확인
3. 수정된 필드명으로 재시도

### Rate Limit 에러

```
RATE_LIMIT_EXCEEDED
```

**대응**:
- 스크립트가 자동으로 재시도 (최대 5회, 지수 백오프)
- 지속적 실패 시 잠시 대기 후 재시도

### 인증 에러

```
AUTHENTICATION_REQUIRED / INVALID_AUTHENTICATION
```

**확인사항**:
1. `AIRTABLE_API_KEY` 환경변수 설정 확인
2. PAT(Personal Access Token)이 만료되지 않았는지 확인
3. PAT에 필요한 scope가 있는지 확인:
   - 읽기: `schema.bases:read`, `data.records:read`
   - 쓰기: `schema.bases:write`, `data.records:write`

---

## Anti-Patterns

### 필터 없이 조회

```bash
# BAD: 모든 레코드 가져옴 (낭비)
bun run read.ts --table Users

# GOOD: 필요한 것만 가져옴
bun run read.ts --table Users --filter '{상태}="활성"' --max 20
```

### 스키마 확인 안 하고 작업

```bash
# BAD: 필드명 오타로 에러 발생
bun run read.ts --table Users --filter '{Stauts}="Active"'  # 오타!

# GOOD: 스키마 먼저 확인
cat skills/airtable-sdk/references/schema-summary.json
bun run read.ts --table Users --filter '{Status}="Active"'
```

### 대량 삭제 실수

```bash
# BAD: 실수로 전체 삭제
bun run delete.ts --table Users --ids '[...]' --confirm

# GOOD: 먼저 조회로 확인
bun run read.ts --table Users --filter '{삭제대상}=TRUE()' --max 5
# 결과 확인 후 삭제
```

---

## Quick Reference

### 환경변수

```bash
export AIRTABLE_API_KEY="pat_XXXXX..."  # Personal Access Token
export AIRTABLE_BASE_ID="appXXXXX..."   # Base ID
```

### 스크립트 경로

```
skills/airtable-sdk/scripts/
├── lib/airtable.ts      # SDK 래퍼 (import용)
├── sync-schema.ts       # 스키마 동기화
├── create.ts            # 레코드 생성
├── read.ts              # 레코드 조회
├── update.ts            # 레코드 수정
├── delete.ts            # 레코드 삭제
└── create-field.ts      # 필드 생성 (+ 자동 sync)
```

### 스키마 파일

```
skills/airtable-sdk/references/
├── schema-summary.json  # 테이블/필드명 요약 (~500 토큰)
├── schema-full.json     # 전체 상세 (타입, 옵션 포함)
└── llm-rules.md         # 이 문서
```

---

## Checklist

Airtable 작업 전 확인:

- [ ] `schema-summary.json` 읽었는가?
- [ ] 사용자 입력에 `escapeFormulaValue()` 적용했는가?
- [ ] 필터와 maxRecords를 적절히 설정했는가?
- [ ] 삭제 작업 시 `--confirm` 플래그 확인했는가?
- [ ] 필드 에러 시 스키마 동기화 후 재시도했는가?
