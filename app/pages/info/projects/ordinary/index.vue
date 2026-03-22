<!--
================================================================================
[pages/info/projects/ordinary/index.vue] 경상사업 목록 페이지
================================================================================
경상사업(ORN_YN='Y') 목록을 조회하고 필터링할 수 있는 페이지입니다.

[주요 기능]
  - 경상사업 목록 DataTable 조회
  - 다중 선택 체크박스 + 결재신청 버튼
  - 예산 단위 변환 (원/천원/백만원/억원)
  - 상세 조회 Drawer (오른쪽 슬라이드): 조건 필터링

[라우팅]
  - 접근: /info/projects/ordinary
  - 등록 폼: /info/projects/ordinary/form
  - 수정 폼: /info/projects/ordinary/form?id=:prjMngNo
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjects } from '~/composables/useProjects';
import { formatBudget as formatBudgetUtil } from '~/utils/common';

const title = '경상사업 목록';
definePageMeta({
    title
});

/* ── 데이터 로드 (경상사업만: ornYn=Y) ── */
const { fetchProjects } = useProjects();
const { data: projectsData, error } = await fetchProjects({ ornYn: 'Y' });

/** 경상사업 목록 (null 안전 처리) */
const projects = computed(() => projectsData.value || []);
/** DataTable 다중 선택 항목 */
const selectedProjects = ref([]);

/**
 * 결재신청 처리
 * 선택된 프로젝트들의 관리번호를 sessionStorage에 저장 후 보고서 페이지로 이동합니다.
 */
const requestApproval = () => {
    if (selectedProjects.value.length === 0) {
        alert('결재할 사업을 선택해주세요.');
        return;
    }
    const ids = selectedProjects.value.map((p: any) => p.prjMngNo);

    /* 쿼리 파라미터 대신 sessionStorage 사용 (URL 길이 제한 우회) */
    if (process.client) {
        sessionStorage.setItem('selectedProjectIds', JSON.stringify(ids));
    }

    navigateTo('/info/projects/report');
};

/* ── 검색 Drawer 상태 ── */
/** 우측 검색 Drawer 표시 여부 */
const visibleDrawer = ref(false);

/** 검색 필터 조건 상태 */
const searchFilters = ref({
    name: '',
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    status: [] as string[],
    prjYy: '' as string,
});

/* ── AutoComplete 기본 데이터 (목록에서 유니크 값 추출) ── */
const statusOptions = computed(() => [...new Set(projects.value.map(p => p.prjSts).filter(Boolean))]);
const filteredStatuses = ref<string[]>([]);

/**
 * 진행 상태 AutoComplete 검색
 * @param event - PrimeVue AutoComplete 검색 이벤트
 */
const searchStatus = (event: { query: string }) => {
    filteredStatuses.value = statusOptions.value.filter(s => s.includes(event.query));
};

/**
 * 검색 필터 초기화
 */
const resetFilters = () => {
    searchFilters.value = {
        name: '',
        budgetMin: null,
        budgetMax: null,
        status: [],
        prjYy: '',
    };
};

/**
 * 다중 조건 필터링된 경상사업 목록
 */
const filteredProjects = computed(() => {
    return projects.value.filter(project => {
        /* 사업명 필터 */
        if (searchFilters.value.name && !project.prjNm.includes(searchFilters.value.name)) return false;

        /* 진행 상태 다중 필터 */
        if (searchFilters.value.status.length > 0 && !searchFilters.value.status.includes(project.prjSts)) return false;

        /* 예산 범위 필터 */
        if (searchFilters.value.budgetMin !== null && project.prjBg < searchFilters.value.budgetMin) return false;
        if (searchFilters.value.budgetMax !== null && project.prjBg > searchFilters.value.budgetMax) return false;

        /* 사업연도 필터 */
        if (searchFilters.value.prjYy && String(project.prjYy) !== searchFilters.value.prjYy) return false;

        return true;
    });
});

/* ── 예산 단위 변환 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');
/**
 * 예산 금액을 선택된 단위로 변환
 *
 * @param amount - 원(KRW) 단위 금액
 * @returns 단위 변환된 포맷 문자열
 */
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더: 제목 + 액션 버튼 그룹 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-4">
                <!-- 예산 단위 SelectButton -->
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="basic" />
                <!-- 상세 검색 Drawer 열기 -->
                <Button label="조회" icon="pi pi-search" severity="secondary" outlined @click="visibleDrawer = true" />
                <!-- 신규 경상사업 등록 폼으로 이동 -->
                <Button label="사업등록" icon="pi pi-plus" @click="navigateTo('/info/projects/ordinary/form')" />
                <!-- 선택된 항목이 있을 때만 활성화 -->
                <Button label="결재신청" icon="pi pi-check-square" severity="help" @click="requestApproval"
                    :disabled="selectedProjects.length === 0" />
            </div>
        </div>

        <!-- 경상사업 DataTable -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>
            <DataTable v-else :value="filteredProjects" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
                v-model:selection="selectedProjects" sortField="prjMngNo" :sortOrder="-1" dataKey="prjMngNo"
                tableStyle="min-width: 50rem" :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }">
                <!-- 다중 선택 체크박스 -->
                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

                <!-- 사업연도 -->
                <Column field="prjYy" header="사업연도" sortable></Column>

                <!-- 사업명: 유형 태그 + 수정 폼 링크 -->
                <Column field="prjNm" header="사업명" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <div class="flex items-center gap-2">
                            <NuxtLink :to="`/info/projects/ordinary/form?id=${slotProps.data.prjMngNo}`"
                                class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                {{ slotProps.data.prjNm }}
                            </NuxtLink>
                        </div>
                    </template>
                </Column>

                <!-- 프로젝트유형 -->
                <Column field="prjTp" header="유형" sortable></Column>

                <!-- 예산: 선택된 단위로 변환 -->
                <Column field="prjBg" :header="`예산 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.prjBg) }} {{ selectedUnit }}</span>
                    </template>
                </Column>

                <!-- 결재현황 태그 -->
                <Column field="applicationInfo.apfSts" header="결재현황" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.applicationInfo?.apfSts"
                            :class="getApprovalTagClass(slotProps.data.applicationInfo?.apfSts)" class="border-0"
                            rounded />
                    </template>
                </Column>

                <!-- 사업현황 태그 -->
                <Column field="prjSts" header="사업현황" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.prjSts" :class="getProjectTagClass(slotProps.data.prjSts)"
                            class="border-0" rounded />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- 상세 조회 Drawer (오른쪽 슬라이드) -->
        <Drawer v-model:visible="visibleDrawer" header="상세 조회" position="right" class="!w-full md:!w-[480px]">
            <div class="flex flex-col gap-6">

                <!-- 사업명 텍스트 검색 -->
                <div class="flex flex-col gap-2">
                    <label for="name" class="font-semibold">사업명</label>
                    <InputText id="name" v-model="searchFilters.name" placeholder="사업명을 입력하세요" />
                </div>

                <!-- 사업연도 -->
                <div class="flex flex-col gap-2">
                    <label for="prjYy" class="font-semibold">사업연도</label>
                    <InputText id="prjYy" v-model="searchFilters.prjYy" placeholder="예: 2026" />
                </div>

                <!-- 예산 범위: 최소/최대 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">예산 (원)</label>
                    <InputNumber v-model="searchFilters.budgetMin" placeholder="최소" mode="currency" currency="KRW"
                        locale="ko-KR" :minFractionDigits="0" class="w-full" />
                    <InputNumber v-model="searchFilters.budgetMax" placeholder="최대" mode="currency" currency="KRW"
                        locale="ko-KR" :minFractionDigits="0" class="w-full" />
                </div>

                <!-- 진행 상태 다중 선택 AutoComplete -->
                <div class="flex flex-col gap-2">
                    <label for="status" class="font-semibold">진행 상태</label>
                    <AutoComplete id="status" v-model="searchFilters.status" :suggestions="filteredStatuses"
                        @complete="searchStatus" multiple dropdown placeholder="상태 선택 (다중)" fluid />
                </div>

                <!-- Drawer 액션 버튼: 초기화 + 조회(Drawer 닫기) -->
                <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button label="초기화" icon="pi pi-refresh" severity="secondary" @click="resetFilters"
                        class="flex-1" />
                    <Button label="조회" icon="pi pi-search" @click="visibleDrawer = false" class="flex-1" />
                </div>
            </div>
        </Drawer>
    </div>
</template>
