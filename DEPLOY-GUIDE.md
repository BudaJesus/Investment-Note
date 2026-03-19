# 투자 노트 — 배포 가이드

## 전체 흐름 (15~20분)

```
1. Supabase 프로젝트 생성 (무료)  →  DB + 인증 준비
2. GitHub에 코드 올리기            →  소스코드 저장소
3. Vercel에 배포                   →  웹사이트 공개
```

---

## Step 1: Supabase 설정 (5분)

### 1-1. 프로젝트 생성
1. https://supabase.com 접속 → `Start your project` 클릭
2. GitHub 계정으로 로그인
3. `New project` 클릭
4. 설정:
   - **Organization**: 본인 이름
   - **Project name**: `invest-note`
   - **Database Password**: 강력한 비밀번호 설정 (메모해두세요)
   - **Region**: Northeast Asia (Tokyo) — 한국에서 가장 빠름
5. `Create new project` 클릭 → 2분 기다림

### 1-2. 테이블 생성
1. 좌측 메뉴 `SQL Editor` 클릭
2. `New query` 클릭
3. `supabase-setup.sql` 파일 내용 전체 복사 붙여넣기
4. `Run` 클릭 → "Success" 확인

### 1-3. API 키 복사
1. 좌측 메뉴 `Settings` → `API`
2. 아래 두 값을 메모:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (긴 문자열)

### 1-4. 인증 설정 (선택)
Google 로그인을 쓰고 싶다면:
1. `Authentication` → `Providers` → `Google`
2. Google Cloud Console에서 OAuth 클라이언트 설정
3. Client ID / Secret 입력

이메일/비밀번호 로그인은 기본으로 활성화되어 있습니다.

---

## Step 2: GitHub에 코드 올리기 (5분)

### 2-1. GitHub 저장소 생성
1. https://github.com → `New repository`
2. **Repository name**: `invest-note`
3. **Private** 선택 (공개하고 싶으면 Public)
4. `Create repository` 클릭

### 2-2. 코드 업로드
다운로드 받은 `invest-note` 폴더에서 터미널을 열고:

```bash
cd invest-note

# git 초기화
git init
git add .
git commit -m "Initial commit"

# GitHub 연결 (your-username을 본인 깃허브 아이디로 변경)
git remote add origin https://github.com/your-username/invest-note.git
git branch -M main
git push -u origin main
```

> **터미널이 어렵다면**: GitHub 웹에서 직접 파일을 드래그&드롭해도 됩니다.

---

## Step 3: Vercel 배포 (5분)

### 3-1. Vercel 연결
1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. `Add New...` → `Project`
3. `invest-note` 저장소 선택 → `Import`

### 3-2. 환경 변수 설정
`Environment Variables` 섹션에서:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` (Step 1에서 복사) |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` (Step 1에서 복사) |

### 3-3. 배포
1. `Deploy` 클릭
2. 1~2분 대기
3. 완료되면 URL이 나옵니다: `https://invest-note.vercel.app`

**끝!** 이 URL로 PC, 모바일 어디서든 접속할 수 있습니다.

---

## Step 4: Supabase에 Vercel URL 등록

배포 후 Supabase에 사이트 URL을 알려줘야 합니다:
1. Supabase 대시보드 → `Authentication` → `URL Configuration`
2. **Site URL**: `https://invest-note.vercel.app` (본인 Vercel URL)
3. **Redirect URLs**에도 같은 URL 추가

---

## 로컬에서 개발할 때

```bash
# 의존성 설치 (최초 1회)
npm install

# .env 파일 생성
cp .env.example .env
# .env 파일을 열어 Supabase URL과 Key 입력

# 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

> **Supabase 없이 로컬 테스트**: .env를 비워두면 localStorage 모드로 동작합니다.

---

## 커스텀 도메인 (선택)

Vercel에서 무료로 커스텀 도메인을 연결할 수 있습니다:
1. Vercel 프로젝트 → `Settings` → `Domains`
2. 본인 도메인 입력 (예: `invest.mydomain.com`)
3. DNS 설정 안내에 따라 CNAME 레코드 추가

---

## 폴더 구조

```
invest-note/
├── index.html              ← HTML 진입점
├── package.json            ← 의존성 목록
├── vite.config.js          ← 빌드 설정
├── supabase-setup.sql      ← DB 테이블 생성 SQL
├── .env.example            ← 환경변수 예시
├── .gitignore
└── src/
    ├── main.jsx            ← React 진입점
    ├── App.jsx             ← 인증 체크 + 라우팅
    ├── Auth.jsx            ← 로그인/회원가입 화면
    ├── InvestmentJournal.jsx  ← 메인 앱 전체
    ├── supabase.js         ← Supabase 클라이언트
    └── storage.js          ← 저장소 어댑터 (Supabase/localStorage)
```

---

## 비용

| 서비스 | 무료 티어 | 한도 |
|--------|-----------|------|
| Supabase | 무료 | 500MB DB, 50,000 월간 인증, 2GB 전송 |
| Vercel | 무료 | 100GB 전송, 무제한 배포 |
| **합계** | **0원** | 개인 사용 충분 |

투자 일지 텍스트 데이터는 매일 써도 연간 2MB 미만이므로 500MB의 0.4%입니다.
