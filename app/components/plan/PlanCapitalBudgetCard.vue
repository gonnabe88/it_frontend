<!--
================================================================================
[components/plan/PlanCapitalBudgetCard.vue] 자본예산 카드
================================================================================
/info/plan/form 미리보기 영역의 '자본예산' 카드.

PUL_DTT 코드(신규/계속)별로 정보화사업을 그룹핑하여 assetBg 합계와
주요 내역(assetBg 내림차순 Top 2 사업명, 3개 이상 시 ' 등' 접미어)을 표시.

[Design Ref: §2.1 — Option C Pragmatic, 컴포넌트 내부 computed로 그룹핑]
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue'
import { formatBudget } from '~/utils/common'
import { useCodeOptions } from '~/composables/useCodeOptions'
import type { SummaryItem } from '~/types/budget-work'
import type { PlanProjectItem } from '~/composables/usePlan'

const props = defineProps<{
    /** 편성 결과 자본예산 항목 (form.vue useBudgetAllocationSummary 공유) */
    capitalSummaryItems: SummaryItem[]
    /** 정보화사업 스냅샷 목록 */
    prjSnapshots: PlanProjectItem[]
    /** 금액 단위 ('원' | '천원' | '백만원') */
    unit: string
}>()

// Plan SC: FR-02 PUL_DTT 코드명 조회 (신규/계속)
const { getCodeName } = useCodeOptions('PUL_DTT')

/** budget summary 자본예산 총 편성금액 (편성률 반영) */
const totalCapDupAmount = computed(() =>
    props.capitalSummaryItems.reduce((s, item) => s + item.dupAmount, 0)
)

/**
 * PUL_DTT 기준 그룹핑 + Top 2 주요 내역 + 편성예산(dupAmount 비례 배분)
 * dupAmount는 budget summary 자본예산 합계를 assetBg 비율로 배분
 */
const capitalGroups = computed(() => {
    const validItems = props.prjSnapshots.filter(p => p.pulDtt)
    const grouped = new Map<string, PlanProjectItem[]>()
    for (const item of validItems) {
        const key = item.pulDtt!
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(item)
    }
    const totalAssetBg = validItems.reduce((s, p) => s + p.assetBg, 0)
    return [...grouped.entries()].map(([pulDtt, items]) => {
        const sorted = [...items].sort((a, b) => b.assetBg - a.assetBg)
        const top2 = sorted.slice(0, 2).map(i => i.prjNm)
        const mainContent = top2.join(', ') + (sorted.length > 2 ? ' 등' : '')
        const groupAssetBg = items.reduce((s, i) => s + i.assetBg, 0)
        // assetBg 비율로 총 dupAmount 배분 (편성률 반영 금액)
        const dupAmount = totalAssetBg > 0
            ? Math.round(groupAssetBg / totalAssetBg * totalCapDupAmount.value)
            : 0
        return { pulDtt, groupName: getCodeName(pulDtt), count: items.length, mainContent, dupAmount }
    })
})

/** 합계: budget summary 자본예산 총 편성금액 */
const grandTotal = computed(() => totalCapDupAmount.value)

const hasData = computed(() => capitalGroups.value.length > 0)
</script>

<template>
    <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">자본예산</h2>

        <!-- 빈 상태 -->
        <div v-if="!hasData" class="text-center text-zinc-400 dark:text-zinc-500 py-4 text-sm">
            자본예산 데이터가 없습니다.
        </div>

        <!-- 자본예산 테이블 -->
        <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse">
                <colgroup>
                    <col style="width: 12%">
                    <col style="width: 8%">
                    <col style="width: 60%">
                    <col style="width: 20%">
                </colgroup>
                <thead>
                    <tr>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            구분
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            건수
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            주요 내역
                        </th>
                        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900"
                            style="border-color: rgba(255,255,255,0.2)">
                            편성예산 ({{ unit }})
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="group in capitalGroups"
                        :key="group.pulDtt"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-200">
                            {{ group.groupName }}
                        </td>
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ group.count }}
                        </td>
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-800 dark:text-zinc-200">
                            {{ group.mainContent }}
                        </td>
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ formatBudget(group.dupAmount, unit) }}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="font-semibold bg-blue-50 dark:bg-blue-950/30">
                        <td colspan="3"
                            class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-200">
                            합계
                        </td>
                        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {{ formatBudget(grandTotal, unit) }}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</template>
