<script setup lang="ts">
import { ref, computed } from 'vue';

const title = '정보화사업 목록';
definePageMeta({
    title
});

// 프로젝트 목록 가져오기
const { fetchProjects } = useProjects();
const { data: projectsData, error } = await fetchProjects();

// 프로젝트 목록 Computed property to handle potential null data
const projects = computed(() => projectsData.value || []);

// 검색 로직
const visibleDrawer = ref(false);
const searchFilters = ref({
    name: '',
    major_department: [] as string[],
    it_department: [] as string[],
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    startDate: null as Date | null,
    endDate: null as Date | null,
    status: [] as string[],
    major_hdq: [] as string[],
});

// Dropdown Options
const majorHdqs = computed(() => [...new Set(projects.value.map(p => p.svnHdq).filter(Boolean))]);
const majorDepartments = computed(() => [...new Set(projects.value.map(p => p.svnDpm).filter(Boolean))]);
const itDepartments = computed(() => [...new Set(projects.value.map(p => p.itDpm).filter(Boolean))]);
const statusOptions = computed(() => [...new Set(projects.value.map(p => p.prjSts).filter(Boolean))]);

// AutoComplete Suggestions
const filteredMajorHdqs = ref<string[]>([]);
const filteredMajorDepartments = ref<string[]>([]);
const filteredItDepartments = ref<string[]>([]);
const filteredStatuses = ref<string[]>([]);

const searchMajorHdq = (event: { query: string }) => {
    filteredMajorHdqs.value = majorHdqs.value.filter(d => d.includes(event.query));
};

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
        status: [],
        major_hdq: []
    };
};

const filteredProjects = computed(() => {
    return projects.value.filter(project => {
        // Name Filter
        if (searchFilters.value.name && !project.prjNm.includes(searchFilters.value.name)) return false;
        
        // 부문 및 본부 필터 (다중)
        if (searchFilters.value.major_hdq.length > 0 && !searchFilters.value.major_hdq.includes(project.svnHdq)) return false;

        // Department Filters (Multiple)
        if (searchFilters.value.major_department.length > 0 && !searchFilters.value.major_department.includes(project.svnDpm)) return false;
        if (searchFilters.value.it_department.length > 0 && !searchFilters.value.it_department.includes(project.itDpm)) return false;
        
        // Status Filter (Multiple)
        if (searchFilters.value.status.length > 0 && !searchFilters.value.status.includes(project.prjSts)) return false;
        
        // Budget Filter
        if (searchFilters.value.budgetMin !== null && project.prjBg < searchFilters.value.budgetMin) return false;
        if (searchFilters.value.budgetMax !== null && project.prjBg > searchFilters.value.budgetMax) return false;
        
        // Date Filter (Simple string comparison for YYYY-MM-DD)
        if (searchFilters.value.startDate) {
            const filterStart = searchFilters.value.startDate.toISOString().split('T')[0];
            if (project.endDt < filterStart) return false; // 프로젝트 종료일이 검색 시작일보다 빠르면 제외
        }
        if (searchFilters.value.endDate) {
            const filterEnd = searchFilters.value.endDate.toISOString().split('T')[0];
            if (project.sttDt > filterEnd) return false; // 프로젝트 시작일이 검색 종료일보다 늦으면 제외
        }

        return true;
    });
});

const getStatusClass = (status: string) => {
    switch (status) {
        case '예산 신청': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case '사전 협의': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        case '정실협 진행중': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
        case '요건 상세화': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        case '소요예산 산정': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
        case '과심위 진행중': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
        case '입찰/계약 진행중': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
        case '사업 진행중': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case '사업 완료': return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
        case '대금지급 완료': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
        case '성과평가(대기)': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
        case '성과평가(완료)': return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        default: return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
    }
};

const getPrjTypeClass = (type: string) => {
    return type === '신규' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
};

// 화폐 단위 
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원'); // 기본값
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
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>
            <DataTable v-else :value="filteredProjects" paginator :rows="10" 
                tableStyle="min-width: 50rem"
                :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }"
            >
                <Column field="prjNm" header="사업명" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <div class="flex items-center gap-2">
                            <Tag :value="slotProps.data.prjTp" :class="getPrjTypeClass(slotProps.data.prjTp)" class="border-0" rounded />
                            <NuxtLink :to="`/info/projects/${slotProps.data.prjMngNo}`" class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
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
                <Column field="prjSts" header="상태" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.prjSts" :class="getStatusClass(slotProps.data.prjSts)" class="border-0" rounded />
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

                <!-- 주관부문 -->
                <div class="flex flex-col gap-2">
                    <label for="major_hdq" class="font-semibold">주관부문 및 본부</label>
                    <AutoComplete id="major_hdq" v-model="searchFilters.major_hdq" :suggestions="filteredMajorHdqs" @complete="searchMajorHdq" multiple dropdown placeholder="주관부문 및 본부 선택 (다중)" fluid />
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
