<!--
사업별 편성 결과 테이블입니다.
백엔드가 내려주는 비목 카테고리를 동적 컬럼으로 렌더링합니다.
-->
<script setup lang="ts">
import StyledDataTable from '~/components/common/StyledDataTable.vue'
import BudgetTableActions from '~/components/budget/BudgetTableActions.vue'
import type { ProjectSummaryResponse } from '~/types/budget-work'

defineProps<{
    summary: ProjectSummaryResponse
    unit: string
    fmt: (amount: number | null | undefined) => string
}>()

defineEmits<{
    export: []
}>()
</script>

<template>
    <TableCard icon="pi-briefcase" title="사업별 편성 결과">
        <template #actions>
            <BudgetTableActions :unit="unit" @export="$emit('export')" />
        </template>

        <StyledDataTable :value="summary.data" striped-rows data-key="orcPkVl" scrollable scroll-height="flex">
            <ColumnGroup type="header">
                <Row>
                    <Column header="구분" :rowspan="2" style="width: 5rem" />
                    <Column header="사업명/계약명" :rowspan="2" style="min-width: 14rem" />
                    <Column
                        v-for="cat in summary.categories"
                        :key="cat.ioePrefix"
                        :header="cat.cdNm"
                        :colspan="2"
                    />
                    <Column header="합계" :colspan="2" />
                </Row>
                <Row>
                    <template v-for="cat in summary.categories" :key="'sub-' + cat.ioePrefix">
                        <Column header="요청" style="min-width: 7rem" />
                        <Column header="편성" style="min-width: 7rem" />
                    </template>
                    <Column header="요청" style="min-width: 8rem" />
                    <Column header="편성" style="min-width: 8rem" />
                </Row>
            </ColumnGroup>

            <Column>
                <template #body="{ data }">
                    <Tag
                        :value="data.orcTb === 'BPROJM' ? '사업' : '비용'"
                        :class="data.orcTb === 'BPROJM'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'"
                        class="border-0"
                        rounded
                    />
                </template>
            </Column>

            <Column field="name">
                <template #body="{ data }">
                    <span class="font-medium">{{ data.name }}</span>
                </template>
                <template #footer>
                    <span class="font-bold">합계</span>
                </template>
            </Column>

            <template v-for="cat in summary.categories" :key="'col-' + cat.ioePrefix">
                <Column>
                    <template #body="{ data }">
                        <span class="text-right block text-zinc-500">
                            {{ fmt(data.categoryAmounts[cat.ioePrefix]?.requestAmount) }}
                        </span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold text-zinc-500">
                            {{ fmt(summary.data.reduce((s, d) => s + (d.categoryAmounts[cat.ioePrefix]?.requestAmount || 0), 0)) }}
                        </span>
                    </template>
                </Column>
                <Column>
                    <template #body="{ data }">
                        <span class="text-right block">
                            {{ fmt(data.categoryAmounts[cat.ioePrefix]?.dupAmount) }}
                        </span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">
                            {{ fmt(summary.data.reduce((s, d) => s + (d.categoryAmounts[cat.ioePrefix]?.dupAmount || 0), 0)) }}
                        </span>
                    </template>
                </Column>
            </template>

            <Column>
                <template #body="{ data }">
                    <span class="text-right block font-semibold">{{ fmt(data.requestAmount) }}</span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(summary.totals.requestAmount) }}</span>
                </template>
            </Column>

            <Column>
                <template #body="{ data }">
                    <span class="text-right block font-semibold">{{ fmt(data.dupAmount) }}</span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(summary.totals.dupAmount) }}</span>
                </template>
            </Column>
        </StyledDataTable>
    </TableCard>
</template>
