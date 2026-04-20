# 공통 컴포넌트 (`components/common/`)

프로젝트 전체에서 재사용하는 공통 UI 컴포넌트입니다.

> **import 규칙**: Nuxt 자동 등록 시 `Common` 접두사가 붙으므로(`CommonStyledDataTable`),
> 기존 코드와의 일관성을 위해 **명시적 import**를 사용합니다.

---

## StyledDataTable.vue — 표준 테이블 래퍼

PrimeVue DataTable에 프로젝트 표준 디자인(파란 헤더, gridlines, 컬럼 리사이즈)을
일괄 적용하는 래퍼 컴포넌트입니다.

### 빠른 사용법

```vue
<script setup lang="ts">
import StyledDataTable from '~/components/common/StyledDataTable.vue';
</script>

<template>
    <StyledDataTable :value="rows" :loading="pending" stripedRows>
        <Column field="name" header="이름" />
        <Column field="amount" header="금액" />
    </StyledDataTable>
</template>
```

### 자동 적용되는 속성 (수동 지정 불필요)

| 속성 | 값 | 설명 |
|------|----|------|
| `showGridlines` | `true` | 셀 경계선 표시 |
| `resizableColumns` | `true` | 컬럼 크기 조절 |
| `columnResizeMode` | `"fit"` | 리사이즈 시 전체 너비 유지 |
| `tableStyle` | `min-width: 50rem` | 최소 테이블 너비 |
| 헤더 배경색 | `blue-900` (CSS) | 파란 헤더 |
| 행 hover | `bg-zinc-50` (pt) | 행 호버 강조 |

### 사용 중인 페이지

| 페이지 | 용도 |
|--------|------|
| `pages/budget/work.vue` | 대상 목록, 편성비목(자본/일반), 편성 결과 |
| `components/cost/CostFormTableSection.vue` | 전산업무비 신청 테이블 |
| `components/cost/TerminalTableSection.vue` | 금융정보단말기 테이블 |

> **참고**: `pages/info/cost/index.vue`는 인라인 편집·정렬·선택 등 고급 기능이 필요하여
> DataTable + 인라인 `pt` + 자체 scoped CSS를 직접 사용합니다.
> 신규 페이지는 특별한 사유가 없으면 `StyledDataTable`을 사용합니다.

---

### 내부 구조

```
<div class="kdb-it-table">              ← CSS 타겟팅 래퍼
    <DataTable v-bind="$attrs" ...>     ← PrimeVue DataTable (모든 props 전달)
        <slot />                        ← Column 등 자식 요소
    </DataTable>
</div>
```

### CSS 구현 방식 — 래퍼 div + 비스코프 CSS

PrimeVue 컴포넌트를 Vue 컴포넌트로 래핑할 때 **Vue의 `<style scoped>` + `:deep()`는
PrimeVue 내부 DOM 요소에 적용되지 않는 문제**가 있습니다.

이 문제가 발생하는 이유와 해결 방법을 아래에 정리합니다.

#### 문제: `<style scoped>` + `:deep()`이 동작하지 않는 이유

Vue의 `<style scoped>`는 `data-v-xxxx` 속성을 루트 요소에 추가하고,
`:deep(.selector)`는 `[data-v-xxxx] .selector` 형태로 컴파일됩니다.

```
컴파일 결과: [data-v-a1b2c3] .p-datatable-header-cell { ... }
```

그런데 `StyledDataTable`의 루트가 PrimeVue `<DataTable>` 컴포넌트일 때,
`data-v-xxxx` 속성이 PrimeVue의 내부 DOM 요소 조상에 정상적으로 부여되지 않아
CSS 셀렉터 매칭이 실패합니다.

```html
<!-- ❌ 이 패턴은 동작하지 않음 -->
<template>
    <DataTable v-bind="$attrs">    <!-- PrimeVue 컴포넌트가 루트 -->
        <slot />
    </DataTable>
</template>
<style scoped>
:deep(.p-datatable-header-cell) { color: white; }  /* 매칭 실패 */
</style>
```

#### 해결: 래퍼 `<div>` + 비스코프 `<style>` + 고유 클래스

래퍼 `<div>`에 고유 클래스(`kdb-it-table`)를 부여하고,
`<style>` (scoped 제거)에서 해당 클래스를 기준으로 CSS를 타겟팅합니다.

```html
<!-- ✅ 올바른 패턴 -->
<template>
    <div class="kdb-it-table">
        <DataTable v-bind="$attrs">
            <slot />
        </DataTable>
    </div>
</template>
<style>
.kdb-it-table .p-datatable-header-cell { color: white; }  /* 정상 동작 */
</style>
```

#### 주의: PrimeVue CSS 클래스 타겟팅 규칙

PrimeVue DataTable의 CSS 클래스는 **렌더링된 HTML에서 실제 확인된 것만** 사용합니다.

| 요소 | CSS 클래스 | 타겟팅 |
|------|-----------|--------|
| `<th>` (헤더 셀) | `p-datatable-header-cell` | ✅ **사용 가능** |
| `<td>` (본문 셀) | `p-datatable-body-cell` | ✅ 사용 가능 |
| `<tr>` (헤더 행) | _(기본 클래스 없음)_ | ❌ **CSS 직접 타겟팅 불가** |

> **`<tr>` 헤더 행에는 기본 CSS 클래스가 없습니다.**
> `pt.headerRow: { class: '...' }`로 클래스를 주입할 수는 있지만,
> 래퍼 컴포넌트에서 `pt`가 정상 전달되지 않을 수 있으므로 `<tr>` 의존은 피합니다.
>
> 따라서 배경색은 `<th>` (`p-datatable-header-cell`)에 **직접 지정**합니다.

```css
/* ❌ 동작하지 않음 — <tr>에 기본 클래스가 없음 */
.kdb-it-table .p-datatable-header-row {
    background-color: rgb(30 58 138);
}
.kdb-it-table .p-datatable-header-cell {
    background: inherit;   /* <tr>에 배경이 없으므로 inherit해도 흰색 */
    color: white;          /* 흰 배경 + 흰 글씨 = 헤더가 안 보임! */
}

/* ✅ 올바른 방법 — <th>에 직접 배경색 지정 */
.kdb-it-table .p-datatable-header-cell {
    background-color: rgb(30 58 138) !important;
    color: white !important;
}
```

---

### 트러블슈팅 이력

| 시도 | 결과 | 원인 |
|------|------|------|
| `<style scoped>` + `:deep()` | ❌ 스타일 미적용 | PrimeVue가 루트일 때 `data-v-xxxx` 매칭 실패 |
| 래퍼 div + `.p-datatable-header-row`에 배경색 | ❌ 헤더 안 보임 | `<tr>`에 해당 클래스 없음 → 배경 미적용, 흰 글씨만 적용 |
| 래퍼 div + `.p-datatable-header-cell`에 배경색 직접 지정 | ✅ 정상 동작 | `<th>`에 확인된 클래스로 직접 스타일 적용 |

---

## EmployeeSearchDialog.vue — 직원 검색 다이얼로그

직원 검색이 필요한 모든 폼에서 재사용하는 검색 다이얼로그 컴포넌트입니다.
`useEmployeeSearch.ts` composable과 함께 사용합니다.
