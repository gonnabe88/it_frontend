---
[ 프론트엔드 가이드 ]
본 파일은 IT Portal 프론트엔드의 SoT(Single Source of Truth)입니다.
기술 스택, 컴포넌트 규약, 라우팅, 클라이언트 인증 책임의 원본은 여기에 있습니다.
공통 규약(한글 주석, 인증 정책 SoT 등)은 루트 `../CLAUDE.md` 참조.
---

## 1. 개요
- 프로젝트 개요/목적은 루트 `../CLAUDE.md` §1 참조.
- 백엔드 패키지 구조 및 인증 정책은 `../it_backend/CLAUDE.md`를 SoT로 따릅니다(이중 관리 금지).

## 2. 기술 스택
- Framework: Nuxt 4 (v4)
- UI Library: PrimeVue (Aura Theme)
- Styling: Tailwind CSS
- State Management: Pinia
- Language: TypeScript

## 3. 주요 명령어
- `npm install` — 패키지 설치
- `npx nuxt prepare` — 타입 정의 생성
- `npm run dev` — 개발 서버 (http://localhost:3000)
- `npm run build` — 운영 빌드
- `npm test` — 단위 테스트 (Vitest)
- `npm run test:watch` — 단위 테스트 watch
- `npm run test:coverage` — 커버리지 리포트
- `npm run test:e2e` — E2E 테스트 (Playwright)

## 4. 코딩 스타일 및 가이드라인

### 4.1 컴포넌트 개발 원칙
- 재사용성 중심 분리.
- Composition API 사용: 반드시 `<script setup lang="ts">`.
- UI 일관성: PrimeVue 우선, 세부 레이아웃은 Tailwind로 조정.
- 한글 주석 원칙은 루트 `../CLAUDE.md` §4.1 참조.

### 4.2 API 요청 패턴
두 가지 API 유틸리티를 용도에 맞게 구분합니다.

| 구분 | 함수 | 용도 |
|------|------|------|
| GET (조회) | `useApiFetch<T>` | `useFetch` 래퍼. 반응형 데이터 조회. httpOnly 쿠키 자동 전송 + 401 처리 |
| POST/PUT/DELETE (변경) | `$apiFetch` | `$fetch` 래퍼. 일회성 변경. httpOnly 쿠키 자동 전송 + 401 처리 |

```ts
// GET 조회
const { data, pending, refresh } = useApiFetch<Project[]>('/api/projects', {
  query: { year: 2025 }
});

// POST/PUT/DELETE 변경
const { $apiFetch } = useNuxtApp();
await $apiFetch('/api/projects', { method: 'POST', body: payload });

// 주의: stores/auth.ts 내부에서는 $apiFetch 사용 불가 (순환 참조)
// 로그인/갱신/로그아웃은 Nuxt 내장 $fetch + credentials:'include'를 직접 사용
```

### 4.3 환경 변수 / API Base URL
하드코딩 금지. 반드시 `runtimeConfig` 사용.

```ts
// .env
// NUXT_PUBLIC_API_BASE=http://localhost:8080

const config = useRuntimeConfig();
const url = `${config.public.apiBase}/api/projects`;
```

### 4.4 클라이언트 인증 책임
인증 정책의 SoT는 백엔드(`../it_backend/CLAUDE.md` §5.6)이며, 프론트는 다음 책임만 집니다.

- JWT를 직접 저장/읽지 않는다 — 토큰은 백엔드 발급 httpOnly 쿠키로만 흐른다.
- 모든 인증 API 요청은 `credentials: 'include'`.
- 사용자 표시용 인증 상태는 `stores/auth.ts`의 `useCookie('it-portal-user')`로 관리.
- 다크모드 초기 상태는 `theme-dark` 쿠키를 기준으로 `nuxt.config.ts` 인라인 스크립트에서 하이드레이션 전에 적용.
- 자격등급 상수는 `types/auth.ts`의 `ROLE` 객체 사용 (`ROLE.ADMIN/USER/DEPT_MANAGER`).

### 4.5 XSS 방지
`v-html` 사용 시 반드시 `isomorphic-dompurify`로 새니타이징.

```ts
import DOMPurify from 'isomorphic-dompurify';

// 금지
<div v-html="content" />

// 사용
<div v-html="DOMPurify.sanitize(content)" />
```

### 4.6 디렉토리 구조

**Nuxt 4는 소스 루트가 `app/` 입니다. 파일 생성 시 반드시 `app/` 하위에 위치시킵니다.**

```
it_frontend/
├── app/                       ← 소스 루트 (Nuxt 4)
│   ├── assets/                이미지, 전역 CSS
│   ├── components/            공통 컴포넌트
│   ├── composables/           Composable 함수
│   ├── layouts/               레이아웃
│   ├── middleware/            미들웨어
│   ├── pages/                 페이지 라우트
│   │   ├── admin/             시스템 관리 (ROLE_ADMIN 전용)
│   │   ├── info/projects/     정보화사업
│   │   ├── info/cost/         전산업무비
│   │   ├── info/documents/    요구사항 정의서 + 사전협의
│   │   ├── info/plan/         정보기술부문 계획
│   │   ├── budget/            전산예산 + 예산 작업
│   │   ├── diagnosis/         사전진단
│   │   ├── audit/             IT 감사
│   │   └── approval/          전자결재
│   ├── plugins/               Nuxt 플러그인
│   ├── stores/                Pinia 상태관리
│   ├── types/                 TypeScript 타입 정의
│   └── utils/                 유틸리티 함수
├── public/                    정적 파일
└── nuxt.config.ts
```

### 4.7 Composables / Stores / Utils / Types
새 기능 개발 전 `app/composables/`, `app/stores/`, `app/utils/`, `app/types/` 디렉토리를 직접 확인하여 중복 구현을 방지합니다. 주요 그룹:

- **인증·세션:** `useAuth`, `stores/auth.ts`, `plugins/auth.ts` (`$apiFetch` provide, 401 처리)
- **API 호출 래퍼:** `useApiFetch`, `useAdminApi`(관리자 전용 CRUD)
- **예산 도메인:** `useProjects`, `useCost`, `usePlan`, `useBudgetPeriod`, `useBudgetStatus`, `useProjectOptions`, `useCurrencyRates`
- **결재·문서:** `useApprovals`, `useApprovalDashboard`, `useDocuments`, `useGuideDocuments`, `useDocumentDashboard`, `usePendingApprovalCount`
- **협의회·검토:** `useCouncil`, `useCouncilCodes`, `useReview`, `useReviewCommentApi`, `stores/review.ts`
- **공통 코드/조직:** `useCodeOptions`, `useOrganization`, `useEmployeeSearch`
- **첨부/내보내기:** `useFiles`, `useExcalidrawAttachment`, `useExcalidrawDialog`, `useHwpxExport`, `usePdfReport`
- **UI 보조:** `useGlobalSearch`, `useTabs`, `useTableCellSelection`, `useDateRangeValidation`
- **유틸:** `utils/common.ts`(`formatBudget`, `getApprovalTagClass`, `getProjectTagClass`), `utils/excel.ts`, `utils/hwpx.ts`
- **타입:** `types/auth.ts`(인증 + `ROLE` 상수), `types/budget-work.ts`, `types/budgetStatus.ts`, `types/council.ts`, `types/review.ts`

### 4.8 관리자 접근 제어 패턴
관리자 전용 페이지(`/admin/**`)는 3단계로 보호합니다.
1. `middleware/admin.ts` — 클라이언트에서 `ROLE.ADMIN` 검증, 미보유 시 `/` 리다이렉트.
2. `layouts/admin.vue` — 관리자 전용 레이아웃 (`definePageMeta({ layout: 'admin' })`).
3. 백엔드 — `@PreAuthorize("hasRole('ADMIN')")` + SecurityConfig URL 패턴 이중 보호.

### 4.9 공통 컴포넌트 사용 규칙
- `StyledDataTable.vue` — 모든 DataTable 통일(파란 헤더/gridlines/resizable). 상세 사용법은 → [`docs/guides/styled-data-table.md`](docs/guides/styled-data-table.md).
- `EmployeeSearchDialog.vue` — 직원 검색이 필요한 모든 폼에서 재사용. `useEmployeeSearch.ts`와 함께 사용.
- `components/common/` 하위는 Nuxt 자동 등록 시 `Common` 접두사가 붙으므로 일관성을 위해 **명시적 import** 사용.

### 4.10 테스트 작성 원칙
**기능 또는 화면 개발 완료 시 반드시 테스트 코드를 함께 작성합니다.**

| 대상 | 테스트 파일 위치 | 러너 |
|------|----------------|------|
| 순수 유틸 함수 (`utils/`) | `tests/unit/utils/*.test.ts` | Vitest |
| Pinia store (`stores/`) | `tests/unit/stores/*.test.ts` | Vitest |
| Composable (`composables/`) | `tests/unit/composables/*.test.ts` | Vitest |
| 페이지/화면 E2E | `tests/e2e/*.spec.ts` | Playwright |

필수 테스트 범위:
- **유틸 함수**: 신규 함수 추가 시 모든 분기 커버.
- **Store 액션**: 로직 변경 시 성공/실패/엣지 케이스.
- **신규 페이지**: 핵심 사용자 시나리오 1개 이상 E2E.

Mock 규칙:
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

// 주의: Nuxt auto-import(#app, #imports)는 Vitest 미지원
// → ref, computed, defineStore 등은 테스트 파일에서 명시적 import
```

실행 명령:
- 타입 변경/컴포넌트 변경: `npm run typecheck`
- 정적 분석: `npm run lint`
- 단위 로직 변경: `npm test`
- 사용자 시나리오 변경: `npm run test:e2e`

`coverage/`, `test-results/`, `.nuxt/`, `.output/`, `dist/`는 ESLint 대상에서 제외.

### 4.11 타입 충돌 주의
동일 도메인에서 용도가 다른 두 User 타입은 혼용 금지.

```ts
// types/auth.ts - 인증용 (로그인 세션)
type User = { eno: string; empNm: string; athIds: string[]; bbrC: string; temC: string; }

// composables/useOrganization.ts - 조직도용
type OrgUser = { eno: string; usrNm: string; bbrNm: string; /* ... */ }

// composables/useEmployeeSearch.ts - AutoComplete 검색용
type UserSuggestion = { eno: string; usrNm: string; bbrNm: string; bbrC: string; /* ... */ }
```

자격등급(역할) 상수:
```ts
import { ROLE } from '~/types/auth';
// ROLE.USER = 'ITPZZ001', ROLE.DEPT_MANAGER = 'ITPZZ002', ROLE.ADMIN = 'ITPAD001'
```

## 5. PrimeVue 참조
- 공식 문서: https://primevue.org
- LLM 최적화 문서 (컴포넌트 전체 API): https://primevue.org/llms
- MCP 서버: https://primevue.org/mcp
- Pass Through API: https://primevue.org/passthrough
