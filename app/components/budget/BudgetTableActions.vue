<!--
================================================================================
[components/budget/BudgetTableActions.vue] 예산 테이블 액션 버튼 컴포넌트
================================================================================
예산 DataTable 툴바에 공통으로 표시되는 조회·엑셀·PDF 버튼과,
예산 작업 화면의 기준 단위·Excel 내보내기 액션을 함께 제공합니다.

[사용처]
  - pages/budget/list.vue
  - pages/budget/approval.vue
  - pages/budget/work.vue

[모드]
  - unit 값 있음: 기준 단위 표시 + Excel 내보내기 버튼
  - unit 값 없음: 조회/Excel/PDF 버튼 그룹
================================================================================
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
    unit?: string
    reportLoading?: boolean
    hasFilters?: boolean
}>(), {
    unit: '',
    reportLoading: false,
    hasFilters: false
})

defineEmits<{
    export: []
    excel: []
    pdf: []
    filter: []
}>()
</script>

<template>
    <div v-if="props.unit" class="flex flex-col items-end gap-1">
        <span class="text-xs text-zinc-400 mb-3">(기준 : {{ unit }})</span>
        <button
            class="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            @click="$emit('export')"
        >
            <i class="pi pi-file-excel text-xs" style="color:#16a34a;" />
            Excel
        </button>
    </div>
    <div v-else class="flex items-center gap-2">
        <Button
            icon="pi pi-filter"
            label="필터"
            severity="secondary"
            outlined
            :badge="hasFilters ? '!' : undefined"
            badge-severity="danger"
            @click="$emit('filter')"
        />
        <button
            class="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            @click="$emit('excel')"
        >
            <i class="pi pi-file-excel text-xs" style="color:#16a34a;" />
            Excel
        </button>
        <button
            class="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="reportLoading"
            @click="$emit('pdf')"
        >
            <i v-if="reportLoading" class="pi pi-spin pi-spinner text-xs" style="color:#dc2626;" />
            <i v-else class="pi pi-file-pdf text-xs" style="color:#dc2626;" />
            PDF
        </button>
    </div>
</template>
