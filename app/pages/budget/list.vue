<!--
================================================================================
[pages/budget/list.vue] 예산 통합 목록 페이지
================================================================================
정보화사업과 전산업무비 예산을 탭으로 구분하여 통합 조회하는 페이지입니다.
상단에 예산 요약 카드를 표시하고, 탭 전환으로 각 목록을 확인할 수 있습니다.

[주요 기능]
  - 예산 단위 변환: SelectButton으로 원/천원/백만원/억원 단위 전환
  - 예산 요약 카드: 정보화사업 예산 합계, 전산업무비 예산 합계, 전체 합계
  - 정보화사업 탭: 검색(사업명/주관부서/IT부서) + DataTable (결재현황/사업현황 태그 포함)
  - 전산업무비 탭: 검색(비목명/계약명/계약상대처) + DataTable
  - 각 탭 헤더에 전체 항목 수(Badge) 표시

[탭 구성]
  - TabView: activeTab ref로 탭 인덱스 관리
  - 탭 0: 전체 (pi-th-large 아이콘, 통합 조회)
  - 탭 1: 정보화사업 (pi-desktop 아이콘, indigo 테마)
  - 탭 2: 전산업무비 (pi-wallet 아이콘, emerald 테마)

[라우팅 링크]
  - 정보화사업 목록 → /info/projects/:prjMngNo
  - 전산업무비 목록 → /info/cost/:itMngcNo
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjects, type Project } from '~/composables/useProjects';
import { useCost, type ItCost } from '~/composables/useCost';
import { getApprovalTagClass, formatBudget as formatBudgetUtil } from '~/utils/common';

const title = '예산 목록';
definePageMeta({
    title: '예산 목록'
});

/* ── 탭 관리 ── */
/** 현재 활성화된 탭 인덱스 (0: 정보화사업, 1: 전산업무비) */
const activeTab = ref(0);

/* ── 정보화사업 데이터 ── */
const { fetchProjects } = useProjects();
const { data: projectsData, error: projectsError } = await fetchProjects();
/** 정보화사업 목록 (null 안전 처리) */
const projects = computed(() => projectsData.value || []);

/* ── 전산업무비 데이터 ── */
const { fetchCosts } = useCost();
const { data: costsData, error: costsError } = await fetchCosts();
/** 전산업무비 목록 (null 안전 처리) */
const costs = computed(() => costsData.value || []);

/**
 * [UnifiedBudgetItem] 통합 예산 항목 인터페이스
 * 정보화사업과 전산업무비를 하나의 공통 구조로 매핑합니다.
 */
interface UnifiedBudgetItem {
    _id: string;         // 고유 키 (prjMngNo 또는 itMngcNo)
    _type: string;       // 구분 ('정보화사업' | '전산업무비')
    _link: string;       // 상세 페이지 링크
    name: string;        // 사업명/계약명
    category: string;    // 신규/계속 (prjTp / cttTp)
    totalBg: number;     // 총 예산
    assetBg: number;     // 자본예산
    costBg: number;      // 일반관리비
    deptNm: string;      // 담당부서
    managerNm: string;   // 담당자
    sttDt: string;       // 시작일
    endDt: string;       // 종료일
    apfSts: string;      // 결재현황
    lstChgDtm: string;   // 최근수정일
}

/**
 * 정보화사업 + 전산업무비를 UnifiedBudgetItem 형태로 합산한 통합 목록
 */
const unifiedItems = computed<UnifiedBudgetItem[]>(() => {
    /* 정보화사업 매핑 */
    const projectItems: UnifiedBudgetItem[] = projects.value.map((p: Project) => ({
        _id: p.prjMngNo,
        _type: '사업',
        _link: `/info/projects/${p.prjMngNo}`,
        name: p.prjNm,
        category: p.prjTp,
        totalBg: p.prjBg || 0,
        assetBg: p.assetBg || 0,
        costBg: p.costBg || 0,
        deptNm: p.svnDpmNm || '',
        managerNm: p.svnDpmCgprNm || '',
        sttDt: p.sttDt || '',
        endDt: p.endDt || '',
        apfSts: p.apfSts || '',
        lstChgDtm: (p as any).lstChgDtm || ''
    }));
    /* 전산업무비 매핑 */
    const costItems: UnifiedBudgetItem[] = costs.value.map((c: ItCost) => ({
        _id: c.itMngcNo || '',
        _type: '비용',
        _link: `/info/cost/${c.itMngcNo}`,
        name: c.cttNm,
        category: c.cttTp,
        totalBg: c.itMngcBg || 0,
        assetBg: c.assetBg || 0,
        costBg: c.itMngcBg || 0,
        deptNm: c.pulDpmNm || '',
        managerNm: c.pulCgprNm || '',
        sttDt: typeof c.fstDfrDt === 'string' ? c.fstDfrDt : '',
        endDt: typeof c.fstDfrDt === 'string' ? c.fstDfrDt : '',
        apfSts: c.apfSts || '',
        lstChgDtm: (c as any).lstChgDtm || ''
    }));
    return [...projectItems, ...costItems];
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

/**
 * 정보화사업 유형에 따른 태그 색상 CSS 클래스 반환
 * '신규': 에메랄드, '계속': 스카이
 *
 * @param type - 사업 유형 ('신규' | '계속')
 * @returns Tailwind CSS 클래스 문자열
 */
const getPrjTypeClass = (type: string) => {
    return type === '신규'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
};

/* ── 검색어 필터 ── */
/** 정보화사업 탭 검색어 */
const projectSearch = ref('');
/** 전산업무비 탭 검색어 */
const costSearch = ref('');
/** 전체 탭 검색어 */
const allSearch = ref('');

/**
 * 정보화사업 필터링
 * 사업명, 주관부서, IT부서 중 하나라도 검색어를 포함하면 반환합니다.
 */
const filteredProjects = computed(() => {
    if (!projectSearch.value) return projects.value;
    const keyword = projectSearch.value.toLowerCase();
    return projects.value.filter((p: Project) =>
        p.prjNm?.toLowerCase().includes(keyword) ||
        p.svnDpmNm?.toLowerCase().includes(keyword) ||
        p.itDpmNm?.toLowerCase().includes(keyword)
    );
});

/**
 * 전산업무비 필터링
 * 비목명, 계약명, 계약상대처 중 하나라도 검색어를 포함하면 반환합니다.
 */
const filteredCosts = computed(() => {
    if (!costSearch.value) return costs.value;
    const keyword = costSearch.value.toLowerCase();
    return costs.value.filter((c: ItCost) =>
        c.ioeNm?.toLowerCase().includes(keyword) ||
        c.cttNm?.toLowerCase().includes(keyword) ||
        c.cttOpp?.toLowerCase().includes(keyword)
    );
});

/**
 * 전체 통합 목록 필터링
 * 사업명/계약명, 담당부서, 담당자 중 하나라도 검색어를 포함하면 반환합니다.
 */
const filteredAll = computed(() => {
    if (!allSearch.value) return unifiedItems.value;
    const keyword = allSearch.value.toLowerCase();
    return unifiedItems.value.filter(item =>
        item.name?.toLowerCase().includes(keyword) ||
        item.deptNm?.toLowerCase().includes(keyword) ||
        item.managerNm?.toLowerCase().includes(keyword)
    );
});

/* ── 예산 합계 계산 ── */
/** 정보화사업 예산 합계 (원 단위) */
const totalProjectBudget = computed(() => {
    return projects.value.reduce((sum: number, p: Project) => sum + (p.prjBg || 0), 0);
});

/** 전산업무비 예산 합계 (원 단위) */
const totalCostBudget = computed(() => {
    return costs.value.reduce((sum: number, c: ItCost) => sum + (c.itMngcBg || 0), 0);
});

/**
 * 탭 헤더 아이템 정의
 * 라벨, 아이콘, 뱃지(항목 수)로 구성됩니다.
 */
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

        <!-- 페이지 헤더: 제목 + 예산 단위 선택 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-4">
                <!-- 예산 단위 SelectButton (원/천원/백만원/억원) -->
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="unit-selector" />
            </div>
        </div>

        <!-- 예산 요약 카드 (3열 그리드) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

            <!-- 정보화사업 예산 합계 카드 (인디고 테마) -->
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

            <!-- 전산업무비 예산 합계 카드 (에메랄드 테마) -->
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

            <!-- 전체 예산 합계 카드 (그라디언트 강조 테마) -->
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

        <!-- 탭 영역 (전체 / 정보화사업 / 전산업무비) -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <TabView v-model:activeIndex="activeTab" :pt="{
                nav: { class: 'border-b border-zinc-200 dark:border-zinc-800' },
                tabpanel: { header: { class: '' } }
            }">

                <!-- 전체 통합 탭 -->
                <TabPanel value="all">
                    <template #header>
                        <div class="flex items-center gap-2">
                            <i class="pi pi-th-large"></i>
                            <span>전체</span>
                            <Tag :value="unifiedItems.length"
                                class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0"
                                rounded />
                        </div>
                    </template>

                    <div class="p-4 space-y-4">
                        <!-- 전체 검색 바 -->
                        <div class="flex items-center gap-3">
                            <IconField class="flex-1">
                                <InputIcon class="pi pi-search" />
                                <InputText v-model="allSearch" placeholder="사업명/계약명, 담당부서, 담당자 검색..." class="w-full" />
                            </IconField>
                        </div>

                        <!-- 전체 통합 DataTable -->
                        <DataTable :value="filteredAll" paginator :rows="10" sortField="lstChgDtm" :sortOrder="-1"
                            dataKey="_id" tableStyle="min-width: 50rem" :pt="{
                                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                            }">
                            <!-- 구분: 정보화사업/전산업무비 태그 -->
                            <Column field="_type" header="구분" sortable style="width: 100px">
                                <template #body="slotProps">
                                    <Tag :value="slotProps.data._type"
                                        :class="slotProps.data._type === '사업'
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'" class="border-0"
                                        rounded />
                                </template>
                            </Column>
                            <!-- 사업명/계약명: 상세 페이지 링크 -->
                            <Column field="name" header="사업명/계약명" sortable headerClass="font-bold">
                                <template #body="slotProps">
                                    <NuxtLink :to="slotProps.data._link"
                                        class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                        {{ slotProps.data.name }}
                                    </NuxtLink>
                                </template>
                            </Column>
                            <!-- 신규/계속 -->
                            <Column field="category" header="신규/계속" sortable>
                                <template #body="slotProps">
                                    <Tag :value="slotProps.data.category"
                                        :class="getPrjTypeClass(slotProps.data.category)" class="border-0" rounded />
                                </template>
                            </Column>
                            <!-- 총 예산 -->
                            <Column field="totalBg" :header="`총 예산`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.totalBg) }}{{ selectedUnit }}</span>
                                </template>
                            </Column>
                            <!-- 자본예산 -->
                            <Column field="assetBg" :header="`자본예산`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.assetBg) }}{{ selectedUnit }}</span>
                                </template>
                            </Column>
                            <!-- 일반관리비 -->
                            <Column field="costBg" :header="`일반관리비`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.costBg) }}{{ selectedUnit }}</span>
                                </template>
                            </Column>
                            <!-- 담당부서 -->
                            <Column field="deptNm" header="담당부서" sortable></Column>
                            <!-- 담당자 -->
                            <Column field="managerNm" header="담당자" sortable></Column>
                            <!-- 시작일 -->
                            <Column field="sttDt" header="시작일" sortable></Column>
                            <!-- 종료일 -->
                            <Column field="endDt" header="종료일" sortable></Column>
                            <!-- 결재현황 태그 -->
                            <Column field="apfSts" header="결재현황" sortable>
                                <template #body="slotProps">
                                    <Tag v-if="slotProps.data.apfSts" :value="slotProps.data.apfSts"
                                        :class="getApprovalTagClass(slotProps.data.apfSts)" class="border-0" rounded />
                                    <span v-else class="text-zinc-400">-</span>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- 정보화사업 탭 -->
                <TabPanel value="projects">
                    <template #header>
                        <div class="flex items-center gap-2">
                            <i class="pi pi-desktop"></i>
                            <span>정보화사업</span>
                            <Tag :value="projects.length"
                                class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0"
                                rounded />
                        </div>
                    </template>

                    <div class="p-4 space-y-4">
                        <!-- 정보화사업 검색 바 -->
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
                        <DataTable v-else :value="filteredProjects" paginator :rows="10" sortField="lstChgDtm"
                            :sortOrder="-1" dataKey="prjMngNo" tableStyle="min-width: 50rem" :pt="{
                                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                            }">
                            <!-- 사업명: 상세 페이지 링크 -->
                            <Column field="prjNm" header="사업명" sortable headerClass="font-bold">
                                <template #body="slotProps">
                                    <NuxtLink :to="`/info/projects/${slotProps.data.prjMngNo}`"
                                        class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                        {{ slotProps.data.prjNm }}
                                    </NuxtLink>
                                </template>
                            </Column>
                            <!-- 신규/계속 태그 -->
                            <Column field="prjTp" header="신규/계속" sortable>
                                <template #body="slotProps">
                                    <Tag :value="slotProps.data.prjTp" :class="getPrjTypeClass(slotProps.data.prjTp)"
                                        class="border-0" rounded />
                                </template>
                            </Column>
                            <!-- 총 예산 -->
                            <Column field="prjBg" :header="`총 예산 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.prjBg) }}</span>
                                </template>
                            </Column>
                            <!-- 자본예산 -->
                            <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.assetBg || 0) }}</span>
                                </template>
                            </Column>
                            <!-- 일반관리비 -->
                            <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.costBg || 0) }}</span>
                                </template>
                            </Column>
                            <!-- 담당부서 -->
                            <Column field="svnDpmNm" header="담당부서" sortable></Column>
                            <!-- 담당자 -->
                            <Column field="svnDpmCgprNm" header="담당자" sortable></Column>
                            <!-- 시작일 -->
                            <Column field="sttDt" header="시작일" sortable></Column>
                            <!-- 종료일 -->
                            <Column field="endDt" header="종료일" sortable></Column>
                            <!-- 결재현황 태그 -->
                            <Column field="apfSts" header="결재현황" sortable>
                                <template #body="slotProps">
                                    <Tag :value="slotProps.data.apfSts"
                                        :class="getApprovalTagClass(slotProps.data.apfSts)" class="border-0" rounded />
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
                            <Tag :value="costs.length"
                                class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0"
                                rounded />
                        </div>
                    </template>

                    <div class="p-4 space-y-4">
                        <!-- 전산업무비 검색 바 -->
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
                        <DataTable v-else :value="filteredCosts" paginator :rows="10" sortField="lstChgDtm"
                            :sortOrder="-1" dataKey="itMngcNo" tableStyle="min-width: 50rem" :pt="{
                                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                            }">
                            <!-- 계약명: 상세 페이지 링크 -->
                            <Column field="cttNm" header="계약명" sortable headerClass="font-bold">
                                <template #body="slotProps">
                                    <NuxtLink :to="`/info/cost/${slotProps.data.itMngcNo}`"
                                        class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                        {{ slotProps.data.cttNm }}
                                    </NuxtLink>
                                </template>
                            </Column>
                            <!-- 신규/계속 -->
                            <Column field="cttTp" header="신규/계속" sortable></Column>
                            <!-- 총 예산 -->
                            <Column field="itMngcBg" :header="`총 예산 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.itMngcBg) }}</span>
                                </template>
                            </Column>
                            <!-- 자본예산 -->
                            <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.assetBg || 0) }}</span>
                                </template>
                            </Column>
                            <!-- 일반관리비 -->
                            <Column field="itMngcBg" :header="`일반관리비 (${selectedUnit})`" sortable>
                                <template #body="slotProps">
                                    <span>{{ formatBudget(slotProps.data.itMngcBg || 0) }}</span>
                                </template>
                            </Column>
                            <!-- 담당부서 -->
                            <Column field="pulDpmNm" header="담당부서" sortable></Column>
                            <!-- 담당자 -->
                            <Column field="pulCgprNm" header="담당자" sortable></Column>
                            <!-- 시작일 -->
                            <Column field="fstDfrDt" header="시작일" sortable></Column>
                            <!-- 종료일 -->
                            <Column field="fstDfrDt" header="종료일" sortable></Column>
                            <!-- 결재현황 태그 -->
                            <Column field="apfSts" header="결재현황" sortable>
                                <template #body="slotProps">
                                    <Tag v-if="slotProps.data.apfSts" :value="slotProps.data.apfSts"
                                        :class="getApprovalTagClass(slotProps.data.apfSts)" class="border-0" rounded />
                                    <span v-else class="text-zinc-400">-</span>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>
            </TabView>
        </div>
    </div>
</template>

<style scoped>
/** 탭 버튼에 패딩을 적용하여 inkbar 길이 보정 (li 대신 버튼 안쪽에 패딩) */
:deep(.p-tabview-tablist-item .p-tab),
:deep(.p-tablist .p-tab) {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
}

/** 탭 간 여백 추가 */
:deep(.p-tablist-tab-list) {
    gap: 0.5rem;
}
</style>
