<!-- 정보화사업 상세 페이지: URL의 prjMngNo로 사업 상세, 결재 상태, 리치 텍스트 본문을 조회합니다. -->
<script setup lang="ts">
import 'quill/dist/quill.core.css';
import DOMPurify from 'isomorphic-dompurify';
import { useToast } from 'primevue/usetoast';
import { getProjectTagClass, getApprovalAuthorityBasis } from '~/utils/common';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import ProjectOverviewSection from '~/components/projects/ProjectOverviewSection.vue';
import ProjectProgressSection from '~/components/projects/ProjectProgressSection.vue';

const route = useRoute();
const router = useRouter();
/** URL 파라미터에서 사업 관리번호 추출 */
const prjMngNo = route.params.id;

const { fetchProject, deleteProject } = useProjects();
// RBAC 권한 헬퍼: 수정/삭제 버튼 표시 여부 판단에 사용
const { canModify } = useAuth();
const { data: project, error, pending, refresh: refreshProject } = await fetchProject(prjMngNo as string);

/** KeepAlive 재활성화 시 최신 데이터 재조회 + scrollspy 재연결 */
onActivated(() => {
    refreshProject();
    attachScrollSpy();
});
onDeactivated(() => detachScrollSpy());
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

const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        const container = el.closest('main') || document.querySelector('main');
        if (container) {
            const yOffset = -24;
            const y = el.getBoundingClientRect().top + container.scrollTop - container.getBoundingClientRect().top + yOffset;
            container.scrollTo({ top: y, behavior: 'smooth' });
        } else {
            const y = el.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }
};

/** 현재 스크롤 위치에서 화면 상단에 가장 가까운 섹션 ID를 반환 */
const computeActiveSection = (): string => {
    const container = document.querySelector<HTMLElement>('main');
    if (!container) return activeSection.value;
    // main 상단으로부터 120px 아래를 기준선으로 삼아, 기준선을 지난 마지막 섹션을 활성화
    const threshold = container.getBoundingClientRect().top + 120;
    const allIds = allTocItems.flatMap(item => [item.id, ...(item.children?.map(c => c.id) || [])]);
    let active = allIds[0] ?? 'section-progress';
    for (const id of allIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= threshold) {
            active = id;
        }
    }
    return active;
};

let ticking = false;
const onScrollSpy = () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            activeSection.value = computeActiveSection();
            ticking = false;
        });
        ticking = true;
    }
};

let scrollAttached = false;
const attachScrollSpy = () => {
    if (scrollAttached) return;
    const container = document.querySelector<HTMLElement>('main');
    if (container) {
        container.addEventListener('scroll', onScrollSpy, { passive: true });
        activeSection.value = computeActiveSection();
        scrollAttached = true;
    }
};
const detachScrollSpy = () => {
    if (!scrollAttached) return;
    document.querySelector<HTMLElement>('main')?.removeEventListener('scroll', onScrollSpy);
    scrollAttached = false;
};

onMounted(() => attachScrollSpy());
onUnmounted(() => detachScrollSpy());
</script>

<template>
    <!-- 프로젝트 데이터 존재 시 상세 화면 -->
    <div v-if="project" class="space-y-8 pb-20">

        <!-- 상단 헤더: 사업명 + 상태 태그 + 액션 버튼 -->
        <PageHeader>
            <template #leading>
                <Button
icon="pi pi-arrow-left" text rounded aria-label="Back"
                    class="w-10 h-10 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                    @click="router.back()" />
            </template>
            <template #title>
                <div class="space-y-1">
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
                        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ project.prjNm }}</h1>
                        <Tag
:value="project.prjSts" :class="getProjectTagClass(project.prjSts || '')"
                            class="text-sm px-3 py-1 font-bold shadow-sm" rounded />
                    </div>
                </div>
            </template>
            <template #actions>
                <Button
label="돌아가기" icon="pi pi-arrow-left" severity="secondary" outlined
                    class="bg-white dark:bg-zinc-900" @click="router.back()" />
                <!-- 결재 중이거나 완료된 경우, 또는 수정 권한이 없는 경우 삭제 버튼 숨김 -->
                <Button
                    v-if="!['결재중', '결재완료', '승인'].includes(project.applicationInfo?.apfSts) && canModify(project.fstEnrUsid, project.svnDpm)"
                    label="삭제" icon="pi pi-trash" severity="danger" outlined
                    class="bg-white dark:bg-zinc-900" @click="handleDelete" />
                <!-- 수정 권한이 있는 경우에만 수정 버튼 표시 -->
                <Button
v-if="canModify(project.fstEnrUsid, project.svnDpm)"
                    label="수정" icon="pi pi-pencil" class="shadow-lg shadow-indigo-500/20"
                    @click="navigateTo(`/info/projects/form?id=${project.prjMngNo}${isOrdinary ? '&ordinary=true' : ''}`)" />
            </template>
        </PageHeader>

        <!-- 본문 영역: col1(상세 내용) / col2(바로가기 목차) -->
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-8 items-stretch relative">

            <!-- col1: 상세 내용 영역 (75%) -->
            <div class="xl:col-span-3 flex flex-col gap-10 w-full">

                <ProjectProgressSection :status="project.prjSts" />

                <ProjectOverviewSection
                    :project="project"
                    :is-ordinary="isOrdinary"
                    :sanitize-html="sanitizeHtml"
                />

                <!-- 섹션 3 & 4: 사업 범위 및 일정 + 진행 상황 + 추진시기 (경상사업 숨김) -->
                <section
v-if="!isOrdinary" id="section-scope"
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6">

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
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
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
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
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
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-users text-cyan-500"/>
                        담당 조직
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <!-- 주관부서 정보 카드 (Business Owner) -->
                        <div
id="sub-org-business"
                            class="scroll-mt-6 flex flex-col gap-4 p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-indigo-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                            <div
                                class="absolute right-0 top-0 w-24 h-24 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"/>
                            <!-- 부서 아이콘 + 이름 -->
                            <div class="flex items-center gap-3 z-10">
                                <div
                                    class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-50 dark:border-zinc-700 shrink-0">
                                    <i class="pi pi-briefcase text-lg"/>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-indigo-500 uppercase tracking-wider">주관부서</div>
                                    <div
                                        class="font-extrabold text-base text-zinc-900 dark:text-zinc-100 leading-tight">
                                        {{
                                            project.svnDpmNm }}</div>
                                    <div class="text-xs text-zinc-500">{{ project.svnHdq }}</div>
                                </div>
                            </div>
                            <!-- 담당팀장 / 담당자 -->
                            <div class="flex flex-col gap-2 pt-3 border-t border-indigo-100 dark:border-zinc-700 z-10">
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
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
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
                            class="scroll-mt-6 flex flex-col justify-between p-6 bg-indigo-50/[0.6] dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-indigo-600 dark:text-indigo-500 uppercase tracking-wide mb-2">
                                    전결권</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                                    project.edrt || '-' }}</div>
                            </div>
                            <!-- 전결권 결정 근거 -->
                            <div class="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/30 z-10">
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
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
                    style="height: 1000px;">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-box text-pink-500"/>
                        소요자원 상세내용
                    </h3>
                    <div class="overflow-hidden">
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
                                    <div class="flex justify-center">
                                        <Tag
                                            :value="getCodeNm(data.gclDtt)" :severity="getCategorySeverity(data.gclDtt)" rounded
                                            class="text-xs"/>
                                    </div>
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
                                style="width: 80px">
                                <template #body="{ data }">
                                    <div class="text-right">{{ data.gclQtt }}</div>
                                </template>
                            </Column>
                            <!-- 단가: 소계 ÷ 수량으로 계산 -->
                            <Column
                                field="upr" header="단가" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                style="min-width: 120px">
                                <template #body="{ data }">
                                    <div class="text-right text-zinc-600 dark:text-zinc-400">{{ formatCurrency(data.gclAmt / data.gclQtt || 0, data.cur) }}</div>
                                </template>
                            </Column>
                            <Column
                                field="cur" header="통화" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="bg-zinc-50/50 dark:bg-zinc-900" style="width: 60px">
                                <template #body="{ data }">
                                    <div class="text-center text-xs">
                                        {{ data.cur }}
                                        <span v-if="data.cur && data.cur !== 'KRW' && data.xcr" class="text-zinc-500">
                                            ({{ data.xcr.toLocaleString() }})
                                        </span>
                                    </div>
                                </template>
                            </Column>
                            <!-- 소계 -->
                            <Column
                                field="amt" header="소계" header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 140px">
                                <template #body="{ data }">
                                    <div class="text-right font-medium text-zinc-900 dark:text-zinc-100">{{ formatCurrency(data.gclAmt || 0, data.cur) }}</div>
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
                                class="bg-zinc-50/50 dark:bg-zinc-900" style="width: 80px">
                                <template #body="{ data }">
                                    <div class="flex justify-center">
                                        <Tag
                                            :value="data.infPrtYn === 'Y' ? 'Y' : 'N'"
                                            :severity="data.infPrtYn === 'Y' ? 'success' : 'secondary'" rounded
                                            class="text-xs"/>
                                    </div>
                                </template>
                            </Column>
                            <!-- 통합인프라 여부 -->
                            <Column
                                field="itrInfrYn" header="통합인프라"
                                header-class="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                                class="bg-zinc-50/50 dark:bg-zinc-900" style="width: 90px">
                                <template #body="{ data }">
                                    <div class="flex justify-center">
                                        <Tag
                                            :value="data.itrInfrYn === 'Y' ? 'Y' : 'N'"
                                            :severity="data.itrInfrYn === 'Y' ? 'success' : 'secondary'" rounded
                                            class="text-xs"/>
                                    </div>
                                </template>
                            </Column>
                            <!-- Footer: 소요자원 총 합계 -->
                            <ColumnGroup type="footer">
                                <Row>
                                    <Column :colspan="5">
                                        <template #footer>
                                            <div class="text-center font-bold">총 합계 (원화 환산)</div>
                                        </template>
                                    </Column>
                                    <Column footer-class="bg-zinc-50/50 dark:bg-zinc-900">
                                        <template #footer>
                                            <div class="text-right font-medium text-indigo-600 dark:text-indigo-400">{{ formatCurrency(totalItemsAmount, 'KRW') }}</div>
                                        </template>
                                    </Column>
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

    <!-- 데이터 없음 (존재하지 않는 ID): refresh() 중 pending 상태에서는 표시하지 않음 -->
    <div v-else-if="!pending" class="flex flex-col items-center justify-center py-32 text-center opacity-50">
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
