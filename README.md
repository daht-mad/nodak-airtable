# Airtable SDK Skill for Claude Code

> Claude Code에서 Airtable을 **MCP 없이** 토큰 효율적으로 다루는 Skill입니다.

## Why?

Claude Code에서 Airtable을 쓰는 방법은 크게 두 가지입니다:

| | MCP | SDK Skill (이것!) |
|---|---|---|
| 설치 | 간편 | 약간의 설정 필요 |
| 세션 로딩 토큰 | ~7,500 토큰 | ~500 토큰 (스키마 캐시) |
| 배치 처리 | 수동 | 10건씩 자동 분할 |
| Rate Limit | 직접 처리 | 지수 백오프 자동 재시도 |
| Formula Injection 방지 | 없음 | 내장 (`escapeFormulaValue`) |

**결론**: 토큰 ~60% 절약 + 안전한 자동화를 원한다면 이 Skill을 추천합니다.

---

## Quick Start

### 1. 스킬 설치

```bash
# Claude Code 스킬 폴더에 클론
cd ~/.claude/skills
git clone https://github.com/daht-mad/airtable-sdk.git

# 의존성 설치
cd airtable-sdk
bun install
```

> **Bun이 없다면?** → `curl -fsSL https://bun.sh/install | bash`

### 2. API Key 발급

[Airtable Personal Access Token](https://airtable.com/create/tokens) 페이지에서 토큰을 발급받으세요.

**필요한 권한 (Scopes):**
- `data.records:read` - 레코드 읽기
- `data.records:write` - 레코드 생성/수정/삭제
- `schema.bases:read` - 스키마 조회 (스키마 동기화에 필요)
- `schema.bases:write` - 필드/테이블 생성 (선택)

발급받은 토큰을 환경변수로 설정합니다:

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가
export AIRTABLE_API_KEY="patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

### 3. Base 연결

**단일 베이스 사용 시:**
```bash
# Airtable URL에서 Base ID 확인: https://airtable.com/appXXXXXXXXXXXXXXX/...
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXXX"
```

**여러 베이스 사용 시:**
`references/bases.json` 파일을 생성하세요 (`bases.json.example` 참고):

```json
{
  "default": "main",
  "bases": {
    "main": { "id": "appXXXXXXXXXXXXXXX", "description": "Main workspace" },
    "partners": { "id": "appYYYYYYYYYYYYYYY", "description": "Partner management" }
  }
}
```

### 4. 스키마 동기화

```bash
cd ~/.claude/skills/airtable-sdk/scripts
bun run sync-schema.ts          # 기본 베이스
bun run sync-schema.ts --all    # 멀티 베이스 전체
```

이 명령어를 실행하면 `references/schema-summary.json`에 테이블/필드 정보가 캐싱됩니다.
Claude가 이 파일을 읽고 필드명과 타입을 정확히 파악합니다.

### 5. 사용하기

설치 끝! Claude Code에서 자연어로 요청하면 됩니다:

```
"Users 테이블에서 활성 상태인 사람 조회해줘"
"새 레코드 생성해줘 - 이름: 홍길동, 이메일: hong@example.com"
"recXXX 레코드의 상태를 비활성으로 바꿔줘"
```

---

## 수동 스크립트 사용법

Claude 없이 직접 스크립트를 실행할 수도 있습니다:

```bash
cd ~/.claude/skills/airtable-sdk/scripts

# 조회
bun run read.ts --table Users --filter '{상태}="활성"'

# 생성
bun run create.ts --table Users --fields '{"이름":"홍길동","이메일":"hong@example.com"}'

# 수정
bun run update.ts --table Users --records '[{"id":"recXXX","fields":{"상태":"비활성"}}]'

# 삭제 (--confirm 필수!)
bun run delete.ts --table Users --ids '["recXXX"]' --confirm

# 필드 추가
bun run create-field.ts --table Users --field '{"name":"등급","type":"singleSelect"}'

# 테이블 생성
bun run create-table.ts --name "NewTable" --fields '[{"name":"이름","type":"singleLineText"}]'
```

**멀티 베이스 사용 시** 모든 명령에 `--base` 옵션 추가:
```bash
bun run read.ts --base partners --table Users
```

---

## 파일 구조

```
airtable-sdk/
├── SKILL.md                          # Claude가 읽는 스킬 정의
├── package.json                      # 의존성 (airtable SDK)
├── references/
│   ├── schema-summary.json           # 스키마 캐시 (자동 생성)
│   ├── schema-full.json              # 전체 스키마 상세 (자동 생성)
│   ├── bases.json.example            # 멀티 베이스 설정 예시
│   ├── llm-rules.md                  # LLM 에이전트용 API 규칙
│   └── script-usage.md               # 스크립트 상세 사용법
└── scripts/
    ├── lib/airtable.ts               # 공통 라이브러리 (인젝션 방지, Rate Limit)
    ├── sync-schema.ts                # 스키마 동기화
    ├── create.ts                     # 레코드 생성
    ├── read.ts                       # 레코드 조회
    ├── update.ts                     # 레코드 수정
    ├── delete.ts                     # 레코드 삭제
    ├── create-field.ts               # 필드 생성
    ├── create-table.ts               # 테이블 생성
    └── add-select-choice.ts          # Select 옵션 추가
```

---

## 안전장치

이 Skill은 Airtable 작업 시 흔히 발생하는 실수를 방지합니다:

- **Formula Injection 방지** - 사용자 입력에 `escapeFormulaValue()` 자동 적용
- **삭제 시 확인 필수** - `--confirm` 플래그 없이는 삭제 불가
- **배치 자동 분할** - 10건 초과 시 Airtable API 제한에 맞춰 자동 분할
- **Rate Limit 대응** - 초당 5건 제한 초과 시 지수 백오프로 자동 재시도
- **스키마 검증** - 작업 전 `schema-summary.json`으로 필드명/타입 사전 확인

---

## 요구사항

- [Bun](https://bun.sh/) 런타임
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Airtable Personal Access Token ([발급하기](https://airtable.com/create/tokens))

---

## Troubleshooting

**Q: `AIRTABLE_API_KEY` 환경변수가 안 잡혀요**
→ `~/.zshrc`에 추가한 후 터미널을 새로 열거나 `source ~/.zshrc` 실행

**Q: 스키마 동기화 시 에러가 나요**
→ PAT의 Scope에 `schema.bases:read`가 포함되어 있는지 확인

**Q: 필드명이 안 맞는다고 나와요**
→ Airtable에서 필드를 수정했다면 `bun run sync-schema.ts`로 스키마를 다시 동기화

**Q: Rate Limit 에러가 자주 발생해요**
→ 대량 작업 시 자동 재시도가 동작하지만, 너무 빈번하면 작업 간 간격을 두세요

---

## License

MIT
