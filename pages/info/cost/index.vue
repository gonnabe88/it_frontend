<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCost, type ItCost } from '~/composables/useCost';
import { useAuth } from '~/composables/useAuth';
import { useRouter } from 'vue-router';
import { formatBudget as formatBudgetUtil } from '~/utils/common';

const title = '전산업무비 목록';
definePageMeta({
    title
});

// 전산업무비 목록 가져오기
const { fetchCosts } = useCost();
const { user } = useAuth();
const router = useRouter();
const { data: costsData, error } = await fetchCosts();

// 목록 Computed property
const costs = computed(() => costsData.value || []);
const selectedCosts = ref<ItCost[]>([]);

// 화폐 단위
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원'); // 기본값
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);

// 일괄 수정
const handleBulkEdit = () => {
    if (!user.value || !user.value.eno) {
        alert('로그인 정보가 없습니다.');
        return;
    }

    const myCosts = costs.value.filter(cost => cost.pulCgpr === user.value?.eno);

    if (myCosts.length === 0) {
        alert('수정할 대상이 없습니다. (본인 담당 건 없음)');
        return;
    }

    const ids = myCosts.map(cost => cost.itMngcNo).filter(id => id).join(',');
    router.push({ path: '/info/cost/form', query: { ids } });
};

// 검색 로직 (필요시 확장 가능, 현재는 기본 필터링 없음)
const filteredCosts = computed(() => {
    return costs.value;
});

</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-4">
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="basic" />
                <Button label="일괄 수정" icon="pi pi-pencil" severity="info" @click="handleBulkEdit" />
                <Button label="전산업무비 등록" icon="pi pi-plus" @click="navigateTo('/info/cost/form')" />
            </div>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>
            <DataTable v-else :value="filteredCosts" paginator :rows="10" v-model:selection="selectedCosts"
                sortField="itMngcNo" :sortOrder="-1" dataKey="itMngcNo" tableStyle="min-width: 50rem" :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }">
                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
                <Column field="itMngcNo" header="관리번호" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <NuxtLink :to="`/info/cost/${slotProps.data.itMngcNo}`"
                            class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                            {{ slotProps.data.itMngcNo }}
                        </NuxtLink>
                    </template>
                </Column>
                <Column field="ioeNm" header="비목명" sortable></Column>
                <Column field="cttNm" header="계약명" sortable></Column>
                <Column field="cttOpp" header="계약상대처" sortable></Column>
                <Column field="itMngcBg" :header="`예산 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.itMngcBg) }} {{ selectedUnit }}</span>
                    </template>
                </Column>
                <Column field="dfrCle" header="지급주기" sortable></Column>
                <Column field="pulCgpr" header="담당자" sortable></Column>

                <Column style="width: 10%">
                    <template #body>
                        <Button icon="pi pi-search" text rounded aria-label="Search" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
