# 처음 연결 가이드 — 사람이 할 일 4단계

봇은 에어테이블에 **가입도, 토큰 발급도 못 한다.** 사람이 아래 4단계를 해서 토큰과 베이스 ID를 넘겨줘야 한다.
`.env`가 비어 있으면 이 순서대로 **한 단계씩** 안내한다. 한 번에 다 던지지 말고, 각 단계 끝에 "됐어?"를 묻는다.

## 1. 가입

- https://airtable.com → **Sign up** (구글 계정으로 가입하면 제일 빠르다)
- 무료 플랜으로 충분하다. 가입 중 팀 초대·유료 체험을 물으면 건너뛰어도 된다.

## 2. 워크스페이스에 베이스 하나 만들기

- 홈 화면 → **Create** → **Start from scratch** (빈 베이스)
- 베이스 이름은 지금 설계할 도메인 이름으로 (예: `독서모임 운영`). 나중에 바꿀 수 있다.
- **베이스 안의 테이블은 비워둬도 된다.** 테이블은 설계 인터뷰가 끝난 뒤 봇이 만든다.
- 주소창 `airtable.com/appXXXXXXXXXXXXXX/...` 에서 **`app`으로 시작하는 부분 = 베이스 ID.** 메모해 둔다.

## 3. 빌더 허브에서 Personal Access Token 발급

- 오른쪽 위 프로필 → **Builder hub** → 왼쪽 **Personal access tokens** → **Create new token**
  (바로 가기: https://airtable.com/create/tokens)
- **Name**: 아무거나 (예: `내봇`)
- **Scopes**: 목록에 보이는 걸 전부 추가. 최소한 아래 4개는 꼭 있어야 한다.
  - `data.records:read` · `data.records:write` — 레코드 읽기·쓰기
  - `schema.bases:read` · `schema.bases:write` — 테이블·필드 구조 읽기·**만들기** (설계한 걸 봇이 직접 만들려면 필수)
- **Access**: **Add a base** → **All current and future bases in all current and future workspaces**
  - ⚠️ 제일 많이 빠뜨리는 칸. Scope만 넣고 Access를 안 고르면 토큰은 멀쩡한데 아무 베이스도 안 보인다.
- **Create token** → `pat`으로 시작하는 토큰을 복사. **이 화면을 닫으면 다시 못 본다.**

## 4. 봇에게 연결

사람이 DM으로 이렇게 보낸다:

```
에어테이블 스킬 토큰이야. 스킬 폴더 .env에 저장해줘. 답장에 토큰 다시 쓰지 마.
토큰: pat...
베이스 ID: app...
```

봇이 할 일:

1. `<skill-dir>/.env`에 저장 (기존 줄이 있으면 그 줄만 바꾼다)
   ```
   AIRTABLE_API_KEY=pat...
   AIRTABLE_BASE_ID=app...
   ```
2. 답장에 토큰을 **다시 적지 않는다.** "붙여넣은 메시지는 지워줘"라고 안내한다.
3. 연결 확인: `bun run scripts/sync-schema.ts` → 성공하면 테이블 목록을 보여준다.
4. 테이블이 비어 있거나 기본 `Table 1`뿐이면 → **바로 설계 인터뷰를 제안한다** ([relational-design-interview.md](relational-design-interview.md)).

## 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| `NOT_FOUND` / 베이스가 안 보임 | 토큰의 **Access**에 베이스를 안 넣음 → 토큰 편집에서 추가 |
| `INVALID_PERMISSIONS` (테이블·필드 만들 때) | `schema.bases:write` scope 빠짐 |
| `AUTHENTICATION_REQUIRED` | 토큰 오타·복사 중 잘림 → 새로 발급 |
| 토큰이 채팅에 남았다 | 토큰 페이지에서 지우고 새로 만들면 끝 |
