<!--
비목별 편성 결과 테이블입니다.
전년/당해 요청금액과 편성금액 증감율을 계층형 행으로 표시합니다.
-->
<script setup lang="ts">
import StyledDataTable from '~/components/common/StyledDataTable.vue'
import BudgetTableActions from '~/components/budget/BudgetTableActions.vue'
import type { SummaryResponse } from '~/types/budget-work'

type SummaryRowType = 'data' | 'subtotal' | 'total'

interface SummaryDisplayRow {
    id: string
    ioeCategory: string
    rowType: SummaryRowType
    indent: number
    bigNm: string
    bigNmRowspan: number
    midNm: string
    midNmRowspan: number
    capItem: boolean
    dtlNm: string
    requestAmount: number
    dupAmount: number
    prevRequestAmount: number
    prevDupAmount: number
    dupRt: number | null
}

defineProps<{
    rows: SummaryDisplayRow[]
    summary: SummaryResponse
    prevSummary?: SummaryResponse | null
    prevYear: number
    selectedYear: number
    unit: string
    rowClass: (data: SummaryDisplayRow) => string
    fmt: (amount: number | null | undefined) => string
    calcChangeRate: (current: number, prev: number) => string
}>()

defineEmits<{
    export: []
}>()
</script>

<template>
    <TableCard icon="pi-calculator" title="비목별 편성 결과">
        <template #actions>
            <BudgetTableActions :unit="unit" @export="$emit('export')" />
        </template>

        <StyledDataTable :value="rows" data-key="id" :row-class="rowClass">
            <ColumnGroup type="header">
                <Row>
                    <Column header="비목" :colspan="3" :rowspan="2" />
                    <Column header="요청금액" :colspan="3" />
                    <Column header="편성금액" :colspan="3" />
                </Row>
                <Row>
                    <Column :header="`${prevYear}`" style="min-width: 8rem" />
                    <Column :header="`${selectedYear}`" style="min-width: 8rem" />
                    <Column header="증감율" style="width: 6rem" />
                    <Column :header="`${prevYear}`" style="min-width: 8rem" />
                    <Column :header="`${selectedYear}`" style="min-width: 8rem" />
                    <Column header="증감율" style="width: 6rem" />
                </Row>
            </ColumnGroup>

            <Column field="bigNm">
                <template #body="{ data }">
                    <span v-if="data.bigNm" class="font-bold text-blue-900 dark:text-blue-300">{{ data.bigNm }}</span>
                </template>
                <template #footer />
            </Column>

            <Column field="midNm">
                <template #body="{ data }">
                    <span
                        v-if="data.midNm"
                        :class="{
                            'font-semibold': data.rowType === 'data' && data.dtlNm,
                            'font-bold': data.rowType === 'total',
                        }"
                    >
                        {{ data.midNm }}
                    </span>
                </template>
                <template #footer>
                    <span class="font-bold">합계</span>
                </template>
            </Column>

            <Column field="dtlNm">
                <template #body="{ data }">
                    <span v-if="data.dtlNm" :class="{ 'font-bold': data.rowType === 'subtotal' }">{{ data.dtlNm }}</span>
                </template>
                <template #footer />
            </Column>

            <Column>
                <template #body="{ data }">
                    <span
                        v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                        class="text-right block text-zinc-500"
                    >
                        {{ fmt(data.prevRequestAmount) }}
                    </span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold text-zinc-500">{{ fmt(prevSummary?.totals.requestAmount) }}</span>
                </template>
            </Column>

            <Column>
                <template #body="{ data }">
                    <span
                        v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                        class="text-right block"
                    >
                        {{ fmt(data.requestAmount) }}
                    </span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(summary.totals.requestAmount) }}</span>
                </template>
            </Column>

            <Column>
                <template #body="{ data }">
                    <span
                        v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                        class="text-right block"
                        :class="{
                            'text-red-600': data.requestAmount - data.prevRequestAmount > 0,
                            'text-blue-600': data.requestAmount - data.prevRequestAmount < 0
                        }"
                    >
                        {{ calcChangeRate(data.requestAmount, data.prevRequestAmount) }}
                    </span>
                </template>
                <template #footer>
                    <span
                        class="text-right block font-bold"
                        :class="{
                            'text-red-600': (summary.totals.requestAmount - (prevSummary?.totals.requestAmount || 0)) > 0,
                            'text-blue-600': (summary.totals.requestAmount - (prevSummary?.totals.requestAmount || 0)) < 0
                        }"
                    >
                        {{ calcChangeRate(summary.totals.requestAmount, prevSummary?.totals.requestAmount || 0) }}
                    </span>
                </template>
            </Column>

            <Column>
                <template #body="{ data }">
                    <span
                        v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                        class="text-right block text-zinc-500"
                    >
                        {{ fmt(data.prevDupAmount) }}
                    </span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold text-zinc-500">{{ fmt(prevSummary?.totals.dupAmount) }}</span>
                </template>
            </Column>

            <Column>
                <template #body="{ data }">
                    <span
                        v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                        class="text-right block"
                    >
                        {{ fmt(data.dupAmount) }}
                    </span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(summary.totals.dupAmount) }}</span>
                </template>
            </Column>

            <Column>
                <template #body="{ data }">
                    <span
                        v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                        class="text-right block"
                        :class="{
                            'text-red-600': data.dupAmount - data.prevDupAmount > 0,
                            'text-blue-600': data.dupAmount - data.prevDupAmount < 0
                        }"
                    >
                        {{ calcChangeRate(data.dupAmount, data.prevDupAmount) }}
                    </span>
                </template>
                <template #footer>
                    <span
                        class="text-right block font-bold"
                        :class="{
                            'text-red-600': (summary.totals.dupAmount - (prevSummary?.totals.dupAmount || 0)) > 0,
                            'text-blue-600': (summary.totals.dupAmount - (prevSummary?.totals.dupAmount || 0)) < 0
                        }"
                    >
                        {{ calcChangeRate(summary.totals.dupAmount, prevSummary?.totals.dupAmount || 0) }}
                    </span>
                </template>
            </Column>
        </StyledDataTable>
    </TableCard>
</template>
