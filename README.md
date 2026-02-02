# Airtable SDK Skill for Claude Code

Claude Code에서 Airtable 작업을 효율적으로 수행하기 위한 Skill입니다.

## 왜 만들었나요?

Claude Code에서 Airtable을 연동하는 방법은 크게 두 가지입니다:

1. **MCP (Model Context Protocol)**: 설치 간편하지만 매 세션마다 ~7,500 토큰 로딩
2. **SDK Skill**: 스키마 캐싱으로 토큰 60% 절약 + 배치/Rate Limit 재시도 지원

이 Skill은 두 번째 방식입니다. 스키마를 미리 캐싱해두어 Claude가 필드명/타입을 정확히 알고 작업할 수 있습니다.

> 자세한 비교는 [블로그 글](https://github.com/daht-mad/airtable-sdk/blob/main/docs/mcp-vs-sdk-skill.md)을 참고하세요.

## 설치

```bash
cd ~/.claude/skills
git clone https://github.com/daht-mad/airtable-sdk.git
```

## 설정

### 1. API Key 설정

[Airtable Personal Access Token](https://airtable.com/create/tokens)을 발급받아 환경변수로 설정합니다.

```bash
export AIRTABLE_API_KEY="pat.xxxxx"
```

### 2. Base 설정

**단일 베이스 사용 시:**
```bash
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXXX"
```

**여러 베이스 사용 시:**
`references/bases.json` 파일을 생성합니다. (`bases.json.example` 참고)

```json
{
  "default": "main",
  "bases": {
    "main": { "id": "appXXXXXXXXXXXXXXX", "description": "Main workspace" },
    "partners": { "id": "appYYYYYYYYYYYYYYY", "description": "Partner management" }
  }
}
```

### 3. 스키마 동기화

```bash
cd ~/.claude/skills/airtable-sdk/scripts
bun run sync-schema.ts
```

`references/schema-summary.json`에 스키마가 저장됩니다.

## 사용법

Claude Code에서 "에어테이블에서 Users 테이블 조회해줘" 같은 요청을 하면, Claude가 이 Skill의 스크립트를 사용합니다.

### 수동 실행 예시

```bash
cd ~/.claude/skills/airtable-sdk/scripts

# 레코드 조회
bun run read.ts --table Users --filter '{상태}="활성"'

# 레코드 생성
bun run create.ts --table Users --fields '{"이름":"홍길동","이메일":"hong@example.com"}'

# 레코드 수정
bun run update.ts --table Users --records '[{"id":"recXXX","fields":{"상태":"비활성"}}]'

# 레코드 삭제
bun run delete.ts --table Users --ids '["recXXX"]' --confirm

# 필드 추가
bun run create-field.ts --table Users --field '{"name":"등급","type":"singleSelect"}'
```

### 멀티 베이스 사용

모든 스크립트에 `--base` 옵션을 사용할 수 있습니다.

```bash
bun run read.ts --base partners --table Users
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| **스키마 캐싱** | 토큰 절약 + 디버깅 루프 제거 |
| **배치 처리** | 10건씩 자동 분할 (Airtable API 제한 준수) |
| **Rate Limit 재시도** | 지수 백오프로 자동 재시도 |
| **멀티 베이스** | 여러 Airtable Base 지원 |
| **필드 추가** | 스크립트로 테이블 필드 추가 가능 |

## 파일 구조

```
airtable-sdk/
├── SKILL.md                     # Claude가 읽는 Skill 정의
├── references/
│   ├── schema-summary.json      # 스키마 캐시 (자동 생성)
│   ├── bases.json.example       # 멀티 베이스 설정 예시
│   └── llm-rules.md             # API 규칙
└── scripts/
    ├── lib/airtable.ts          # 공통 라이브러리
    ├── sync-schema.ts           # 스키마 동기화
    ├── create.ts                # 레코드 생성
    ├── read.ts                  # 레코드 조회
    ├── update.ts                # 레코드 수정
    ├── delete.ts                # 레코드 삭제
    └── create-field.ts          # 필드 생성
```

## 요구사항

- [Bun](https://bun.sh/) 런타임
- Airtable Personal Access Token

## 라이선스

MIT
