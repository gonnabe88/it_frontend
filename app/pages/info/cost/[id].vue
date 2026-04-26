<!--
================================================================================
[pages/info/cost/[id].vue] 전산업무비 상세 페이지
================================================================================
URL 파라미터(id = itMngcNo)로 특정 전산업무비 항목의 상세 정보를 표시합니다.
수정 및 삭제 기능을 제공하며, 삭제 시 확인 다이얼로그를 표시합니다.

[라우팅]
  - 접근: /info/cost/:id
  - 목록 이동: /info/cost
  - 수정 이동: /info/cost/form?id=:id

[UI 구성]
  헤더: 계약명 + 계약구분 태그 + 결재현황 태그 + 액션 버튼
  xl 2-col: 계약 정보 | 담당 조직
  full row: 예산 및 지급 정보 (summary 카드 + 환율 상세)
  full row: 기타 정보 (정보보호여부 + 증감사유)
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useCost } from '~/composables/useCost';
import { getApprovalTagClass } from '~/utils/common';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const { fetchCost, deleteCost } = useCost();

/** URL 파라미터에서 전산업무비 관리번호 추출 */
const id = route.params.id as string;

definePageMeta({ title: '전산업무비 상세' });

/** 전산업무비 상세 데이터 조회 */
const { data: cost, error, refresh: refreshCost } = await fetchCost(id);

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(() => refreshCost());

/**
 * 삭제 확인 다이얼로그 표시 및 처리
 * 사용자 확인 후 deleteCost API를 호출하고 목록으로 이동합니다.
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
                await deleteCost(id);
                if (window.history.length > 1) { router.back(); } else { router.push('/info/cost'); }
            } catch (err) {
                console.error('Failed to delete cost:', err);
                toast.add({
                    severity: 'error',
                    summary: '삭제 실패',
                    detail: '전산업무비 정보를 삭제하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
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
 * @returns 통화 형식 문자열 또는 '-'
 */
const formatCurrency = (value: number | undefined, currency: string = 'KRW') => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(value);
};

// --- 목차 (TOC) 관련 상태 및 로직 ---
interface TocItem {
    id: string;
    label: string;
    icon: string;
    children?: { id: string; label: string; }[];
}

const tocItems: TocItem[] = [
    { id: 'section-contract', label: '계약 정보', icon: 'pi pi-file-edit' },
    { id: 'section-org', label: '담당 조직', icon: 'pi pi-users' },
    { id: 'section-budget', label: '예산 및 지급 정보', icon: 'pi pi-wallet' },
    { id: 'section-etc', label: '기타 정보', icon: 'pi pi-info-circle' }
];

const activeSection = ref('section-contract');
let observer: IntersectionObserver | null = null;
const visibleSections = new Set<string>();

const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        const container = el.closest('main') || document.querySelector('main');
        if (container) {
            const yOffset = -24; // 스티키 여백 고려
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
        const allIds = tocItems.flatMap(item => [item.id, ...(item.children?.map(c => c.id) || [])]);
        for (const id of allIds) {
            if (visibleSections.has(id)) {
                activeSection.value = id;
                break;
            }
        }
    }, {
        root: rootContainer,
        rootMargin: '-10px 0px -60% 0px'
    });

    tocItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && observer) observer.observe(el);
    });
});

onUnmounted(() => {
    if (observer) observer.disconnect();
});
</script>

<template>
    <!-- 데이터 로드 성공 시 상세 화면 -->
    <div v-if="cost" class="space-y-8 pb-20">

        <!-- 상단 헤더: 계약명 + 태그 + 액션 버튼 -->
        <PageHeader>
            <template #leading>
                <Button icon="pi pi-arrow-left" text rounded aria-label="Back"
                    class="w-10 h-10 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                    @click="router.back()" />
            </template>
            <template #title>
                <div class="space-y-1">
                    <!-- 신규/계속 태그 + 관리번호 + 최초지급일 -->
                    <div class="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <Tag :value="cost.pulDtt"
                            class="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 px-2.5 py-0.5 font-medium"
                            rounded />
                        <span class="font-mono text-zinc-400">#{{ cost.itMngcNo }}</span>
                        <span class="text-zinc-300 dark:text-zinc-700">|</span>
                        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">
                            <i class="pi pi-calendar text-zinc-400"/>
                            <span>최초지급: {{ cost.fstDfrDt }}</span>
                        </div>
                    </div>
                    <!-- 계약명 + 결재현황 태그 -->
                    <div class="flex flex-wrap items-center gap-3">
                        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ cost.cttNm }}</h1>
                        <Tag :value="cost.apfSts" :class="getApprovalTagClass(cost.apfSts || '')"
                            class="text-sm px-3 py-1 font-bold shadow-sm" rounded />
                    </div>
                </div>
            </template>
            <template #actions>
                <Button label="돌아가기" icon="pi pi-arrow-left" severity="secondary" outlined
                    class="bg-white dark:bg-zinc-900" @click="router.back()" />
                <Button label="삭제" icon="pi pi-trash" severity="danger" outlined
                    class="bg-white dark:bg-zinc-900" @click="handleDelete" />
                <Button label="수정" icon="pi pi-pencil" class="shadow-lg shadow-indigo-500/20"
                    @click="navigateTo(`/info/cost/form?id=${cost.itMngcNo}`)" />
            </template>
        </PageHeader>

        <!-- 본문 영역: col1(상세 내용) / col2(바로가기 목차) -->
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-8 items-stretch relative">

            <!-- col1: 상세 내용 영역 (75%) -->
            <div class="xl:col-span-3 flex flex-col gap-10 w-full">

                <!-- 계약 정보 -->
                <section
id="section-contract"
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-file-edit text-indigo-500"/>
                        계약 정보
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">비목코드</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ cost.ioeC || '-' }}</span>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">신규/계속</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ cost.pulDtt || '-' }}</span>
                        </div>
                        <div
                            class="col-span-2 flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">계약명</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ cost.cttNm || '-' }}</span>
                        </div>
                        <div
                            class="col-span-2 flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                            <span class="text-zinc-500 text-sm font-medium">계약상대처</span>
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ cost.cttOpp || '-' }}</span>
                        </div>
                    </div>
                </section>

                <!-- 담당 조직 -->
                <section
id="section-org"
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-users text-cyan-500"/>
                        담당 조직
                    </h3>
                    <!-- 추진부서 카드 -->
                    <div
                        class="flex flex-col gap-4 p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-indigo-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                        <div
                            class="absolute right-0 top-0 w-24 h-24 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"/>
                        <!-- 부서 아이콘 + 이름 -->
                        <div class="flex items-center gap-3 z-10">
                            <div
                                class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-50 dark:border-zinc-700 shrink-0">
                                <i class="pi pi-building text-lg"/>
                            </div>
                            <div>
                                <div class="text-xs font-bold text-indigo-500 uppercase tracking-wider">담당부서</div>
                                <div class="font-extrabold text-base text-zinc-900 dark:text-zinc-100 leading-tight">
                                    {{ cost.biceDpmNm || '-' }}
                                </div>
                            </div>
                        </div>
                        <!-- 담당자 / 사번 -->
                        <div class="flex flex-col gap-2 pt-3 border-t border-indigo-100 dark:border-zinc-700 z-10">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-zinc-400 font-medium">담당자</span>
                                <span class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">{{ cost.cgprNm ||
                                    '-' }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-zinc-400 font-medium">사번</span>
                                <span class="text-zinc-900 dark:text-zinc-100 font-mono text-sm">{{ cost.cgpr || '-'
                                    }}</span>
                            </div>
                        </div>
                    </div>
                </section>
                <!-- 예산 및 지급 정보 -->
                <section
id="section-budget"
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-wallet text-yellow-500"/>
                        예산 및 지급 정보
                    </h3>

                    <!-- 전산업무비 예산 / 지급주기 / 최초지급일 summary 카드 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <!-- 전산업무비 예산 -->
                        <div
                            class="flex flex-col justify-between p-6 bg-yellow-50/[0.6] dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide mb-2">
                                    전산업무비 예산</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    {{ formatCurrency(cost.itMngcBg, cost.cur || 'KRW') }}
                                </div>
                            </div>
                            <div class="mt-4 pt-3 border-t border-yellow-100 dark:border-yellow-900/30 z-10">
                                <div class="flex justify-between text-xs text-zinc-500">
                                    <span>통화</span>
                                    <span class="font-medium text-zinc-700 dark:text-zinc-300">{{ cost.cur || 'KRW'
                                        }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- 지급주기 -->
                        <div
                            class="flex flex-col justify-between p-6 bg-indigo-50/[0.6] dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-indigo-600 dark:text-indigo-500 uppercase tracking-wide mb-2">
                                    지급주기</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    {{ cost.dfrCle || '-' }}
                                </div>
                            </div>
                            <div class="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/30 z-10">
                                <p class="text-xs text-zinc-400">정기 지급 주기</p>
                            </div>
                        </div>

                        <!-- 최초지급일 -->
                        <div
                            class="flex flex-col justify-between p-6 bg-green-50/[0.6] dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 text-center relative overflow-hidden">
                            <div
                                class="absolute -right-4 -top-4 w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full blur-xl"/>
                            <div class="z-10">
                                <div
                                    class="text-sm font-bold text-green-600 dark:text-green-500 uppercase tracking-wide mb-2">
                                    최초지급일</div>
                                <div class="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    {{ cost.fstDfrDt || '-' }}
                                </div>
                            </div>
                            <div class="mt-4 pt-3 border-t border-green-100 dark:border-green-900/30 z-10">
                                <p class="text-xs text-zinc-400">최초 지급 예정일</p>
                            </div>
                        </div>
                    </div>

                    <!-- 환율 상세 (외화 계약인 경우에만 표시) -->
                    <div
v-if="cost.cur && cost.cur !== 'KRW'"
                        class="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                        <div class="grid grid-cols-3 gap-3">
                            <div
                                class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                                <span class="text-zinc-500 text-sm font-medium">통화</span>
                                <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ cost.cur }}</span>
                            </div>
                            <div
                                class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                                <span class="text-zinc-500 text-sm font-medium">환율</span>
                                <span class="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                                    {{ cost.xcr?.toLocaleString('ko-KR') || '-' }}
                                </span>
                            </div>
                            <div
                                class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                                <span class="text-zinc-500 text-sm font-medium">환율기준일</span>
                                <span class="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ cost.xcrBseDt ||
                                    '-' }}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 기타 정보 -->
                <section
id="section-etc"
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                        <i class="pi pi-info-circle text-zinc-400"/>
                        기타 정보
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- 정보보호 여부 -->
                        <div class="relative">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <i class="pi pi-shield text-sm"/>
                                </div>
                                <label class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">정보보호
                                    여부</label>
                                <div
                                    class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm">
                                    <Tag
:value="cost.infPrtYn === 'Y' ? '정보보호 대상' : '일반'"
                                        :severity="cost.infPrtYn === 'Y' ? 'success' : 'secondary'" rounded />
                                </div>
                            </div>
                        </div>
                        <!-- 증감사유 -->
                        <div class="relative">
                            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"/>
                            <div class="relative pl-10">
                                <div
                                    class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <i class="pi pi-comment text-sm"/>
                                </div>
                                <label
                                    class="font-bold text-zinc-900 dark:text-zinc-100 text-md mb-3 block">증감사유</label>
                                <div
                                    class="p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 min-h-[80px] text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                                    {{ cost.indRsn || '-' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </div> <!-- // col1 종료 -->

            <!-- col2: 목차 영역 (25%) -->
            <div class="xl:col-span-1 relative hidden xl:block">
                <!-- 스크롤 시 화면 상단에 고정 (심플한 사이드바 스타일) -->
                <div class="sticky top-6 lg:pl-4">
                    <h3
                        class="font-bold text-[14px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 px-3 flex items-center gap-2">
                        <i class="pi pi-align-left text-sm text-zinc-300 dark:text-zinc-600"/> 바로가기 목차
                    </h3>

                    <ul class="flex flex-col relative border-l border-zinc-200 dark:border-zinc-800 ml-3">
                        <li v-for="item in tocItems" :key="item.id" class="flex flex-col mb-1 relative">
                            <!-- 활성화 인디케이터 (왼쪽 보더선) -->
                            <div
v-if="activeSection === item.id || (item.children && item.children.some((c: any) => activeSection === c.id))"
                                class="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] bg-indigo-500 rounded-full"/>

                            <div
class="relative flex items-center gap-3 py-1.5 px-4 cursor-pointer transition-colors duration-200 group text-[14px]"
                                :class="(activeSection === item.id || (item.children && item.children.some((c: any) => activeSection === c.id))) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
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

    <!-- API 오류 표시 -->
    <div v-else-if="error" class="p-4 text-red-500">
        데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
    </div>
</template>
