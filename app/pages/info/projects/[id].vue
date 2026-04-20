<!--
================================================================================
[pages/info/projects/[id].vue] 정보화사업 상세 페이지
================================================================================
URL 파라미터(id = prjMngNo)로 특정 정보화사업의 상세 정보를 표시합니다.
수정, 삭제 기능을 제공하며, 결재 중/완료 건은 삭제 버튼이 숨겨집니다.

[라우팅]
  - 접근: /info/projects/:id
  - 목록 이동: /info/projects
  - 수정 이동: /info/projects/form?id=:id

[UI 구성 (총 9개 섹션, xl 2-col 레이아웃)]
  전체 row: 사업 진행 현황 (11단계 타임라인, 현재 단계 강조)
  xl 2-col 상단:
    좌) 7. 담당 조직: 주관부서(Business Owner) + IT부서(IT Partner) 카드
        8. 추진시기 및 소요예산: 총예산/전결권/보고상태 + 시작일/종료일/추진가능성
    우) 9. 소요자원 상세: DataTable (구분/품목명/수량/단가/통화/소계/산정근거/일정주기) + 합계 Footer
  이하:
  2. 사업 개요: RichText 설명 + 현황/필요성/기대효과/미추진시문제점 4개 박스
  3. 사업 범위: RichText 전산 요구사항
  4. 진행 상황: 추진 경과 + 향후 계획 (2열)
  5. 사업 구분: 업무구분/사업유형/기술유형/주요사용자
  6. 편성 기준: 중복여부/법규상완료시기

[보안]
  - prjDes, prjRng (Rich Text HTML): DOMPurify(isomorphic-dompurify)로 XSS 방어

[삭제 조건]
  - apfSts가 '결재중', '결재완료', '승인'이면 삭제 버튼 숨김
  - 그 외 상태에서만 삭제 확인 다이얼로그 표시

[타임라인 단계]
  예산 작성 → 사전 협의 → 정실협 → 요건 상세화 → 소요예산 산정
  → 과심위 → 입찰/계약 → 사업 추진 → 대금지급 → 성과평가 → 완료
================================================================================
-->
<script setup lang="ts">
import 'quill/dist/quill.core.css';
import DOMPurify from 'isomorphic-dompurify';
import { useToast } from 'primevue/usetoast';
import { PROJECT_STAGES, getProjectTagClass, getApprovalAuthorityBasis } from '~/utils/common';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

const route = useRoute();
const router = useRouter();
/** URL 파라미터에서 사업 관리번호 추출 */
const prjMngNo = route.params.id;

const { fetchProject, deleteProject } = useProjects();
// RBAC 권한 헬퍼: 수정/삭제 버튼 표시 여부 판단에 사용
const { canModify } = useAuth();
const { data: project, error, refresh: refreshProject } = await fetchProject(prjMngNo as string);

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(() => refreshProject());
const confirm = useConfirm();
const toast = useToast();

// useCurrencyRates() 내부에서 useApiFetch가 자동으로 초기 fetch를 실행하므로
// fetchRates() (= refresh) 중복 호출 불필요 → 2회 호출 및 40X 오류 방지
const { convertToKRW } = useCurrencyRates();

/* ── 공통코드 코드명 변환 (cdId → cdNm) ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP');
const { getCodeName: getBzDttName } = useCodeOptions('BZ_DTT');
const { getCodeName: getTchnTpName } = useCodeOptions('TCHN_TP');
const { getCodeName: getMnUsrName } = useCodeOptions('MN_USR');
const { getCodeName: getRprStsName } = useCodeOptions('RPR_STS');
const { getCodeName: getPrjPulPttName } = useCodeOptions('PRJ_PUL_PTT');

/* ── IOE 비목 공통코드 조회 (구분 컬럼 cdId → cdNm 표시용) ── */
interface IoeCode { cdId: string; cdNm: string; cttTp: string; }
const ioeCodeMap = ref(new Map<string, IoeCode>());
const IOE_CTT_TYPES = ['IOE_LEAFE', 'IOE_XPN', 'IOE_SEVS', 'IOE_IDR', 'IOE_CPIT'];

onMounted(async () => {
    try {
        const { $apiFetch } = useNuxtApp();
        const config = useRuntimeConfig();
        const results = await Promise.all(
            IOE_CTT_TYPES.map(cttTp =>
                $apiFetch<IoeCode[]>(`${config.public.apiBase}/api/ccodem/type/${cttTp}`)
            )
        );
        const map = new Map<string, IoeCode>();
        for (const code of results.flat()) {
            map.set(code.cdId, code);
        }
        ioeCodeMap.value = map;
    } catch (e) {
        console.error('IOE 비목 코드 조회 실패', e);
    }
});

/** cdId로 코드명 조회 (없으면 cdId 그대로 표시) */
const getCodeNm = (cdId: string): string => {
    return ioeCodeMap.value.get(cdId)?.cdNm || cdId;
};

/** cdId로 cttTp 조회 */
const getCttTp = (cdId: string): string => {
    return ioeCodeMap.value.get(cdId)?.cttTp || '';
};

/** 경상사업 여부 (ornYn='Y') */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isOrdinary = computed(() => (project.value as any)?.ornYn === 'Y');

definePageMeta({
    title: '정보화사업 상세'
});

/**
 * 삭제 확인 다이얼로그 표시 및 처리
 * 사용자 확인 후 deleteProject API를 호출하고 목록으로 이동합니다.
 */
const handleDelete = () => {
    confirm.require({
        message: '정말로 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteProject(prjMngNo as string);
                /* 진입 전 화면으로 복귀 (히스토리가 없으면 목록으로 이동) */
                if (window.history.length > 1) {
                    router.back();
                } else {
                    router.push('/info/projects');
                }
            } catch (err) {
                console.error('Failed to delete project:', err);
                toast.add({
                    severity: 'error',
                    summary: '삭제 실패',
                    detail: '사업 정보를 삭제하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                    life: 5000
                });
            }
        }
    });
};

/**
 * 금액을 지정된 통화 형식으로 포맷팅
 *
 * @param value - 포맷팅할 숫자
 * @param currency - 통화 코드 (기본값: 'KRW')
 * @returns '₩1,234,567' 또는 '$1,234.56' 형식의 문자열
 */
const formatCurrency = (value: number, currency: string = 'KRW') => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(value);
};

/**
 * 전결권 결정 근거 텍스트
 * utils/common.ts의 getApprovalAuthorityBasis로 기준·금액을 구한 뒤 포맷팅합니다.
 */
const approvalBasisText = computed(() => {
    const { label, amount } = getApprovalAuthorityBasis(
        project.value?.assetBg ?? 0,
        project.value?.costBg ?? 0
    );
    return `${label} ${formatCurrency(amount)} 기준으로 결정`;
});

/**
 * 현재 프로젝트 상태의 단계 인덱스 반환
 * 타임라인에서 완료/현재/예정 표시를 결정하는 데 사용합니다.
 *
 * @param status - 현재 프로젝트 상태 문자열
 * @returns 단계 인덱스 (0-based), 없으면 -1
 */
const getCurrentStageIndex = (status?: string) => {
    if (!status) return -1;
    return PROJECT_STAGES.indexOf(status);
};

/**
 * 타임라인 진행선(인디고)의 너비 계산
 * 첫 번째 원 중심 ~ 현재 단계 원 중심까지의 너비를 CSS calc로 반환합니다.
 * flex-1 기준으로 각 step의 너비는 100%/total이고, 원 중심은 그 절반에 위치합니다.
 */
const timelineProgressWidth = computed(() => {
    const idx = getCurrentStageIndex(project.value?.prjSts);
    if (idx <= 0) return '0%';
    const total = PROJECT_STAGES.length;
    const fraction = idx / (total - 1);
    return `calc((100% - 100% / ${total}) * ${fraction})`;
});

/**
 * 소요자원 항목들의 소계(gclAmt)를 원화로 환산하여 합산합니다.
 * 소요자원 DataTable 하단 Footer에 표시됩니다.
 *
 * [환산 우선순위]
 * 1. 저장된 환율(xcr)이 있고 KRW가 아닌 경우 → 저장 당시 환율로 환산 (gclAmt × xcr)
 * 2. 그 외 → useCurrencyRates의 convertToKRW로 현재 환율 환산
 */
const totalItemsAmount = computed(() => {
    if (!project.value?.items) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return project.value.items.reduce((sum: number, item: any) => {
        const amt = item.gclAmt || 0;
        const currency = item.cur || 'KRW';
        // 저장된 환율(xcr)이 있고 원화가 아닌 경우: 저장 당시 환율 적용
        if (item.xcr && currency !== 'KRW') {
            return sum + Math.round(amt * item.xcr);
        }
        // 저장된 환율이 없거나 원화인 경우: 현재 환율로 환산 (KRW는 rate=1)
        return sum + convertToKRW(amt, currency);
    }, 0);
});

/**
 * 소요자원 구분별 PrimeVue Tag severity 매핑
 * cttTp 기준으로 색상을 결정합니다.
 *
 * @param cdId - 공통코드 cdId (예: IOE-351-1100-1)
 * @returns PrimeVue Tag severity 값
 */
const getCategorySeverity = (cdId: string) => {
    const cttTp = getCttTp(cdId);
    switch (cttTp) {
        case 'IOE_CPIT': return 'info';       // 자본예산
        case 'IOE_LEAFE': return 'danger';     // 임차료
        case 'IOE_XPN': return 'warning';      // 여비/경비
        case 'IOE_SEVS': return 'contrast';    // 용역비
        case 'IOE_IDR': return 'secondary';    // 제비/간접비
        default: return 'secondary';
    }
};

/**
 * HTML 새니타이징 (XSS 방지)
 * DOMPurify를 사용하여 Rich Text 필드의 악성 스크립트를 제거합니다.
 *
 * @param html - 새니타이징할 HTML 문자열
 * @returns 안전한 HTML 문자열
 */
const sanitizeHtml = (html: string) => DOMPurify.sanitize(html);

/**
 * 날짜 문자열을 YYYY-MM 형식으로 변환
 * YYYYMMDD(8자리) 또는 YYYY-MM-DD 형식을 모두 처리합니다.
 *
 * @param dateStr - 변환할 날짜 문자열
 * @returns 'YYYY-MM' 형식 문자열 또는 '-'
 */
const formatDateToYearMonth = (dateStr?: string) => {
    if (!dateStr) return '-';
    /* YYYYMMDD 형식인 경우 */
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}`;
    }
    /* YYYY-MM-DD 형식인 경우 */
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : dateStr;
    }
    return dateStr;
};

// --- 목차 (TOC) 관련 상태 및 로직 ---
const allTocItems = [
    { id: 'section-progress', label: '사업 진행 현황', icon: 'pi pi-step-forward-alt' },
    {
        id: 'section-overview',
        label: '사업 개요',
        icon: 'pi pi-info-circle',
        children: [
            { id: 'sub-overview-desc', label: '사업 주요내용' },
            { id: 'sub-overview-status', label: '현황 & 필요성' },
            { id: 'sub-overview-expect', label: '기대효과 & 문제점', ordinaryHidden: true }
        ]
    },
    {
        id: 'section-scope',
        label: '사업 범위 및 일정',
        icon: 'pi pi-map',
        ordinaryHidden: true,
        children: [
            { id: 'sub-scope-range', label: '사업 범위' },
            { id: 'sub-scope-history', label: '추진 경과 & 향후 계획' },
            { id: 'sub-scope-dates', label: '사업 일정 & 추진가능성' }
        ]
    },
    { id: 'section-category', label: '사업 구분', icon: 'pi pi-tags', ordinaryHidden: true },
    { id: 'section-criteria', label: '편성 기준', icon: 'pi pi-check-circle', ordinaryHidden: true },
    {
        id: 'section-org',
        label: '담당 조직',
        icon: 'pi pi-users',
        ordinaryHidden: true,
        children: [
            { id: 'sub-org-business', label: '주관부서 & IT 담당부서' }
        ]
    },
    {
        id: 'section-budget',
        label: '소요예산',
        icon: 'pi pi-wallet',
        children: [
            { id: 'sub-budget-total', label: '총 예산 & 전결권 & 보고상태' }
        ]
    },
    { id: 'section-resource', label: '소요자원 상세내용', icon: 'pi pi-box' }
];

/** 경상사업 시 숨겨진 섹션을 제외한 TOC 항목 */
const tocItems = computed(() => {
    if (!isOrdinary.value) return allTocItems;
    return allTocItems
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter(item => !(item as any).ordinaryHidden)
        .map(item => ({
            ...item,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            children: item.children?.filter(c => !(c as any).ordinaryHidden)
        }));
});

const activeSection = ref('section-progress');
let observer: IntersectionObserver | null = null;
const visibleSections = new Set<string>();

const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        const container = el.closest('main') || document.querySelector('main');
        if (container) {
            const yOffset = -24; // 스티키 여백 고려
            // 컨테이너 스크롤 top + 요소의 상대 위치 - 컨테이너의 상대 위치 + 여백
            const y = el.getBoundingClientRect().top + container.scrollTop - container.getBoundingClientRect().top + yOffset;
            container.scrollTo({ top: y, behavior: 'smooth' });
        } else {
            const yOffset = -80;
            const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }
};

onMounted(() => {
    // 옵저버 생성 시 root를 main 컨테이너로 설정 (레이아웃 scroll-container 기준)
    const rootContainer = document.querySelector('main');

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                visibleSections.add(entry.target.id);
            } else {
                visibleSections.delete(entry.target.id);
            }
        });

        // 화면에 보여지는 섹션 중 가장 상단(목차 순서상 먼저 나오는) 것을 activeSection으로 지정
        const allIds = allTocItems.flatMap(item => [item.id, ...(item.children?.map(c => c.id) || [])]);
        for (const id of allIds) {
            if (visibleSections.has(id)) {
                activeSection.value = id;
                break;
            }
        }
    }, {
        root: rootContainer,
        rootMargin: '-10px 0px -60% 0px' // 스크롤 시 상단 바로 아래부터 감지하도록 여백 조정
    });

    allTocItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && observer) observer.observe(el);
        if (item.children) {
            item.children.forEach(child => {
                const childEl = document.getElementById(child.id);
                if (childEl && observer) observer.observe(childEl);
            });
        }
    });
});

onUnmounted(() => {
    if (observer) observer.disconnect();
});
</script>

<template>
    <!-- 프로젝트 데이터 존재 시 상세 화면 -->
    <div v-if="project" class="space-y-8 pb-20">

        <!-- 상단 헤더: 사업명 + 상태 태그 + 액션 버튼 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
                <!-- 뒤로 가기 버튼 -->
                <Button
icon="pi pi-arrow-left" text rounded aria-label="Back" class="mt-1 w-10 h-10 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                    @click="router.back()" />
                <div class="space-y-2">
                    <!-- 사업 유형 태그 + 관리번호 + 기간 -->
                    <div class="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <Tag
v-if="isOrdinary" value="경상사업"
                            class="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-0 px-2.5 py-0.5 font-medium"
                            rounded />
                        <Tag
                            :value="getPrjTpName(project.prjTp)"
                            class="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 px-2.5 py-0.5 font-medium"
                            rounded />
                        <span class="font-mono text-zinc-400">#{{ project.prjMngNo }}</span>
                        <span class="text-zinc-300 dark:text-zinc-700">|</span>
                        <div
                            v-if="!isOrdinary"
                            class="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">
                            <i class="pi pi-calendar text-zinc-400"/>
                            <span>{{ project.sttDt }} ~ {{ project.endDt }}</span>
                        </div>
                        <span v-else class="text-xs font-medium">{{ project.bgYy }}년</span>
                    </div>
                    <!-- 사업명 + 진행 상태 태그 -->
                    <div class="flex flex-wrap items-center gap-3">
                        <h1 class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                            project.prjNm }}</h1>
                        <Tag
                            :value="project.prjSts" :class="getProjectTagClass(project.prjSts || '')"
                            class="text-sm px-3 py-1 font-bold shadow-sm" rounded />
                    </div>
                </div>
            </div>

            <!-- 액션 버튼: 목록 / 삭제(조건부) / 수정 -->
            <div class="flex gap-2 self-end md:self-center">
                <Button
label="돌아가기" icon="pi pi-arrow-left" severity="secondary" outlined class="bg-white dark:bg-zinc-900"
                    @click="router.back()" />
                <!-- 결재 중이거나 완료된 경우, 또는 수정 권한이 없는 경우 삭제 버튼 숨김 -->
                <Button
v-if="!['결재중', '결재완료', '승인'].includes(project.applicationInfo?.apfSts)
                    && canModify(project.fstEnrUsid, project.svnDpm)" label="삭제"
                    icon="pi pi-trash" severity="danger" outlined class="bg-white dark:bg-zinc-900"
                    @click="handleDelete" />
                <!-- 수정 권한이 있는 경우에만 수정 버튼 표시 -->
                <Button
v-if="canModify(project.fstEnrUsid, project.svnDpm)" label="수정" icon="pi pi-pencil"
                    class="shadow-lg shadow-indigo-500/20"
                    @click="navigateTo(`/info/projects/form?id=${project.prjMngNo}${isOrdinary ? '&ordinary=true' : ''}`)" />
            </div>
        </div>

        <!-- 본문 영역: col1(상세 내용) / col2(바로가기 목차) -->
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-8 items-stretch relative">

            <!-- col1: 상세 내용 영역 (75%) -->
            <div class="xl:col-span-3 flex flex-col gap-10 w-full">

                <!-- 섹션 1: 사업 진행 현황 타임라인 -->
                <section
id="section-progress"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md overflow-visible">
                    <div class="flex items-center justify-between mb-8">
                        <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <i class="pi pi-step-forward-alt text-indigo-500"/>
                            사업 진행 현황
                        </h3>
                        <!-- 현재 단계 뱃지 -->
                        <span
                            class="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                            {{ project.prjSts }}
                        </span>
                    </div>

                    <!-- 타임라인 컨테이너 -->
                    <div class="relative w-full px-2">
                        <!-- 전체 기준선 (회색): 첫 원 중심 ~ 마지막 원 중심 -->
                        <div
class="absolute h-[2px] bg-zinc-200 dark:bg-zinc-700"
                            :style="{ top: '20px', left: `calc(100% / ${PROJECT_STAGES.length * 2})`, right: `calc(100% / ${PROJECT_STAGES.length * 2})` }"/>
                        <!-- 완료 진행선 (인디고): 첫 원 중심 ~ 현재 단계 원 중심 -->
                        <div
class="absolute h-[2px] bg-indigo-500 transition-all duration-700"
                            :style="{ top: '20px', left: `calc(100% / ${PROJECT_STAGES.length * 2})`, width: timelineProgressWidth }"/>

                        <div class="flex items-start justify-between w-full">
                            <!-- 각 단계 스텝 -->
                            <div
v-for="(step, index) in PROJECT_STAGES" :key="index"
                                class="relative flex flex-col items-center flex-1 group">

                                <!-- 원형 마커: 완료(체크)/현재(진행 텍스트+링)/예정(숫자) -->
                                <div
class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 relative z-10 mb-3 shrink-0"
                                    :class="[
                                        getCurrentStageIndex(project.prjSts) > Number(index)
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-400 dark:border-indigo-800 dark:bg-indigo-900/10 dark:text-indigo-500'
                                            : getCurrentStageIndex(project.prjSts) === Number(index)
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 scale-110 ring-4 ring-indigo-50 dark:ring-indigo-900/20'
                                                : 'border-zinc-200 text-zinc-300 dark:border-zinc-700 dark:text-zinc-600 bg-white dark:bg-zinc-900'
                                    ]">

                                    <!-- 완료 단계: 체크 아이콘 -->
                                    <i
v-if="getCurrentStageIndex(project.prjSts) > Number(index)"
                                        class="pi pi-check text-lg font-bold"/>
                                    <!-- 현재 단계: '진행' 텍스트 -->
                                    <span
v-else-if="getCurrentStageIndex(project.prjSts) === Number(index)"
                                        class="text-[10px] font-bold tracking-tighter">진행</span>
                                    <!-- 예정 단계: 순번 숫자 -->
                                    <span v-else>{{ Number(index) + 1 }}</span>

                                    <!-- 현재 단계 핑 애니메이션 -->
                                    <span
v-if="getCurrentStageIndex(project.prjSts) === Number(index)"
                                        class="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20"/>
                                </div>

                                <!-- 단계 라벨 텍스트 -->
                                <div class="h-10 flex items-start justify-center w-full">
                                    <span
                                        class="text-[10px] sm:text-xs font-medium text-center break-keep leading-tight px-0.5 transition-colors duration-300 w-full"
                                        :class="[
                                            getCurrentStageIndex(project.prjSts) === Number(index)
                                                ? 'text-indigo-700 dark:text-indigo-400 font-bold'
                                                : getCurrentStageIndex(project.prjSts) > Number(index)
                                                    ? 'text-zinc-500 dark:text-zinc-500'
                                                    : 'text-zinc-300 dark:text-zinc-600'
                                        ]">
                                        {{ step }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 섹션 2: 사업 개요 -->
                <section
id="section-overview"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md flex flex-col gap-6">

                    <div id="sub-overview-desc" class="scroll-mt-6">
                        <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                            <i class="pi pi-info-circle text-blue-500"/>
                            사업 개요
                        </h3>
                        <!-- 사업 주요내용 (Rich Text - XSS 방어 적용) -->
                        <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md block mb-2">사업 주요내용</label>
                        <div
class="ql-editor p-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                            style="height: 200px; overflow-y: auto;"
                            v-html="sanitizeHtml(project.prjDes || '<span class=\'text-zinc-400 italic\'>내용 없음</span>')"/>
                    </div>
                    <!-- 현황 / 필요성 / 기대효과 / 미추진 시 문제점 (2x2 타임라인 스타일) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- 현황 -->
                        <div id="sub-overview-status" class="relative scroll-mt-6">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <i class="pi pi-chart-bar text-sm"/>
                                </div>
                                <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">현황</label>
                                <div
                                    class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 h-[100px] overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                                    {{ project.saf || '-' }}
                                </div>
                            </div>
                        </div>
                        <!-- 필요성 -->
                        <div id="sub-overview-need" class="relative scroll-mt-6">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <i class="pi pi-question-circle text-sm"/>
                                </div>
                                <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">필요성</label>
                                <div
                                    class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 h-[100px] overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                                    {{ project.ncs || '-' }}
                                </div>
                            </div>
                        </div>
                        <!-- 기대효과 (경상사업 숨김) -->
                        <div v-if="!isOrdinary" id="sub-overview-expect" class="relative scroll-mt-6">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-50 dark:bg-blue-900/20"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                                    <i class="pi pi-star text-sm"/>
                                </div>
                                <label
                                    class="font-bold text-blue-900 dark:text-blue-100 text-md mb-3 block">기대효과</label>
                                <div
                                    class="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 h-[100px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                    {{ project.xptEff || '-' }}
                                </div>
                            </div>
                        </div>
                        <!-- 미추진 시 문제점 (경상사업 숨김) -->
                        <div v-if="!isOrdinary" id="sub-overview-problem" class="relative scroll-mt-6">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-red-50 dark:bg-red-900/20"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                    <i class="pi pi-exclamation-triangle text-sm"/>
                                </div>
                                <label class="font-bold text-red-900 dark:text-red-100 text-md mb-3 block">미추진 시
                                    문제점</label>
                                <div
                                    class="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 h-[100px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                    {{ project.plm || '-' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 섹션 3 & 4: 사업 범위 및 일정 + 진행 상황 + 추진시기 (경상사업 숨김) -->
                <section
v-if="!isOrdinary" id="section-scope"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md flex flex-col gap-6">

                    <!-- 사업 범위 및 일정 -->
                    <div id="sub-scope-range" class="scroll-mt-6">
                        <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                            <i class="pi pi-map text-green-500"/>
                            사업 범위 및 일정
                        </h3>
                        <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md block mb-2">사업 범위</label>
                        <div
class="ql-editor p-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                            style="height: 200px;"
                            v-html="sanitizeHtml(project.prjRng || '<span class=\'text-zinc-400 italic\'>내용 없음</span>')"/>
                    </div>

                    <!-- 진행 상황 (추진 경과 + 향후 계획) -->
                    <div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <!-- 추진 경과 -->
                            <div id="sub-scope-history" class="relative scroll-mt-6">
                                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                                <div class="relative pl-10">
                                    <div
                                        class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                        <i class="pi pi-history text-sm"/>
                                    </div>
                                    <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">추진
                                        경과</label>
                                    <div
                                        class="p-5 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 min-h-[120px] text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                                        {{ project.pulPsg || '-' }}
                                    </div>
                                </div>
                            </div>
                            <!-- 향후 계획 -->
                            <div id="sub-scope-plan" class="relative scroll-mt-6">
                                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-50 dark:bg-indigo-900/20"/>
                                <div class="relative pl-10">
                                    <div
                                        class="absolute left-0 top-0 w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500">
                                        <i class="pi pi-calendar-plus text-sm"/>
                                    </div>
                                    <label class="font-bold text-indigo-900 dark:text-indigo-100 text-md mb-3 block">향후
                                        계획</label>
                                    <div
                                        class="p-5 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/20 min-h-[120px] text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                        {{ project.hrfPln || '-' }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="border-t border-zinc-100 dark:border-zinc-800"/>

                    <!-- 시작일 / 종료일 / 추진가능성 -->
                    <div id="sub-scope-dates" class="grid grid-cols-1 md:grid-cols-3 gap-8 scroll-mt-6">
                        <!-- 시작일 -->
                        <div class="relative">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <i class="pi pi-calendar text-sm"/>
                                </div>
                                <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">사업시작
                                    예정일</label>
                                <div
                                    class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400">
                                    {{ project.sttDt || '-' }}
                                </div>
                            </div>
                        </div>
                        <!-- 종료일 -->
                        <div class="relative">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <i class="pi pi-calendar-minus text-sm"/>
                                </div>
                                <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">사업종료
                                    예정일</label>
                                <div
                                    class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400">
                                    {{ project.endDt || '-' }}
                                </div>
                            </div>
                        </div>
                        <!-- 추진가능성 -->
                        <div class="relative">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-green-50 dark:bg-green-900/20"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-500">
                                    <i class="pi pi-check-circle text-sm"/>
                                </div>
                                <label
                                    class="font-bold text-green-900 dark:text-green-100 text-md mb-3 block">추진가능성</label>
                                <div
                                    class="p-4 bg-green-50/30 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20 text-sm text-zinc-700 dark:text-zinc-300">
                                    {{ getPrjPulPttName(String(project.prjPulPtt ?? '')) }}
                                </div>
                            </div>
                        </div>
                    </div>

                </section>
                <!-- 섹션 5: 사업 구분 (경상사업 숨김) -->
                <section
v-if="!isOrdinary" id="section-category"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-tags text-purple-500"/>
                        사업 구분
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">업무 구분</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ getBzDttName(project.bzDtt) }}</span>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">사업 유형</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ getPrjTpName(project.prjTp) }}</span>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">기술 유형</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ getTchnTpName(project.tchnTp) }}</span>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">주요 사용자</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ getMnUsrName(project.mnUsr) }}</span>
                        </div>
                    </div>
                </section>

                <!-- 섹션 6: 편성 기준 (경상사업 숨김) -->
                <section
v-if="!isOrdinary" id="section-criteria"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-check-circle text-teal-500"/>
                        편성 기준
                    </h3>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">중복 여부</span>
                            <Tag
                                :severity="project.dplYn === 'Y' ? 'danger' : 'success'"
                                :value="project.dplYn === 'Y' ? '중복 (Y)' : '미중복 (N)'" rounded/>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">법규상 완료시기</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ project.lblFsgTlm || '-'
                            }}</span>
                        </div>
                    </div>
                </section>
                <!-- 섹션 7: 담당 조직 (경상사업 숨김) -->
                <section
v-if="!isOrdinary" id="section-org"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-users text-cyan-500"/>
                        담당 조직
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <!-- 주관부서 정보 카드 (Business Owner) -->
                        <div
id="sub-org-business"
                            class="scroll-mt-6 flex flex-col gap-4 p-6 bg-gradient-to-br from-blue-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-blue-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                            <div
                                class="absolute right-0 top-0 w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"/>
                            <!-- 부서 아이콘 + 이름 -->
                            <div class="flex items-center gap-3 z-10">
                                <div
                                    class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-50 dark:border-zinc-700 shrink-0">
                                    <i class="pi pi-briefcase text-lg"/>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-blue-500 uppercase tracking-wider">주관부서</div>
                                    <div
                                        class="font-extrabold text-base text-zinc-900 dark:text-zinc-100 leading-tight">
                                        {{
                                            project.svnDpmNm }}</div>
                                    <div class="text-xs text-zinc-500">{{ project.svnHdq }}</div>
                                </div>
                            </div>
                            <!-- 담당팀장 / 담당자 -->
                            <div class="flex flex-col gap-2 pt-3 border-t border-blue-100 dark:border-zinc-700 z-10">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-zinc-400 font-medium">담당팀장</span>
                                    <span class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">{{
                                        project.svnDpmTlrNm
                                        || '-' }}</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-zinc-400 font-medium">담당자</span>
                                    <span class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">{{
                                        project.svnDpmCgprNm
                                        || '-' }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- IT부서 정보 카드 (IT Partner) -->
                        <div
id="sub-org-it"
                            class="scroll-mt-6 flex flex-col gap-4 p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-indigo-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                            <div
                                class="absolute right-0 top-0 w-24 h-24 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"/>
                            <!-- 부서 아이콘 + 이름 -->
                            <div class="flex items-center gap-3 z-10">
                                <div
                                    class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-50 dark:border-zinc-700 shrink-0">
                                    <i class="pi pi-desktop text-lg"/>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-indigo-500 uppercase tracking-wider">IT 담당부서
                                    </div>
                                    <div
                                        class="font-extrabold text-base text-zinc-900 dark:text-zinc-100 leading-tight">
                                        {{
                                            project.itDpmNm }}</div>
                                </div>
                            </div>
                            <!-- 담당팀장 / 담당자 -->
                            <div class="flex flex-col gap-2 pt-3 border-t border-indigo-100 dark:border-zinc-700 z-10">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-zinc-400 font-medium">담당팀장</span>
                                    <span class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">{{
                                        project.itDpmTlrNm
                                        || '-' }}</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-zinc-400 font-medium">담당자</span>
                                    <span class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">{{
                                        project.itDpmCgprNm
                                        || '-' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 섹션 8: 추진시기 및 소요예산 -->
                <section
id="section-budget"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-wallet text-yellow-500"/>
                        소요예산
                    </h3>
                    <!-- 총예산 / 전결권 / 보고상태 카드 (경상사업: 보고상태 숨김 → 2열) -->
                    <div class="grid gap-4" :class="isOrdinary ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'">
                        <!-- 총 예산 카드 -->
                        <div
id="sub-budget-total"
                            class="scroll-mt-6 flex flex-col justify-between p-6 bg-yellow-50/[0.6] dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide mb-2">
                                    총 예산</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                                    formatCurrency(project.prjBg) }}</div>
                            </div>
                            <!-- 자본예산 / 일반관리비 상세 -->
                            <div class="mt-4 pt-3 border-t border-yellow-100 dark:border-yellow-900/30 z-10 space-y-1">
                                <div class="flex justify-between text-xs text-zinc-500">
                                    <span>자본예산</span>
                                    <span class="font-medium text-zinc-700 dark:text-zinc-300">{{
                                        formatCurrency(project.assetBg ?? 0) }}</span>
                                </div>
                                <div class="flex justify-between text-xs text-zinc-500">
                                    <span>일반관리비</span>
                                    <span class="font-medium text-zinc-700 dark:text-zinc-300">{{
                                        formatCurrency(project.costBg ?? 0) }}</span>
                                </div>
                            </div>
                        </div>
                        <!-- 전결권 카드 -->
                        <div
id="sub-budget-auth"
                            class="scroll-mt-6 flex flex-col justify-between p-6 bg-blue-50/[0.6] dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wide mb-2">
                                    전결권</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                                    project.edrt || '-' }}</div>
                            </div>
                            <!-- 전결권 결정 근거 -->
                            <div class="mt-4 pt-3 border-t border-blue-100 dark:border-blue-900/30 z-10">
                                <p class="text-xs text-zinc-400 leading-relaxed">
                                    {{ approvalBasisText }}
                                </p>
                            </div>
                        </div>
                        <!-- 보고상태 카드 (경상사업 숨김) -->
                        <div
v-if="!isOrdinary" id="sub-budget-report"
                            class="scroll-mt-6 flex flex-col justify-between p-6 bg-green-50/[0.6] dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-green-600 dark:text-green-500 uppercase tracking-wide mb-2">
                                    보고상태</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                                    getRprStsName(project.rprSts) }}</div>
                            </div>
                            <!-- 보고상태 안내 문구 -->
                            <div class="mt-4 pt-3 border-t border-green-100 dark:border-green-900/30 z-10">
                                <p class="text-xs text-zinc-400 leading-relaxed">
                                    미보고 시 본건(예산 요청) 결재권자인 <span class="font-semibold text-zinc-500">'부장'</span> 선택
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 섹션 9: 소요자원 상세내용 DataTable -->
                <section
id="section-resource"
                    class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md"
                    style="height: 1000px;">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-box text-pink-500"/>
                        소요자원 상세내용
                    </h3>
                    <div class="rounded-xl overflow-hidden">
                        <StyledDataTable
                            :value="project.items || []" size="small"
                            striped-rows class="resource-table-modern">
                            <template #empty>
                                <div class="text-center text-zinc-500 py-12 flex flex-col items-center gap-3">
                                    <i class="pi pi-inbox text-4xl text-zinc-300"/>
                                    <p>등록된 소요자원이 없습니다.</p>
                                </div>
                            </template>
                            <!-- 구분: 공통코드 cdNm 표시 + cttTp 기반 색상 Badge -->
                            <Column
                                field="gclDtt" header="구분" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                style="min-width: 100px">
                                <template #body="{ data }">
                                    <Tag
                                        :value="getCodeNm(data.gclDtt)" :severity="getCategorySeverity(data.gclDtt)" rounded
                                        class="text-xs"/>
                                </template>
                            </Column>
                            <Column
                                field="gclNm" header="품목명" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                style="min-width: 250px">
                                <template #body="{ data }">
                                    <span class="text-zinc-700 dark:text-zinc-200 font-medium">{{ data.gclNm }}</span>
                                </template>
                            </Column>
                            <Column
                                field="gclQtt" header="수량" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-right" style="width: 80px" />
                            <!-- 단가: 소계 ÷ 수량으로 계산 -->
                            <Column
                                field="upr" header="단가" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-right" style="min-width: 120px">
                                <template #body="{ data }">
                                    <span class="text-zinc-600 dark:text-zinc-400">{{ formatCurrency(data.gclAmt /
                                        data.gclQtt
                                        || 0, data.cur) }}</span>
                                </template>
                            </Column>
                            <Column
                                field="cur" header="통화" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="width: 60px">
                                <template #body="{ data }">
                                    <span class="text-xs">
                                        {{ data.cur }}
                                        <span v-if="data.cur && data.cur !== 'KRW' && data.xcr" class="text-zinc-500">
                                            ({{ data.xcr.toLocaleString() }})
                                        </span>
                                    </span>
                                </template>
                            </Column>
                            <!-- 소계 -->
                            <Column
                                field="amt" header="소계" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 140px">
                                <template #body="{ data }">
                                    <span class="font-medium text-zinc-900 dark:text-zinc-100">{{
                                        formatCurrency(data.gclAmt ||
                                            0, data.cur) }}</span>
                                </template>
                            </Column>
                            <Column
                                field="bgFdtn" header="산정근거"
                                header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center" style="min-width: 100px"
                                class="text-right bg-zinc-50/50 dark:bg-zinc-900" />
                            <!-- 도입시기: 자본예산(IOE_CPIT) -->
                            <Column
                                header="도입시기" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-center bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 100px">
                                <template #body="{ data }">
                                    <span
                                        v-if="getCttTp(data.gclDtt) === 'IOE_CPIT'"
                                        class="text-zinc-600 dark:text-zinc-300">
                                        {{ formatDateToYearMonth(data.itdDt) }}
                                    </span>
                                    <span v-else class="text-zinc-400 dark:text-zinc-600 font-light">-</span>
                                </template>
                            </Column>
                            <!-- 지급주기: 자본예산 이외 -->
                            <Column
                                header="지급주기" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-center bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 100px">
                                <template #body="{ data }">
                                    <span
                                        v-if="getCttTp(data.gclDtt) !== 'IOE_CPIT' && getCttTp(data.gclDtt)"
                                        class="text-zinc-600 dark:text-zinc-300">
                                        {{ data.dfrCle || '-' }}
                                    </span>
                                    <span v-else class="text-zinc-400 dark:text-zinc-600 font-light">-</span>
                                </template>
                            </Column>
                            <!-- 정보보호 여부 -->
                            <Column
                                field="infPrtYn" header="정보보호"
                                header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-center bg-zinc-50/50 dark:bg-zinc-900" style="width: 80px">
                                <template #body="{ data }">
                                    <Tag
                                        :value="data.infPrtYn === 'Y' ? 'Y' : 'N'"
                                        :severity="data.infPrtYn === 'Y' ? 'success' : 'secondary'" rounded
                                        class="text-xs"/>
                                </template>
                            </Column>
                            <!-- 통합인프라 여부 -->
                            <Column
                                field="itrInfrYn" header="통합인프라"
                                header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="text-center bg-zinc-50/50 dark:bg-zinc-900" style="width: 90px">
                                <template #body="{ data }">
                                    <Tag
                                        :value="data.itrInfrYn === 'Y' ? 'Y' : 'N'"
                                        :severity="data.itrInfrYn === 'Y' ? 'success' : 'secondary'" rounded
                                        class="text-xs"/>
                                </template>
                            </Column>
                            <!-- Footer: 소요자원 총 합계 -->
                            <ColumnGroup type="footer">
                                <Row>
                                    <Column footer="총 합계 (원화 환산)" :colspan="5" footer-class="text-center font-bold" />
                                    <Column
                                        :footer="formatCurrency(totalItemsAmount, 'KRW')"
                                        footer-class="text-center font-medium text-indigo-600 dark:text-indigo-400" />
                                    <Column :colspan="5" />
                                </Row>
                            </ColumnGroup>
                        </StyledDataTable>
                    </div>
                </section>

            </div> <!-- // col1 종료 -->

            <!-- col2: 목차 영역 (25%) -->
            <div class="xl:col-span-1 relative hidden xl:block">
                <!-- 스크롤 시 화면 상단에 고정 (카드 스타일 제거 -> 심플한 사이드바 스타일) -->
                <div class="sticky top-6 lg:pl-4">
                    <h3
                        class="font-bold text-[14px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 px-3 flex items-center gap-2">
                        <i class="pi pi-align-left text-sm text-zinc-300 dark:text-zinc-600"/> 바로가기 목차
                    </h3>

                    <ul class="flex flex-col relative border-l border-zinc-200 dark:border-zinc-800 ml-3">
                        <li v-for="item in tocItems" :key="item.id" class="flex flex-col mb-1 relative">
                            <!-- 활성화 인디케이터 (왼쪽 보더선) -->
                            <div
v-if="activeSection === item.id || (item.children && item.children.some(c => activeSection === c.id))"
                                class="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] bg-indigo-500 rounded-full"/>

                            <div
class="relative flex items-center gap-3 py-1.5 px-4 cursor-pointer transition-colors duration-200 group text-[14px]"
                                :class="(activeSection === item.id || (item.children && item.children.some(c => activeSection === c.id))) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
                                @click="scrollTo(item.id)">
                                <span class="truncate">{{ item.label }}</span>
                            </div>

                            <!-- 하위 목차 (children이 있는 경우) -->
                            <ul v-if="item.children" class="flex flex-col gap-0.5 mt-0.5 mb-2 ml-5">
                                <li v-for="child in item.children" :key="child.id" class="relative">
                                    <div
class="py-1 px-3 rounded-md cursor-pointer transition-colors duration-200 text-[13px] flex items-center"
                                        :class="activeSection === child.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'"
                                        @click.stop="scrollTo(child.id)">
                                        <span class="truncate">{{ child.label }}</span>
                                    </div>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div> <!-- // col2 종료 -->

        </div> <!-- // 본문 레이아웃 종료 -->

    </div>

    <!-- API 오류 상태 -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500 animate-pulse">
        <i class="pi pi-exclamation-circle text-5xl mb-6"/>
        <h2 class="text-2xl font-bold mb-2">데이터를 불러오지 못했습니다</h2>
        <p class="text-zinc-500 mb-6">{{ error.message }}</p>
        <Button label="다시 시도" icon="pi pi-refresh" @click="router.go(0)" />
        <Button label="목록으로" link class="mt-2" @click="router.back()" />
    </div>

    <!-- 데이터 없음 (존재하지 않는 ID) -->
    <div v-else class="flex flex-col items-center justify-center py-32 text-center opacity-50">
        <div class="text-6xl mb-6 grayscale filter">😢</div>
        <h2 class="text-2xl font-bold text-zinc-800 dark:text-zinc-200">찾으시는 사업 정보가 없습니다.</h2>
        <p class="text-zinc-500 mt-2">삭제되었거나 존재하지 않는 프로젝트 ID입니다.</p>
        <Button label="목록으로 돌아가기" outlined class="mt-8" @click="router.back()" />
    </div>
</template>

<style scoped>
/** 소요자원 테이블 전체 폰트 크기 통일 (13px) */
:deep(.resource-table-modern .p-datatable-thead > tr > th),
:deep(.resource-table-modern .p-datatable-tbody > tr > td),
:deep(.resource-table-modern .p-datatable-tfoot > tr > td) {
    font-size: 0.8125rem !important;
}

/** 헤더 셀 내부 flex 컨테이너 가운데 정렬 (PrimeVue 3/4 모두 대응) */
:deep(.resource-table-modern .p-datatable-thead > tr > th .p-column-header-content),
:deep(.resource-table-modern .p-datatable-thead > tr > th .p-datatable-column-header-content) {
    justify-content: center;
}
</style>
