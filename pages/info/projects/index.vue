<script setup lang="ts">
import { ref, computed } from 'vue';

const title = '정보화사업 목록';

definePageMeta({
    title
});

const { projects } = useProjects();

// Search Logic
const visibleDrawer = ref(false);
const searchFilters = ref({
    name: '',
    major_department: [] as string[],
    it_department: [] as string[],
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    startDate: null as Date | null,
    endDate: null as Date | null,
    status: [] as string[]
});

// Dropdown Options (Mock Data)
const majorDepartments = computed(() => [...new Set(projects.value.map(p => p.major_department))]);
const itDepartments = computed(() => [...new Set(projects.value.map(p => p.it_department))]);
const statusOptions = computed(() => [...new Set(projects.value.map(p => p.status))]);

// AutoComplete Suggestions
const filteredMajorDepartments = ref<string[]>([]);
const filteredItDepartments = ref<string[]>([]);
const filteredStatuses = ref<string[]>([]);

const searchMajorDept = (event: { query: string }) => {
    filteredMajorDepartments.value = majorDepartments.value.filter(d => d.includes(event.query));
};

const searchItDept = (event: { query: string }) => {
    filteredItDepartments.value = itDepartments.value.filter(d => d.includes(event.query));
};

const searchStatus = (event: { query: string }) => {
    filteredStatuses.value = statusOptions.value.filter(s => s.includes(event.query));
};

const resetFilters = () => {
    searchFilters.value = {
        name: '',
        major_department: [],
        it_department: [],
        budgetMin: null,
        budgetMax: null,
        startDate: null,
        endDate: null,
        status: []
    };
};

const filteredProjects = computed(() => {
    return projects.value.filter(project => {
        // Name Filter
        if (searchFilters.value.name && !project.name.includes(searchFilters.value.name)) return false;
        
        // Department Filters (Multiple)
        if (searchFilters.value.major_department.length > 0 && !searchFilters.value.major_department.includes(project.major_department)) return false;
        if (searchFilters.value.it_department.length > 0 && !searchFilters.value.it_department.includes(project.it_department)) return false;
        
        // Status Filter (Multiple)
        if (searchFilters.value.status.length > 0 && !searchFilters.value.status.includes(project.status)) return false;
        
        // Budget Filter
        if (searchFilters.value.budgetMin !== null && project.budget < searchFilters.value.budgetMin) return false;
        if (searchFilters.value.budgetMax !== null && project.budget > searchFilters.value.budgetMax) return false;
        
        // Date Filter (Simple string comparison for YYYY-MM-DD)
        if (searchFilters.value.startDate) {
            const filterStart = searchFilters.value.startDate.toISOString().split('T')[0];
            if (project.end_date < filterStart) return false; // 프로젝트 종료일이 검색 시작일보다 빠르면 제외
        }
        if (searchFilters.value.endDate) {
            const filterEnd = searchFilters.value.endDate.toISOString().split('T')[0];
            if (project.sta_date > filterEnd) return false; // 프로젝트 시작일이 검색 종료일보다 늦으면 제외
        }

        return true;
    });
});

const getStatusClass = (status: string) => {
    switch (status) {
        case '예산 신청': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
        case '사전 협의': return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
        case '정실협 진행중': return 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
        case '요건 상세화': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
        case '소요예산 산정': return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
        case '과심위 진행중': return 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
        case '입찰/계약 진행중': return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
        case '사업 진행중': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
        case '사업 완료': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        case '대금지급 완료': return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
        case '성과평가(대기)': return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
        case '성과평가(완료)': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        case '완료': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        default: return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
    }
};

const getPrjTypeClass = (type: string) => {
    switch (type) {
        case '신규': return 'bg-indigo-500 text-white dark:bg-indigo-600';
        case '계속': return 'bg-zinc-500 text-white dark:bg-zinc-600';
        default: return 'bg-zinc-500 text-white';
    }
};

const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');

const formatBudget = (amount: number) => {
    let value = amount;
    let fractionDigits = 0;

    switch (selectedUnit.value) {
        case '천원':
            value = amount / 1000;
            break;
        case '백만원':
            value = amount / 1000000;
            fractionDigits = 1;
            break;
        case '억원':
            value = amount / 100000000;
            fractionDigits = 1;
            break;
    }

    return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
};
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-4">
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="basic" />
                <Button label="조회" icon="pi pi-search" severity="secondary" outlined @click="visibleDrawer = true" />
                <Button label="예산 신청" icon="pi pi-plus" @click="navigateTo('/info/projects/form')" />
            </div>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <DataTable :value="filteredProjects" paginator :rows="10" 
                tableStyle="min-width: 50rem"
                :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }"
            >
                <Column field="name" header="사업명" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <div class="flex items-center gap-2">
                            <Tag :value="slotProps.data.prj_type" :class="getPrjTypeClass(slotProps.data.prj_type)" class="border-0" rounded />
                            <NuxtLink :to="`/info/projects/${slotProps.data.id}`" class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                {{ slotProps.data.name }}
                            </NuxtLink>
                        </div>
                    </template>
                </Column>
                <Column field="major_department" header="주관부서" sortable></Column>
                <Column field="it_department" header="IT부서" sortable></Column>
                <Column field="budget" :header="`예산 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.budget) }} {{ selectedUnit }}</span>
                    </template>
                </Column>
                <Column field="sta_date" header="시작일" sortable></Column>
                <Column field="end_date" header="종료일" sortable></Column>
                <Column field="status" header="상태" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status" :class="getStatusClass(slotProps.data.status)" class="border-0" rounded />
                    </template>
                </Column>
                <Column style="width: 10%">
                    <template #body>
                        <Button icon="pi pi-search" text rounded aria-label="Search" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Search Drawer -->
        <Drawer v-model:visible="visibleDrawer" header="상세 조회" position="right" class="!w-full md:!w-[600px]">
            <div class="flex flex-col gap-6">
                <!-- 사업명 -->
                <div class="flex flex-col gap-2">
                    <label for="name" class="font-semibold">사업명</label>
                    <InputText id="name" v-model="searchFilters.name" placeholder="사업명을 입력하세요" />
                </div>

                <!-- 주관부서 -->
                <div class="flex flex-col gap-2">
                    <label for="major_dept" class="font-semibold">주관부서</label>
                    <AutoComplete id="major_dept" v-model="searchFilters.major_department" :suggestions="filteredMajorDepartments" @complete="searchMajorDept" multiple dropdown placeholder="주관부서 선택 (다중)" fluid />
                </div>

                <!-- IT부서 -->
                <div class="flex flex-col gap-2">
                    <label for="it_dept" class="font-semibold">IT부서</label>
                    <AutoComplete id="it_dept" v-model="searchFilters.it_department" :suggestions="filteredItDepartments" @complete="searchItDept" multiple dropdown placeholder="IT부서 선택 (다중)" fluid />
                </div>

                <!-- 예산 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">예산 (원)</label>
                    <div class="flex items-center gap-2">
                        <InputNumber v-model="searchFilters.budgetMin" placeholder="최소" mode="currency" currency="KRW" locale="ko-KR" :minFractionDigits="0" class="w-full" />
                    </div>                                     
                    <div class="flex items-center gap-2">
                        <InputNumber v-model="searchFilters.budgetMax" placeholder="최대" mode="currency" currency="KRW" locale="ko-KR" :minFractionDigits="0" class="w-full" />
                    </div>
                </div>

                <!-- 기간 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">사업 기간</label>
                    <div class="flex flex-col gap-2">
                        <DatePicker v-model="searchFilters.startDate" placeholder="시작일" showIcon fluid dateFormat="yy-mm-dd" />
                        <DatePicker v-model="searchFilters.endDate" placeholder="종료일" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                </div>

                 <!-- 상태 -->
                 <div class="flex flex-col gap-2">
                    <label for="status" class="font-semibold">진행 상태</label>
                    <AutoComplete id="status" v-model="searchFilters.status" :suggestions="filteredStatuses" @complete="searchStatus" multiple dropdown placeholder="상태 선택 (다중)" fluid />
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button label="초기화" icon="pi pi-refresh" severity="secondary" @click="resetFilters" class="flex-1" />
                    <Button label="조회" icon="pi pi-search" @click="visibleDrawer = false" class="flex-1" />
                </div>
            </div>
        </Drawer>
    </div>
</template>
