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
================================================================================
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false });
</script>

<template>
    <DataTable v-bind="$attrs" showGridlines resizableColumns columnResizeMode="fit"
        tableStyle="min-width: 50rem" :pt="{
            headerRow: { class: 'bg-blue-900 text-white dark:bg-blue-950' },
            bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' },
        }">
        <slot />
    </DataTable>
</template>

<style scoped>
/* 헤더 셀: headerRow(tr)의 bg-blue-900을 상속, 텍스트 가운데 정렬 */
:deep(.p-datatable-header-cell) {
    text-align: center;
    background: inherit !important;
    color: white !important;
    border-color: rgba(255, 255, 255, 0.2);
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
}

:deep(.p-datatable-column-header-content) {
    justify-content: center;
}

/* 셀 내부 input이 컬럼 너비에 맞게 축소되도록 처리 */
:deep(.p-datatable-body-cell) {
    overflow: hidden;
}

:deep(.p-datatable-body-cell .p-inputnumber),
:deep(.p-datatable-body-cell .p-inputnumber input) {
    width: 100%;
    min-width: 0;
}
</style>
