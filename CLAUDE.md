---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Portal 프론트엔드의 개발 환경, 기술 스택, 코딩 표준을 정의합니다.
AI 어시스턴트는 코드 생성 시 이 지침을 준수하며, 모든 주석은 한글로 작성합니다.
---

## 1. 프로젝트 개요
- 명칭: IT Portal (IT 정보화 포탈)
- 주요 기능: 정보화 예산, 사업, 인력 관리
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
- npm run dev: 개발 서버 실행 (http://localhost:3000)
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

> **백엔드 패키지 구조 참고** (2026-04-10 기준)
> 백엔드 API 경로(`/api/**`)는 변경 없음. 백엔드 내부 클래스는 도메인 기반으로 재구조화됨:
> - `common/system` — 인증 (AuthController, JwtUtil)
> - `common/iam` — 사용자·조직 (UserRepository, OrganizationRepository)
> - `common/admin` — 시스템관리 (AdminController, AdminService — ROLE_ADMIN 전용)
> - `budget/project` — 정보화사업 (ProjectController, ProjectService)
> - `budget/cost` — 전산업무비 (CostController, CostService)
> - `budget/plan` — 정보기술부문 계획 (PlanController, PlanService)
> - `budget/work` — 예산 작업 (BudgetWorkController, BudgetWorkService)
> - `budget/status` — 예산현황 3탭 조회 (BudgetStatusService)
> - `budget/document` — 검토의견 (Brivgm 엔티티, ReviewCommentService)
> - `council` — 정보화실무협의회 (CouncilController, 8개 서비스)
> - `infra/file` — 파일 (FileController, FileService)
> - `infra/ai` — Gemini AI (GeminiController, GeminiService)

```
it_frontend/
├── app/                         ← 소스 루트 (Nuxt 4)
│   ├── assets/                  이미지, 전역 CSS 등
│   ├── components/              공통 컴포넌트
│   ├── composables/             Composable 함수
│   ├── layouts/                 레이아웃
│   ├── middleware/              미들웨어
│   ├── pages/                   페이지 라우트
│   │   ├── admin/               시스템 관리 (ROLE_ADMIN 전용)
│   │   ├── info/projects/       프로젝트(정보화사업) 관리
│   │   ├── info/cost/           프로젝트(전산업무비) 관리
│   │   ├── info/documents/      요구사항 정의서 + 사전협의
│   │   ├── info/plan/           정보기술부문 계획
│   │   ├── budget/              전산예산 관리 + 예산 작업
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
- `composables/useAdminApi.ts` - 관리자 전용 API (24개 CRUD 함수)
- `composables/useApiFetch.ts` - 인증 GET 요청 (useFetch 래핑)
- `composables/useAuth.ts` - 인증 store 노출
- `composables/useApprovalDashboard.ts` - 전자결재 홈 대시보드 KPI/월별통계(`useApprovalDashboard`) + 사이드바 배지(`useApprovalBadgeCount`)
- `composables/useApprovals.ts` - 전자결재 조회
- `composables/useCost.ts` - 전산업무비 조회
- `composables/useDocumentDashboard.ts` - 사전협의 홈 대시보드 KPI/월별통계(`useDocumentDashboard`) + 사이드바 배지(`useDocumentBadgeCount`)
- `composables/useCurrencyRates.ts` - 환율 조회
- `composables/useDateRangeValidation.ts` - 날짜 범위 유효성 검사
- `composables/useDocuments.ts` - 요구사항 정의서 CRUD
- `composables/useEmployeeSearch.ts` - 직원 검색 (AutoComplete + 다이얼로그)
- `composables/useFiles.ts` - 첨부파일 업로드/다운로드/미리보기
- `composables/useGuideDocuments.ts` - 가이드 문서 CRUD
- `composables/useHwpxExport.ts` - HWPX(한글) 파일 내보내기
- `composables/useOrganization.ts` - 조직도/사용자 조회
- `composables/usePdfReport.ts` - PDF 리포트 생성
- `composables/usePlan.ts` - 정보기술부문 계획 CRUD
- `composables/useProjectOptions.ts` - 프로젝트 옵션 (연도/분류/상태 코드)
- `composables/useProjects.ts` - 정보화사업 프로젝트 조회
- `composables/useReview.ts` - 사전협의 세션 관리
- `composables/useTabs.ts` - 탭 상태 관리

**Stores / Utils / Types**
- `stores/auth.ts` - 로그인/로그아웃/토큰갱신/세션복원
- `stores/review.ts` - 사전협의 세션/버전/코멘트/검토자 상태 관리
- `plugins/auth.ts` - `$apiFetch` provide, 401 처리
- `utils/common.ts` - `formatBudget`, `getApprovalTagClass`, `getProjectTagClass`
- `types/auth.ts` - 인증 타입 + ROLE 상수 (ADMIN/USER/DEPT_MANAGER)
- `types/budget-work.ts` - 예산 작업 타입 (편성비목/편성결과)
- `types/review.ts` - 사전협의 타입 (세션/코멘트/검토자/버전)

### 4.7 관리자 접근 제어 패턴
관리자 전용 페이지(`/admin/**`)는 다음 3단계로 보호합니다:
1. `middleware/admin.ts`: 클라이언트에서 `ROLE.ADMIN` 포함 여부 검증 → 미보유 시 `/` 리다이렉트
2. `layouts/admin.vue`: 관리자 전용 레이아웃 적용 (`definePageMeta({ layout: 'admin' })`)
3. 백엔드: `@PreAuthorize("hasRole('ADMIN')")` + SecurityConfig URL 패턴 이중 보호

### 4.8 공통 컴포넌트 사용 규칙
- `StyledDataTable.vue`: 모든 DataTable에 파란 헤더/gridlines 일관 적용 시 이 래퍼를 사용합니다. (상세: 4.9 참조)
- `EmployeeSearchDialog.vue`: 직원 검색이 필요한 모든 폼에서 재사용합니다. `useEmployeeSearch.ts`와 함께 사용합니다.
- `components/common/` 하위 컴포넌트는 Nuxt 자동 등록 시 `Common` 접두사가 붙으므로, 기존 코드와의 일관성을 위해 **명시적 import**를 사용합니다.

### 4.9 표준 테이블 레이아웃 (StyledDataTable)

모든 DataTable은 `StyledDataTable` 공통 컴포넌트를 사용하여 **파란 헤더(blue-900), gridlines, resizable 컬럼** 스타일을 통일합니다.

#### 사용법

```ts
// 반드시 명시적 import (Nuxt 자동 등록 시 CommonStyledDataTable이 되므로)
import StyledDataTable from '~/components/common/StyledDataTable.vue';
```

```html
<!-- PrimeVue DataTable과 동일하게 사용, Column은 slot으로 전달 -->
<StyledDataTable :value="rows" :loading="pending" stripedRows dataKey="id">
    <Column field="name" header="이름" />
    <Column field="amount" header="금액">
        <template #body="{ data }">
            <span class="text-right block">{{ fmt(data.amount) }}</span>
        </template>
        <template #footer>
            <span class="text-right block font-bold">{{ fmt(total) }}</span>
        </template>
    </Column>
</StyledDataTable>
```

#### 자동 적용 속성 (수동 지정 불필요)

| 속성 | 값 | 설명 |
|------|----|------|
| `showGridlines` | `true` | 셀 경계선 표시 |
| `resizableColumns` | `true` | 컬럼 크기 조절 가능 |
| `columnResizeMode` | `"fit"` | 리사이즈 시 전체 너비 유지 |
| `tableStyle` | `min-width: 50rem` | 최소 테이블 너비 |
| 헤더 배경색 | `blue-900` | CSS로 자동 적용 |
| 행 hover | `bg-zinc-50` | `pt.bodyRow`로 자동 적용 |

#### 공통 표준 기능 (자동 적용)

모든 `StyledDataTable`에는 다음 공통 기능이 자동 적용됩니다.

**1. 화면 채움 레이아웃 + 하단 Paginator 고정**
- `scrollable` + `scroll-height="flex"`와 함께 사용하면 테이블이 남은 화면 영역을 채우고 본문만 스크롤됩니다.
- Paginator는 하단에 고정되며 좌/우/하단 보더가 제거되어 카드 테두리와 자연스럽게 이어집니다.
- 부모 컨테이너는 `flex-1 min-h-0 flex flex-col` 체인을 제공해야 합니다.

```html
<div class="flex-1 min-h-0 flex flex-col"> <!-- 부모 flex 체인 -->
    <StyledDataTable scrollable scroll-height="flex" ... paginator :rows="20">
        ...
    </StyledDataTable>
</div>
```

**2. 삭제 표시 행 (row-deleted) 규약**
- `row-class` 함수가 `'row-deleted'`를 반환하는 행에 회색 배경 + 취소선 + pointer-events 차단이 자동 적용됩니다.
- 첫 번째 셀(선택 체크박스)과 마지막 셀(삭제/복구 버튼)은 조작 가능 상태로 유지됩니다.
- `input`/`AutoComplete`/`Select` 내부 텍스트까지 취소선이 적용됩니다.

```ts
// 페이지에서 rowClass 정의
const rowClass = (data: RowType): string | undefined => {
    return data._status === 'deleted' ? 'row-deleted' : undefined;
};
```

```html
<StyledDataTable :row-class="rowClass" ...>
    ...
</StyledDataTable>
```

**3. (옵션) 엑셀 스타일 셀 선택**
- 페이지에서 `useTableCellSelection` composable과 `.cell-select-host` 래퍼 div를 사용하면 셀 드래그 선택/복사가 추가됩니다.
- 이는 opt-in 기능이므로 필요한 페이지에서만 사용합니다.

#### 내부 구조 및 CSS 동작 원리

```
┌── <div class="kdb-it-table">          ← CSS 타겟팅 래퍼
│   └── <DataTable v-bind="$attrs">     ← PrimeVue DataTable
│       └── <table>
│           ├── <thead>
│           │   └── <tr>
│           │       └── <th class="p-datatable-header-cell">  ← CSS 직접 적용 대상
│           └── <tbody>
│               └── <tr>
│                   └── <td class="p-datatable-body-cell">
└──
```

#### ⚠️ PrimeVue 래퍼 컴포넌트 CSS 주의사항

PrimeVue 컴포넌트를 Vue 컴포넌트로 래핑할 때 반드시 알아야 할 제약입니다.

**1. `<style scoped>` + `:deep()`는 PrimeVue 내부 요소에 적용되지 않을 수 있음**

```html
<!-- ❌ 동작하지 않는 패턴 -->
<template>
    <DataTable v-bind="$attrs"> <!-- PrimeVue 컴포넌트가 루트 -->
        <slot />
    </DataTable>
</template>

<style scoped>
/* Vue가 data-v-xxxx를 DataTable 루트에 정상적으로 부여하지 못해 매칭 실패 */
:deep(.p-datatable-header-cell) { color: white; }
</style>
```

```html
<!-- ✅ 올바른 패턴: 래퍼 div + 비스코프 CSS + 고유 클래스 -->
<template>
    <div class="kdb-it-table">  <!-- 래퍼 div가 CSS 앵커 역할 -->
        <DataTable v-bind="$attrs">
            <slot />
        </DataTable>
    </div>
</template>

<style>  <!-- scoped 제거 -->
.kdb-it-table .p-datatable-header-cell { color: white; }
</style>
```

**2. PrimeVue `pt` (Pass Through)로 `<tr>`에 클래스를 주입해도 CSS `inherit`에 의존하면 안 됨**

```css
/* ❌ p-datatable-header-row 클래스가 <tr>에 존재하지 않을 수 있음 */
.kdb-it-table .p-datatable-header-row { background-color: blue; }
.kdb-it-table .p-datatable-header-cell { background: inherit; }

/* ✅ <th>에 직접 배경색 지정 — 확인된 CSS 클래스(p-datatable-header-cell)만 사용 */
.kdb-it-table .p-datatable-header-cell { background-color: rgb(30 58 138) !important; }
```

**3. 반드시 렌더링된 HTML에서 확인된 CSS 클래스만 타겟팅할 것**

| 요소 | 확인된 CSS 클래스 | 사용 가능 |
|------|-------------------|-----------|
| `<th>` | `p-datatable-header-cell` | ✅ |
| `<td>` | `p-datatable-body-cell` | ✅ |
| `<tr>` (헤더) | (클래스 없음, `pt`로만 부여) | ❌ CSS 직접 타겟팅 불가 |

#### 기존 페이지 마이그레이션 시 체크리스트

- [ ] `import StyledDataTable from '~/components/common/StyledDataTable.vue'` 추가
- [ ] `<DataTable>` → `<StyledDataTable>` 태그 변경
- [ ] 중복 속성 제거: `showGridlines`, `resizableColumns`, `tableStyle`, `:pt` (헤더 관련)
- [ ] `class="text-sm"` 등 테이블 자체 스타일 클래스 제거 (StyledDataTable이 관리)
- [ ] `</DataTable>` → `</StyledDataTable>` 닫는 태그 변경
- [ ] 브라우저에서 파란 헤더 + gridlines 표시 확인

### 4.10 테스트 작성 원칙

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

### 4.11 타입 충돌 주의사항
동일한 도메인에서 용도가 다른 두 User 타입이 존재합니다. 혼용하지 않습니다.

```ts
// types/auth.ts - 인증용 (로그인 세션)
type User = { eno: string; empNm: string; athIds: string[]; bbrC: string; temC: string; }

// composables/useOrganization.ts - 조직도용 (사용자 검색)
type OrgUser = { eno: string; usrNm: string; bbrNm: string; /* ... */ }

// composables/useEmployeeSearch.ts - 직원 검색용 (AutoComplete)
type UserSuggestion = { eno: string; usrNm: string; bbrNm: string; bbrC: string; /* ... */ }
```

자격등급(역할) 상수는 `types/auth.ts`의 `ROLE` 객체를 사용합니다:
```ts
import { ROLE } from '~/types/auth';
// ROLE.USER = 'ITPZZ001', ROLE.DEPT_MANAGER = 'ITPZZ002', ROLE.ADMIN = 'ITPAD001'
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

## 6. PrimeVue 참조
- 공식 문서: https://primevue.org
- LLM 최적화 문서 (컴포넌트 전체 API): https://primevue.org/llms
- MCP 서버: https://primevue.org/mcp
- Pass Through API: https://primevue.org/passthrough
