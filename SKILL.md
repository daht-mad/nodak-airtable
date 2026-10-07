---
name: nodak-airtable
description: SDK 스크립트 기반 Airtable CRUD·스키마 관리 + 관계형 DB 설계 인터뷰. MCP 없이 토큰 효율적으로 Airtable을 조작한다. 사용자가 "에어테이블", "airtable", "레코드 생성/조회/수정/삭제", "테이블 필드 추가", "DB 설계", "표 짜줘", "테이블 설계" 등을 언급할 때, 또는 이 스킬이 막 설치됐을 때 사용. 토큰은 스킬 폴더 .env(AIRTABLE_API_KEY) 또는 환경변수. Multi-base 지원 (bases.json 또는 AIRTABLE_BASE_ID).
---

# Airtable SDK Skill

스크립트로 Airtable CRUD 수행. 스키마를 JSON으로 캐싱하여 토큰 절약.

## 이 스킬이 뭐냐고 물으면

사람이 "이거 무슨 스킬이야?"라고 물으면 아래를 **사람 말로** 짧게 설명하고, 마지막에 "뭘 기록하고 싶어?"로 넘어간다.

- **에어테이블** = 엑셀처럼 생긴 온라인 표. 다른 점은 봇이 인터넷으로 직접 읽고 쓸 수 있다는 것
- **이 스킬** = 그 표를 다루는 설명서 + 도구 상자. 레코드 읽기·쓰기·고치기·지우기, 테이블·칸 만들기를 명령 한 줄로 한다
- **왜 필요하냐** = 봇은 대화가 끝나면 잊는다. 계속 쌓이는 기록(명단·출석·주문)은 대화창이 아니라 표에 둬야 한다
- **할 수 있는 것 중 제일 중요한 것** = 사람 업무를 인터뷰해서 **관계형 DB**(테이블 여러 개를 링크로 이은 구조)를 같이 설계하고 직접 만든다

## 설치 직후 / 처음 쓸 때 — 이 순서로 시작한다

1. `.env` 확인 (아래 1번). **비어 있으면** [references/setup-guide.md](references/setup-guide.md) 순서대로 사람에게 한 단계씩 안내한다 — 가입 → 베이스 만들기 → 빌더 허브에서 토큰 발급 → 봇에게 전달
2. 연결되면 `sync-schema.ts`로 확인하고 테이블 목록을 보여준다
3. 베이스가 비어 있으면(테이블 없음 또는 기본 `Table 1`뿐) **먼저 묻는다**:
   > "연결됐어! 이 베이스로 뭘 관리하고 싶어? 하는 일 얘기해주면 같이 표 구조부터 짜보자."
4. 답이 오면 [references/relational-design-interview.md](references/relational-design-interview.md)대로 인터뷰한다. **설계안을 사람이 확인하기 전엔 테이블을 만들지 않는다.**

"테이블 만들어줘"라는 요청도 구조가 정해지지 않았으면 같은 인터뷰부터 한다. 이미 구조가 있고 칸 하나 추가처럼 작은 요청이면 바로 한다.

## 워크플로우

### 1. 사전 확인

토큰은 **스킬 폴더의 `.env`** 에 둔다. 스크립트가 어디서 실행되든 이 파일을 자동으로 읽는다 (`scripts/lib/load-env.ts`). 환경변수에 이미 값이 있으면 그게 우선.

```bash
cat <skill-dir>/.env 2>/dev/null | sed 's/=.*/=<set>/'   # 값은 절대 화면에 출력하지 말 것
```

없으면 → [references/setup-guide.md](references/setup-guide.md) (가입부터 토큰 전달까지 사람이 할 4단계)

**사용자가 채팅으로 토큰(`pat...`)을 주면** — 그 값을 `<skill-dir>/.env`에 아래 형식으로 저장하고, 답장에 토큰을 다시 적지 말 것. 저장 후 "붙여넣은 메시지는 지워달라"고 안내한다.

```
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX.XXXXXXXX...
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

베이스 ID를 모르면 사용자에게 에어테이블 주소창의 `app`으로 시작하는 부분을 물어본다.

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

- **처음 연결 (사람이 할 일)**: [references/setup-guide.md](references/setup-guide.md)
- **관계형 DB 설계 인터뷰**: [references/relational-design-interview.md](references/relational-design-interview.md)

- **스크립트 상세 사용법**: [references/script-usage.md](references/script-usage.md)
- **API 규칙 및 제약사항**: [references/llm-rules.md](references/llm-rules.md)
- **스키마 요약**: [references/schema-summary.json](references/schema-summary.json)
