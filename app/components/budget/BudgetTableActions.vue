<!--
================================================================================
[components/budget/BudgetTableActions.vue] 예산 테이블 액션 버튼 컴포넌트
================================================================================
예산 DataTable 툴바에 공통으로 표시되는 엑셀·PDF·조회 버튼 3종입니다.

[사용처]
  - pages/budget/list.vue    (전체 탭)
  - pages/budget/approval.vue

[Props]
  - reportLoading : PDF 보고서 생성 중 로딩 상태
  - hasFilters    : 조회 필터 적용 여부 (조회 버튼 뱃지 표시)

[Emits]
  - excel  : 엑셀 다운로드 버튼 클릭
  - pdf    : PDF 보고서 버튼 클릭
  - filter : 조회(상세 필터) 버튼 클릭
================================================================================
-->
<script setup lang="ts">
defineProps<{
  /** PDF 보고서 생성 중 로딩 상태 */
  reportLoading?: boolean;
  /** 조회 필터 적용 여부 (버튼 뱃지 표시) */
  hasFilters?: boolean;
}>();

defineEmits<{
  /** 엑셀 다운로드 */
  excel: [];
  /** PDF 보고서 다운로드 */
  pdf: [];
  /** 상세 조회 Drawer 열기 */
  filter: [];
}>();
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- 상세 조회 (필터 Drawer 열기) -->
    <Button
label="조회" icon="pi pi-search" severity="secondary" outlined :badge="hasFilters ? '●' : undefined"
      :badge-severity="hasFilters ? 'danger' : undefined" class="shrink-0" @click="$emit('filter')" />
    <!-- 엑셀 다운로드 -->
    <Button
icon="pi pi-file-excel" severity="success" outlined title="엑셀 다운로드" class="shrink-0"
      @click="$emit('excel')" />
    <!-- PDF 보고서 다운로드 -->
    <Button
icon="pi pi-file-pdf" severity="danger" outlined title="보고서 다운로드" class="shrink-0" :loading="reportLoading"
      @click="$emit('pdf')" />
  </div>
</template>
