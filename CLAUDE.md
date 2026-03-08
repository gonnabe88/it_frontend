---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Portal System의 개발 환경, 기술 스택, 코딩 표준을 정의합니다.
AI 어시스턴트는 코드 생성 시 이 지침을 준수하며, 모든 주석은 한글로 작성합니다.
---

## 1. 프로젝트 개요
- 명칭: IT Portal System (IT 포털 시스템)
- 주요 기능: 프로젝트(정보화사업 및 전산예산) 관리, 전자결재
- 사용자: 약 3,000명의 사내 임직원

## 2. 기술 스택 (Tech Stack)
- Framework: Nuxt 4 (v4)
- UI Library: PrimeVue (Aura Theme)
- Styling: Tailwind CSS
- State Management: Pinia
- Language: TypeScript

## 3. 주요 명령어
- npm install: 패키지 설치
- npx nuxt prepare: 타입 정의 자동 생성
- npm run dev: 개발 서버 실행
- npm run build: 운영 빌드
- npm test: 단위 테스트 실행 (Vitest)
- npm run test:watch: 단위 테스트 watch 모드
- npm run test:coverage: 커버리지 리포트 생성
- npm run test:e2e: E2E 테스트 실행 (Playwright)

## 4. 코딩 스타일 및 가이드라인

### 4.1 컴포넌트 개발 원칙
- 재사용성을 위해 컴포넌트 분리 중심의 개발을 진행합니다.
- Composition API 사용: 반드시 `<script setup lang="ts">` 구조를 사용합니다.
- UI 일관성: PrimeVue 컴포넌트를 우선 사용하며, 세부 레이아웃은 Tailwind로 조정합니다.
- 상세 주석: 코드의 의도를 명확히 하기 위해 모든 로직에는 한글 주석을 필수로 작성합니다.

### 4.2 API 요청 패턴
두 가지 API 유틸리티를 용도에 맞게 구분하여 사용합니다.

| 구분 | 함수 | 용도 |
|------|------|------|
| GET (조회) | `useApiFetch<T>` | `useFetch` 래퍼. 반응형 데이터 조회. 토큰 자동 주입 및 401 처리 포함. |
| POST/PUT/DELETE (변경) | `$apiFetch` | `$fetch` 래퍼. 일회성 데이터 변경. 토큰 자동 주입 및 401 처리 포함. |

```ts
// GET 조회 예시 (composables/useApiFetch.ts)
const { data, pending, refresh } = useApiFetch<Project[]>('/api/projects', {
  query: { year: 2025 }
});

// POST/PUT/DELETE 변경 예시 (plugins/auth.ts에서 provide됨)
const { $apiFetch } = useNuxtApp();
await $apiFetch('/api/projects', { method: 'POST', body: payload });

// ⚠️ 주의: stores/auth.ts 내부에서는 $apiFetch 사용 불가 (순환 참조 발생)
```

### 4.3 환경 변수 및 API Base URL
API URL을 코드에 하드코딩하지 않습니다. 반드시 `runtimeConfig`를 통해 주입합니다.

```ts
// .env
// NUXT_PUBLIC_API_BASE=http://localhost:8080

// 사용 방법
const config = useRuntimeConfig();
const url = `${config.public.apiBase}/api/projects`;
```

### 4.4 보안 정책
- `v-html` 사용 시 반드시 `isomorphic-dompurify`로 새니타이징한 후 바인딩합니다.

```ts
import DOMPurify from 'isomorphic-dompurify';

// ❌ 금지
<div v-html="content" />

// ✅ 올바른 사용
<div v-html="DOMPurify.sanitize(content)" />
```

### 4.5 Architecture

**Nuxt 4는 소스 루트가 `app/` 디렉토리입니다. 파일 생성 시 반드시 `app/` 하위에 위치시킵니다.**

```
it_frontend/
├── app/                         ← 소스 루트 (Nuxt 4)
│   ├── assets/                  이미지, 전역 CSS 등
│   ├── components/              공통 컴포넌트
│   ├── composables/             Composable 함수
│   ├── layouts/                 레이아웃
│   ├── middleware/              미들웨어
│   ├── pages/                   페이지 라우트
│   │   ├── info/projects/       프로젝트(정보화사업) 관리
│   │   ├── info/cost/           프로젝트(전산업무비) 관리
│   │   ├── budget/              전산예산 관리
│   │   ├── diagnosis/           사전진단
│   │   ├── audit/               IT 감사
│   │   └── approval/            전자결재
│   ├── plugins/                 Nuxt 플러그인
│   ├── stores/                  Pinia 상태관리
│   ├── types/                   TypeScript 타입 정의
│   └── utils/                   유틸리티 함수
├── public/                      정적 파일
└── nuxt.config.ts
```

### 4.6 주요 파일 목록
새 기능 개발 전 아래 파일의 존재를 확인하여 중복 구현을 방지합니다.

**Composables**
- `composables/useApiFetch.ts` - 인증 GET 요청 (useFetch 래핑)
- `composables/useAuth.ts` - 인증 store 노출
- `composables/useOrganization.ts` - 조직도/사용자 조회
- `composables/useProjects.ts` - 정보화사업 프로젝트 조회
- `composables/useCost.ts` - 전산업무비 조회
- `composables/useApprovals.ts` - 전자결재 조회
- `composables/useCurrencyRates.ts` - 환율 조회
- `composables/usePdfReport.ts` - PDF 리포트 생성
- `composables/useTabs.ts` - 탭 상태 관리

**Stores / Utils**
- `stores/auth.ts` - 로그인/로그아웃/토큰갱신/세션복원
- `plugins/auth.ts` - `$apiFetch` provide, 401 처리
- `utils/common.ts` - `formatBudget`, `getApprovalTagClass`, `getProjectTagClass`

### 4.7 테스트 작성 원칙

**기능 또는 화면 개발 완료 시 반드시 테스트 코드를 함께 작성합니다.**

#### 테스트 대상별 위치

| 대상 | 테스트 파일 위치 | 러너 |
|------|----------------|------|
| 순수 유틸 함수 (`utils/`) | `tests/unit/utils/*.test.ts` | Vitest |
| Pinia store (`stores/`) | `tests/unit/stores/*.test.ts` | Vitest |
| Composable (`composables/`) | `tests/unit/composables/*.test.ts` | Vitest |
| 페이지/화면 E2E | `tests/e2e/*.spec.ts` | Playwright |

#### 필수 테스트 범위

- **유틸 함수** (`utils/common.ts` 등): 신규 함수 추가 시 모든 분기를 커버하는 단위 테스트 작성
- **Store 액션** (`stores/*.ts`): 로직 변경 시 성공/실패/엣지 케이스 테스트 작성
- **신규 페이지** (`pages/**/*.vue`): 핵심 사용자 시나리오 1개 이상 E2E 테스트 작성

#### Mock 규칙

```ts
// Nuxt $fetch → vi.stubGlobal로 대체
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// process.client → Object.assign으로 클라이언트 환경 시뮬레이션
Object.assign(process, { client: true });

// Playwright API Mock → page.route()로 응답 대체
await page.route('**/api/projects', route =>
    route.fulfill({ status: 200, body: JSON.stringify(mockData) })
);

// ⚠️ Nuxt auto-import(#app, #imports)는 Vitest에서 미지원
// → ref, computed, defineStore 등을 테스트 파일에서 명시적으로 import할 것
```

#### 테스트 실행 확인

개발 완료 후 반드시 `npm test`를 실행하여 기존 테스트가 모두 통과하는지 확인합니다.

### 4.8 타입 충돌 주의사항
동일한 도메인에서 용도가 다른 두 User 타입이 존재합니다. 혼용하지 않습니다.

```ts
// types/auth.ts - 인증용 (로그인 세션)
type User = { eno: string; empNm: string; }

// composables/useOrganization.ts - 조직도용 (사용자 검색)
type OrgUser = { eno: string; usrNm: string; bbrNm: string; /* ... */ }
```

## 5. 주석 및 타입 작성 예시
```TypeScript
    /**
     * 페이지 새로고침 후 세션 복원
     * localStorage에 저장된 토큰과 사용자 정보를 읽어 Pinia 상태를 복원합니다.
     * middleware/auth.global.ts에서 매 라우트 네비게이션마다 호출됩니다.
     *
     * [localStorage 데이터 형식]
     *  - 'accessToken'  : 문자열 (JWT)
     *  - 'refreshToken' : 문자열 (JWT)
     *  - 'user'         : JSON 문자열 ({ eno, empNm })
     *
     * [예외 처리]
     * - JSON.parse 실패(데이터 손상) 시 clearAuth()로 초기화합니다.
     */
    const restoreSession = (): void => {
```

```TypeScript
/**
 * 프로젝트 정보를 업데이트하는 함수
 * @param id - 프로젝트 고유 아이디
 * @param data - 수정할 데이터 객체
 */
const updateProject = (id: string, data: any) => {
  // 로직을 한글 주석과 함께 구현하세요.
};
```
