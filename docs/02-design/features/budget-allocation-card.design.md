# 전산예산 카드 Design Document

> **Plan**: `docs/01-plan/features/budget-allocation-card.plan.md`
> **Feature**: budget-allocation-card
> **Version**: 1.0.0
> **Date**: 2026-05-05
> **Status**: Draft
> **Architecture**: Option B — Clean Architecture

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 계획 등록 미리보기에서 비목별 전산예산 현황 부재 → 계획 수립 의사결정 지원 부족 |
| **WHO** | IT기획부 담당자 (정보기술부문 계획 등록자) |
| **RISK** | `/api/budget/work/summary` 해당 연도 데이터 없을 때 빈 카드 처리, 전년도 데이터 없을 때 `-` 처리 |
| **SUCCESS** | 미리보기([생성] 클릭 후) 영역에 '전산예산' 카드가 노출되고 5개 컬럼 데이터가 정확히 표시됨 |
| **SCOPE** | 신규 composable + 신규 컴포넌트 + `form.vue` 수정. API 신규 개발 없음 |

---

## 1. Overview

### 1.1 Selected Architecture: Option B — Clean Architecture

| 구분 | 내용 |
|------|------|
| **선택 이유** | 관심사 분리, form.vue 비대화 방지, 컴포넌트 재사용 가능성 |
| **신규 파일** | `app/composables/useBudgetAllocationSummary.ts` |
| | `app/components/plan/PlanBudgetAllocationCard.vue` |
| **수정 파일** | `app/pages/info/plan/form.vue` |

### 1.2 Data Flow

```
form.vue
  └── <PlanBudgetAllocationCard :plnYy="plnYy" :unit="selectedUnit" />
        └── useBudgetAllocationSummary(plnYy)
              ├── useApiFetch('/api/budget/work/summary', { query: { bgYy: plnYy } })
              ├── useApiFetch('/api/budget/work/summary', { query: { bgYy: plnYy - 1 } })
              └── computed: BudgetAllocationRow[]
```

---

## 2. Type Definitions

### 2.1 BudgetAllocationRow (신규, flat — rowspan 없음)

```typescript
// app/composables/useBudgetAllocationSummary.ts 내 정의
interface BudgetAllocationRow {
  id: string           // 고유 키 (렌더링 key prop용)
  bigNm: string        // 대분류명 (모든 행에 채움 — cell 병합 없으므로)
  label: string        // 세부 비목명 or '소계' or '합계'
  rowType: 'data' | 'subtotal' | 'total'
  requestAmount: number  // 편성요청 (dupAmount가 아닌 requestAmount)
  dupAmount: number      // 편성조정 = '26년 편성액(본건) (동일 값)
  adjustRate: string     // 조정율: dupAmount/requestAmount*100 소수점1자리+'%', 0이면 '-'
  prevDupAmount: number  // '25년 편성액(전년도)
}
```

### 2.2 재사용 타입 (기존 `app/types/budget-work.ts`)

```typescript
// import만 추가 — 수정 없음
import type { SummaryResponse, SummaryItem } from '~/types/budget-work'
```

---

## 3. Composable: useBudgetAllocationSummary

**파일**: `app/composables/useBudgetAllocationSummary.ts`

### 3.1 시그니처

```typescript
export function useBudgetAllocationSummary(plnYy: Ref<string>) {
  // 반환값
  return {
    rows: Readonly<Ref<BudgetAllocationRow[]>>,
    pending: Readonly<Ref<boolean>>,
    hasData: ComputedRef<boolean>,
    yearLabel: ComputedRef<string>,       // "'26년" 형식
    prevYearLabel: ComputedRef<string>,   // "'25년" 형식
  }
}
```

### 3.2 API 호출 전략

- `useApiFetch` 2회 — 당해/전년 병렬 자동 조회 (`watch: [plnYy]` 반응형)
- `plnYy`가 `''`(빈 문자열)이면 API 호출 skip (`immediate: false` + `watch`)

```typescript
// 당해 연도
const { data: currData, pending: currPending } = useApiFetch<SummaryResponse>(
  '/api/budget/work/summary',
  { query: computed(() => ({ bgYy: plnYy.value })),
    watch: [plnYy] }
)

// 전년도
const prevYy = computed(() => String(Number(plnYy.value) - 1))
const { data: prevData, pending: prevPending } = useApiFetch<SummaryResponse>(
  '/api/budget/work/summary',
  { query: computed(() => ({ bgYy: prevYy.value })),
    watch: [plnYy] }
)
```

### 3.3 행 생성 로직 (flat, cell 병합 없음)

`budget/work.vue`의 `summaryRows` 로직에서 rowspan 제거. 그룹 순서는 동일:

```
[자본예산 그룹]
  각 capital 비목 행 (rowType: 'data')
  자본예산 합계 행 (rowType: 'total')
[일반관리비 그룹]
  전산임차료 세부비목 (rowType: 'data')
  전산임차료 소계 (rowType: 'subtotal')
  전산여비 세부비목 (rowType: 'data')
  전산여비 소계 (rowType: 'subtotal')
  전산용역비 세부비목 (rowType: 'data')
  전산용역비 소계 (rowType: 'subtotal')
  전산제비 세부비목 (rowType: 'data')
  전산제비 소계 (rowType: 'subtotal')
  일반관리비 합계 (rowType: 'total')
```

### 3.4 조정율 계산 규칙

```typescript
function calcAdjustRate(requestAmount: number, dupAmount: number): string {
  if (requestAmount === 0) return '-'
  return (dupAmount / requestAmount * 100).toFixed(1) + '%'
}
```

---

## 4. Component: PlanBudgetAllocationCard

**파일**: `app/components/plan/PlanBudgetAllocationCard.vue`

### 4.1 Props

```typescript
interface Props {
  plnYy: string    // 계획 대상년도 (YYYY)
  unit: string     // 금액 단위 ('원' | '천원' | '백만원')
}
```

### 4.2 테이블 컬럼 구성 (6컬럼)

| # | 헤더 | 데이터 소스 | 정렬 | 비고 |
|---|------|-----------|------|------|
| 1 | 비목 | `row.bigNm + ' > ' + row.label` 또는 레이아웃 분리 | 좌 | rowType별 스타일 구분 |
| 2 | 편성요청 | `formatBudget(row.requestAmount, unit)` | 우 | |
| 3 | 편성조정 | `formatBudget(row.dupAmount, unit)` | 우 | |
| 4 | 조정율 | `row.adjustRate` | 우 | |
| 5 | `{year}년 편성액(본건) | `formatBudget(row.dupAmount, unit)` | 우 | col3과 동일 값, 헤더만 다름 |
| 6 | `{prevYear}년 편성액(전년도) | `formatBudget(row.prevDupAmount, unit)` | 우 | |

> 컬럼 3(편성조정)과 컬럼 5('26년 편성액(본건))는 동일한 `dupAmount` 값을 표시하되 헤더 레이블이 다릅니다. (사용자 확인 완료)

### 4.3 행 스타일링

```vue
<Row
  :class="{
    'font-semibold bg-blue-50': row.rowType === 'total',
    'font-medium bg-gray-50': row.rowType === 'subtotal',
  }"
/>
```

### 4.4 데이터 없음 처리

```vue
<template v-if="hasData">
  <StyledDataTable ... />
</template>
<template v-else-if="!pending">
  <p class="text-center text-gray-400 py-4">편성 결과 데이터가 없습니다.</p>
</template>
```

### 4.5 카드 헤더

```vue
<div class="flex items-center justify-between mb-2">
  <h3 class="text-base font-semibold">전산예산</h3>
  <span class="text-sm text-gray-500">{{ yearLabel }} 비목별 편성 현황</span>
</div>
```

---

## 5. form.vue 수정 내용

### 5.1 변경 위치

`app/pages/info/plan/form.vue` — `<template v-if="previewVisible">` 섹션 내
정보화사업 카드(`<!-- 정보화사업 카드 -->`) 바로 다음, 약 680라인 이후

### 5.2 추가 코드 (삽입)

```vue
<!-- 전산예산 카드 -->
<div class="card">
  <PlanBudgetAllocationCard :pln-yy="plnYy" :unit="selectedUnit" />
</div>
```

### 5.3 import 추가 불필요

Nuxt 자동 등록: `components/plan/PlanBudgetAllocationCard.vue` → `<PlanBudgetAllocationCard>` 자동 사용 가능

---

## 6. API Contract

| 항목 | 값 |
|------|-----|
| Endpoint | `GET /api/budget/work/summary` |
| Query param | `bgYy` (YYYY string) |
| Response type | `SummaryResponse` (기존 `types/budget-work.ts`) |
| Auth | httpOnly 쿠키 자동 전송 (`useApiFetch` 내장) |
| Error handling | 404/500 → `data.value` null → `hasData = false` → 안내 문구 |

---

## 7. Dependencies

| 의존성 | 출처 | 변경 여부 |
|--------|------|---------|
| `SummaryResponse`, `SummaryItem` | `types/budget-work.ts` | import만 추가 |
| `useApiFetch` | `composables/useApiFetch.ts` | 변경 없음 |
| `formatBudget` | `utils/common.ts` | 변경 없음 |
| `StyledDataTable` | `components/common/StyledDataTable.vue` | 변경 없음 |
| `/api/budget/work/summary` | 기존 백엔드 API | 변경 없음 |

---

## 8. Test Plan

| 시나리오 | 검증 포인트 |
|---------|-----------|
| [생성] 클릭 후 카드 표시 | `previewVisible=true` → 카드 렌더링 |
| 데이터 정상 응답 | 비목 행 표시, 합계/소계 행 굵게 표시 |
| 조정율 계산 | 편성요청 0 → `-`, 정상값 → `XX.X%` |
| 단위 변경 | `selectedUnit` 변경 시 금액 열 포맷 반영 |
| 데이터 없음 | API 빈 배열 반환 → 안내 문구 표시 |
| cell 병합 없음 | 모든 행의 `bigNm`이 독립 셀로 렌더링됨 |

---

## 9. Implementation Order (Session Guide)

| 순서 | 모듈 | 파일 | 예상 라인 |
|------|------|------|---------|
| 1 | module-1 | `app/composables/useBudgetAllocationSummary.ts` | ~80 |
| 2 | module-2 | `app/components/plan/PlanBudgetAllocationCard.vue` | ~120 |
| 3 | module-3 | `app/pages/info/plan/form.vue` (3줄 삽입) | +3 |

```
/pdca do budget-allocation-card --scope module-1  → composable 구현
/pdca do budget-allocation-card --scope module-2  → 컴포넌트 구현
/pdca do budget-allocation-card --scope module-3  → form.vue 통합
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-05-05 | Initial draft — Option B selected |
