<!--
================================================================================
[pages/budget/list.vue] 예산 통합 목록 페이지
================================================================================
정보화사업, 전산업무비, 경상사업 예산을 하나의 통합 테이블로 조회하는 페이지입니다.
상단에 예산 요약 카드를 표시하고, Drawer 필터로 상세 조건 검색이 가능합니다.

[주요 기능]
  - 예산 단위 변환: SelectButton으로 원/천원/백만원/억원 단위 전환
  - 예산 요약 카드: 정보화사업/전산업무비/경상사업 예산 합계
  - 통합 목록: StyledDataTable + 구분 태그(사업/비용/경상)
  - 상세 조회 Drawer: 구분/담당부서/예산 범위/결재현황 필터

[라우팅 링크]
  - 정보화사업 → /info/projects/:prjMngNo
  - 전산업무비 → /info/cost/
  - 결재신청 → /budget/report
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { exportRowsToExcel } from '~/utils/excel';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import ApprovalTimeline from '~/components/approval/ApprovalTimeline.vue';
import { useProjects, type Project, type ProjectDetail } from '~/composables/useProjects';
import { useCost, type ItCost } from '~/composables/useCost';
import { useAuth } from '~/composables/useAuth';
import { usePdfReport } from '~/composables/usePdfReport';
import { getApprovalTagClass, formatBudget as formatBudgetUtil } from '~/utils/common';

const title = '예산 목록';
definePageMeta({
    title: '예산 목록'
});

/* ── (탭 제거됨 — 통합 목록만 표시) ── */

/* ── 정보화사업 데이터 (일반 정보화사업만: ornYn != 'Y') ── */
const { fetchProjects, fetchProjectsBulk } = useProjects();
const { data: projectsData, error: projectsError } = await fetchProjects({ ornYn: 'N' });
/** 정보화사업 목록 (null 안전 처리) */
const projects = computed(() => projectsData.value || []);

/* ── 경상사업 데이터 (ornYn='Y') ── */
const { data: ordinaryData, error: ordinaryError } = await fetchProjects({ ornYn: 'Y' });
/** 경상사업 목록 (null 안전 처리) */
const ordinary = computed(() => ordinaryData.value || []);

/* ── 공통코드 코드명 변환 ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP');
const { getCodeName: getPulDttName } = useCodeOptions('PUL_DTT');

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
    category: string;    // 신규/계속 (pulDtt)
    bgYy: string;        // 예산연도
    totalBg: number;     // 총 예산
    assetBg: number;     // 자본예산
    devBg: number;       // 개발비
    machBg: number;      // 기계장치
    intanBg: number;     // 기타무형자산
    costBg: number;      // 일반관리비
    deptNm: string;      // 담당부서
    managerNm: string;   // 담당자
    sttDt: string;       // 시작일
    endDt: string;       // 종료일
    apfSts: string;      // 결재현황
    lstChgDtm: string;   // 최근수정일
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applicationInfo?: any; // 결재 타임라인용 상세 정보
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: (p as any).pulDtt || '',
        bgYy: String(p.bgYy || ''),
        totalBg: p.prjBg || 0,
        assetBg: p.assetBg || 0,
        devBg: p.devBg || 0,
        machBg: p.machBg || 0,
        intanBg: p.intanBg || 0,
        costBg: p.costBg || 0,
        deptNm: p.svnDpmNm || '',
        managerNm: p.svnDpmCgprNm || '',
        sttDt: p.sttDt || '',
        endDt: p.endDt || '',
        apfSts: p.applicationInfo?.apfSts || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lstChgDtm: (p as any).lstChgDtm || '',
        applicationInfo: p.applicationInfo
    }));
    /* 전산업무비 매핑 (assetBg/costBg는 백엔드에서 비목코드 기준으로 계산) */
    const costItems: UnifiedBudgetItem[] = costs.value.map((c: ItCost) => ({
        _id: c.itMngcNo || '',
        _type: '비용',
        _link: c.itMngcNo ? `/info/cost/${c.itMngcNo}` : '/info/cost',
        name: c.cttNm,
        category: c.pulDtt || '',
        bgYy: String(c.bgYy || ''),
        totalBg: c.itMngcBg || 0,
        assetBg: c.assetBg || 0,
        devBg: c.devBg || 0,
        machBg: c.machBg || 0,
        intanBg: c.intanBg || 0,
        costBg: c.costBg || 0,
        deptNm: c.biceDpmNm || '',
        managerNm: c.cgprNm || '',
        sttDt: typeof c.fstDfrDt === 'string' ? c.fstDfrDt : '',
        endDt: typeof c.fstDfrDt === 'string' ? c.fstDfrDt : '',
        apfSts: c.apfSts || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lstChgDtm: (c as any).lstChgDtm || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationInfo: (c as any).applicationInfo
    }));
    /* 경상사업 매핑 */
    const ordinaryItems: UnifiedBudgetItem[] = ordinary.value.map((p: Project) => ({
        _id: p.prjMngNo,
        _type: '경상',
        _link: `/info/projects/${p.prjMngNo}`,
        name: p.prjNm,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: (p as any).pulDtt || '',
        bgYy: String(p.bgYy || ''),
        totalBg: p.prjBg || 0,
        assetBg: p.assetBg || 0,
        devBg: p.devBg || 0,
        machBg: p.machBg || 0,
        intanBg: p.intanBg || 0,
        costBg: p.costBg || 0,
        deptNm: p.svnDpmNm || '',
        managerNm: p.svnDpmCgprNm || '',
        sttDt: p.sttDt || '',
        endDt: p.endDt || '',
        apfSts: p.applicationInfo?.apfSts || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lstChgDtm: (p as any).lstChgDtm || '',
        applicationInfo: p.applicationInfo
    }));
    return [...projectItems, ...costItems, ...ordinaryItems];
});

/* ── 예산 현황 요약 카드 접기/펼치기 ── */
/** true: 카드 접힌 상태 (기본값) */
const summaryCollapsed = ref(true);

/* ── 예산 단위 변환 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');
/**
 * 예산 금액을 선택된 단위로 변환
 *
 * @param amount - 원(KRW) 단위 금액
 * @returns 단위 변환된 포맷 문자열
 */
const formatBudget = (amount: number) => amount ? formatBudgetUtil(amount, selectedUnit.value) : '-';

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
/** 경상사업 탭 검색어 */
const ordinarySearch = ref('');

/* ── 조회 Drawer ── */
/** Drawer 표시 여부 */
const visibleDrawer = ref(false);

/* ── 정보화사업 Drawer 필터 ── */
const projectFilters = ref({
    major_hdq: [] as string[],
    major_department: [] as string[],
    it_department: [] as string[],
    status: [] as string[],
    apfSts: [] as string[],
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    assetBgMin: null as number | null,
    assetBgMax: null as number | null,
    costBgMin: null as number | null,
    costBgMax: null as number | null,
    startDate: null as Date | null,
    endDate: null as Date | null
});

/** 정보화사업 필터 적용 여부 */
const hasProjectFilters = computed(() =>
    projectFilters.value.major_hdq.length > 0 ||
    projectFilters.value.major_department.length > 0 ||
    projectFilters.value.it_department.length > 0 ||
    projectFilters.value.status.length > 0 ||
    projectFilters.value.apfSts.length > 0 ||
    projectFilters.value.budgetMin !== null ||
    projectFilters.value.budgetMax !== null ||
    projectFilters.value.assetBgMin !== null ||
    projectFilters.value.assetBgMax !== null ||
    projectFilters.value.costBgMin !== null ||
    projectFilters.value.costBgMax !== null ||
    projectFilters.value.startDate !== null ||
    projectFilters.value.endDate !== null
);

/* AutoComplete 옵션: 목록 데이터에서 유니크 값 추출 */
const projMajorHdqs = computed(() => [...new Set(projects.value.map((p: Project) => p.svnHdq).filter(Boolean))]);
const projMajorDepts = computed(() => [...new Set(projects.value.map((p: Project) => p.svnDpmNm).filter(Boolean))]);
const projItDepts = computed(() => [...new Set(projects.value.map((p: Project) => p.itDpmNm).filter(Boolean))]);
const projStatuses = computed(() => [...new Set(projects.value.map((p: Project) => p.prjSts).filter(Boolean))]);
const projApfStsOpts = computed(() => [...new Set(projects.value.map((p: Project) => p.applicationInfo?.apfSts).filter(Boolean))]);

const filteredProjMajorHdqs = ref<string[]>([]);
const filteredProjMajorDepts = ref<string[]>([]);
const filteredProjItDepts = ref<string[]>([]);
const filteredProjStatuses = ref<string[]>([]);
const filteredProjApfSts = ref<string[]>([]);

const searchProjMajorHdq = (e: { query: string }) => { filteredProjMajorHdqs.value = projMajorHdqs.value.filter(v => v.includes(e.query)); };
const searchProjMajorDept = (e: { query: string }) => { filteredProjMajorDepts.value = projMajorDepts.value.filter(v => v.includes(e.query)); };
const searchProjItDept = (e: { query: string }) => { filteredProjItDepts.value = projItDepts.value.filter(v => v.includes(e.query)); };
const searchProjStatus = (e: { query: string }) => { filteredProjStatuses.value = projStatuses.value.filter(v => v.includes(e.query)); };
const searchProjApfSts = (e: { query: string }) => { filteredProjApfSts.value = projApfStsOpts.value.filter(v => v.includes(e.query)); };

/** 정보화사업 필터 초기화 */
const resetProjectFilters = () => {
    projectFilters.value = { major_hdq: [], major_department: [], it_department: [], status: [], apfSts: [], budgetMin: null, budgetMax: null, assetBgMin: null, assetBgMax: null, costBgMin: null, costBgMax: null, startDate: null, endDate: null };
};

/* ── 전산업무비 Drawer 필터 ── */
const costFilters = ref({
    ioeC: [] as string[],
    ioeNm: [] as string[],
    cttTp: [] as string[],
    cttOpp: [] as string[],
    biceDpmNm: [] as string[],
    pulDpmNm: [] as string[],
    apfSts: [] as string[],
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    assetBgMin: null as number | null,
    assetBgMax: null as number | null,
    costBgMin: null as number | null,
    costBgMax: null as number | null
});

/** 전산업무비 필터 적용 여부 */
const hasCostFilters = computed(() =>
    costFilters.value.ioeC.length > 0 ||
    costFilters.value.ioeNm.length > 0 ||
    costFilters.value.cttTp.length > 0 ||
    costFilters.value.cttOpp.length > 0 ||
    costFilters.value.biceDpmNm.length > 0 ||
    costFilters.value.pulDpmNm.length > 0 ||
    costFilters.value.apfSts.length > 0 ||
    costFilters.value.budgetMin !== null ||
    costFilters.value.budgetMax !== null ||
    costFilters.value.assetBgMin !== null ||
    costFilters.value.assetBgMax !== null ||
    costFilters.value.costBgMin !== null ||
    costFilters.value.costBgMax !== null
);

const costIoeNms = computed(() => [...new Set(costs.value.map((c: ItCost) => c.ioeC).filter((v): v is string => Boolean(v)))]);
const costCttTps = computed(() => [...new Set(costs.value.map((c: ItCost) => c.pulDtt).filter((v): v is string => Boolean(v)))]);
const costCttOpps = computed(() => [...new Set(costs.value.map((c: ItCost) => c.cttOpp).filter((v): v is string => Boolean(v)))]);
const costPulDpmNms = computed(() => [...new Set(costs.value.map((c: ItCost) => c.biceDpmNm).filter((v): v is string => Boolean(v)))]);
const costApfStsOpts = computed(() => [...new Set(costs.value.map((c: ItCost) => c.apfSts).filter((v): v is string => Boolean(v)))]);

const filteredCostIoeNms = ref<string[]>([]);
const filteredCostCttTps = ref<string[]>([]);
const filteredCostCttOpps = ref<string[]>([]);
const filteredCostPulDpmNms = ref<string[]>([]);
const filteredCostApfSts = ref<string[]>([]);

const searchCostIoeNm = (e: { query: string }) => { filteredCostIoeNms.value = costIoeNms.value.filter(v => v.includes(e.query)); };
const searchCostCttTp = (e: { query: string }) => { filteredCostCttTps.value = costCttTps.value.filter(v => v.includes(e.query)); };
const searchCostCttOpp = (e: { query: string }) => { filteredCostCttOpps.value = costCttOpps.value.filter(v => v.includes(e.query)); };
const searchCostPulDpmNm = (e: { query: string }) => { filteredCostPulDpmNms.value = costPulDpmNms.value.filter(v => v.includes(e.query)); };
const searchCostApfSts = (e: { query: string }) => { filteredCostApfSts.value = costApfStsOpts.value.filter(v => v.includes(e.query)); };

/** 전산업무비 필터 초기화 */
const resetCostFilters = () => {
    costFilters.value = { ioeC: [], ioeNm: [], cttTp: [], cttOpp: [], biceDpmNm: [], pulDpmNm: [], apfSts: [], budgetMin: null, budgetMax: null, assetBgMin: null, assetBgMax: null, costBgMin: null, costBgMax: null };
};

/* ── 경상사업 Drawer 필터 ── */
const ordinaryFilters = ref({
    name: '',
    bgYy: '',
    status: [] as string[]
});

/** 경상사업 필터 적용 여부 */
const hasOrdinaryFilters = computed(() =>
    ordinaryFilters.value.name !== '' ||
    ordinaryFilters.value.bgYy !== '' ||
    ordinaryFilters.value.status.length > 0
);

const ordinaryStatuses = computed(() => [...new Set(ordinary.value.map((p: Project) => p.prjSts).filter(Boolean))]);
const filteredOrdinaryStatuses = ref<string[]>([]);
const searchOrdinaryStatus = (e: { query: string }) => {
    filteredOrdinaryStatuses.value = ordinaryStatuses.value.filter(v => v.includes(e.query));
};

/** 경상사업 필터 초기화 */
const resetOrdinaryFilters = () => {
    ordinaryFilters.value = { name: '', bgYy: '', status: [] };
};

/* ── 전체 탭 Drawer 필터 ── */
const allFilters = ref({
    type: [] as string[],
    deptNm: [] as string[],
    apfSts: [] as string[],
    budgetMin: null as number | null,
    budgetMax: null as number | null,
    assetBgMin: null as number | null,
    assetBgMax: null as number | null,
    costBgMin: null as number | null,
    costBgMax: null as number | null
});

/** 전체 탭 필터 적용 여부 */
const hasAllFilters = computed(() =>
    allFilters.value.type.length > 0 ||
    allFilters.value.deptNm.length > 0 ||
    allFilters.value.apfSts.length > 0 ||
    allFilters.value.budgetMin !== null ||
    allFilters.value.budgetMax !== null ||
    allFilters.value.assetBgMin !== null ||
    allFilters.value.assetBgMax !== null ||
    allFilters.value.costBgMin !== null ||
    allFilters.value.costBgMax !== null
);

const allTypeOpts = ['사업', '비용', '경상'];
const allDeptNmOpts = computed(() => [...new Set(unifiedItems.value.map(i => i.deptNm).filter(Boolean))]);
const allApfStsOpts = computed(() => [...new Set(unifiedItems.value.map(i => i.apfSts).filter(Boolean))]);

const filteredAllTypes = ref<string[]>([]);
const filteredAllDeptNms = ref<string[]>([]);
const filteredAllApfSts = ref<string[]>([]);

const searchAllType = (e: { query: string }) => { filteredAllTypes.value = allTypeOpts.filter(v => v.includes(e.query)); };
const searchAllDeptNm = (e: { query: string }) => { filteredAllDeptNms.value = allDeptNmOpts.value.filter(v => v.includes(e.query)); };
const searchAllApfSts = (e: { query: string }) => { filteredAllApfSts.value = allApfStsOpts.value.filter(v => v.includes(e.query)); };

/** 전체 탭 필터 초기화 */
const resetAllFilters = () => {
    allFilters.value = { type: [], deptNm: [], apfSts: [], budgetMin: null, budgetMax: null, assetBgMin: null, assetBgMax: null, costBgMin: null, costBgMax: null };
};

/**
 * 정보화사업 필터링 (텍스트 검색 + Drawer 다중 조건)
 */
const filteredProjects = computed(() => {
    return projects.value.filter((p: Project) => {
        /* 텍스트 검색 */
        if (projectSearch.value) {
            const kw = projectSearch.value.toLowerCase();
            if (!p.prjNm?.toLowerCase().includes(kw) &&
                !p.svnDpmNm?.toLowerCase().includes(kw) &&
                !p.itDpmNm?.toLowerCase().includes(kw)) return false;
        }
        /* Drawer 필터 */
        if (projectFilters.value.major_hdq.length > 0 && !projectFilters.value.major_hdq.includes(p.svnHdq)) return false;
        if (projectFilters.value.major_department.length > 0 && !projectFilters.value.major_department.includes(p.svnDpmNm)) return false;
        if (projectFilters.value.it_department.length > 0 && !projectFilters.value.it_department.includes(p.itDpmNm)) return false;
        if (projectFilters.value.status.length > 0 && !projectFilters.value.status.includes(p.prjSts)) return false;
        if (projectFilters.value.apfSts.length > 0 && !projectFilters.value.apfSts.includes(p.applicationInfo?.apfSts)) return false;
        if (projectFilters.value.budgetMin !== null && p.prjBg < projectFilters.value.budgetMin) return false;
        if (projectFilters.value.budgetMax !== null && p.prjBg > projectFilters.value.budgetMax) return false;
        if (projectFilters.value.assetBgMin !== null && (p.assetBg || 0) < projectFilters.value.assetBgMin) return false;
        if (projectFilters.value.assetBgMax !== null && (p.assetBg || 0) > projectFilters.value.assetBgMax) return false;
        if (projectFilters.value.costBgMin !== null && (p.costBg || 0) < projectFilters.value.costBgMin) return false;
        if (projectFilters.value.costBgMax !== null && (p.costBg || 0) > projectFilters.value.costBgMax) return false;
        if (projectFilters.value.startDate) {
            const fs = projectFilters.value.startDate.toISOString().split('T')[0]!;
            if (p.endDt < fs) return false;
        }
        if (projectFilters.value.endDate) {
            const fe = projectFilters.value.endDate.toISOString().split('T')[0]!;
            if (p.sttDt > fe) return false;
        }
        return true;
    });
});

/**
 * 전산업무비 필터링 (텍스트 검색 + Drawer 다중 조건)
 */
const filteredCosts = computed(() => {
    return costs.value.filter((c: ItCost) => {
        /* 텍스트 검색 */
        if (costSearch.value) {
            const kw = costSearch.value.toLowerCase();
            if (!c.ioeC?.toLowerCase().includes(kw) &&
                !c.cttNm?.toLowerCase().includes(kw) &&
                !c.cttOpp?.toLowerCase().includes(kw)) return false;
        }
        /* Drawer 필터 */
        if (costFilters.value.ioeC.length > 0 && !costFilters.value.ioeC.includes(c.ioeC)) return false;
        if (costFilters.value.cttTp.length > 0 && !costFilters.value.cttTp.includes(c.pulDtt)) return false;
        if (costFilters.value.cttOpp.length > 0 && !costFilters.value.cttOpp.includes(c.cttOpp)) return false;
        if (costFilters.value.biceDpmNm.length > 0 && !costFilters.value.biceDpmNm.includes(c.biceDpmNm ?? '')) return false;
        if (costFilters.value.apfSts.length > 0 && !costFilters.value.apfSts.includes(c.apfSts ?? '')) return false;
        if (costFilters.value.budgetMin !== null && c.itMngcBg < costFilters.value.budgetMin) return false;
        if (costFilters.value.budgetMax !== null && c.itMngcBg > costFilters.value.budgetMax) return false;
        if (costFilters.value.assetBgMin !== null && (c.assetBg || 0) < costFilters.value.assetBgMin) return false;
        if (costFilters.value.assetBgMax !== null && (c.assetBg || 0) > costFilters.value.assetBgMax) return false;
        /* 전산업무비 일반관리비 = 총예산 - 자본예산 */
        const costCostBg = c.itMngcBg - (c.assetBg || 0);
        if (costFilters.value.costBgMin !== null && costCostBg < costFilters.value.costBgMin) return false;
        if (costFilters.value.costBgMax !== null && costCostBg > costFilters.value.costBgMax) return false;
        return true;
    });
});

/**
 * 전체 통합 목록 필터링 (텍스트 검색 + Drawer 다중 조건)
 */
const filteredAll = computed(() => {
    return unifiedItems.value.filter(item => {
        /* 텍스트 검색 */
        if (allSearch.value) {
            const kw = allSearch.value.toLowerCase();
            if (!item.name?.toLowerCase().includes(kw) &&
                !item.deptNm?.toLowerCase().includes(kw) &&
                !item.managerNm?.toLowerCase().includes(kw)) return false;
        }
        /* Drawer 필터 */
        if (allFilters.value.type.length > 0 && !allFilters.value.type.includes(item._type)) return false;
        if (allFilters.value.deptNm.length > 0 && !allFilters.value.deptNm.includes(item.deptNm)) return false;
        if (allFilters.value.apfSts.length > 0 && !allFilters.value.apfSts.includes(item.apfSts)) return false;
        if (allFilters.value.budgetMin !== null && item.totalBg < allFilters.value.budgetMin) return false;
        if (allFilters.value.budgetMax !== null && item.totalBg > allFilters.value.budgetMax) return false;
        if (allFilters.value.assetBgMin !== null && (item.assetBg || 0) < allFilters.value.assetBgMin) return false;
        if (allFilters.value.assetBgMax !== null && (item.assetBg || 0) > allFilters.value.assetBgMax) return false;
        if (allFilters.value.costBgMin !== null && (item.costBg || 0) < allFilters.value.costBgMin) return false;
        if (allFilters.value.costBgMax !== null && (item.costBg || 0) > allFilters.value.costBgMax) return false;
        return true;
    });
});


/**
 * 경상사업 필터링 (텍스트 검색 + Drawer 조건)
 */
const filteredOrdinary = computed(() => {
    return ordinary.value.filter((p: Project) => {
        /* 텍스트 검색 */
        if (ordinarySearch.value) {
            const kw = ordinarySearch.value.toLowerCase();
            if (!p.prjNm?.toLowerCase().includes(kw) &&
                !p.svnDpmNm?.toLowerCase().includes(kw)) return false;
        }
        /* Drawer 필터 */
        if (ordinaryFilters.value.name && !p.prjNm?.includes(ordinaryFilters.value.name)) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (ordinaryFilters.value.bgYy && String((p as any).bgYy) !== ordinaryFilters.value.bgYy) return false;
        if (ordinaryFilters.value.status.length > 0 && !ordinaryFilters.value.status.includes(p.prjSts)) return false;
        return true;
    });
});

/* ── 페이지 크기 ── */
/** 페이지당 표시 건수 옵션 */
const pageSizeOptions = [
    { label: '10건', value: 10 },
    { label: '20건', value: 20 },
    { label: '50건', value: 50 }
];
/** 전체 탭 페이지당 표시 건수 */
const allPageSize = ref(10);
/** 정보화사업 탭 페이지당 표시 건수 */
const projectPageSize = ref(10);
/** 전산업무비 탭 페이지당 표시 건수 */
const costPageSize = ref(10);
/** 경상사업 탭 페이지당 표시 건수 */
const ordinaryPageSize = ref(10);

/* (탭 제거: currentPageSize, tabItems 불필요) */

/* ── 엑셀/보고서 다운로드 ── */
const { user } = useAuth();
const { generateReport } = usePdfReport();

/** 보고서/엑셀 다운로드 진행 중 상태 (버튼 loading 표시용) */
const reportLoading = ref(false);

/* ── 신청서 조회 PDF 뷰어 ── */
/** ApplicationViewerDialog 표시 여부 */
const showApplicationViewer = ref(false);
/** 조회할 신청관리번호 */
const viewerApfMngNo = ref('');

/**
 * 신청서 조회 다이얼로그 열기
 * @param apfMngNo - applicationInfo.apfMngNo
 */
const openApplicationViewer = (apfMngNo: string) => {
    viewerApfMngNo.value = apfMngNo;
    showApplicationViewer.value = true;
};

/**
 * 워크시트 데이터를 XLSX 파일로 다운로드 (공통 유틸 래퍼)
 *
 * @param rows - 행 데이터 배열 (첫 번째 행을 헤더로 사용)
 * @param sheetName - 시트명
 * @param fileName - 다운로드 파일명 (.xlsx 포함)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const downloadExcel = async (rows: Record<string, any>[], sheetName: string, fileName: string) => {
    await exportRowsToExcel(rows, sheetName, fileName);
};

/**
 * 전체 탭 엑셀 다운로드
 * 현재 필터링된 통합 목록(filteredAll)을 엑셀로 저장합니다.
 */
const downloadAllExcel = async () => {
    const rows = filteredAll.value.map(item => ({
        '구분': item._type,
        '사업명/계약명': item.name,
        '신규/계속': getPulDttName(item.category),
        '총 예산(원)': item.totalBg,
        '자본예산(원)': item.assetBg,
        '일반관리비(원)': item.costBg,
        '담당부서': item.deptNm,
        '담당자': item.managerNm,
        '시작일': item.sttDt,
        '종료일': item.endDt,
        '결재현황': item.apfSts
    }));
    await downloadExcel(rows, '전체예산목록', `전체예산목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * 정보화사업 탭 엑셀 다운로드
 * 현재 필터링된 정보화사업 목록(filteredProjects)을 엑셀로 저장합니다.
 */
const downloadProjectsExcel = async () => {
    const rows = filteredProjects.value.map((p: Project) => ({
        '사업명': p.prjNm,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        '신규/계속': getPulDttName((p as any).pulDtt),
        '총 예산(원)': p.prjBg,
        '자본예산(원)': p.assetBg || 0,
        '일반관리비(원)': p.costBg || 0,
        '주관부서': p.svnDpmNm,
        '담당자': p.svnDpmCgprNm,
        '시작일': p.sttDt,
        '종료일': p.endDt,
        '상태': p.prjSts,
        '결재현황': p.applicationInfo?.apfSts
    }));
    await downloadExcel(rows, '정보화사업목록', `정보화사업목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * 전산업무비 탭 엑셀 다운로드
 * 현재 필터링된 전산업무비 목록(filteredCosts)을 엑셀로 저장합니다.
 */
const downloadCostsExcel = async () => {
    const rows = filteredCosts.value.map((c: ItCost) => ({
        '계약명': c.cttNm,
        '비목코드': c.ioeC,
        '신규/계속': getPulDttName(c.pulDtt),
        '총 예산(원)': c.itMngcBg,
        '자본예산(원)': c.assetBg || 0,
        '계약상대처': c.cttOpp,
        '담당부서': c.biceDpmNm,
        '담당자': c.cgprNm,
        '지급예정월': c.fstDfrDt,
        '결재현황': c.apfSts
    }));
    await downloadExcel(rows, '전산업무비목록', `전산업무비목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * 경상사업 탭 엑셀 다운로드
 * 현재 필터링된 경상사업 목록(filteredOrdinary)을 엑셀로 저장합니다.
 */
const downloadOrdinaryExcel = async () => {
    const rows = filteredOrdinary.value.map((p: Project) => ({
        '사업명': p.prjNm,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        '신규/계속': getPulDttName((p as any).pulDtt),
        '총 예산(원)': p.prjBg,
        '자본예산(원)': p.assetBg || 0,
        '담당부서': p.svnDpmNm,
        '담당자': p.svnDpmCgprNm,
        '시작일': p.sttDt,
        '종료일': p.endDt,
        '상태': p.prjSts,
        '결재현황': p.applicationInfo?.apfSts
    }));
    await downloadExcel(rows, '경상사업목록', `경상사업목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/* ── 보고서 다운로드 ── */

/**
 * 보고서 PDF 다운로드
 * 현재 필터링된 항목(정보화사업 + 전산업무비)에 대해 예산편성 신청서 PDF를 생성합니다.
 * 기안자는 현재 로그인 사용자로 자동 설정하고, 팀장/부서장은 미지정으로 처리합니다.
 */
const downloadReport = async () => {
    reportLoading.value = true;
    try {
        /* 통합 목록에서 유형별 분리 */
        const projectIdList = filteredAll.value.filter(i => i._type === '사업' || i._type === '경상').map(i => i._id);
        const costList = filteredCosts.value.filter(c =>
            filteredAll.value.some(i => i._type === '비용' && i._id === c.itMngcNo)
        );

        /* 정보화사업 상세 데이터 일괄 조회 (품목 포함) */
        let projectDetails: ProjectDetail[] = [];
        if (projectIdList.length > 0) {
            projectDetails = await fetchProjectsBulk(projectIdList);
        }

        /* 결재선: 기안자는 로그인 사용자, 팀장/부서장은 미지정 */
        const today = new Date().toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');

        const approvalLine = {
            drafter: { name: user.value?.empNm || '', rank: '', date: today, id: user.value?.eno || '' },
            teamLead: { name: '', rank: '', date: '', id: '' },
            deptHead: { name: '', rank: '', date: '', id: '' }
        };

        /* PDF 생성 후 새 탭에서 열기 */
        const pdfUrl = await generateReport(projectDetails, approvalLine, costList);
        window.open(pdfUrl, '_blank');
    } catch (e) {
        console.error('보고서 생성 중 오류:', e);
        alert('보고서 생성 중 오류가 발생했습니다.');
    } finally {
        reportLoading.value = false;
    }
};

/* ── 결재 진행 상황 타임라인 다이얼로그 ── */
const showTimelineDialog = ref(false);
/** 타임라인에 전달할 선택된 결재 항목 데이터 (applicationInfo) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectedTimelineData = ref<any>(null);

/**
 * 결재 진행 상황 타임라인 열기
 * 각 항목의 applicationInfo 객체를 타임라인 컴포넌트에 전달합니다.
 * @param data - 결재 항목 (UnifiedBudgetItem, Project, ItCost 중 하나)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openTimeline = (data: any) => {
    if (!data.applicationInfo) return;
    selectedTimelineData.value = data.applicationInfo;
    showTimelineDialog.value = true;
};

</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더: 제목 + 예산 단위 선택 -->
        <div class="flex items-center justify-between">
            <!-- 좌측: 제목 -->
            <div class="flex items-center gap-3">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            </div>
            <!-- 우측: 요약 카드 토글 버튼 + 예산 단위 선택 -->
            <div class="flex items-center gap-4">
                <!-- 예산 현황 요약 카드 접기/펼치기 토글 버튼 -->
                <Button
v-tooltip="summaryCollapsed ? '예산 현황 요약 펼치기' : '예산 현황 요약 접기'"
                    :icon="summaryCollapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'" :label="summaryCollapsed ? '예산 현황' : '예산 현황'" severity="secondary" outlined
                    size="small"
                    @click="summaryCollapsed = !summaryCollapsed" />
                <!-- 예산 단위 SelectButton (원/천원/백만원/억원) -->
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="unit-selector" />
            </div>
        </div>

        <!-- 예산 현황 요약 카드 (접기/펼치기) -->
        <Transition
enter-active-class="transition-all duration-300 ease-out overflow-hidden"
            leave-active-class="transition-all duration-300 ease-in overflow-hidden"
            enter-from-class="opacity-0 max-h-0" enter-to-class="opacity-100 max-h-96"
            leave-from-class="opacity-100 max-h-96" leave-to-class="opacity-0 max-h-0">
            <div v-show="!summaryCollapsed">
                <BudgetSummaryCards
                    :projects="projects" :costs="costs" :ordinary="ordinary"
                    :selected-unit="selectedUnit" />
            </div>
        </Transition>

        <!-- 통합 목록 영역 -->
        <div
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4">

            <!-- ── 툴바: 페이지크기 | 건수 | 검색 | 액션 ── -->
            <div class="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <!-- 페이지당 표시 건수 Select -->
                <Select
v-model="allPageSize" :options="pageSizeOptions" option-label="label" option-value="value"
                    class="shrink-0" />
                <div class="flex-1"/>
                <!-- 통합 검색 -->
                <IconField class="w-[30rem] shrink-0">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="allSearch" placeholder="사업명, 담당부서, 담당자 검색..." class="w-full" />
                </IconField>
                <!-- 엑셀/보고서/필터 액션 -->
                <BudgetTableActions
class="shrink-0" :report-loading="reportLoading" :has-filters="hasAllFilters"
                    @excel="downloadAllExcel" @pdf="downloadReport()" @filter="visibleDrawer = true" />
            </div>

            <!-- ── 통합 DataTable ── -->
            <StyledDataTable
:value="filteredAll" paginator :rows="allPageSize" data-key="_id" sort-field="lstChgDtm"
                :sort-order="-1">
                    <!-- 구분: 정보화사업/전산업무비/경상사업 태그 -->
                    <Column
field="_type" header="구분" sortable style="width: 100px"
                        :pt="{ bodyCell: { style: 'text-align: center' } }">
                        <template #body="slotProps">
                            <Tag
:value="slotProps.data._type"
                                :class="slotProps.data._type === '사업'
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                    : slotProps.data._type === '경상'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'" class="border-0" rounded />
                        </template>
                    </Column>
                    <!-- 예산연도 -->
                    <Column
field="bgYy" header="예산연도" sortable style="min-width: 120px"
                        :pt="{ bodyCell: { style: 'text-align: center' } }"/>
                    <!-- 사업명/계약명: 상세 페이지 링크 -->
                    <Column field="name" header="사업명/계약명" sortable header-class="font-bold">
                        <template #body="slotProps">
                            <NuxtLink
:to="slotProps.data._link"
                                class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                                {{ slotProps.data.name }}
                            </NuxtLink>
                        </template>
                    </Column>
                    <!-- 신규/계속 -->
                    <Column
field="category" header="신규/계속" sortable
                        :pt="{ bodyCell: { style: 'text-align: center' } }">
                        <template #body="slotProps">
                            <Tag
:value="getPulDttName(slotProps.data.category)" :class="getPrjTypeClass(getPulDttName(slotProps.data.category))"
                                class="border-0" rounded />
                        </template>
                    </Column>
                    <!-- 총 예산 -->
                    <Column
field="totalBg" :header="`총 예산`" sortable
                        :pt="{ bodyCell: { style: 'text-align: right' } }">
                        <template #body="slotProps">
                            <span>{{ formatBudget(slotProps.data.totalBg) }}{{ slotProps.data.totalBg ? selectedUnit : '' }}</span>
                        </template>
                    </Column>
                    <!-- 개발비 -->
                    <Column
field="devBg" :header="`개발비`" sortable
                        :pt="{ bodyCell: { style: 'text-align: right' } }">
                        <template #body="slotProps">
                            <span>{{ formatBudget(slotProps.data.devBg) }}{{ slotProps.data.devBg ? selectedUnit : '' }}</span>
                        </template>
                    </Column>
                    <!-- 기계장치 -->
                    <Column
field="machBg" :header="`기계장치`" sortable
                        :pt="{ bodyCell: { style: 'text-align: right' } }">
                        <template #body="slotProps">
                            <span>{{ formatBudget(slotProps.data.machBg) }}{{ slotProps.data.machBg ? selectedUnit : '' }}</span>
                        </template>
                    </Column>
                    <!-- 기타무형자산 -->
                    <Column
field="intanBg" :header="`기타무형자산`" sortable
                        :pt="{ bodyCell: { style: 'text-align: right' } }">
                        <template #body="slotProps">
                            <span>{{ formatBudget(slotProps.data.intanBg) }}{{ slotProps.data.intanBg ? selectedUnit : '' }}</span>
                        </template>
                    </Column>
                    <!-- 일반관리비 -->
                    <Column
field="costBg" :header="`일반관리비`" sortable
                        :pt="{ bodyCell: { style: 'text-align: right' } }">
                        <template #body="slotProps">
                            <span>{{ formatBudget(slotProps.data.costBg) }}{{ slotProps.data.costBg ? selectedUnit : '' }}</span>
                        </template>
                    </Column>
                    <!-- 담당부서 -->
                    <Column field="deptNm" header="담당부서" sortable/>
                    <!-- 담당자 -->
                    <Column
field="managerNm" header="담당자" sortable
                        :pt="{ bodyCell: { style: 'text-align: center' } }"/>
                    <!-- 시작일 -->
                    <Column field="sttDt" header="시작일" sortable/>
                    <!-- 종료일 -->
                    <Column field="endDt" header="종료일" sortable/>
                    <!-- 결재현황 태그 + 신청서 조회 버튼 -->
                    <Column
field="apfSts" header="결재현황" sortable style="min-width: 150px"
                        :pt="{ bodyCell: { style: 'text-align: center' } }">
                        <template #body="slotProps">
                            <div v-if="slotProps.data.apfSts" class="flex items-center gap-2">
                                <Tag
v-tooltip="'결재 진행 상황 보기'"
                                    :value="slotProps.data.apfSts"
                                    :class="[getApprovalTagClass(slotProps.data.apfSts), 'cursor-pointer hover:opacity-80 transition-opacity']" class="border-0" rounded
                                    @click="openTimeline(slotProps.data)" />
                                <!-- 신청서 조회 버튼: applicationInfo.apfMngNo가 있을 때만 표시 -->
                                <Button
v-if="slotProps.data.applicationInfo?.apfMngNo" v-tooltip="'신청서 조회'"
                                    icon="pi pi-file-pdf" size="small" severity="secondary" text rounded
                                    title="신청서 조회"
                                    @click="openApplicationViewer(slotProps.data.applicationInfo.apfMngNo)" />
                            </div>
                            <span v-else class="text-zinc-400">-</span>
                        </template>
                    </Column>
                </StyledDataTable>

        </div>

    <!-- 상세 조회 Drawer (오른쪽 슬라이드) -->
    <Drawer v-model:visible="visibleDrawer" header="상세 조회" position="right" class="!w-full md:!w-[600px]">
        <div class="flex flex-col gap-6">
            <!-- 구분 (사업/비용/경상) -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">구분</label>
                <AutoComplete
v-model="allFilters.type" :suggestions="filteredAllTypes" multiple
                    dropdown placeholder="사업 / 비용 / 경상 선택 (다중)" fluid @complete="searchAllType" />
            </div>
            <!-- 담당부서 -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">담당부서</label>
                <AutoComplete
v-model="allFilters.deptNm" :suggestions="filteredAllDeptNms"
                    multiple dropdown placeholder="담당부서 선택 (다중)" fluid @complete="searchAllDeptNm" />
            </div>
            <!-- 총 예산 범위 -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">총 예산 (원)</label>
                <InputNumber
v-model="allFilters.budgetMin" placeholder="최소" mode="currency" currency="KRW"
                    locale="ko-KR" :min-fraction-digits="0" class="w-full" />
                <InputNumber
v-model="allFilters.budgetMax" placeholder="최대" mode="currency" currency="KRW"
                    locale="ko-KR" :min-fraction-digits="0" class="w-full" />
            </div>
            <!-- 자본예산 범위 -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">자본예산 (원)</label>
                <InputNumber
v-model="allFilters.assetBgMin" placeholder="최소" mode="currency" currency="KRW"
                    locale="ko-KR" :min-fraction-digits="0" class="w-full" />
                <InputNumber
v-model="allFilters.assetBgMax" placeholder="최대" mode="currency" currency="KRW"
                    locale="ko-KR" :min-fraction-digits="0" class="w-full" />
            </div>
            <!-- 일반관리비 범위 -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">일반관리비 (원)</label>
                <InputNumber
v-model="allFilters.costBgMin" placeholder="최소" mode="currency" currency="KRW"
                    locale="ko-KR" :min-fraction-digits="0" class="w-full" />
                <InputNumber
v-model="allFilters.costBgMax" placeholder="최대" mode="currency" currency="KRW"
                    locale="ko-KR" :min-fraction-digits="0" class="w-full" />
            </div>
            <!-- 결재현황 -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">결재현황</label>
                <AutoComplete
v-model="allFilters.apfSts" :suggestions="filteredAllApfSts"
                    multiple dropdown placeholder="결재현황 선택 (다중)" fluid @complete="searchAllApfSts" />
            </div>
            <!-- 액션 버튼 -->
            <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
label="초기화" icon="pi pi-refresh" severity="secondary" class="flex-1"
                    @click="resetAllFilters" />
                <Button label="조회" icon="pi pi-search" class="flex-1" @click="visibleDrawer = false" />
            </div>

        </div>
    </Drawer>

    <!-- 결재 진행 상황 타임라인 컴포넌트 -->
    <ApprovalTimeline v-model:visible="showTimelineDialog" :approval-data="selectedTimelineData" />

    <!-- 신청서 조회 PDF 뷰어 다이얼로그 (재사용 컴포넌트) -->
    <ApplicationViewerDialog v-model:visible="showApplicationViewer" :apf-mng-no="viewerApfMngNo" />
    </div>
</template>
