<!--
================================================================================
[pages/budget/approval.vue] 전산예산 결재 상신 페이지
================================================================================
정보화사업과 전산업무비 통합 목록에서 항목을 선택하여
전자결재를 상신하는 페이지입니다.

[주요 기능]
  - 전체 통합 DataTable (정보화사업 + 전산업무비): 체크박스 다중 선택
  - 검색: 사업명/계약명, 담당부서, 담당자
  - 이미 결재 진행 중인 항목은 선택 비활성화 (apfSts 존재 시)
  - 결재 상신: 선택된 항목 ID를 sessionStorage에 저장 후 /budget/report 이동

[결재 상신 로직]
  - 선택된 정보화사업 prjMngNo → sessionStorage('selectedBudgetProjectIds')
  - 선택된 전산업무비 itMngcNo  → sessionStorage('selectedBudgetCostIds')
  - /budget/report 페이지에서 상세 데이터 조회 + 결재 라인 지정 + 상신 처리
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import * as XLSX from 'xlsx';
import { useProjects, type Project, type ProjectDetail } from '~/composables/useProjects';
import { useCost, type ItCost } from '~/composables/useCost';
import { useAuth } from '~/composables/useAuth';
import { usePdfReport } from '~/composables/usePdfReport';
import { formatBudget as formatBudgetUtil, formatKoreanDate } from '~/utils/common';

definePageMeta({
    title: '전산예산 결재 상신'
});

/* ── 데이터 조회 ── */
const { fetchProjects, fetchProjectsBulk } = useProjects();
/* apfSts=none: 결재 신청이 없는 항목(미상신)만 조회 */
const { data: projectsData } = await fetchProjects({ apfSts: 'none' });
/** 정보화사업 목록 */
const projects = computed(() => projectsData.value || []);

const { fetchCosts, fetchCostsBulk } = useCost();
/* apfSts=none: 결재 신청이 없는 항목(미상신)만 조회 */
const { data: costsData } = await fetchCosts({ apfSts: 'none' });
/** 전산업무비 목록 */
const costs = computed(() => costsData.value || []);

/**
 * [UnifiedBudgetItem] 통합 예산 항목 인터페이스
 * 정보화사업과 전산업무비를 하나의 공통 구조로 매핑합니다.
 */
interface UnifiedBudgetItem {
    _id: string;
    _type: string;       // '사업' | '비용' | '경상'
    _link: string;
    name: string;
    category: string;
    bgYy: string;
    totalBg: number;
    assetBg: number;
    costBg: number;
    deptNm: string;
    managerNm: string;
    sttDt: string;
    endDt: string;
    lstChgDtm: string;
}

/**
 * 정보화사업 + 전산업무비 통합 목록 매핑
 */
const unifiedItems = computed<UnifiedBudgetItem[]>(() => {
    const projectItems: UnifiedBudgetItem[] = projects.value.map((p: Project) => ({
        _id: p.prjMngNo,
        _type: (p as any).ornYn === 'Y' ? '경상' : '사업',
        _link: `/info/projects/${p.prjMngNo}`,
        name: p.prjNm,
        category: (p as any).pulDtt || '',
        bgYy: String(p.bgYy || ''),
        totalBg: p.prjBg || 0,
        assetBg: p.assetBg || 0,
        costBg: p.costBg || 0,
        deptNm: p.svnDpmNm || '',
        managerNm: p.svnDpmCgprNm || '',
        sttDt: p.sttDt || '',
        endDt: p.endDt || '',
        lstChgDtm: (p as any).lstChgDtm || ''
    }));

    /* 전산업무비 매핑 (assetBg/costBg는 백엔드에서 비목코드 기준으로 계산) */
    const costItems: UnifiedBudgetItem[] = costs.value.map((c: ItCost) => ({
        _id: c.itMngcNo || '',
        _type: '비용',
        _link: '/info/cost/',
        name: c.cttNm,
        category: c.pulDtt || '',
        bgYy: String(c.bgYy || ''),
        totalBg: c.itMngcBg || 0,
        assetBg: c.assetBg || 0,
        costBg: c.costBg || 0,
        deptNm: c.biceDpmNm || '',
        managerNm: c.cgprNm || '',
        sttDt: typeof c.fstDfrDt === 'string' ? c.fstDfrDt : '',
        endDt: typeof c.fstDfrDt === 'string' ? c.fstDfrDt : '',
        lstChgDtm: (c as any).lstChgDtm || ''
    }));

    return [...projectItems, ...costItems];
});

/* ── 예산 단위 변환 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');

/**
 * 예산 금액을 선택된 단위로 변환
 * @param amount - 원(KRW) 단위 금액
 */
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);

/**
 * 항목 유형 태그 색상 클래스
 */
const getPrjTypeClass = (type: string) =>
    type === '신규'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';

/* ── 검색 ── */
/** 텍스트 검색어 */
const search = ref('');

/* ── 페이지 크기 ── */
const pageSizeOptions = [
    { label: '10건', value: 10 },
    { label: '20건', value: 20 },
    { label: '50건', value: 50 }
];
const pageSize = ref(10);

/* ── 체크박스 선택 관리 ── */
/** 선택된 통합 항목 목록 */
const selectedItems = ref<UnifiedBudgetItem[]>([]);

/**
 * 선택 가능한 항목이 모두 선택됐을 때 true
 */
const headerChecked = computed(() => {
    return filteredItems.value.length > 0 && selectedItems.value.length === filteredItems.value.length;
});

/** 일부만 선택된 경우 인디터미네이트 */
const headerIndeterminate = computed(() =>
    selectedItems.value.length > 0 && !headerChecked.value
);

/** 헤더 체크박스: 전체 선택 / 전체 해제 */
const toggleSelectAll = (val: boolean) => {
    selectedItems.value = val ? [...filteredItems.value] : [];
};

/** 행 선택 여부 확인 */
const isSelected = (data: UnifiedBudgetItem) =>
    selectedItems.value.some(i => i._id === data._id);

/** 개별 행 토글 */
const toggleRow = (data: UnifiedBudgetItem, val: boolean) => {
    selectedItems.value = val
        ? [...selectedItems.value, data]
        : selectedItems.value.filter(i => i._id !== data._id);
};

/** 선택된 정보화사업 건수 */
const selectedProjectCount = computed(() =>
    selectedItems.value.filter(i => i._type === '사업').length
);

/** 선택된 경상사업 건수 */
const selectedOrdinaryCount = computed(() =>
    selectedItems.value.filter(i => i._type === '경상').length
);

/** 선택된 전산업무비 건수 */
const selectedCostCount = computed(() =>
    selectedItems.value.filter(i => i._type === '비용').length
);

/** 결재 상신 버튼 활성화 여부 */
const hasSelection = computed(() => selectedItems.value.length > 0);

/**
 * 선택 초기화
 */
const clearSelection = () => {
    selectedItems.value = [];
};

/**
 * 결재 상신 처리
 * 선택된 항목의 ID를 유형별로 분리하여 sessionStorage에 저장 후
 * /budget/report 페이지로 이동합니다.
 */
const requestApproval = () => {
    if (!hasSelection.value) {
        alert('결재할 항목을 선택해주세요.');
        return;
    }

    if (process.client) {
        const projectIds = selectedItems.value
            .filter(i => i._type === '사업' || i._type === '경상')
            .map(i => i._id);
        const costIds = selectedItems.value
            .filter(i => i._type === '비용')
            .map(i => i._id);

        sessionStorage.setItem('selectedBudgetProjectIds', JSON.stringify(projectIds));
        sessionStorage.setItem('selectedBudgetCostIds', JSON.stringify(costIds));
    }

    navigateTo('/budget/report');
};

/**
 * 현재 조회 필터가 적용된 항목 ID 셋 (카드 통계에 사용)
 * 선택된 항목이 있으면 선택된 것만, 없으면 필터링된 목록 기준으로 표시합니다.
 */
const cardSourceItems = computed(() =>
    hasSelection.value ? selectedItems.value : filteredItems.value
);

/**
 * BudgetSummaryCards에 전달할 정보화사업/경상사업/전산업무비 목록
 * cardSourceItems를 한 번만 순회하여 유형별 ID 셋을 구성합니다.
 */
const categorizedCards = computed(() => {
    const projectIds = new Set<string>();
    const ordinaryIds = new Set<string>();
    const costIds = new Set<string>();
    for (const item of cardSourceItems.value) {
        if (item._type === '사업') projectIds.add(item._id);
        else if (item._type === '경상') ordinaryIds.add(item._id);
        else costIds.add(item._id);
    }
    return {
        projects: projects.value.filter(p => (p as any).ornYn !== 'Y' && projectIds.has(p.prjMngNo)),
        ordinary: projects.value.filter(p => (p as any).ornYn === 'Y' && ordinaryIds.has(p.prjMngNo)),
        costs: costs.value.filter(c => costIds.has(c.itMngcNo || ''))
    };
});

/* ── 조회 필터 Drawer ── */
/** Drawer 표시 여부 */
const visibleDrawer = ref(false);

/**
 * [ApprovalFilters] 결재 상신 페이지 조회 필터 구조
 */
interface ApprovalFilters {
    type: string[];        // 구분 (사업/비용/경상)
    bgYy: string;          // 예산연도
    category: string[];    // 신규/계속
    totalBgMin: number | null;  // 총예산 최소
    totalBgMax: number | null;  // 총예산 최대
    assetBgMin: number | null;  // 자본예산 최소
    assetBgMax: number | null;  // 자본예산 최대
    costBgMin: number | null;   // 일반관리비 최소
    costBgMax: number | null;   // 일반관리비 최대
    deptNm: string[];      // 담당부서
}

/* ── 예산연도 기본값: 1~9월 → 올해, 10~12월 → 내년 ── */
const now = new Date();
const defaultBgYy = now.getMonth() < 9
    ? String(now.getFullYear())
    : String(now.getFullYear() + 1);

/** 예산연도 옵션 (전년/올해/내년) */
const bgYyOptions = [
    String(now.getFullYear() - 1),
    String(now.getFullYear()),
    String(now.getFullYear() + 1),
];

/** 신규/계속 옵션 (데이터에서 추출) */
const categoryOptions = computed(() =>
    [...new Set(unifiedItems.value.map(i => i.category).filter(Boolean))]
);

/** 현재 적용된 조회 필터 */
const filters = ref<ApprovalFilters>({
    type: [],
    bgYy: defaultBgYy,
    category: [],
    totalBgMin: null,
    totalBgMax: null,
    assetBgMin: null,
    assetBgMax: null,
    costBgMin: null,
    costBgMax: null,
    deptNm: []
});

/** 필터 적용 여부 (조회 버튼 뱃지 표시용) */
const hasFilters = computed(() => {
    const f = filters.value;
    return f.type.length > 0 ||
        f.bgYy !== defaultBgYy ||
        f.category.length > 0 ||
        f.totalBgMin !== null || f.totalBgMax !== null ||
        f.assetBgMin !== null || f.assetBgMax !== null ||
        f.costBgMin !== null || f.costBgMax !== null ||
        f.deptNm.length > 0;
});

/** 구분 AutoComplete 옵션 */
const typeOptions = ['사업', '비용', '경상'];

/** 담당부서 AutoComplete 검색 결과 */
const deptSuggestions = ref<string[]>([]);

/**
 * 담당부서 AutoComplete 검색
 * @param query - 검색어
 */
const searchDept = (query: string) => {
    const allDepts = Array.from(new Set(unifiedItems.value.map(i => i.deptNm).filter(Boolean)));
    deptSuggestions.value = query
        ? allDepts.filter(d => d.toLowerCase().includes(query.toLowerCase()))
        : allDepts;
};

/** 필터 초기화 */
const resetFilters = () => {
    filters.value = {
        type: [], bgYy: '', category: [],
        totalBgMin: null, totalBgMax: null,
        assetBgMin: null, assetBgMax: null,
        costBgMin: null, costBgMax: null,
        deptNm: []
    };
};

/**
 * 필터가 적용된 통합 목록
 * 기존 텍스트 검색(search)과 Drawer 필터를 모두 적용합니다.
 */
const filteredItems = computed(() =>
    unifiedItems.value.filter(item => {
        const f = filters.value;
        /* 텍스트 검색 */
        if (search.value) {
            const kw = search.value.toLowerCase();
            const textMatch =
                item.name?.toLowerCase().includes(kw) ||
                item.deptNm?.toLowerCase().includes(kw) ||
                item.managerNm?.toLowerCase().includes(kw);
            if (!textMatch) return false;
        }
        /* 구분 필터 */
        if (f.type.length > 0 && !f.type.includes(item._type)) return false;
        /* 예산연도 필터 */
        if (f.bgYy && item.bgYy !== f.bgYy) return false;
        /* 신규/계속 필터 */
        if (f.category.length > 0 && !f.category.includes(item.category)) return false;
        /* 총예산 범위 필터 */
        if (f.totalBgMin !== null && item.totalBg < f.totalBgMin) return false;
        if (f.totalBgMax !== null && item.totalBg > f.totalBgMax) return false;
        /* 자본예산 범위 필터 */
        if (f.assetBgMin !== null && item.assetBg < f.assetBgMin) return false;
        if (f.assetBgMax !== null && item.assetBg > f.assetBgMax) return false;
        /* 일반관리비 범위 필터 */
        if (f.costBgMin !== null && item.costBg < f.costBgMin) return false;
        if (f.costBgMax !== null && item.costBg > f.costBgMax) return false;
        /* 담당부서 필터 */
        if (f.deptNm.length > 0 && !f.deptNm.includes(item.deptNm)) return false;
        return true;
    })
);

/* ── 엑셀 다운로드 ── */
/**
 * 현재 필터링된 통합 목록을 엑셀로 저장합니다.
 */
const downloadExcel = () => {
    const rows = filteredItems.value.map(item => ({
        '구분': item._type,
        '사업명/계약명': item.name,
        '유형': item.category,
        '총 예산(원)': item.totalBg,
        '자본예산(원)': item.assetBg,
        '일반관리비(원)': item.costBg,
        '담당부서': item.deptNm,
        '담당자': item.managerNm,
        '시작일': item.sttDt,
        '종료일': item.endDt
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '결재상신목록');
    XLSX.writeFile(wb, `결재상신목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/* ── PDF 보고서 다운로드 ── */
/** PDF 생성 로딩 상태 */
const reportLoading = ref(false);
/** 마지막으로 생성된 PDF Blob URL (메모리 해제용) */
const lastPdfUrl = ref<string | null>(null);
const { user } = useAuth();
const { generateReport } = usePdfReport();

/**
 * 현재 필터링된 목록을 기준으로 PDF 보고서를 생성합니다.
 */
const downloadPdf = async () => {
    reportLoading.value = true;
    try {
        const projectIds = filteredItems.value.filter(i => i._type === '사업' || i._type === '경상').map(i => i._id);
        const costIds = filteredItems.value.filter(i => i._type === '비용').map(i => i._id);

        const [projectDetails, costDetails]: [ProjectDetail[], ItCost[]] = await Promise.all([
            projectIds.length ? fetchProjectsBulk(projectIds) : Promise.resolve([]),
            costIds.length ? fetchCostsBulk(costIds) : Promise.resolve([])
        ]);

        const approvalLine = {
            drafter: { name: user.value?.empNm || '', rank: '', date: formatKoreanDate(), id: user.value?.eno || '' },
            teamLead: { name: '', rank: '', date: '', id: '' },
            deptHead: { name: '', rank: '', date: '', id: '' }
        };

        const url = await generateReport(projectDetails, approvalLine, costDetails);
        if (url) {
            /* 이전 Blob URL 메모리 해제 */
            if (lastPdfUrl.value) URL.revokeObjectURL(lastPdfUrl.value);
            lastPdfUrl.value = url;
            window.open(url, '_blank');
        }
    } catch (e) {
        console.error('PDF 생성 실패:', e);
        alert('PDF 보고서 생성에 실패했습니다.');
    } finally {
        reportLoading.value = false;
    }
};

onBeforeUnmount(() => {
    if (lastPdfUrl.value) URL.revokeObjectURL(lastPdfUrl.value);
});

</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <!-- 좌측: 제목 + 선택 현황 칩 -->
            <div class="flex items-end gap-3">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">결재 상신</h1>
                <h5 class="text-zinc-500 dark:text-zinc-400">
                    <i class="pi pi-info-circle text-zinc-400 me-1"></i>
                    <span>상신할 예산 목록을 체크 후 [결재 상신] 버튼을 클릭해주세요.</span>
                </h5>
                <!-- 선택 시에만 표시되는 인라인 칩 -->
                <div v-if="hasSelection"
                    class="flex items-center gap-1.5 text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-700">
                    <i class="pi pi-check-square text-purple-500 dark:text-purple-400 text-xs"></i>
                    <span v-if="selectedProjectCount > 0" class="font-semibold">사업 {{ selectedProjectCount }}건</span>
                    <span v-if="selectedProjectCount > 0 && selectedOrdinaryCount > 0"
                        class="text-purple-300 dark:text-purple-600">·</span>
                    <span v-if="selectedOrdinaryCount > 0" class="font-semibold">경상 {{ selectedOrdinaryCount }}건</span>
                    <span v-if="(selectedProjectCount > 0 || selectedOrdinaryCount > 0) && selectedCostCount > 0"
                        class="text-purple-300 dark:text-purple-600">·</span>
                    <span v-if="selectedCostCount > 0" class="font-semibold">비용 {{ selectedCostCount }}건</span>
                    <i class="pi pi-times text-xs text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 ml-0.5 cursor-pointer"
                        @click="clearSelection"></i>
                </div>
            </div>
            <!-- 우측: 예산 단위 선택 + 결재 상신 버튼 -->
            <div class="flex items-center gap-4">
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="unit-selector" />
                <Button label="결재 상신" icon="pi pi-send" severity="help" @click="requestApproval"
                    :disabled="!hasSelection" :badge="hasSelection ? String(selectedItems.length) : undefined" />
            </div>
        </div>

        <!-- 예산 현황 요약 카드 -->
        <BudgetSummaryCards :projects="categorizedCards.projects" :costs="categorizedCards.costs" :ordinary="categorizedCards.ordinary"
            :selectedUnit="selectedUnit" />

        <!-- 통합 DataTable -->
        <div
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

            <!-- 검색 바 (list.vue 동일 구조: 좌-구분선-중앙-구분선-우) -->
            <div class="flex items-stretch border-b border-zinc-200 dark:border-zinc-800">
                <!-- 좌측: 페이지당 표시 건수 -->
                <div class="flex items-center px-3 shrink-0">
                    <Select v-model="pageSize" :options="pageSizeOptions" optionLabel="label" optionValue="value"
                        class="shrink-0" />
                </div>

                <!-- 여백 (flex-1) -->
                <div class="flex-1"></div>

                <!-- 우측: 통합검색 + 액션 버튼 -->
                <div class="flex items-center gap-2 px-3 py-2 shrink-0">
                    <IconField class="w-[30rem] shrink-0">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="search" placeholder="사업명/계약명, 담당부서, 담당자 검색..." class="w-full" />
                    </IconField>
                    <BudgetTableActions :reportLoading="reportLoading" :hasFilters="hasFilters" @excel="downloadExcel"
                        @pdf="downloadPdf" @filter="visibleDrawer = true" />
                </div>
            </div>

            <!-- 통합 DataTable -->
            <DataTable :value="filteredItems" paginator :rows="pageSize" dataKey="_id" sortField="lstChgDtm"
                :sortOrder="-1" tableStyle="min-width: 50rem"
                :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
                }">

                <!-- 커스텀 체크박스 컬럼 -->
                <Column headerStyle="width: 3rem">
                    <template #header>
                        <Checkbox binary :modelValue="headerChecked" :indeterminate="headerIndeterminate"
                            @update:modelValue="toggleSelectAll" />
                    </template>
                    <template #body="{ data }">
                        <Checkbox binary :modelValue="isSelected(data)"
                            @update:modelValue="(val: boolean) => toggleRow(data, val)" />
                    </template>
                </Column>

                <!-- 구분: 사업 / 비용 / 경상 태그 -->
                <Column field="_type" header="구분" sortable style="width: 100px">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data._type" :class="slotProps.data._type === '사업'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : slotProps.data._type === '경상'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 예산연도 -->
                <Column field="bgYy" header="예산연도" sortable style="min-width: 120px"></Column>

                <!-- 사업명/계약명: 상세 링크 -->
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
                        <Tag :value="slotProps.data.category" :class="getPrjTypeClass(slotProps.data.category)"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 총 예산 -->
                <Column field="totalBg" header="총 예산" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.totalBg) }}{{ selectedUnit }}</span>
                    </template>
                </Column>

                <!-- 자본예산 -->
                <Column field="assetBg" header="자본예산" sortable>
                    <template #body="slotProps">
                        <span>{{ formatBudget(slotProps.data.assetBg) }}{{ selectedUnit }}</span>
                    </template>
                </Column>

                <!-- 일반관리비 -->
                <Column field="costBg" header="일반관리비" sortable>
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

            </DataTable>
        </div>

        <!-- 조회 필터 Drawer -->
        <Drawer v-model:visible="visibleDrawer" header="상세 조회" position="right" class="!w-full md:!w-[480px]">
            <div class="flex flex-col gap-6 py-2">

                <!-- 예산연도 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">예산연도</label>
                    <SelectButton v-model="filters.bgYy" :options="bgYyOptions" :allowEmpty="true" />
                </div>

                <!-- 구분 필터 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">구분</label>
                    <div class="flex gap-2 flex-wrap">
                        <Button v-for="opt in typeOptions" :key="opt" :label="opt" size="small" outlined
                            :severity="filters.type.includes(opt) ? 'primary' : 'secondary'" @click="filters.type.includes(opt)
                                ? filters.type.splice(filters.type.indexOf(opt), 1)
                                : filters.type.push(opt)" />
                    </div>
                </div>

                <!-- 신규/계속 필터 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">신규/계속</label>
                    <div class="flex gap-2 flex-wrap">
                        <Button v-for="opt in categoryOptions" :key="opt" :label="opt" size="small" outlined
                            :severity="filters.category.includes(opt) ? 'primary' : 'secondary'" @click="filters.category.includes(opt)
                                ? filters.category.splice(filters.category.indexOf(opt), 1)
                                : filters.category.push(opt)" />
                    </div>
                </div>

                <!-- 총예산 범위 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">총예산 (원)</label>
                    <div class="flex gap-2">
                        <InputNumber v-model="filters.totalBgMin" placeholder="최소" mode="currency" currency="KRW"
                            locale="ko-KR" :minFractionDigits="0" class="flex-1" />
                        <span class="self-center text-zinc-400">~</span>
                        <InputNumber v-model="filters.totalBgMax" placeholder="최대" mode="currency" currency="KRW"
                            locale="ko-KR" :minFractionDigits="0" class="flex-1" />
                    </div>
                </div>

                <!-- 자본예산 범위 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">자본예산 (원)</label>
                    <div class="flex gap-2">
                        <InputNumber v-model="filters.assetBgMin" placeholder="최소" mode="currency" currency="KRW"
                            locale="ko-KR" :minFractionDigits="0" class="flex-1" />
                        <span class="self-center text-zinc-400">~</span>
                        <InputNumber v-model="filters.assetBgMax" placeholder="최대" mode="currency" currency="KRW"
                            locale="ko-KR" :minFractionDigits="0" class="flex-1" />
                    </div>
                </div>

                <!-- 일반관리비 범위 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">일반관리비 (원)</label>
                    <div class="flex gap-2">
                        <InputNumber v-model="filters.costBgMin" placeholder="최소" mode="currency" currency="KRW"
                            locale="ko-KR" :minFractionDigits="0" class="flex-1" />
                        <span class="self-center text-zinc-400">~</span>
                        <InputNumber v-model="filters.costBgMax" placeholder="최대" mode="currency" currency="KRW"
                            locale="ko-KR" :minFractionDigits="0" class="flex-1" />
                    </div>
                </div>

                <!-- 담당부서 필터 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">담당부서</label>
                    <AutoComplete v-model="filters.deptNm" :suggestions="deptSuggestions" multiple fluid
                        @complete="searchDept($event.query)" placeholder="부서명 검색..." />
                </div>

            </div>

            <!-- Drawer 푸터: 초기화 -->
            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="초기화" icon="pi pi-refresh" severity="secondary" outlined @click="resetFilters" />
                    <Button label="닫기" icon="pi pi-times" @click="visibleDrawer = false" />
                </div>
            </template>
        </Drawer>

    </div>
</template>
