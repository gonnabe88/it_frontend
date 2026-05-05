<!--
예산 작업 대상 목록 테이블입니다.
결재완료 정보화사업/전산업무비와 사업별 편성률 입력 UI를 담당합니다.
-->
<script setup lang="ts">
import StyledDataTable from '~/components/common/StyledDataTable.vue'
import BudgetTableActions from '~/components/budget/BudgetTableActions.vue'

interface TargetItem {
    _id: string
    _type: string
    _link: string
    name: string
    totalBg: number
    assetBg: number
    costBg: number
    deptNm: string
    assetDupRt: number | null
    costDupRt: number
}

defineProps<{
    items: TargetItem[]
    loading: boolean
    totals: {
        totalBg: number
        assetBg: number
        costBg: number
    }
    unit: string
    saving: boolean
    fmt: (amount: number | null | undefined) => string
}>()

defineEmits<{
    export: []
    save: []
}>()
</script>

<template>
    <TableCard icon="pi-table" title="대상 목록" subtitle="결재완료된 정보화사업 · 전산업무비">
        <template #actions>
            <BudgetTableActions :unit="unit" @export="$emit('export')" />
        </template>

        <StyledDataTable :value="items" :loading="loading" striped-rows data-key="_id">
            <Column field="_type" header="구분" style="width: 5rem">
                <template #body="{ data }">
                    <Tag
                        :value="data._type"
                        :class="data._type === '사업'
                            ? 'kdb-tag-indigo'
                            : 'kdb-tag-emerald'"
                        class="border-0"
                        rounded
                    />
                </template>
            </Column>

            <Column field="name" header="사업명/계약명" style="min-width: 16rem">
                <template #body="{ data }">
                    <NuxtLink
                        :to="data._link"
                        class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100"
                    >
                        {{ data.name }}
                    </NuxtLink>
                </template>
            </Column>

            <Column field="totalBg" header="총예산" style="min-width: 8rem">
                <template #body="{ data }">
                    <span class="text-right block">{{ fmt(data.totalBg) }}</span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(totals.totalBg) }}</span>
                </template>
            </Column>

            <Column field="assetBg" header="자본예산" style="min-width: 8rem">
                <template #body="{ data }">
                    <span class="text-right block">{{ fmt(data.assetBg) }}</span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(totals.assetBg) }}</span>
                </template>
            </Column>

            <Column field="costBg" header="일반관리비" style="min-width: 8rem">
                <template #body="{ data }">
                    <span class="text-right block">{{ fmt(data.costBg) }}</span>
                </template>
                <template #footer>
                    <span class="text-right block font-bold">{{ fmt(totals.costBg) }}</span>
                </template>
            </Column>

            <Column header="자본예산 편성률(%)" style="width: 10rem">
                <template #body="{ data }">
                    <InputNumber
                        v-if="data.assetDupRt != null"
                        v-model="data.assetDupRt"
                        :min="0"
                        :max="100"
                        suffix=" %"
                        :show-buttons="true"
                        :step="5"
                        class="w-full"
                        input-class="text-right"
                    />
                    <span v-else class="text-right block text-zinc-400">-</span>
                </template>
            </Column>

            <Column header="일반관리비 편성률(%)" style="width: 10rem">
                <template #body="{ data }">
                    <InputNumber
                        v-model="data.costDupRt"
                        :min="0"
                        :max="100"
                        suffix=" %"
                        :show-buttons="true"
                        :step="5"
                        class="w-full"
                        input-class="text-right"
                    />
                </template>
            </Column>

            <Column field="deptNm" header="담당부서" style="min-width: 8rem" />

            <template #empty>
                <div class="text-center py-8 text-zinc-500">
                    결재완료된 항목이 없습니다.
                </div>
            </template>
        </StyledDataTable>

        <div class="flex justify-end px-6 py-4">
            <Button
                label="저장"
                severity="primary"
                icon="pi pi-save"
                :loading="saving"
                :disabled="items.length === 0"
                @click="$emit('save')"
            />
        </div>
    </TableCard>
</template>
