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

[CSS 방식]
  Vue <style scoped>의 :deep()은 data-v-xxxx 스코프 속성에 의존하는데,
  컴포넌트 루트가 PrimeVue 내부 요소로 구성될 때 매칭이 누락될 수 있습니다.
  래퍼 div에 고유 클래스(kdb-it-table)를 부여하고 비스코프 CSS로 타겟팅합니다.
================================================================================
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false });
</script>

<template>
    <!-- kdb-it-table: 비스코프 CSS 타겟팅 기준 래퍼 -->
    <div class="kdb-it-table">
        <DataTable v-bind="$attrs" showGridlines resizableColumns columnResizeMode="fit"
            tableStyle="min-width: 50rem" :pt="{
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
</style>
