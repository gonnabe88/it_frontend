# StyledDataTable 사용 가이드

> `it_frontend/CLAUDE.md`에서 분리된 컴포넌트 사용 자료입니다.
> 모든 DataTable은 `StyledDataTable` 공통 컴포넌트를 사용하여 **파란 헤더(blue-900), gridlines, resizable 컬럼** 스타일을 통일합니다.

## 1. 사용법

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

## 2. 자동 적용 속성 (수동 지정 불필요)

| 속성 | 값 | 설명 |
|------|----|------|
| `showGridlines` | `true` | 셀 경계선 표시 |
| `resizableColumns` | `true` | 컬럼 크기 조절 가능 |
| `columnResizeMode` | `"fit"` | 리사이즈 시 전체 너비 유지 |
| `tableStyle` | `min-width: 50rem` | 최소 테이블 너비 |
| 헤더 배경색 | `blue-900` | CSS로 자동 적용 |
| 행 hover | `bg-zinc-50` | `pt.bodyRow`로 자동 적용 |

## 3. 공통 표준 기능 (자동 적용)

### 3.1 화면 채움 레이아웃 + 하단 Paginator 고정

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

### 3.2 삭제 표시 행 (row-deleted) 규약

- `row-class` 함수가 `'row-deleted'`를 반환하는 행에 회색 배경 + 취소선 + pointer-events 차단이 자동 적용됩니다.
- 첫 번째 셀(선택 체크박스)과 마지막 셀(삭제/복구 버튼)은 조작 가능 상태로 유지됩니다.
- `input`/`AutoComplete`/`Select` 내부 텍스트까지 취소선이 적용됩니다.

```ts
const rowClass = (data: RowType): string | undefined => {
    return data._status === 'deleted' ? 'row-deleted' : undefined;
};
```

```html
<StyledDataTable :row-class="rowClass" ...>
    ...
</StyledDataTable>
```

### 3.3 (옵션) 엑셀 스타일 셀 선택

- 페이지에서 `useTableCellSelection` composable과 `.cell-select-host` 래퍼 div를 사용하면 셀 드래그 선택/복사가 추가됩니다.
- opt-in 기능이므로 필요한 페이지에서만 사용합니다.

## 4. 내부 구조

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

## 5. PrimeVue 래퍼 컴포넌트 CSS 주의사항

PrimeVue 컴포넌트를 Vue 컴포넌트로 래핑할 때 반드시 알아야 할 제약입니다.

### 5.1 `<style scoped>` + `:deep()`는 PrimeVue 내부 요소에 적용되지 않을 수 있음

```html
<!-- 동작하지 않는 패턴 -->
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
<!-- 올바른 패턴: 래퍼 div + 비스코프 CSS + 고유 클래스 -->
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

### 5.2 PrimeVue `pt`(Pass Through)로 `<tr>`에 클래스 주입 시 `inherit` 의존 금지

```css
/* 위험: p-datatable-header-row 클래스가 <tr>에 존재하지 않을 수 있음 */
.kdb-it-table .p-datatable-header-row { background-color: blue; }
.kdb-it-table .p-datatable-header-cell { background: inherit; }

/* 안전: <th>에 직접 배경색 지정, 확인된 CSS 클래스만 사용 */
.kdb-it-table .p-datatable-header-cell { background-color: rgb(30 58 138) !important; }
```

### 5.3 렌더링된 HTML에서 확인된 CSS 클래스만 타겟팅

| 요소 | 확인된 CSS 클래스 | 사용 가능 |
|------|-------------------|-----------|
| `<th>` | `p-datatable-header-cell` | ✅ |
| `<td>` | `p-datatable-body-cell` | ✅ |
| `<tr>` (헤더) | (클래스 없음, `pt`로만 부여) | ❌ CSS 직접 타겟팅 불가 |

## 6. 기존 페이지 마이그레이션 체크리스트

- [ ] `import StyledDataTable from '~/components/common/StyledDataTable.vue'` 추가
- [ ] `<DataTable>` → `<StyledDataTable>` 태그 변경
- [ ] 중복 속성 제거: `showGridlines`, `resizableColumns`, `tableStyle`, `:pt` (헤더 관련)
- [ ] `class="text-sm"` 등 테이블 자체 스타일 클래스 제거 (StyledDataTable이 관리)
- [ ] `</DataTable>` → `</StyledDataTable>` 닫는 태그 변경
- [ ] 브라우저에서 파란 헤더 + gridlines 표시 확인
