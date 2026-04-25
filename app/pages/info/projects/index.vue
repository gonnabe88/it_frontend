<!--
================================================================================
[pages/info/projects/index.vue] 사업 목록 페이지 (정보화사업 + 경상사업 통합)
================================================================================
정보화사업(ornYn='N')과 경상사업(ornYn='Y')을 통합 조회하는 페이지입니다.

[주요 기능]
  - 정보화사업 + 경상사업 통합 DataTable 조회
  - 구분(정보화/경상) 필터링
  - 예산 단위 변환 (원/천원/백만원/억원)
  - 상세 조회 Drawer (오른쪽 슬라이드): 조건 다중 필터링
  - 사업명 클릭 → 상세 페이지 이동

[결재신청 로직]
  - 선택된 프로젝트들의 prjMngNo를 sessionStorage에 저장
  - /info/projects/report 페이지로 이동 (보고서 + 결재 상신)
  - sessionStorage 사용 이유: 쿼리 파라미터 길이 제한 우회

[라우팅]
  - 접근: /info/projects
  - 상세: /info/projects/:prjMngNo
  - 등록 폼: /info/projects/form (정보화), /info/projects/form?ordinary=true (경상)
  - 보고서/결재: /info/projects/report
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onActivated } from 'vue';
import { useProjects } from '~/composables/useProjects';
import { formatBudget as formatBudgetUtil } from '~/utils/common';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

const title = '사업 목록';
definePageMeta({
    title
});

/* ── 데이터 로드 (정보화사업 + 경상사업 전체 조회) ── */
const { fetchProjects } = useProjects();
const { data: projectsData, error, refresh: refreshProjects } = await fetchProjects({});

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(() => refreshProjects());

/* ── 공통코드 코드명 변환 ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP');

/** 정보화사업 목록 (null 안전 처리) */
const projects = computed(() => projectsData.value || []);

/* ── 검색 Drawer 상태 ── */
/** 우측 검색 Drawer 표시 여부 */
const visibleDrawer = ref(false);

/** 검색 필터 조건 상태 */
const searchFilters = ref({
    name: '',
    category: '' as '' | 'N' | 'Y',  // 구분: '' = 전체, 'N' = 정보화, 'Y' = 경상
    major_department: [] as string[],
    it_department: [] as string[],
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    startDate: null as Date | null,
    endDate: null as Date | null,
    status: [] as string[],
    major_hdq: [] as string[],
});

/** 구분 필터 옵션 */
const categoryOptions = [
    { label: '전체', value: '' },
    { label: '정보화사업', value: 'N' },
    { label: '경상사업', value: 'Y' },
];

/* ── AutoComplete 기본 데이터 (목록에서 유니크 값 추출) ── */
const majorHdqs = computed(() => [...new Set(projects.value.map(p => p.svnHdq).filter(Boolean))]);
const majorDepartments = computed(() => [...new Set(projects.value.map(p => p.svnDpmNm).filter(Boolean))]);
const itDepartments = computed(() => [...new Set(projects.value.map(p => p.itDpmNm).filter(Boolean))]);
const statusOptions = computed(() => [...new Set(projects.value.map(p => p.prjSts).filter(Boolean))]);

/* ── AutoComplete 검색 Suggestions (타이핑에 따라 필터링) ── */
const filteredMajorHdqs = ref<string[]>([]);
const filteredMajorDepartments = ref<string[]>([]);
const filteredItDepartments = ref<string[]>([]);
const filteredStatuses = ref<string[]>([]);

/**
 * 주관부문 AutoComplete 검색
 * @param event - PrimeVue AutoComplete 검색 이벤트
 */
const searchMajorHdq = (event: { query: string }) => {
    filteredMajorHdqs.value = majorHdqs.value.filter(d => d.includes(event.query));
};

/**
 * 주관부서 AutoComplete 검색
 * @param event - PrimeVue AutoComplete 검색 이벤트
 */
const searchMajorDept = (event: { query: string }) => {
    filteredMajorDepartments.value = majorDepartments.value.filter(d => d.includes(event.query));
};

/**
 * IT부서 AutoComplete 검색
 * @param event - PrimeVue AutoComplete 검색 이벤트
 */
const searchItDept = (event: { query: string }) => {
    filteredItDepartments.value = itDepartments.value.filter(d => d.includes(event.query));
};

/**
 * 진행 상태 AutoComplete 검색
 * @param event - PrimeVue AutoComplete 검색 이벤트
 */
const searchStatus = (event: { query: string }) => {
    filteredStatuses.value = statusOptions.value.filter(s => s.includes(event.query));
};

/**
 * 검색 필터 초기화
 * 모든 필터 조건을 초기 빈 상태로 리셋합니다.
 */
const resetFilters = () => {
    searchFilters.value = {
        name: '',
        category: '',
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

/**
 * 다중 조건 필터링된 프로젝트 목록
 * 각 필터 조건이 설정된 경우에만 해당 조건으로 필터링합니다.
 * 기간 필터는 "프로젝트 기간과 검색 기간이 겹치는 건" 기준으로 동작합니다.
 */
const filteredProjects = computed(() => {
    return projects.value.filter(project => {
        /* 구분 필터 (정보화/경상) */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (searchFilters.value.category && (project as any).ornYn !== searchFilters.value.category) return false;

        /* 사업명 필터 */
        if (searchFilters.value.name && !project.prjNm.includes(searchFilters.value.name)) return false;

        /* 주관부문 및 본부 다중 필터 */
        if (searchFilters.value.major_hdq.length > 0 && !searchFilters.value.major_hdq.includes(project.svnHdq)) return false;

        /* 주관부서 다중 필터 */
        if (searchFilters.value.major_department.length > 0 && !searchFilters.value.major_department.includes(project.svnDpmNm)) return false;

        /* IT부서 다중 필터 */
        if (searchFilters.value.it_department.length > 0 && !searchFilters.value.it_department.includes(project.itDpmNm)) return false;

        /* 진행 상태 다중 필터 */
        if (searchFilters.value.status.length > 0 && !searchFilters.value.status.includes(project.prjSts)) return false;

        /* 예산 범위 필터 */
        if (searchFilters.value.budgetMin !== null && project.prjBg < searchFilters.value.budgetMin) return false;
        if (searchFilters.value.budgetMax !== null && project.prjBg > searchFilters.value.budgetMax) return false;

        /* 기간 필터: YYYY-MM-DD 문자열 비교 */
        if (searchFilters.value.startDate) {
            const filterStart = searchFilters.value.startDate.toISOString().split('T')[0]!;
            if (project.endDt < filterStart) return false; // 프로젝트 종료일이 검색 시작일보다 빠르면 제외
        }
        if (searchFilters.value.endDate) {
            const filterEnd = searchFilters.value.endDate.toISOString().split('T')[0]!;
            if (project.sttDt > filterEnd) return false; // 프로젝트 시작일이 검색 종료일보다 늦으면 제외
        }

        return true;
    });
});

/**
 * 사업 유형에 따른 태그 색상 CSS 클래스 반환
 * '신규': 에메랄드, '계속': 스카이
 *
 * @param type - 사업 유형 ('신규' | '계속')
 * @returns Tailwind CSS 클래스 문자열
 */
const getPrjTypeClass = (type: string) => {
    return type === '신규' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
};

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
            </div>
        </div>

        <!-- 정보화사업 DataTable -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>
            <StyledDataTable
v-else :value="filteredProjects" paginator :rows="10"
                :rows-per-page-options="[10, 20, 50]" sort-field="prjMngNo" :sort-order="-1" data-key="prjMngNo">

                <!-- 구분: 정보화사업/경상사업 태그 -->
                <Column field="ornYn" header="구분" sortable header-style="width: 7rem">
                    <template #body="slotProps">
                        <Tag
:value="slotProps.data.ornYn === 'Y' ? '경상' : '정보화'"
                            :class="slotProps.data.ornYn === 'Y' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 사업명: 신규/계속 태그 + 상세 페이지 링크 -->
                <Column field="prjNm" header="사업명" sortable header-class="font-bold">
                    <template #body="slotProps">
                        <div class="flex items-center gap-2">
                            <Tag
:value="getPrjTpName(slotProps.data.prjTp)" :class="getPrjTypeClass(slotProps.data.prjTp)"
                                class="border-0" rounded />
                            <NuxtLink
:to="`/info/projects/${slotProps.data.prjMngNo}`"
                                class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                {{ slotProps.data.prjNm }}
                            </NuxtLink>
                        </div>
                    </template>
                </Column>
                <Column field="svnDpmNm" header="주관부서" sortable/>
                <Column field="itDpmNm" header="IT부서" sortable/>

                <!-- 총 예산: 선택된 단위로 변환 -->
                <Column field="prjBg" :header="`총 예산 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.prjBg) }} {{ selectedUnit }}</span>
                    </template>
                </Column>

                <!-- 자본예산: 비목코드 cttTp=IOE_CPIT 기준 -->
                <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.assetBg) }} {{ selectedUnit }}</span>
                    </template>
                </Column>

                <!-- 일반관리비: 비목코드 cttTp=IOE_IDR/IOE_SEVS/IOE_XPN/IOE_LEAFE 기준 -->
                <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.costBg) }} {{ selectedUnit }}</span>
                    </template>
                </Column>
                <Column field="sttDt" header="시작일" sortable/>
                <Column field="endDt" header="종료일" sortable/>

                <!-- 결재현황 태그 -->
                <Column field="applicationInfo.apfSts" header="결재현황" sortable>
                    <template #body="slotProps">
                        <Tag
:value="slotProps.data.applicationInfo?.apfSts"
                            :class="getApprovalTagClass(slotProps.data.applicationInfo?.apfSts)" class="border-0"
                            rounded />
                    </template>
                </Column>

                <!-- 사업현황 태그 -->
                <Column field="prjSts" header="사업현황" sortable>
                    <template #body="slotProps">
                        <Tag
:value="slotProps.data.prjSts" :class="getProjectTagClass(slotProps.data.prjSts)"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 상세 조회 버튼 -->
                <Column style="width: 10%">
                    <template #body>
                        <Button icon="pi pi-search" text rounded aria-label="Search" />
                    </template>
                </Column>
            </StyledDataTable>
        </div>

        <!-- 상세 조회 Drawer (오른쪽 슬라이드) -->
        <Drawer v-model:visible="visibleDrawer" header="상세 조회" position="right" class="!w-full md:!w-[600px]">
            <div class="flex flex-col gap-6">

                <!-- 사업명 텍스트 검색 -->
                <div class="flex flex-col gap-2">
                    <label for="name" class="font-semibold">사업명</label>
                    <InputText id="name" v-model="searchFilters.name" placeholder="사업명을 입력하세요" />
                </div>

                <!-- 구분 (정보화/경상) 필터 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">구분</label>
                    <SelectButton
v-model="searchFilters.category" :options="categoryOptions" option-label="label"
                        option-value="value" />
                </div>

                <!-- 주관부문 및 본부 다중 선택 AutoComplete -->
                <div class="flex flex-col gap-2">
                    <label for="major_hdq" class="font-semibold">주관부문 및 본부</label>
                    <AutoComplete
id="major_hdq" v-model="searchFilters.major_hdq" :suggestions="filteredMajorHdqs"
                        multiple dropdown placeholder="주관부문 및 본부 선택 (다중)" fluid @complete="searchMajorHdq" />
                </div>

                <!-- 주관부서 다중 선택 AutoComplete -->
                <div class="flex flex-col gap-2">
                    <label for="major_dept" class="font-semibold">주관부서</label>
                    <AutoComplete
id="major_dept" v-model="searchFilters.major_department"
                        :suggestions="filteredMajorDepartments" multiple dropdown placeholder="주관부서 선택 (다중)"
                        fluid @complete="searchMajorDept" />
                </div>

                <!-- IT부서 다중 선택 AutoComplete -->
                <div class="flex flex-col gap-2">
                    <label for="it_dept" class="font-semibold">IT부서</label>
                    <AutoComplete
id="it_dept" v-model="searchFilters.it_department"
                        :suggestions="filteredItDepartments" multiple dropdown placeholder="IT부서 선택 (다중)"
                        fluid @complete="searchItDept" />
                </div>

                <!-- 예산 범위: 최소/최대 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">예산 (원)</label>
                    <div class="flex items-center gap-2">
                        <InputNumber
v-model="searchFilters.budgetMin" placeholder="최소" mode="currency" currency="KRW"
                            locale="ko-KR" :min-fraction-digits="0" class="w-full" />
                    </div>
                    <div class="flex items-center gap-2">
                        <InputNumber
v-model="searchFilters.budgetMax" placeholder="최대" mode="currency" currency="KRW"
                            locale="ko-KR" :min-fraction-digits="0" class="w-full" />
                    </div>
                </div>

                <!-- 사업 기간: 시작일/종료일 DatePicker -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">사업 기간</label>
                    <div class="flex flex-col gap-2">
                        <DatePicker
v-model="searchFilters.startDate" placeholder="시작일" show-icon fluid
                            date-format="yy-mm-dd" />
                        <DatePicker
v-model="searchFilters.endDate" placeholder="종료일" show-icon fluid
                            date-format="yy-mm-dd" />
                    </div>
                </div>

                <!-- 진행 상태 다중 선택 AutoComplete -->
                <div class="flex flex-col gap-2">
                    <label for="status" class="font-semibold">진행 상태</label>
                    <AutoComplete
id="status" v-model="searchFilters.status" :suggestions="filteredStatuses"
                        multiple dropdown placeholder="상태 선택 (다중)" fluid @complete="searchStatus" />
                </div>

                <!-- Drawer 액션 버튼: 초기화 + 조회(Drawer 닫기) -->
                <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button
label="초기화" icon="pi pi-refresh" severity="secondary" class="flex-1"
                        @click="resetFilters" />
                    <Button label="조회" icon="pi pi-search" class="flex-1" @click="visibleDrawer = false" />
                </div>
            </div>
        </Drawer>
    </div>
</template>
