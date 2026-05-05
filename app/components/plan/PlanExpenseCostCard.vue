<!--
================================================================================
[components/plan/PlanExpenseCostCard.vue] 일반관리비 카드
================================================================================
/info/plan/form 미리보기 영역의 '일반관리비' 카드.

구분(전산임차료·전산여비·전산용역비·전산제비) → 세목(ioeC 코드명) 2단 rowspan 구조.
구분은 ioeC가 속한 코드 타입으로 결정 (IOE_LEAFE=전산임차료, IOE_XPN=전산여비,
IOE_SEVS=전산용역비, IOE_IDR=전산제비) — 전산예산 비목 구조와 동일.
- ioeC 기준 1행 (costBg or itMngcBg 합산), 예산 0원 제외
- 구분별 소계 행 + 전체 합계 행(tfoot)

[Design Ref: §5.3 — rowspan = subGroups.length + 1 (세목 행 + 소계 행)]
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue'
import { formatBudget } from '~/utils/common'
import { useCodeOptions } from '~/composables/useCodeOptions'
import type { SummaryItem } from '~/types/budget-work'
import type { ItCost } from '~/composables/useCost'

const props = defineProps<{
    /** 편성 결과 일반관리비 항목 (form.vue useBudgetAllocationSummary 공유) */
    expenseItems: SummaryItem[]
    /** 전산업무비 원본 목록 (주요 내역용) */
    costDetails: ItCost[]
    /** itMngcNo → 부모 사업명 맵 (form.vue에서 abusC 기준 조회) */
    costPrjNm: Record<string, string>
    /** 금액 단위 ('원' | '천원' | '백만원') */
    unit: string
}>()

// 4개 코드 타입 별도 로드 — 구분/세목 구조 구성 및 금액 0인 항목도 표시하기 위해 유지
const { options: ioeLeafeOpts } = useCodeOptions('IOE_LEAFE')
const { options: ioeXpnOpts }   = useCodeOptions('IOE_XPN')
const { options: ioeSevOpts }   = useCodeOptions('IOE_SEVS')
const { options: ioeIdrOpts }   = useCodeOptions('IOE_IDR')

/**
 * ioeC(CCODEM cdId) → dupAmount 인덱스
 * CCODEM.C_ID = SummaryItem.ioeC — 이름 매칭 불필요, 코드 직접 매칭
 */
const amtIndex = computed(() => {
    const idx = new Map<string, number>()
    for (const item of props.expenseItems) {
        idx.set(item.ioeC, (idx.get(item.ioeC) ?? 0) + item.dupAmount)
    }
    return idx
})

/** ItCost → ioeC(CCODEM) 별 주요 내역 인덱스 (부모 사업명 우선, 없으면 계약명) */
const contentIndex = computed(() => {
    const idx = new Map<string, { topCttNm: string; topAmt: number }>()
    for (const item of props.costDetails) {
        if (!idx.has(item.ioeC)) idx.set(item.ioeC, { topCttNm: '', topAmt: 0 })
        const entry = idx.get(item.ioeC)!
        const amt = item.costBg ?? item.itMngcBg ?? 0
        if (amt > entry.topAmt) {
            entry.topCttNm = props.costPrjNm[item.itMngcNo ?? ''] || item.cttNm
            entry.topAmt = amt
        }
    }
    return idx
})

/**
 * 구분(중분류) → 세목(cdNm) 2단 그룹핑
 * CCODEM 코드 기준으로 구성 — 편성금액 0인 세목도 전부 표시.
 * 편성예산: opt.cdId = SummaryItem.ioeC 직접 매칭
 */
const expenseGroups = computed(() => {
    const typeGroups = [
        { groupKey: '전산임차료', opts: ioeLeafeOpts.value },
        { groupKey: '전산여비',   opts: ioeXpnOpts.value },
        { groupKey: '전산용역비', opts: ioeSevOpts.value },
        { groupKey: '전산제비',   opts: ioeIdrOpts.value },
    ]

    return typeGroups
        .filter(g => g.opts.length > 0)
        .map(({ groupKey, opts }) => {
            const subGroups = opts.map(opt => ({
                ioeC: opt.cdId,
                subName: opt.cdDes ?? opt.cdNm,
                mainContent: contentIndex.value.get(opt.cdId)?.topCttNm ?? '',
                total: amtIndex.value.get(opt.cdId) ?? 0,
            }))
            const subtotal = subGroups.reduce((s, sg) => s + sg.total, 0)
            const rowspan = subGroups.length + 1
            return { groupKey, groupName: groupKey, rowspan, subGroups, subtotal }
        })
})

const grandTotal = computed(() =>
    expenseGroups.value.reduce((s, g) => s + g.subtotal, 0)
)

/** 코드 옵션이 하나라도 로드됐으면 테이블 표시 */
const hasData = computed(() => expenseGroups.value.length > 0)
</script>

<template>
    <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">일반관리비</h2>

        <!-- 빈 상태 -->
        <div v-if="!hasData" class="text-center text-zinc-400 dark:text-zinc-500 py-4 text-sm">
            일반관리비 데이터가 없습니다.
        </div>

        <!-- 일반관리비 테이블 -->
        <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse">
                <colgroup>
                    <col style="width: 15%">
                    <col style="width: 20%">
                    <col style="width: 45%">
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
                            세목
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
                    <template v-for="group in expenseGroups" :key="group.groupKey">
                        <!-- 세목 행들 -->
                        <template v-for="(sub, subIdx) in group.subGroups" :key="sub.ioeC">
                            <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <!-- 구분 셀: 첫 번째 세목 행에만 rowspan 렌더링 -->
                                <td
                                    v-if="subIdx === 0"
                                    :rowspan="group.rowspan"
                                    class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center align-middle text-zinc-800 dark:text-zinc-200"
                                >
                                    {{ group.groupName }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-800 dark:text-zinc-200">
                                    {{ sub.subName }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                                    {{ sub.mainContent }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                                    {{ formatBudget(sub.total, unit) }}
                                </td>
                            </tr>
                        </template>
                        <!-- 소계 행 -->
                        <tr class="bg-zinc-50 dark:bg-zinc-800/50 font-medium">
                            <td colspan="2"
                                class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-200">
                                소 계
                            </td>
                            <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                                {{ formatBudget(group.subtotal, unit) }}
                            </td>
                        </tr>
                    </template>
                </tbody>
                <tfoot>
                    <tr class="font-semibold bg-blue-50 dark:bg-blue-950/30">
                        <td colspan="3"
                            class="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-200">
                            합 계
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
