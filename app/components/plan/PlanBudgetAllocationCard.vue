<!--
================================================================================
[components/plan/PlanBudgetAllocationCard.vue] 전산예산 편성 결과 카드
================================================================================
/info/plan/form 미리보기 영역의 '전산예산' 카드.

[비목 컬럼] 원본 BudgetSummaryResultTable과 동일 rowspan/colspan 구조:
  - 대분류(bigNm): rowspan으로 그룹 병합
  - 중분류(midNm): rowspan으로 중분류 병합, 자본예산 개별 비목은 colspan=2
  - 세부비목(dtlNm): 자본예산 개별 비목 행에서는 렌더링 안 함

[데이터 컬럼] cell 병합 없는 5컬럼:
  편성요청 | 편성조정 | 조정율 | {year}년 편성액(본건) | {prevYear}년 편성액(전년도)
================================================================================
-->
<script setup lang="ts">
import { toRef } from 'vue'
import { formatBudget } from '~/utils/common'
import { useBudgetAllocationSummary } from '~/composables/useBudgetAllocationSummary'

const props = defineProps<{
    /** 계획 대상년도 (YYYY) */
    plnYy: string
    /** 금액 단위 ('원' | '천원' | '백만원') */
    unit: string
}>()

const plnYyRef = toRef(props, 'plnYy')
const { rows, pending, hasData, yearLabel, prevYearLabel } = useBudgetAllocationSummary(plnYyRef)

/** 행 유형별 행 클래스 */
function rowClass(rowType: 'data' | 'subtotal' | 'total'): string {
    if (rowType === 'total') return 'font-semibold bg-blue-50 dark:bg-blue-950/30'
    if (rowType === 'subtotal') return 'font-medium bg-zinc-50 dark:bg-zinc-800/50'
    return ''
}
</script>

<template>
    <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <!-- 카드 헤더 -->
        <div class="flex items-center justify-between border-b pb-2">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">전산예산</h2>
            <span v-if="yearLabel" class="text-sm text-zinc-500 dark:text-zinc-400">
                {{ yearLabel }} 비목별 편성 현황
            </span>
        </div>

        <!-- 로딩 -->
        <div v-if="pending" class="flex justify-center py-6">
            <i class="pi pi-spin pi-spinner text-2xl text-zinc-400" />
        </div>

        <!-- 데이터 없음 -->
        <div v-else-if="!hasData" class="text-center text-zinc-400 dark:text-zinc-500 py-4 text-sm">
            편성 결과 데이터가 없습니다.
        </div>

        <!-- 편성 결과 테이블 -->
        <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse">
                <colgroup>
                    <col style="width: 8%">
                    <col style="width: 9%">
                    <col style="width: 13%">
                    <col style="width: 14%">
                    <col style="width: 14%">
                    <col style="width: 7%">
                    <col style="width: 17%">
                    <col style="width: 18%">
                </colgroup>
                <!-- 헤더: 비목 3컬럼 + 데이터 5컬럼 -->
                <thead>
                    <tr>
                        <th colspan="3"
                            class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            비목
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            편성요청
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            편성조정
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            조정율
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            {{ yearLabel }} 편성액(본건)
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            {{ prevYearLabel }} 편성액(전년도)
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in rows"
                        :key="row.id"
                        :class="[rowClass(row.rowType), 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors']"
                    >
                        <!-- 대분류(bigNm): rowspan > 0인 행에서만 렌더링 -->
                        <td
                            v-if="row.bigNmRowspan > 0"
                            :rowspan="row.bigNmRowspan"
                            class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center align-middle font-bold text-blue-900 dark:text-blue-300"
                        >
                            {{ row.bigNm }}
                        </td>

                        <!-- 중분류(midNm): rowspan > 0인 행에서만 렌더링
                             자본예산 개별 비목(capItem) 또는 자본예산 합계(midNmColspan2)는
                             colspan=2로 세부비목 컬럼까지 점유 -->
                        <td
                            v-if="row.midNmRowspan > 0"
                            :rowspan="row.midNmRowspan"
                            :colspan="row.capItem || row.midNmColspan2 ? 2 : 1"
                            class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 align-middle text-zinc-800 dark:text-zinc-200"
                            :class="{
                                'font-semibold': row.rowType === 'data',
                                'font-bold': row.rowType === 'total',
                            }"
                        >
                            {{ row.midNm }}
                        </td>

                        <!-- 세부비목(dtlNm): capItem 또는 midNmColspan2 행은 렌더링 안 함
                             일반관리비 합계(exp-total) 행은 midNm 셀이 없으므로 colspan=2로 점유 -->
                        <td
                            v-if="!row.capItem && !row.midNmColspan2"
                            :colspan="row.dtlNmColspan2 ? 2 : 1"
                            class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-800 dark:text-zinc-200"
                            :class="{ 'font-bold': row.rowType === 'subtotal' || row.rowType === 'total' }"
                        >
                            {{ row.dtlNm }}
                        </td>

                        <!-- 편성요청 -->
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ formatBudget(row.requestAmount, props.unit) }}
                        </td>
                        <!-- 편성조정 -->
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ formatBudget(row.dupAmount, props.unit) }}
                        </td>
                        <!-- 조정율 -->
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ row.adjustRate }}
                        </td>
                        <!-- {year}년 편성액(본건) — 편성조정과 동일 소스 -->
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ formatBudget(row.dupAmount, props.unit) }}
                        </td>
                        <!-- {prevYear}년 편성액(전년도) -->
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ formatBudget(row.prevDupAmount, props.unit) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
