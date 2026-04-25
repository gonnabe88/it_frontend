<!--
================================================================================
[components/common/StyledDataTable.vue] 공통 스타일 DataTable 래퍼 컴포넌트
================================================================================
프로젝트 전체에서 일관된 DataTable 스타일(파란 헤더, gridlines, 중앙정렬)을
적용하는 래퍼 컴포넌트입니다.

[사용법]
  <StyledDataTable :value="rows">
    <Column header="이름">...</Column>
    <Column header="금액">...</Column>
  </StyledDataTable>

[특징]
  - :value, paginator, dataKey 등 DataTable의 모든 속성은 그대로 전달됩니다.
  - showGridlines, resizableColumns, pt(헤더 스타일)은 고정 적용됩니다.

[공통 기능 표준 — 모든 StyledDataTable에 자동 적용]
  1) 화면 채움 레이아웃: scrollable + scroll-height="flex"와 함께 사용할 때
     남은 화면 영역을 자동으로 채우는 flex 체인이 적용됩니다.
     (부모 컨테이너는 flex-1 min-h-0 flex flex-col 체인을 유지해야 합니다)
  2) Paginator: 하단에 고정되며 좌/우/하단 보더는 제거하고 상단 보더만 남겨
     카드 테두리와 자연스럽게 이어지도록 합니다.
  3) 삭제 표시 행 규약: row-class 함수가 'row-deleted'를 반환하는 행은
     회색 배경 + 취소선 + 포인터 차단 스타일이 자동 적용됩니다.
     첫 번째 셀(선택 체크박스)과 마지막 셀(액션 버튼)은 조작 가능합니다.

     예시:
       const rowClass = (data) => data._status === 'deleted' ? 'row-deleted' : '';
       <StyledDataTable :row-class="rowClass" ...>

[CSS 방식]
  Vue <style scoped>의 :deep()은 data-v-xxxx 스코프 속성에 의존하는데,
  컴포넌트 루트가 PrimeVue 내부 요소로 구성될 때 매칭이 누락될 수 있습니다.
  래퍼 div에 고유 클래스(kdb-it-table)를 부여하고 비스코프 CSS로 타겟팅합니다.
================================================================================
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false });

// V1 페이지네이션 기본값 — 사용자가 명시적으로 전달하면 덮어씌워짐
const DEFAULT_PAGINATOR_TEMPLATE = 'CurrentPageReport PrevPageLink PageLinks NextPageLink';
const DEFAULT_PAGE_REPORT_TEMPLATE = '총 {totalRecords}건 중 {first}–{last} 표시';
</script>

<template>
    <!-- kdb-it-table: 비스코프 CSS 타겟팅 기준 래퍼 -->
    <div class="kdb-it-table">
        <!--
            paginator-template / current-page-report-template: V1 기본값 (먼저 선언)
            v-bind="$attrs": 사용처에서 동일 prop 전달 시 덮어씌워짐
            show-gridlines 등 마지막 선언: 항상 강제 적용
        -->
        <DataTable
            :paginator-template="DEFAULT_PAGINATOR_TEMPLATE"
            :current-page-report-template="DEFAULT_PAGE_REPORT_TEMPLATE"
            v-bind="$attrs"
            show-gridlines resizable-columns column-resize-mode="fit"
            table-style="min-width: 50rem" :pt="{
                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' },
            }">
            <slot />
            <!-- named slot 전달: #empty, #header, #footer 등 DataTable 슬롯을 그대로 통과 -->
            <template v-if="$slots.empty" #empty><slot name="empty" /></template>
            <template v-if="$slots.header" #header><slot name="header" /></template>
            <template v-if="$slots.footer" #footer><slot name="footer" /></template>
        </DataTable>
    </div>
</template>

<style>
/* 헤더 셀 배경·색: p-datatable-header-cell(th)에 직접 지정 */
.kdb-it-table .p-datatable-header-cell {
    text-align: center;
    background-color: rgb(30 58 138) !important; /* blue-900 */
    color: white !important;
    border-color: rgba(255, 255, 255, 0.2);
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
}

.kdb-it-table .p-datatable-column-header-content {
    justify-content: center;
}

/* 셀 내부 input이 컬럼 너비에 맞게 축소되도록 처리 */
.kdb-it-table .p-datatable-body-cell {
    overflow: hidden;
}

.kdb-it-table .p-datatable-body-cell .p-inputnumber,
.kdb-it-table .p-datatable-body-cell .p-inputnumber input {
    width: 100%;
    min-width: 0;
}

/* 빈 상태 메시지: 남은 공간을 채워 테이블 본문이 화면 끝까지 보이도록 처리 */
.kdb-it-table .p-datatable-empty-message td {
    height: 50vh;
    vertical-align: middle;
    text-align: center;
}

/* ============================================================================
   [공통 표준] 화면 채움 레이아웃
   ----------------------------------------------------------------------------
   DataTable을 scrollable + scroll-height="flex"로 사용하고 부모가
   (flex-1 min-h-0 flex flex-col) 체인을 제공하면, 테이블이 남은 영역을 채우고
   본문만 스크롤되며 paginator는 하단에 고정됩니다.
   ============================================================================ */
.kdb-it-table {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.kdb-it-table .p-datatable {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.kdb-it-table .p-datatable-table-container {
    flex: 1 1 auto;
    min-height: 0;
}

/* Paginator: 하단 고정 + 좌/우/하단 보더 제거 (상단 보더만 유지) */
.kdb-it-table .p-datatable-paginator-bottom,
.kdb-it-table .p-paginator-bottom {
    flex-shrink: 0;
    margin-top: auto;
    border-left: 0 !important;
    border-right: 0 !important;
    border-bottom: 0 !important;
}

/* ============================================================================
   [공통 표준] 삭제 표시 행(row-deleted)
   ----------------------------------------------------------------------------
   row-class 함수가 'row-deleted'를 반환하는 행에 자동 적용되는 스타일입니다.
   - 회색 배경 + 취소선 + opacity + pointer-events 차단
   - 첫 번째 셀(선택 체크박스)과 마지막 셀(삭제/복구 버튼)은 조작 가능 유지
   - input/AutoComplete/Select 내부 텍스트는 상속되지 않으므로 개별 타겟팅
   ============================================================================ */
.kdb-it-table .p-datatable-tbody>tr.row-deleted {
    background-color: rgb(244 244 245) !important; /* zinc-100 */
}

.kdb-it-table .p-datatable-tbody>tr.row-deleted>td {
    color: rgb(161 161 170) !important; /* zinc-400 */
    text-decoration: line-through;
    pointer-events: none;
    opacity: 0.6;
}

.kdb-it-table .p-datatable-tbody>tr.row-deleted>td input,
.kdb-it-table .p-datatable-tbody>tr.row-deleted>td textarea,
.kdb-it-table .p-datatable-tbody>tr.row-deleted>td .p-inputtext,
.kdb-it-table .p-datatable-tbody>tr.row-deleted>td .p-select-label,
.kdb-it-table .p-datatable-tbody>tr.row-deleted>td .p-autocomplete-input,
.kdb-it-table .p-datatable-tbody>tr.row-deleted>td .inline-edit-cell>span {
    text-decoration: line-through !important;
    color: rgb(161 161 170) !important;
}

.kdb-it-table .p-datatable-tbody>tr.row-deleted>td:first-child,
.kdb-it-table .p-datatable-tbody>tr.row-deleted>td:last-child {
    pointer-events: auto;
    opacity: 1;
    text-decoration: none;
    color: inherit !important;
}

/* 다크 모드 */
.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted {
    background-color: rgb(39 39 42) !important; /* zinc-800 */
}

.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted>td,
.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted>td input,
.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted>td .p-inputtext,
.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted>td .p-select-label,
.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted>td .p-autocomplete-input,
.dark .kdb-it-table .p-datatable-tbody>tr.row-deleted>td .inline-edit-cell>span {
    color: rgb(113 113 122) !important; /* zinc-500 */
}
</style>
