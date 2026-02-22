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

[UI 구성 (총 9개 섹션)]
  1. 사업 진행 현황: 11단계 타임라인 (예산신청 ~ 완료), 현재 단계 강조
  2. 사업 개요: RichText 설명 + 현황/필요성/기대효과/미추진시문제점 4개 박스
  3. 사업 범위: RichText 전산 요구사항
  4. 진행 상황: 추진 경과 + 향후 계획 (2열)
  5. 사업 구분: 업무구분/사업유형/기술유형/주요사용자
  6. 편성 기준: 중복여부/법규상완료시기
  7. 담당 조직: 주관부서(Business Owner) + IT부서(IT Partner) 카드
  8. 예산 및 일정: 총예산/전결권/보고상태 + 시작일/종료일/추진가능성
  9. 소요자원 상세: DataTable (구분/품목명/수량/단가/통화/소계/산정근거/일정주기) + 합계 Footer

[보안]
  - prjDes, prjRng (Rich Text HTML): DOMPurify(isomorphic-dompurify)로 XSS 방어

[삭제 조건]
  - apfSts가 '결재중', '결재완료', '승인'이면 삭제 버튼 숨김
  - 그 외 상태에서만 삭제 확인 다이얼로그 표시

[타임라인 단계]
  예산 신청 → 사전 협의 → 정실협 → 요건 상세화 → 소요예산 산정
  → 과심위 → 입찰/계약 → 사업 추진 → 대금지급 → 성과평가 → 완료
================================================================================
-->
<script setup lang="ts">
import 'quill/dist/quill.core.css';
import DOMPurify from 'isomorphic-dompurify';

const route = useRoute();
const router = useRouter();
/** URL 파라미터에서 사업 관리번호 추출 */
const prjMngNo = route.params.id;

const { fetchProject, deleteProject } = useProjects();
const { data: project, error } = await fetchProject(prjMngNo as string);
const confirm = useConfirm();

definePageMeta({
    title: '사업 상세 정보'
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
                router.push('/info/projects'); // 목록 화면으로 이동
            } catch (err) {
                console.error('Failed to delete project:', err);
                // 에러 처리 필요 시 추가 (예: Toast 메시지)
            }
        }
    });
};

/**
 * 금액을 한국 원화 형식으로 포맷팅
 *
 * @param value - 포맷팅할 숫자
 * @returns '₩1,234,567' 형식의 문자열
 */
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
};

/**
 * 프로젝트 진행 상태에 따른 CSS 색상 클래스 반환
 * 11개 단계별로 각각 고유한 색상을 적용합니다.
 *
 * @param status - 프로젝트 상태 문자열
 * @returns Tailwind CSS 클래스 문자열
 */
const getStatusClass = (status: string) => {
    switch (status) {
        case '예산 신청': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case '사전 협의': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        case '정실협': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
        case '요건 상세화': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        case '소요예산 산정': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
        case '과심위': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
        case '입찰/계약': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
        case '사업 추진': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case '대금지급': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
        case '성과평가': return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        default: return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
    }
};

/**
 * 사업 진행 11단계 순서 정의
 * 타임라인 렌더링 및 현재 단계 인덱스 계산에 사용됩니다.
 */
const projectStages = [
    '예산 신청', '사전 협의', '정실협', '요건 상세화', '소요예산 산정',
    '과심위', '입찰/계약', '사업 추진', '대금지급', '성과평가', '완료'
];

/**
 * 현재 프로젝트 상태의 단계 인덱스 반환
 * 타임라인에서 완료/현재/예정 표시를 결정하는 데 사용합니다.
 *
 * @param status - 현재 프로젝트 상태 문자열
 * @returns 단계 인덱스 (0-based), 없으면 -1
 */
const getCurrentStageIndex = (status?: string) => {
    if (!status) return -1;
    return projectStages.indexOf(status);
};

/**
 * 소요자원 항목들의 소계(gclAmt) 합산
 * 소요자원 DataTable 하단 Footer에 표시됩니다.
 */
const totalItemsAmount = computed(() => {
    if (!project.value?.items) return 0;
    return project.value.items.reduce((sum: number, item: any) => sum + (item.gclAmt || 0), 0);
});

/**
 * 소요자원 구분별 PrimeVue Tag severity 매핑
 * DataTable의 구분 컬럼에 색상 Badge를 표시하는 데 사용합니다.
 *
 * @param category - 자원 구분명 ('개발비' | '기계장치' | '기타무형자산' | '전산임차료' | '전산제비')
 * @returns PrimeVue Tag severity 값
 */
const getCategorySeverity = (category: string) => {
    switch (category) {
        case '개발비': return 'info';
        case '기계장치': return 'warning';
        case '기타무형자산': return 'success';
        case '전산임차료': return 'danger';
        case '전산제비': return 'secondary';
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
</script>

<template>
    <!-- 프로젝트 데이터 존재 시 상세 화면 -->
    <div v-if="project" class="space-y-8 max-w-7xl mx-auto pb-20">

        <!-- 상단 헤더: 사업명 + 상태 태그 + 액션 버튼 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
                <!-- 뒤로 가기 버튼 -->
                <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="router.back()"
                    class="mt-1 w-10 h-10 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors" />
                <div class="space-y-2">
                    <!-- 사업 유형 태그 + 관리번호 + 기간 -->
                    <div class="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <Tag :value="project.prjTp"
                            class="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 px-2.5 py-0.5 font-medium"
                            rounded />
                        <span class="font-mono text-zinc-400">#{{ project.prjMngNo }}</span>
                        <span class="text-zinc-300 dark:text-zinc-700">|</span>
                        <div
                            class="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">
                            <i class="pi pi-calendar text-zinc-400"></i>
                            <span>{{ project.sttDt }} ~ {{ project.endDt }}</span>
                        </div>
                    </div>
                    <!-- 사업명 + 진행 상태 태그 -->
                    <div class="flex flex-wrap items-center gap-3">
                        <h1 class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                            project.prjNm }}</h1>
                        <Tag :value="project.prjSts" :class="getStatusClass(project.prjSts || '')"
                            class="text-sm px-3 py-1 font-bold shadow-sm" rounded />
                    </div>
                </div>
            </div>

            <!-- 액션 버튼: 목록 / 삭제(조건부) / 수정 -->
            <div class="flex gap-2 self-end md:self-center">
                <Button label="목록" icon="pi pi-list" severity="secondary" outlined class="bg-white dark:bg-zinc-900"
                    @click="navigateTo('/info/projects')" />
                <!-- 결재 중이거나 완료된 경우 삭제 버튼 숨김 -->
                <Button v-if="!['결재중', '결재완료', '승인'].includes(project.apfSts)" label="삭제" icon="pi pi-trash"
                    severity="danger" outlined class="bg-white dark:bg-zinc-900" @click="handleDelete" />
                <Button label="수정" icon="pi pi-pencil" class="shadow-lg shadow-indigo-500/20"
                    @click="navigateTo(`/info/projects/form?id=${project.prjMngNo}`)" />
            </div>
        </div>

        <!-- 섹션 1: 사업 진행 현황 타임라인 -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md overflow-visible">
            <div class="flex items-center justify-between mb-8">
                <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <i class="pi pi-step-forward-alt text-indigo-500"></i>
                    사업 진행 현황
                </h3>
                <!-- 현재 단계 뱃지 -->
                <span class="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                    {{ project.prjSts }}
                </span>
            </div>

            <!-- 타임라인 컨테이너 -->
            <div class="relative w-full px-2">
                <div class="flex items-start justify-between w-full">
                    <!-- 각 단계 스텝 -->
                    <div v-for="(step, index) in projectStages" :key="index"
                         class="relative flex flex-col items-center flex-1 group">

                        <!-- 연결선: 이전 단계가 완료된 경우 인디고, 아니면 회색 -->
                        <div v-if="Number(index) > 0"
                             class="absolute top-5 right-1/2 w-full h-[2px] -translate-y-1/2 -z-10 transition-colors duration-500"
                             :class="[
                                getCurrentStageIndex(project.prjSts) >= Number(index)
                                    ? 'bg-indigo-500'
                                    : 'bg-zinc-200 dark:bg-zinc-700'
                             ]">
                        </div>

                        <!-- 원형 마커: 완료(체크)/현재(진행 텍스트+링)/예정(숫자) -->
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 relative z-10 mb-3 shrink-0"
                            :class="[
                                getCurrentStageIndex(project.prjSts) > Number(index)
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-400 dark:border-indigo-800 dark:bg-indigo-900/10 dark:text-indigo-500'
                                    : getCurrentStageIndex(project.prjSts) === Number(index)
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 scale-110 ring-4 ring-indigo-50 dark:ring-indigo-900/20'
                                        : 'border-zinc-200 text-zinc-300 dark:border-zinc-700 dark:text-zinc-600 bg-white dark:bg-zinc-900'
                            ]">

                            <!-- 완료 단계: 체크 아이콘 -->
                            <i v-if="getCurrentStageIndex(project.prjSts) > Number(index)" class="pi pi-check text-lg font-bold"></i>
                            <!-- 현재 단계: '진행' 텍스트 -->
                            <span v-else-if="getCurrentStageIndex(project.prjSts) === Number(index)" class="text-[10px] font-bold tracking-tighter">진행</span>
                            <!-- 예정 단계: 순번 숫자 -->
                            <span v-else>{{ Number(index) + 1 }}</span>

                            <!-- 현재 단계 핑 애니메이션 -->
                            <span v-if="getCurrentStageIndex(project.prjSts) === Number(index)"
                                  class="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20"></span>
                        </div>

                        <!-- 단계 라벨 텍스트 -->
                        <div class="h-10 flex items-start justify-center w-full">
                            <span class="text-[10px] sm:text-xs font-medium text-center break-keep leading-tight px-0.5 transition-colors duration-300 w-full"
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
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md flex flex-col gap-6">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <i class="pi pi-info-circle text-blue-500"></i>
                사업 개요
            </h3>

            <!-- 사업 설명 (Rich Text - XSS 방어 적용) -->
            <div class="ql-editor p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                v-html="sanitizeHtml(project.prjDes || '<span class=\'text-zinc-400 italic\'>내용 없음</span>')"></div>

            <!-- 현황 / 필요성 / 기대효과 / 미추진 시 문제점 (2열 그리드) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <!-- 현황 -->
                <div class="group">
                    <label class="font-bold text-zinc-500 text-xs mb-2 block uppercase tracking-wider pl-1">현황</label>
                    <div
                        class="p-5 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 h-[120px] overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400 group-hover:border-zinc-200 dark:group-hover:border-zinc-700 transition-colors shadow-sm">
                        {{ project.saf || '-' }}
                    </div>
                </div>
                <!-- 필요성 -->
                <div class="group">
                    <label class="font-bold text-zinc-500 text-xs mb-2 block uppercase tracking-wider pl-1">필요성</label>
                    <div
                        class="p-5 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 h-[120px] overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400 group-hover:border-zinc-200 dark:group-hover:border-zinc-700 transition-colors shadow-sm">
                        {{ project.ncs || '-' }}
                    </div>
                </div>
                <!-- 기대효과 (파란색 강조) -->
                <div class="group">
                    <label
                        class="font-bold text-zinc-500 text-xs mb-2 block uppercase tracking-wider pl-1 text-blue-500">기대효과</label>
                    <div
                        class="p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 h-[120px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 group-hover:border-blue-200 transition-colors shadow-sm">
                        {{ project.xptEff || '-' }}
                    </div>
                </div>
                <!-- 미추진 시 문제점 (빨간색 강조) -->
                <div class="group">
                    <label
                        class="font-bold text-zinc-500 text-xs mb-2 block uppercase tracking-wider pl-1 text-red-500">미추진
                        시 문제점</label>
                    <div
                        class="p-5 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 h-[120px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 group-hover:border-red-200 transition-colors shadow-sm">
                        {{ project.plm || '-' }}
                    </div>
                </div>
            </div>
        </section>

        <!-- 섹션 3: 사업 범위 -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-map text-green-500"></i>
                사업 범위
            </h3>
            <!-- 사업 범위 (Rich Text - XSS 방어 적용) -->
            <div class="ql-editor p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                v-html="sanitizeHtml(project.prjRng || '<span class=\'text-zinc-400 italic\'>내용 없음</span>')"></div>
        </section>

        <!-- 섹션 4: 진행 상황 (추진 경과 + 향후 계획) -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-chart-line text-orange-500"></i>
                진행 상황
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- 추진 경과 -->
                <div class="relative">
                    <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800"></div>
                    <div class="relative pl-10">
                        <div
                            class="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                            <i class="pi pi-history text-sm"></i>
                        </div>
                        <label class="font-bold text-zinc-900 dark:text-zinc-100 text-lg mb-3 block">추진 경과</label>
                        <div
                            class="p-5 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl border border-zinc-100 dark:border-zinc-800 min-h-[120px] text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                            {{ project.pulPsg || '-' }}
                        </div>
                    </div>
                </div>
                <!-- 향후 계획 -->
                <div class="relative">
                    <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-50 dark:bg-indigo-900/20"></div>
                    <div class="relative pl-10">
                        <div
                            class="absolute left-0 top-0 w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500">
                            <i class="pi pi-calendar-plus text-sm"></i>
                        </div>
                        <label class="font-bold text-indigo-900 dark:text-indigo-100 text-lg mb-3 block">향후 계획</label>
                        <div
                            class="p-5 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/20 min-h-[120px] text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                            {{ project.hrfPln || '-' }}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 섹션 5 & 6: 사업 구분 + 편성 기준 (2열 그리드) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- 사업 구분 -->
            <section
                class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md h-full">
                <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                    <i class="pi pi-tags text-purple-500"></i>
                    사업 구분
                </h3>
                <div class="space-y-4">
                    <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                        <span class="text-zinc-500 text-sm font-medium">업무 구분</span>
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ project.bzDtt || '-' }}</span>
                    </div>
                    <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                        <span class="text-zinc-500 text-sm font-medium">사업 유형</span>
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ project.prjTp || '-' }}</span>
                    </div>
                    <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                        <span class="text-zinc-500 text-sm font-medium">기술 유형</span>
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ project.tchnTp || '-' }}</span>
                    </div>
                    <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                        <span class="text-zinc-500 text-sm font-medium">주요 사용자</span>
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ project.mnUsr || '-' }}</span>
                    </div>
                </div>
            </section>

            <!-- 편성 기준 -->
            <section
                class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md h-full">
                <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                    <i class="pi pi-check-circle text-teal-500"></i>
                    편성 기준
                </h3>
                <div class="space-y-4">
                    <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                        <span class="text-zinc-500 text-sm font-medium">중복 여부</span>
                        <!-- 중복 여부에 따라 danger/success Tag 표시 -->
                        <Tag :severity="project.dplYn === 'Y' ? 'danger' : 'success'"
                            :value="project.dplYn === 'Y' ? '중복 (Y)' : '미중복 (N)'" rounded></Tag>
                    </div>
                    <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/30 rounded-xl">
                        <span class="text-zinc-500 text-sm font-medium">법규상 완료시기</span>
                        <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ project.lblFsgTlm || '-' }}</span>
                    </div>
                </div>
            </section>
        </div>

        <!-- 섹션 7: 담당 조직 -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-users text-cyan-500"></i>
                담당 조직
            </h3>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <!-- 주관부서 정보 카드 (Business Owner) -->
                <div
                    class="flex flex-col sm:flex-row sm:items-center gap-6 p-6 bg-gradient-to-br from-blue-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-blue-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                    <div
                        class="absolute right-0 top-0 w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700">
                    </div>

                    <div class="flex items-center gap-4 w-[240px] shrink-0 z-10">
                        <div
                            class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-50 dark:border-zinc-700">
                            <i class="pi pi-briefcase text-2xl"></i>
                        </div>
                        <div>
                            <div class="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Business Owner
                            </div>
                            <div class="font-extrabold text-xl text-zinc-900 dark:text-zinc-100 leading-none mb-1">{{
                                project.svnDpm }}</div>
                            <div class="text-xs text-zinc-500">{{ project.svnHdq }}</div>
                        </div>
                    </div>

                    <div class="hidden sm:block w-px h-12 bg-zinc-200 dark:bg-zinc-700 z-10"></div>

                    <div class="flex items-center gap-8 flex-1 z-10">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-zinc-400 uppercase font-bold">Manager</span>
                            <span class="text-zinc-900 dark:text-zinc-100 font-bold text-lg">{{ project.svnDpmTlr || '-'
                                }}</span>
                            <span class="text-xs text-zinc-500">팀장</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-zinc-400 uppercase font-bold">Staff</span>
                            <span class="text-zinc-900 dark:text-zinc-100 font-bold text-lg">{{ project.svnDpmCgpr ||
                                '-' }}</span>
                            <span class="text-xs text-zinc-500">담당</span>
                        </div>
                    </div>
                </div>

                <!-- IT부서 정보 카드 (IT Partner) -->
                <div
                    class="flex flex-col sm:flex-row sm:items-center gap-6 p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-indigo-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                    <div
                        class="absolute right-0 top-0 w-24 h-24 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700">
                    </div>

                    <div class="flex items-center gap-4 w-[240px] shrink-0 z-10">
                        <div
                            class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-50 dark:border-zinc-700">
                            <i class="pi pi-desktop text-2xl"></i>
                        </div>
                        <div>
                            <div class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">IT Partner
                            </div>
                            <div class="font-extrabold text-xl text-zinc-900 dark:text-zinc-100 leading-none mb-1">{{
                                project.itDpm }}</div>
                        </div>
                    </div>

                    <div class="hidden sm:block w-px h-12 bg-zinc-200 dark:bg-zinc-700 z-10"></div>

                    <div class="flex items-center gap-8 flex-1 z-10">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-zinc-400 uppercase font-bold">Manager</span>
                            <span class="text-zinc-900 dark:text-zinc-100 font-bold text-lg">{{ project.itDpmTlr || '-'
                                }}</span>
                            <span class="text-xs text-zinc-500">팀장</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-zinc-400 uppercase font-bold">Staff</span>
                            <span class="text-zinc-900 dark:text-zinc-100 font-bold text-lg">{{ project.itDpmCgpr || '-'
                                }}</span>
                            <span class="text-xs text-zinc-500">담당</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 섹션 8: 추진시기 및 소요예산 -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-wallet text-yellow-500"></i>
                추진시기 및 소요예산
            </h3>
            <!-- 총예산 / 전결권 / 보고상태 카드 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    class="flex flex-col justify-center items-center p-6 bg-yellow-50/[0.6] dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/20 text-center relative overflow-hidden">
                    <div
                        class="absolute -right-4 -top-4 w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full blur-xl">
                    </div>
                    <div
                        class="text-sm font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide mb-2 z-10">
                        총 예산</div>
                    <div class="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 z-10 tracking-tight">{{
                        formatCurrency(project.prjBg) }}</div>
                    <div class="text-xs text-zinc-400 mt-2 z-10">* 부가세 포함</div>
                </div>

                <div
                    class="flex flex-col justify-center items-center p-6 bg-blue-50/[0.6] dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 text-center relative overflow-hidden">
                    <div
                        class="absolute -right-4 -top-4 w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-xl">
                    </div>
                    <div class="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wide mb-2 z-10">
                        전결권</div>
                    <div class="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 z-10 tracking-tight">{{
                        project.edrt || '-' }}</div>
                </div>

                <div
                    class="flex flex-col justify-center items-center p-6 bg-green-50/[0.6] dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 text-center relative overflow-hidden">
                    <div
                        class="absolute -right-4 -top-4 w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full blur-xl">
                    </div>
                    <div class="text-sm font-bold text-green-600 dark:text-green-500 uppercase tracking-wide mb-2 z-10">
                        보고상태</div>
                    <div class="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 z-10 tracking-tight">{{
                        project.rprSts || '-' }}</div>
                </div>
            </div>

            <!-- 시작일 / 종료일 / 추진가능성 -->
            <div class="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <div class="flex flex-col md:flex-row md:items-center gap-8 justify-around">
                    <div class="flex flex-col items-center gap-2">
                        <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest">Start Date</span>
                        <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ project.sttDt ||
                            '-' }}</div>
                    </div>

                    <div class="hidden md:block w-32 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full relative">
                        <div class="absolute top-0 left-0 w-1/3 h-full bg-indigo-500 rounded-full"></div>
                    </div>

                    <div class="flex flex-col items-center gap-2">
                        <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest">End Date</span>
                        <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ project.endDt ||
                            '-' }}</div>
                    </div>

                    <div
                        class="flex flex-col items-center gap-2 md:border-l md:border-zinc-100 dark:md:border-zinc-800 md:pl-8">
                        <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest">추진가능성</span>
                        <div
                            class="px-4 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-bold text-sm">
                            {{ project.prjPulPtt || '-' }}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 섹션 9: 소요자원 상세내용 DataTable -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-box text-pink-500"></i>
                소요자원 상세내용
            </h3>

            <div class="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
                <DataTable :value="project.items || []" stripedRows class="resource-table-modern">
                    <template #empty>
                        <div class="text-center text-zinc-500 py-12 flex flex-col items-center gap-3">
                            <i class="pi pi-inbox text-4xl text-zinc-300"></i>
                            <p>등록된 소요자원이 없습니다.</p>
                        </div>
                    </template>

                    <!-- 구분: 카테고리별 색상 Badge -->
                    <Column field="gclDtt" header="구분" headerClass="bg-zinc-50/80 dark:bg-zinc-800"
                        style="min-width: 100px">
                        <template #body="{ data }">
                            <Tag :value="data.gclDtt" :severity="getCategorySeverity(data.gclDtt)" rounded
                                class="text-xs"></Tag>
                        </template>
                    </Column>
                    <Column field="gclNm" header="품목명" headerClass="bg-zinc-50/80 dark:bg-zinc-800"
                        style="min-width: 200px">
                        <template #body="{ data }">
                            <span class="text-zinc-700 dark:text-zinc-200 font-medium">{{ data.gclNm }}</span>
                        </template>
                    </Column>
                    <Column field="gclQtt" header="수량" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-right"
                        class="text-right" style="width: 80px" />
                    <!-- 단가: 소계 ÷ 수량으로 계산 -->
                    <Column field="upr" header="단가" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-right"
                        class="text-right" style="min-width: 120px">
                        <template #body="{ data }">
                            <span class="text-zinc-600 dark:text-zinc-400">{{ formatCurrency(data.gclAmt / data.gclQtt ||
                                0).replace('₩',
                                '') }}</span>
                        </template>
                    </Column>
                    <Column field="cur" header="통화" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                        class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="width: 60px" />
                    <!-- 소계 -->
                    <Column field="amt" header="소계" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-right"
                        class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 140px">
                        <template #body="{ data }">
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ formatCurrency(data.gclAmt || 0)
                            }}</span>
                        </template>
                    </Column>
                    <Column field="bgFdtn" header="산정근거" headerClass="bg-zinc-50/80 dark:bg-zinc-800"
                        style="min-width: 200px" class="text-right bg-zinc-50/50 dark:bg-zinc-900" />
                    <!-- 일정/주기: 구분에 따라 도입시기(YYYY-MM) 또는 지급주기 표시 -->
                    <Column header="일정/주기" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                        class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 100px">
                        <template #body="{ data }">
                            <div class="inline-flex items-center gap-1 px-2 py-0.5 text-zinc-600 dark:text-zinc-300">
                                <!-- 자본예산 구분(개발비/기계장치/기타무형자산)은 도입시기 -->
                                <span v-if="['개발비', '기계장치', '기타무형자산'].includes(data.gclDtt)"
                                    class="text-right bg-zinc-50/50 dark:bg-zinc-900">
                                    {{ formatDateToYearMonth(data.itdDt) }}
                                </span>
                                <!-- 임차료/제비 구분은 지급주기 -->
                                <span v-else class="text-right bg-zinc-50/50 dark:bg-zinc-900">
                                    {{ data.dfrCle }}
                                </span>
                            </div>
                        </template>
                    </Column>
                    <!-- Footer: 소요자원 총 합계 -->
                    <ColumnGroup type="footer">
                        <Row>
                            <Column footer="총 합계" :colspan="5"
                                footerClass="text-right font-bold text-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 pr-8" />
                            <Column :footer="formatCurrency(totalItemsAmount)"
                                footerClass="text-right font-extrabold text-lg text-indigo-600 dark:text-indigo-400 bg-zinc-100 dark:bg-zinc-800" />
                            <Column :colspan="2" footerClass="bg-zinc-100 dark:bg-zinc-800" />
                        </Row>
                    </ColumnGroup>
                </DataTable>
            </div>
        </section>

    </div>

    <!-- API 오류 상태 -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500 animate-pulse">
        <i class="pi pi-exclamation-circle text-5xl mb-6"></i>
        <h2 class="text-2xl font-bold mb-2">데이터를 불러오지 못했습니다</h2>
        <p class="text-zinc-500 mb-6">{{ error.message }}</p>
        <Button label="다시 시도" icon="pi pi-refresh" @click="router.go(0)" />
        <Button label="목록으로" link @click="router.back()" class="mt-2" />
    </div>

    <!-- 데이터 없음 (존재하지 않는 ID) -->
    <div v-else class="flex flex-col items-center justify-center py-32 text-center opacity-50">
        <div class="text-6xl mb-6 grayscale filter">😢</div>
        <h2 class="text-2xl font-bold text-zinc-800 dark:text-zinc-200">찾으시는 사업 정보가 없습니다.</h2>
        <p class="text-zinc-500 mt-2">삭제되었거나 존재하지 않는 프로젝트 ID입니다.</p>
        <Button label="목록으로 돌아가기" outlined @click="router.back()" class="mt-8" />
    </div>
</template>
