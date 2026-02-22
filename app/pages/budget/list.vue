<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjects, type Project } from '~/composables/useProjects';
import { useCost, type ItCost } from '~/composables/useCost';
import { getApprovalTagClass, getProjectTagClass, formatBudget as formatBudgetUtil } from '~/utils/common';

const title = '예산 목록';
definePageMeta({
    title: '예산 목록'
});

// 탭 관리
const activeTab = ref(0);

// === 정보화사업 데이터 ===
const { fetchProjects } = useProjects();
const { data: projectsData, error: projectsError } = await fetchProjects();
const projects = computed(() => projectsData.value || []);

// === 전산업무비 데이터 ===
const { fetchCosts } = useCost();
const { data: costsData, error: costsError } = await fetchCosts();
const costs = computed(() => costsData.value || []);

// 화폐 단위 변환 (공통)
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);

// 정보화사업 유형 태그 스타일
const getPrjTypeClass = (type: string) => {
    return type === '신규'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
};

// 검색어 필터
const projectSearch = ref('');
const costSearch = ref('');

// 정보화사업 필터링
const filteredProjects = computed(() => {
    if (!projectSearch.value) return projects.value;
    const keyword = projectSearch.value.toLowerCase();
    return projects.value.filter((p: Project) =>
        p.prjNm?.toLowerCase().includes(keyword) ||
        p.svnDpm?.toLowerCase().includes(keyword) ||
        p.itDpm?.toLowerCase().includes(keyword)
    );
});

// 전산업무비 필터링
const filteredCosts = computed(() => {
    if (!costSearch.value) return costs.value;
    const keyword = costSearch.value.toLowerCase();
    return costs.value.filter((c: ItCost) =>
        c.ioeNm?.toLowerCase().includes(keyword) ||
        c.cttNm?.toLowerCase().includes(keyword) ||
        c.cttOpp?.toLowerCase().includes(keyword)
    );
});

// 예산 합계 계산
const totalProjectBudget = computed(() => {
    return projects.value.reduce((sum: number, p: Project) => sum + (p.prjBg || 0), 0);
});

const totalCostBudget = computed(() => {
    return costs.value.reduce((sum: number, c: ItCost) => sum + (c.itMngcBg || 0), 0);
});

// 탭 항목 정의
const tabItems = computed(() => [
    {
        label: '정보화사업',
        icon: 'pi pi-desktop',
        badge: projects.value.length.toString()
    },
    {
        label: '전산업무비',
        icon: 'pi pi-wallet',
        badge: costs.value.length.toString()
    }
]);
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-4">
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="unit-selector" />
            </div>
        </div>

        <!-- 예산 요약 카드 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- 정보화사업 예산 합계 -->
            <div
                class="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div class="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <i class="pi pi-desktop text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">정보화사업 예산</p>
                    <p class="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {{ formatBudget(totalProjectBudget) }}
                        <span class="text-sm font-normal text-zinc-500">{{ selectedUnit }}</span>
                    </p>
                </div>
            </div>

            <!-- 전산업무비 예산 합계 -->
            <div
                class="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <i class="pi pi-wallet text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">전산업무비 예산</p>
                    <p class="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {{ formatBudget(totalCostBudget) }}
                        <span class="text-sm font-normal text-zinc-500">{{ selectedUnit }}</span>
                    </p>
                </div>
            </div>

            <!-- 전체 예산 합계 -->
            <div
                class="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 rounded-xl shadow-sm flex items-center gap-4">
                <div class="p-3 rounded-xl bg-white/20 text-white">
                    <i class="pi pi-chart-bar text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm text-indigo-100">전체 예산 합계</p>
                    <p class="text-xl font-bold text-white">
                        {{ formatBudget(totalProjectBudget + totalCostBudget) }}
                        <span class="text-sm font-normal text-indigo-200">{{ selectedUnit }}</span>
                    </p>
                </div>
            </div>
        </div>

        <!-- 탭 영역 -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <!-- 탭 헤더 -->
            <TabView v-model:activeIndex="activeTab" :pt="{
                nav: { class: 'border-b border-zinc-200 dark:border-zinc-800' },
                tabpanel: { header: { class: 'px-6' } }
            }">
                <!-- 정보화사업 탭 -->
                <TabPanel value="projects">
                    <template #header>
                        <div class="flex items-center gap-2">
                            <i class="pi pi-desktop"></i>
                            <span>정보화사업</span>
                            <Badge :value="projects.length" severity="info" />
                        </div>
                    </template>

                    <div class="p-4 space-y-4">
                        <!-- 검색 바 -->
                        <div class="flex items-center gap-3">
                            <IconField class="flex-1">
                                <InputIcon class="pi pi-search" />
                                <InputText v-model="projectSearch" placeholder="사업명, 주관부서, IT부서 검색..." class="w-full" />
                            </IconField>
                            <Button label="사업 목록" icon="pi pi-list" severity="secondary" outlined
                                @click="navigateTo('/info/projects')" />
                        </div>

                        <!-- 정보화사업 DataTable -->
                        <div v-if="projectsError" class="p-4 text-red-500">
                            데이터를 불러오는 중 오류가 발생했습니다: {{ projectsError.message }}
                        </div>
                        <DataTable v-else :value="filteredProjects" paginator :rows="10" sortField="prjMngNo"
                            :sortOrder="-1" dataKey="prjMngNo" tableStyle="min-width: 50rem" :pt="{
                                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                            }">
                            <Column field="prjNm" header="사업명" sortable headerClass="font-bold">
                                <template #body="slotProps">
                                    <div class="flex items-center gap-2">
                                        <Tag :value="slotProps.data.prjTp"
                                            :class="getPrjTypeClass(slotProps.data.prjTp)" class="border-0" rounded />
                                        <NuxtLink :to="`/info/projects/${slotProps.data.prjMngNo}`"
                                            class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                            {{ slotProps.data.prjNm }}
                                        </NuxtLink>
                                    </div>
                                </template>
                            </Column>
                            <Column field="svnDpm" header="주관부서" sortable></Column>
                            <Column field="itDpm" header="IT부서" sortable></Column>
                            <Column field="prjBg" :header="`예산 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.prjBg) }} {{ selectedUnit }}</span>
                                </template>
                            </Column>
                            <Column field="sttDt" header="시작일" sortable></Column>
                            <Column field="endDt" header="종료일" sortable></Column>
                            <Column field="apfSts" header="결재현황" sortable>
                                <template #body="slotProps">
                                    <Tag :value="slotProps.data.apfSts"
                                        :class="getApprovalTagClass(slotProps.data.apfSts)" class="border-0" rounded />
                                </template>
                            </Column>
                            <Column field="prjSts" header="사업현황" sortable>
                                <template #body="slotProps">
                                    <Tag :value="slotProps.data.prjSts"
                                        :class="getProjectTagClass(slotProps.data.prjSts)" class="border-0" rounded />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- 전산업무비 탭 -->
                <TabPanel value="costs">
                    <template #header>
                        <div class="flex items-center gap-2">
                            <i class="pi pi-wallet"></i>
                            <span>전산업무비</span>
                            <Badge :value="costs.length" severity="success" />
                        </div>
                    </template>

                    <div class="p-4 space-y-4">
                        <!-- 검색 바 -->
                        <div class="flex items-center gap-3">
                            <IconField class="flex-1">
                                <InputIcon class="pi pi-search" />
                                <InputText v-model="costSearch" placeholder="비목명, 계약명, 계약상대처 검색..." class="w-full" />
                            </IconField>
                            <Button label="전산업무비 목록" icon="pi pi-list" severity="secondary" outlined
                                @click="navigateTo('/info/cost')" />
                        </div>

                        <!-- 전산업무비 DataTable -->
                        <div v-if="costsError" class="p-4 text-red-500">
                            데이터를 불러오는 중 오류가 발생했습니다: {{ costsError.message }}
                        </div>
                        <DataTable v-else :value="filteredCosts" paginator :rows="10" sortField="itMngcNo"
                            :sortOrder="-1" dataKey="itMngcNo" tableStyle="min-width: 50rem" :pt="{
                                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                            }">
                            <Column field="cttNm" header="계약명" sortable headerClass="font-bold">
                                <template #body="slotProps">
                                    <NuxtLink :to="`/info/cost/${slotProps.data.itMngcNo}`"
                                        class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                        {{ slotProps.data.cttNm }}
                                    </NuxtLink>
                                </template>
                            </Column>
                            <Column field="ioeNm" header="비목명" sortable></Column>
                            <Column field="cttOpp" header="계약상대처" sortable></Column>
                            <Column field="itMngcBg" :header="`예산 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.itMngcBg) }} {{ selectedUnit }}</span>
                                </template>
                            </Column>
                            <Column field="dfrCle" header="지급주기" sortable></Column>
                            <Column field="pulCgpr" header="담당자" sortable></Column>
                        </DataTable>
                    </div>
                </TabPanel>
            </TabView>
        </div>
    </div>
</template>
