<!--
================================================================================
[pages/info/plan/form.vue] 정보기술부문 계획 등록 페이지
================================================================================
연도별 IT 부문 계획을 등록하는 화면입니다.

[업무 흐름]
  1. 대상년도(YYYY) 입력
  2. 계획구분(신규/조정) 선택
  3. 해당 연도의 정보화사업 + 전산업무비 목록 조회 후 체크박스로 다중 선택
  4. [생성] 버튼 클릭 → 선택된 사업들의 예산 총계, 부문별/사업유형별 목록 미리보기 표시
  5. [저장] 버튼 클릭 → BPLANM + BPROJA 저장, 목록 페이지로 이동

[데이터 흐름]
  - 사업 목록: fetchProjects({ bgYy }) → 연도 필터 조회
  - 선택 사업 상세: fetchProjectsBulk(selectedIds) → 예산 집계용
  - 저장: createPlan({ plnYy, plnTp, prjMngNos })
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjects, type Project } from '~/composables/useProjects';
import { useCost, type ItCost } from '~/composables/useCost';
import { usePlan, type PlanProjectItem } from '~/composables/usePlan';
import { formatBudget as formatBudgetUtil } from '~/utils/common';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import { useTableCellSelection } from '~/composables/useTableCellSelection';
import { useTableColumnResize } from '~/composables/useTableColumnResize';

/**
 * 정보화사업과 전산업무비를 통합하여 표시하기 위한 인터페이스
 * sourceType으로 원본 데이터 구분
 */
interface UnifiedProject {
    /** 관리번호 (prjMngNo 또는 itMngcNo) */
    id: string;
    /** 원본 구분 ('project' | 'cost') */
    sourceType: 'project' | 'cost';
    /** 사업명/계약명 */
    prjNm: string;
    /** 사업유형 */
    prjTp: string;
    /** 주관부문 */
    svnHdq: string;
    /** 주관부서명/담당부서명 */
    svnDpmNm: string;
    /** 총예산 */
    prjBg: number;
    /** 자본예산 */
    assetBg: number;
    /** 일반관리비 */
    costBg: number;
    /** 원본 관리번호 (프로젝트: prjMngNo, 전산업무비: itMngcNo) */
    prjMngNo: string;
}

/* 페이지 탭 제목 설정 */
const title = '정보기술부문 계획 등록';
// key: fullPath 기준으로 KeepAlive 캐시 분리 → 쿼리 파라미터가 다른 탭마다 별개 인스턴스
definePageMeta({ title, key: route => route.fullPath });

const { fetchProjectsBulk } = useProjects();
const { fetchCostsBulk } = useCost();
const { createPlan } = usePlan();
const route = useRoute();
const router = useRouter();
const { removeTab } = useTabs();
const config = useRuntimeConfig();
const { $apiFetch } = useNuxtApp();

/* ── 입력 폼 상태 ── */
/** 대상년도 (YYYY 형식) */
const plnYy = ref<string>(String(new Date().getFullYear()));

/** 계획구분 옵션 */
const plnTpOptions = ['신규', '조정'];
const plnTp = ref<string>('신규');

/* ── 공통코드 코드명 변환 ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP');
const { getCodeName: getItMngcTpName } = useCodeOptions('IT_MNGC_TP');

/* ── 사업 목록 조회 상태 ── */
/** 조회된 통합 사업 목록 (정보화사업 + 전산업무비) */
const projects = ref<UnifiedProject[]>([]);

/** 사업 목록 조회 중 여부 */
const projectsPending = ref(false);

/** 조회 완료 여부 (최초 조회 전에는 안내 문구 표시) */
const searched = ref(false);

/** 체크박스로 선택된 사업 목록 */
const selectedProjects = ref<UnifiedProject[]>([]);

/* ── 예산 단위 선택 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');

/**
 * 예산 금액을 선택된 단위로 변환하여 반환
 */
const formatBudget = (amount: number | undefined | null) => {
    if (amount == null) return '-';
    return formatBudgetUtil(amount, selectedUnit.value);
};

/* ── 미리보기 (생성 버튼 클릭 후) ── */
/** 미리보기 표시 여부 */
const previewVisible = ref(false);

/**
 * [조회] 버튼 클릭 핸들러
 * 입력된 대상년도로 정보화사업 목록을 조회합니다.
 */
const handleSearch = async () => {
    if (!plnYy.value || plnYy.value.length !== 4) {
        alert('대상년도를 올바르게 입력해주세요. (예: 2026)');
        return;
    }

    // 이전 선택 및 미리보기 초기화
    selectedProjects.value = [];
    previewVisible.value = false;

    projectsPending.value = true;
    try {
        // 정보화사업과 전산업무비를 병렬 조회
        const [prjResult, costResult] = await Promise.all([
            $apiFetch<Project[]>(
                `${config.public.apiBase}/api/projects`,
                { query: { bgYy: plnYy.value } }
            ),
            $apiFetch<ItCost[]>(
                `${config.public.apiBase}/api/cost`,
                { query: { bgYy: plnYy.value } }
            ),
        ]);

        // 정보화사업 → 통합 형식 변환
        const unifiedProjects: UnifiedProject[] = (prjResult || []).map(p => ({
            id: p.prjMngNo,
            sourceType: 'project' as const,
            prjNm: p.prjNm,
            prjTp: p.prjTp,
            svnHdq: p.svnHdq,
            svnDpmNm: p.svnDpmNm,
            prjBg: p.prjBg,
            assetBg: p.assetBg,
            costBg: p.costBg,
            prjMngNo: p.prjMngNo,
        }));

        // 전산업무비 → 통합 형식 변환
        const unifiedCosts: UnifiedProject[] = (costResult || []).map(c => ({
            id: c.itMngcNo!,
            sourceType: 'cost' as const,
            prjNm: c.cttNm,
            prjTp: c.itMngcTp,
            svnHdq: '',
            svnDpmNm: c.biceDpmNm || '',
            prjBg: c.itMngcBg,
            assetBg: c.assetBg || 0,
            costBg: c.costBg || 0,
            prjMngNo: c.itMngcNo!,
        }));

        projects.value = [...unifiedProjects, ...unifiedCosts];
        searched.value = true;
    } catch (e) {
        console.error('사업 목록 조회 실패:', e);
        alert('사업 목록 조회 중 오류가 발생했습니다.');
    } finally {
        projectsPending.value = false;
    }
};

/** 예산 총계 */
const totalBudget = ref({ ttlBg: 0, cptBg: 0, mngc: 0 });

/** 부문(SVN_HDQ)별 그룹 */
const byDepartment = ref<{ svnHdq: string; projects: PlanProjectItem[] }[]>([]);

/** 사업유형(PRJ_TP)별 그룹 */
const byProjectType = ref<{ prjTp: string; projects: PlanProjectItem[] }[]>([]);

/** 정보화사업 카드 테이블 행 타입 */
interface ItProjectRow {
    sector: string;                  // 부문/본부명
    subLabel: string;                // 하위 구분명 (국외점포 / IT / AI·DT / 빈칸)
    showSector: boolean;             // sector 셀 렌더링 여부 (IT·AI본부 두 번째 행은 false)
    sectorRowspan: number;           // sector 셀 rowspan (IT·AI본부 첫 번째 행: 2, 나머지: 1)
    hideSectorRightBorder: boolean;  // sector 셀 오른쪽 테두리 숨김 여부
    hideSectorBottomBorder: boolean; // sector 셀 아래쪽 테두리 숨김 여부
    newCount: number;                // 신규 건수
    continueCount: number;           // 계속 건수
    budgetBuk: number;               // 편성예산(억원)
    projects: string[];              // 주요사업 목록
}

/** 정보화사업 스냅샷 (정보화사업 카드 테이블 렌더링용) */
const prjSnapshotsRef = ref<PlanProjectItem[]>([]);

/** 정보화사업 테이블 컨테이너 ref (셀 선택/복사용) */
const itPrjTableRef = ref<HTMLElement | null>(null);
useTableCellSelection(itPrjTableRef);
useTableColumnResize(itPrjTableRef);

/**
 * 정보화사업 요약 테이블 행 계산
 * - 글로벌사업부문: 국외점포(svnDpm 9XX)를 별도 하위 행으로 분리
 * - IT·AI본부: svnDpm '185'는 AI·DT, 나머지는 IT로 분리
 */
const itProjectRows = computed((): ItProjectRow[] => {
    const rows: ItProjectRow[] = [];
    const snapshots = prjSnapshotsRef.value;
    if (!snapshots.length) return rows;

    const sectorMap = new Map<string, PlanProjectItem[]>();
    for (const p of snapshots) {
        const key = p.svnHdq || '미분류';
        if (!sectorMap.has(key)) sectorMap.set(key, []);
        sectorMap.get(key)!.push(p);
    }

    const makeRow = (
        items: PlanProjectItem[],
        sector: string,
        subLabel: string,
        showSector: boolean,
        sectorRowspan: number,
        hideSectorRightBorder: boolean,
        hideSectorBottomBorder: boolean
    ): ItProjectRow => ({
        sector,
        subLabel,
        showSector,
        sectorRowspan,
        hideSectorRightBorder,
        hideSectorBottomBorder,
        newCount: items.filter(p => p.pulDtt === 'PUL_DTT_001').length,
        continueCount: items.filter(p => p.pulDtt === 'PUL_DTT_002').length,
        budgetBuk: items.reduce((s, p) => s + (p.prjBg || 0), 0) / 100_000_000,
        projects: items.map(p => p.prjNm),
    });

    for (const [sector, items] of sectorMap.entries()) {
        if (sector === '글로벌사업부문') {
            // 국외점포(svnDpm이 9로 시작)를 하위 행으로 분리, rowspan=1 + 테두리 숨김으로 시각적 병합
            const domestic = items.filter(p => !String(p.svnDpm || '').startsWith('9'));
            const overseas = items.filter(p => String(p.svnDpm || '').startsWith('9'));
            if (domestic.length) rows.push(makeRow(domestic, sector, '', true, 1, true, !!overseas.length));
            if (overseas.length) rows.push(makeRow(overseas, domestic.length ? '' : sector, '국외점포', true, 1, false, false));
        } else if (sector.includes('IT·AI')) {
            // IT·AI본부: rowspan으로 sector 셀 병합 (원래 방식 유지)
            const itItems = items.filter(p => p.svnDpm !== '185');
            const aiItems = items.filter(p => p.svnDpm === '185');
            const span = (itItems.length ? 1 : 0) + (aiItems.length ? 1 : 0);
            if (itItems.length) rows.push(makeRow(itItems, sector, 'IT', true, span, false, false));
            if (aiItems.length) rows.push(makeRow(aiItems, sector, 'AI·DT', !itItems.length, 1, false, false));
        } else {
            rows.push(makeRow(items, sector, '', true, 1, true, false));
        }
    }

    return rows;
});

/** 생성 처리 중 여부 */
const generating = ref(false);

/**
 * [생성] 버튼 클릭 핸들러
 * 선택된 사업들의 상세 정보를 조회하여 예산 총계 및 그룹핑 미리보기를 표시합니다.
 */
const handleGenerate = async () => {
    if (selectedProjects.value.length === 0) {
        alert('대상사업을 1개 이상 선택해주세요.');
        return;
    }

    generating.value = true;
    try {
        // 선택된 항목을 정보화사업 / 전산업무비로 분리
        const selectedPrjs = selectedProjects.value.filter(p => p.sourceType === 'project');
        const selectedCosts = selectedProjects.value.filter(p => p.sourceType === 'cost');

        // 정보화사업 상세 조회 (선택된 항목이 있을 때만)
        const prjDetails = selectedPrjs.length > 0
            ? await fetchProjectsBulk(selectedPrjs.map(p => p.prjMngNo))
            : [];

        // 전산업무비 상세 조회 (선택된 항목이 있을 때만)
        const costDetails = selectedCosts.length > 0
            ? await fetchCostsBulk(selectedCosts.map(p => p.prjMngNo))
            : [];

        // 정보화사업 스냅샷 변환
        const prjSnapshots: PlanProjectItem[] = prjDetails.map(p => ({
            prjMngNo: p.prjMngNo,
            prjNm: p.prjNm,
            prjTp: p.prjTp,
            svnHdq: p.svnHdq || '미분류',
            svnDpm: p.svnDpm,
            svnDpmNm: p.svnDpmNm || '',
            prjBg: p.prjBg || 0,
            assetBg: p.assetBg || 0,
            costBg: p.costBg || 0,
            pulDtt: p.pulDtt || '',
        }));

        // 정보화사업 카드 테이블용 스냅샷 저장
        prjSnapshotsRef.value = prjSnapshots;

        // 전산업무비 스냅샷 변환
        const costSnapshots: PlanProjectItem[] = costDetails.map(c => ({
            prjMngNo: c.itMngcNo!,
            prjNm: c.cttNm,
            prjTp: c.itMngcTp,
            svnHdq: '미분류',
            svnDpm: c.biceDpm,
            svnDpmNm: c.biceDpmNm || '',
            prjBg: c.itMngcBg,
            assetBg: c.assetBg || 0,
            costBg: c.costBg || 0,
        }));

        const snapshots = [...prjSnapshots, ...costSnapshots];

        // 예산 총계 계산
        totalBudget.value = {
            ttlBg: snapshots.reduce((sum, p) => sum + (p.prjBg || 0), 0),
            cptBg: snapshots.reduce((sum, p) => sum + (p.assetBg || 0), 0),
            mngc: snapshots.reduce((sum, p) => sum + (p.costBg || 0), 0),
        };

        // 부문(SVN_HDQ)별 그룹핑
        const deptMap = new Map<string, PlanProjectItem[]>();
        for (const s of snapshots) {
            const key = s.svnHdq || '미분류';
            if (!deptMap.has(key)) deptMap.set(key, []);
            deptMap.get(key)!.push(s);
        }
        byDepartment.value = Array.from(deptMap.entries()).map(([svnHdq, projs]) => ({ svnHdq, projects: projs }));

        // 사업유형(PRJ_TP)별 그룹핑
        const typeMap = new Map<string, PlanProjectItem[]>();
        for (const s of snapshots) {
            const key = s.prjTp || '미분류';
            if (!typeMap.has(key)) typeMap.set(key, []);
            typeMap.get(key)!.push(s);
        }
        byProjectType.value = Array.from(typeMap.entries()).map(([prjTp, projs]) => ({ prjTp, projects: projs }));

        previewVisible.value = true;
    } catch (e) {
        console.error('사업 상세 조회 실패:', e);
        alert('사업 정보 조회 중 오류가 발생했습니다.');
    } finally {
        generating.value = false;
    }
};

/* ── 저장 처리 ── */
/** 저장 처리 중 여부 */
const saving = ref(false);

/**
 * [저장] 버튼 클릭 핸들러
 * 계획 정보와 대상 프로젝트 목록을 백엔드에 저장합니다.
 */
const handleSave = async () => {
    if (!plnYy.value || plnYy.value.length !== 4) {
        alert('대상년도를 올바르게 입력해주세요. (예: 2026)');
        return;
    }
    if (!plnTp.value) {
        alert('계획구분을 선택해주세요.');
        return;
    }
    if (selectedProjects.value.length === 0) {
        alert('대상사업을 1개 이상 선택해주세요.');
        return;
    }
    if (!previewVisible.value) {
        alert('[생성] 버튼을 먼저 클릭하여 미리보기를 확인해주세요.');
        return;
    }

    saving.value = true;
    try {
        // 정보화사업 / 전산업무비 관리번호 분리
        const prjMngNos = selectedProjects.value
            .filter(p => p.sourceType === 'project')
            .map(p => p.prjMngNo);
        const itMngcNos = selectedProjects.value
            .filter(p => p.sourceType === 'cost')
            .map(p => p.prjMngNo);

        await createPlan({
            plnYy: plnYy.value,
            plnTp: plnTp.value,
            prjMngNos,
            itMngcNos,
        });
        alert('계획이 등록되었습니다.');
        await router.push('/info/plan');
        removeTab(route.fullPath);
    } catch (e) {
        console.error('계획 저장 실패:', e);
        alert('계획 저장 중 오류가 발생했습니다.');
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더 -->
        <PageHeader :title="title">
            <template #actions>
                <SelectButton v-model="selectedUnit" :options="units" />
                <Button label="목록" icon="pi pi-list" severity="secondary" outlined @click="router.push('/info/plan')" />
            </template>
        </PageHeader>

        <!-- ① 기본 정보 입력 -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">기본 정보</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                <!-- 대상년도 입력 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        대상년도 <span class="text-red-500">*</span>
                    </label>
                    <div class="flex gap-2">
                        <InputText
                            v-model="plnYy"
                            placeholder="예: 2026"
                            maxlength="4"
                            class="flex-1"
                            @keyup.enter="handleSearch"
                        />
                        <Button
                            label="조회"
                            icon="pi pi-search"
                            :loading="projectsPending"
                            @click="handleSearch"
                        />
                    </div>
                    <small class="text-zinc-400">YYYY 형식으로 입력 후 [조회]를 클릭하세요.</small>
                </div>

                <!-- 계획구분 선택 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        계획구분 <span class="text-red-500">*</span>
                    </label>
                    <Select
                        v-model="plnTp"
                        :options="plnTpOptions"
                        placeholder="계획구분 선택"
                        class="w-full"
                    />
                </div>
            </div>
        </div>

        <!-- ② 대상사업 선택 -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    대상사업 선택
                    <span class="ml-2 text-sm font-normal text-zinc-500">
                        ({{ plnYy }}년도 사업 목록 · 선택: {{ selectedProjects.length }}건)
                    </span>
                </h2>
                <!-- 생성 버튼 -->
                <Button
                    label="생성"
                    icon="pi pi-refresh"
                    severity="info"
                    :loading="generating"
                    :disabled="selectedProjects.length === 0"
                    @click="handleGenerate"
                />
            </div>

            <!-- 미조회 안내 -->
            <div v-if="!searched && !projectsPending" class="flex items-center justify-center gap-2 text-zinc-400 py-10">
                <i class="pi pi-info-circle text-lg" />
                대상년도를 입력하고 [조회] 버튼을 클릭하세요.
            </div>

            <!-- 로딩 표시 -->
            <div v-else-if="projectsPending" class="flex items-center gap-2 text-zinc-500 py-4">
                <i class="pi pi-spin pi-spinner" />
                사업 목록을 불러오는 중...
            </div>

            <!-- 사업 목록 테이블 -->
            <StyledDataTable
                v-else
                v-model:selection="selectedProjects"
                :value="projects"
                data-key="id"
                paginator
                :rows="10"
                :rows-per-page-options="[10, 20, 50]"
            >
                <!-- 다중 선택 체크박스 -->
                <Column selection-mode="multiple" header-style="width: 3rem" />

                <!-- 구분 (정보화사업/전산업무비) -->
                <Column field="sourceType" header="구분" sortable header-class="font-bold" style="width: 7rem">
                    <template #body="slotProps">
                        <Tag
                            :value="slotProps.data.sourceType === 'project' ? '정보화사업' : '전산업무비'"
                            :severity="slotProps.data.sourceType === 'project' ? 'info' : 'warn'"
                        />
                    </template>
                </Column>

                <!-- 사업명 -->
                <Column field="prjNm" header="사업명" sortable header-class="font-bold" />

                <!-- 사업유형 -->
                <Column field="prjTp" header="사업유형" sortable header-class="font-bold" style="width: 8rem">
                    <template #body="slotProps">
                        {{ slotProps.data.sourceType === 'project'
                            ? getPrjTpName(slotProps.data.prjTp)
                            : getItMngcTpName(slotProps.data.prjTp) }}
                    </template>
                </Column>

                <!-- 주관부문 -->
                <Column field="svnHdq" header="주관부문" sortable header-class="font-bold" style="width: 10rem" />

                <!-- 주관부서명 -->
                <Column field="svnDpmNm" header="주관부서" sortable header-class="font-bold" style="width: 10rem" />

                <!-- 총예산 -->
                <Column field="prjBg" :header="`총예산 (${selectedUnit})`" sortable header-class="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.prjBg) }}</span>
                    </template>
                </Column>

                <!-- 자본예산 -->
                <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" sortable header-class="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.assetBg) }}</span>
                    </template>
                </Column>

                <!-- 일반관리비 -->
                <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" sortable header-class="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.costBg) }}</span>
                    </template>
                </Column>

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                        {{ plnYy }}년도에 해당하는 사업이 없습니다.
                    </div>
                </template>
            </StyledDataTable>
        </div>

        <!-- ③ 미리보기 (생성 버튼 클릭 후 표시) -->
        <template v-if="previewVisible">

            <!-- 예산 총계 카드 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">예산 총계</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- 총예산 -->
                    <div class="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-indigo-600 dark:text-indigo-300 font-medium mb-1">총예산</div>
                        <div class="text-2xl font-bold text-indigo-700 dark:text-indigo-200 tabular-nums">
                            {{ formatBudget(totalBudget.ttlBg) }}
                        </div>
                        <div class="text-xs text-indigo-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                    <!-- 자본예산 -->
                    <div class="bg-sky-50 dark:bg-sky-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-sky-600 dark:text-sky-300 font-medium mb-1">자본예산</div>
                        <div class="text-2xl font-bold text-sky-700 dark:text-sky-200 tabular-nums">
                            {{ formatBudget(totalBudget.cptBg) }}
                        </div>
                        <div class="text-xs text-sky-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                    <!-- 일반관리비 -->
                    <div class="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-4 text-center">
                        <div class="text-sm text-emerald-600 dark:text-emerald-300 font-medium mb-1">일반관리비</div>
                        <div class="text-2xl font-bold text-emerald-700 dark:text-emerald-200 tabular-nums">
                            {{ formatBudget(totalBudget.mngc) }}
                        </div>
                        <div class="text-xs text-emerald-400 mt-1">{{ selectedUnit }}</div>
                    </div>
                </div>
            </div>

            <!-- 정보화사업 요약 카드 -->
            <div v-if="prjSnapshotsRef.length > 0" class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">정보화사업</h2>
                <div ref="itPrjTableRef" class="kdb-it-table">
                    <table class="w-full border-collapse">
                        <colgroup>
                            <col style="width: 14%">
                            <col style="width: 9%">
                            <col style="width: 7%">
                            <col style="width: 7%">
                            <col style="width: 13%">
                            <col style="width: 50%">
                        </colgroup>
                        <thead>
                            <tr>
                                <th colspan="2" rowspan="2" class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" style="border-color: rgba(255,255,255,0.2)">부문/본부</th>
                                <th colspan="2" class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" style="border-color: rgba(255,255,255,0.2)">건수</th>
                                <th rowspan="2" class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" style="border-color: rgba(255,255,255,0.2)">편성예산(억원)</th>
                                <th rowspan="2" class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" style="border-color: rgba(255,255,255,0.2)">주요사업내역</th>
                            </tr>
                            <tr>
                                <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" style="border-color: rgba(255,255,255,0.2)">신규</th>
                                <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" style="border-color: rgba(255,255,255,0.2)">계속</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, idx) in itProjectRows" :key="`${row.sector}-${idx}`" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td
                                    v-if="row.showSector"
                                    :rowspan="row.sectorRowspan"
                                    class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center align-middle text-zinc-800 dark:text-zinc-200 overflow-hidden"
                                    :style="{
                                        'border-right-color': row.hideSectorRightBorder ? 'transparent' : '',
                                        'border-bottom-color': row.hideSectorBottomBorder ? 'transparent' : '',
                                    }"
                                >{{ row.sector }}</td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center text-zinc-800 dark:text-zinc-200 overflow-hidden">
                                    {{ row.subLabel }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center tabular-nums text-zinc-800 dark:text-zinc-200 overflow-hidden">
                                    {{ row.newCount }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center tabular-nums text-zinc-800 dark:text-zinc-200 overflow-hidden">
                                    {{ row.continueCount }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-right tabular-nums text-zinc-800 dark:text-zinc-200 overflow-hidden">
                                    {{ row.budgetBuk.toFixed(1) }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-zinc-800 dark:text-zinc-200 overflow-hidden">
                                    {{ row.projects.join(', ') }}
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2" class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">합계</td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center tabular-nums font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                    {{ itProjectRows.reduce((s, r) => s + r.newCount, 0) }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center tabular-nums font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                    {{ itProjectRows.reduce((s, r) => s + r.continueCount, 0) }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-right tabular-nums font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                    {{ itProjectRows.reduce((s, r) => s + r.budgetBuk, 0).toFixed(1) }}
                                </td>
                                <td class="border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- 부문(SVN_HDQ)별 사업목록 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">부문별 사업목록</h2>
                <div v-for="dept in byDepartment" :key="dept.svnHdq" class="space-y-2">
                    <div class="flex items-center gap-2">
                        <Tag :value="dept.svnHdq" severity="info" />
                        <span class="text-sm text-zinc-500">{{ dept.projects.length }}건</span>
                    </div>
                    <StyledDataTable
                        :value="dept.projects"
                        data-key="prjMngNo"
                    >
                        <Column field="prjNm" header="사업명" />
                        <Column field="prjTp" header="사업유형" style="width: 8rem">
                            <template #body="slotProps">{{ getPrjTpName(slotProps.data.prjTp) }}</template>
                        </Column>
                        <Column field="svnDpmNm" header="주관부서" style="width: 10rem" />
                        <Column field="prjBg" :header="`총예산 (${selectedUnit})`" style="width: 10rem">
                            <template #body="slotProps">
                                <span class="tabular-nums">{{ formatBudget(slotProps.data.prjBg) }}</span>
                            </template>
                        </Column>
                        <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" style="width: 10rem">
                            <template #body="slotProps">
                                <span class="tabular-nums">{{ formatBudget(slotProps.data.assetBg) }}</span>
                            </template>
                        </Column>
                        <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" style="width: 10rem">
                            <template #body="slotProps">
                                <span class="tabular-nums">{{ formatBudget(slotProps.data.costBg) }}</span>
                            </template>
                        </Column>
                    </StyledDataTable>
                </div>
            </div>

            <!-- 사업유형(PRJ_TP)별 사업목록 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">사업유형별 사업목록</h2>
                <div v-for="typeGroup in byProjectType" :key="typeGroup.prjTp" class="space-y-2">
                    <div class="flex items-center gap-2">
                        <Tag :value="getPrjTpName(typeGroup.prjTp)" severity="secondary" />
                        <span class="text-sm text-zinc-500">{{ typeGroup.projects.length }}건</span>
                    </div>
                    <StyledDataTable
                        :value="typeGroup.projects"
                        data-key="prjMngNo"
                    >
                        <Column field="prjNm" header="사업명" />
                        <Column field="svnHdq" header="주관부문" style="width: 10rem" />
                        <Column field="svnDpmNm" header="주관부서" style="width: 10rem" />
                        <Column field="prjBg" :header="`총예산 (${selectedUnit})`" style="width: 10rem">
                            <template #body="slotProps">
                                <span class="tabular-nums">{{ formatBudget(slotProps.data.prjBg) }}</span>
                            </template>
                        </Column>
                        <Column field="assetBg" :header="`자본예산 (${selectedUnit})`" style="width: 10rem">
                            <template #body="slotProps">
                                <span class="tabular-nums">{{ formatBudget(slotProps.data.assetBg) }}</span>
                            </template>
                        </Column>
                        <Column field="costBg" :header="`일반관리비 (${selectedUnit})`" style="width: 10rem">
                            <template #body="slotProps">
                                <span class="tabular-nums">{{ formatBudget(slotProps.data.costBg) }}</span>
                            </template>
                        </Column>
                    </StyledDataTable>
                </div>
            </div>
        </template>

        <!-- ④ 하단 저장/취소 버튼 -->
        <div class="flex justify-end gap-3 pb-8">
            <Button
                label="취소"
                icon="pi pi-times"
                severity="secondary"
                outlined
                @click="router.push('/info/plan')"
            />
            <Button
                label="저장"
                icon="pi pi-save"
                :loading="saving"
                :disabled="!previewVisible || saving"
                @click="handleSave"
            />
        </div>
    </div>
</template>
