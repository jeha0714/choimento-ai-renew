# Vercel 배포 가이드

## 사전 준비

- Node.js 18+ 설치 (https://nodejs.org)
- Vercel 계정 (https://vercel.com — GitHub로 가입 가능)

---

## 방법 1: CLI로 배포 (가장 빠름)

### 1단계: 프로젝트 압축 해제

다운로드한 `review-tool.tar.gz`를 원하는 위치에 압축 해제합니다.

```bash
tar -xzf review-tool.tar.gz
cd review-tool
```

### 2단계: 의존성 설치 및 로컬 테스트

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하여 정상 작동하는지 확인합니다.

### 3단계: Vercel CLI 설치 및 배포

```bash
npm install -g vercel
vercel login
vercel
```

`vercel` 명령 실행 시 나오는 질문:
- Set up and deploy? → `Y`
- Which scope? → 본인 계정 선택
- Link to existing project? → `N`
- Project name? → `review-tool` (또는 원하는 이름)
- Framework? → `Vite` (자동 감지됨)
- Override settings? → `N`

배포 완료 후 URL이 출력됩니다 (예: `https://review-tool-xxxx.vercel.app`).

### 4단계: 프로덕션 배포

```bash
vercel --prod
```

---

## 방법 2: GitHub 연동으로 배포

### 1단계: GitHub 저장소 생성

1. GitHub에서 새 저장소 생성 (예: `review-tool`)
2. 프로젝트 파일을 push:

```bash
cd review-tool
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/본인계정/review-tool.git
git push -u origin main
```

### 2단계: Vercel에서 Import

1. https://vercel.com/dashboard 접속
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 목록에서 `review-tool` 선택
4. Framework Preset: `Vite` (자동 감지)
5. "Deploy" 클릭

배포 완료 후 URL이 생성됩니다.

---

## 검수자에게 공유

배포된 URL (예: `https://review-tool-xxxx.vercel.app`)을 검수자에게 공유하면 됩니다.

### 주의사항

- **localStorage는 브라우저별로 독립적**입니다. 검수자가 같은 브라우저에서 접속해야 이전 진행 상태가 유지됩니다.
- 다른 브라우저나 시크릿 모드에서 접속하면 처음부터 시작됩니다.
- localStorage 용량 한도는 브라우저별로 5~10MB이므로 9,400건 데이터 + 결과도 충분히 저장됩니다.
