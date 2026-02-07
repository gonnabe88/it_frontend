<script setup lang="ts">
import 'quill/dist/quill.core.css';

const route = useRoute();
const router = useRouter();
const prjMngNo = route.params.id;

const { fetchProject, deleteProject } = useProjects();
const { data: project, error } = await fetchProject(prjMngNo as string);
const confirm = useConfirm();

definePageMeta({
    title: '사업 상세 정보'
});


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

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
};

const getStatusClass = (status: string) => {
    switch (status) {
        case '예산 신청': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case '사전 협의': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        case '정실협 진행중': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
        case '요건 상세화': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        case '소요예산 산정': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
        case '과심위 진행중': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
        case '입찰/계약 진행중': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
        case '사업 진행중': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case '사업 완료': return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
        case '대금지급 완료': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
        case '성과평가(대기)': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
        case '성과평가(완료)': return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        default: return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
    }
};

const projectStages = [
    '예산 신청', '사전 협의', '정실협 진행중', '요건 상세화', '소요예산 산정',
    '과심위 진행중', '입찰/계약 진행중', '사업 진행중', '사업 완료',
    '대금지급 완료', '성과평가(대기)', '성과평가(완료)', '완료'
];

const getCurrentStageIndex = (status?: string) => {
    if (!status) return -1;
    return projectStages.indexOf(status);
};

// 소요자원 합계 계산
const totalItemsAmount = computed(() => {
    if (!project.value?.items) return 0;
    return project.value.items.reduce((sum, item) => sum + (item.amt || 0), 0);
});

// 자원 구분별 태그 색상 매핑
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

// 날짜를 YYYY-MM 형식으로 포맷팅
const formatDateToYearMonth = (dateStr?: string) => {
    if (!dateStr) return '-';
    // YYYYMMDD 형식인 경우
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}`;
    }
    // YYYY-MM-DD 형식인 경우
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : dateStr;
    }
    return dateStr;
};

</script>

<template>
    <div v-if="project" class="space-y-8 max-w-7xl mx-auto pb-20">
        <!-- 상단 헤더 (Header) -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
                <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="router.back()"
                    class="mt-1 w-10 h-10 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors" />
                <div class="space-y-2">
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
                    <div class="flex flex-wrap items-center gap-3">
                        <h1 class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{{
                            project.prjNm }}</h1>
                        <!-- 프로젝트 상태 태그 -->
                        <Tag :value="project.prjSts" :class="getStatusClass(project.prjSts || '')"
                            class="text-sm px-3 py-1 font-bold shadow-sm" rounded />
                    </div>
                </div>
            </div>

            <!-- 액션 버튼 그룹 -->
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

        <!-- 1. 사업 진행 현황 (Stepper - Responsive Wrap) -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <div class="flex items-center justify-between mb-8">
                <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <i class="pi pi-step-forward-alt text-indigo-500"></i>
                    사업 진행 현황
                </h3>
            </div>

            <div class="flex flex-wrap items-center gap-4">
                <div v-for="(step, index) in projectStages" :key="index" class="flex items-center gap-2">
                    <!-- Step Item -->
                    <div class="flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300"
                        :class="[
                            getCurrentStageIndex(project.prjSts) > index
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300'
                                : getCurrentStageIndex(project.prjSts) === index
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none ring-2 ring-indigo-100 dark:ring-indigo-900/30'
                                    : 'bg-white border-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-600'
                        ]">
                        <!-- Icon/Number -->
                        <div v-if="getCurrentStageIndex(project.prjSts) > index">
                            <i class="pi pi-check-circle text-lg"></i>
                        </div>
                        <div v-else
                            class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border"
                            :class="getCurrentStageIndex(project.prjSts) === index ? 'border-white/30 bg-white/20' : 'border-zinc-300 dark:border-zinc-600'">
                            {{ index + 1 }}
                        </div>

                        <!-- Label -->
                        <span class="text-sm font-semibold whitespace-nowrap">{{ step }}</span>
                    </div>

                    <!-- Arrow Separator -->
                    <i v-if="index < projectStages.length - 1"
                        class="pi pi-angle-right text-zinc-300 dark:text-zinc-600 text-sm"></i>
                </div>
            </div>
        </section>

        <!-- 2. 사업 개요 (Overview) -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md flex flex-col gap-6">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <i class="pi pi-info-circle text-blue-500"></i>
                사업 개요
            </h3>

            <!-- 사업 설명 (Rich Text) -->
            <div class="ql-editor p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                v-html="project.prjDes || '<span class=\'text-zinc-400 italic\'>내용 없음</span>'"></div>

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
                <!-- 기대효과 -->
                <div class="group">
                    <label
                        class="font-bold text-zinc-500 text-xs mb-2 block uppercase tracking-wider pl-1 text-blue-500">기대효과</label>
                    <div
                        class="p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 h-[120px] overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 group-hover:border-blue-200 transition-colors shadow-sm">
                        {{ project.xptEff || '-' }}
                    </div>
                </div>
                <!-- 미추진 시 문제점 -->
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

        <!-- 3. 사업 범위 (Scope) -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-map text-green-500"></i>
                사업 범위
            </h3>
            <div class="ql-editor p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-100 dark:border-zinc-800"
                v-html="project.prjRng || '<span class=\'text-zinc-400 italic\'>내용 없음</span>'"></div>
        </section>

        <!-- 4. 진행 상황 (Progress) -->
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

        <!-- 5. 사업 구분 및 편성 기준 (Grid Layout) -->
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

        <!-- 7. 담당 조직 (Departments) -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-users text-cyan-500"></i>
                담당 조직
            </h3>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <!-- 주관부서 정보 -->
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

                <!-- IT부서 정보 -->
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

        <!-- 8. 예산 및 일정 (Budget & Schedule) -->
        <section
            class="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
                <i class="pi pi-wallet text-yellow-500"></i>
                추진시기 및 소요예산
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- 총 예산 카드 -->
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


                <!-- 전결권 Status -->
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

                <!-- 보고상태 Status -->
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

            <div class="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <div class="flex flex-col md:flex-row md:items-center gap-8 justify-around">
                    <!-- 시작일 -->
                    <div class="flex flex-col items-center gap-2">
                        <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest">Start Date</span>
                        <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ project.sttDt ||
                            '-' }}</div>
                    </div>

                    <div class="hidden md:block w-32 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full relative">
                        <div class="absolute top-0 left-0 w-1/3 h-full bg-indigo-500 rounded-full"></div>
                    </div>

                    <!-- 종료일 -->
                    <div class="flex flex-col items-center gap-2">
                        <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest">End Date</span>
                        <div class="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">{{ project.endDt ||
                            '-' }}</div>
                    </div>

                    <!-- 가능성 Rating?? -->
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

        <!-- 9. 소요자원 상세내용 (Resource Items) [NEW IMPROVED] -->
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
                    <Column field="upr" header="단가" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-right"
                        class="text-right" style="min-width: 120px">
                        <template #body="{ data }">
                            <span class="text-zinc-600 dark:text-zinc-400">{{ formatCurrency(data.upr || 0).replace('₩',
                                '') }}</span>
                        </template>
                    </Column>
                    <Column field="cur" header="통화" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                        class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="width: 60px" />
                    <Column field="amt" header="소계" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-right"
                        class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 140px">
                        <template #body="{ data }">
                            <span class="font-bold text-zinc-900 dark:text-zinc-100">{{ formatCurrency(data.amt || 0)
                            }}</span>
                        </template>
                    </Column>
                    <Column field="bgFdtn" header="산정근거" headerClass="bg-zinc-50/80 dark:bg-zinc-800"
                        style="min-width: 200px" class="text-right bg-zinc-50/50 dark:bg-zinc-900" />
                    <Column header="일정/주기" headerClass="bg-zinc-50/80 dark:bg-zinc-800 text-center"
                        class="text-right bg-zinc-50/50 dark:bg-zinc-900" style="min-width: 100px">
                        <template #body="{ data }">
                            <div class="inline-flex items-center gap-1 px-2 py-0.5 text-zinc-600 dark:text-zinc-300">
                                <span v-if="['개발비', '기계장치', '기타무형자산'].includes(data.gclDtt)"
                                    class="text-right bg-zinc-50/50 dark:bg-zinc-900">
                                    {{ formatDateToYearMonth(data.itdDt) }}
                                </span>
                                <span v-else class="text-right bg-zinc-50/50 dark:bg-zinc-900">
                                    {{ data.dfrCle }}
                                </span>
                            </div>
                        </template>
                    </Column>
                    <!-- Column Footer for Total -->
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
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500 animate-pulse">
        <i class="pi pi-exclamation-circle text-5xl mb-6"></i>
        <h2 class="text-2xl font-bold mb-2">데이터를 불러오지 못했습니다</h2>
        <p class="text-zinc-500 mb-6">{{ error.message }}</p>
        <Button label="다시 시도" icon="pi pi-refresh" @click="router.go(0)" />
        <Button label="목록으로" link @click="router.back()" class="mt-2" />
    </div>
    <div v-else class="flex flex-col items-center justify-center py-32 text-center opacity-50">
        <div class="text-6xl mb-6 grayscale filter">😢</div>
        <h2 class="text-2xl font-bold text-zinc-800 dark:text-zinc-200">찾으시는 사업 정보가 없습니다.</h2>
        <p class="text-zinc-500 mt-2">삭제되었거나 존재하지 않는 프로젝트 ID입니다.</p>
        <Button label="목록으로 돌아가기" outlined @click="router.back()" class="mt-8" />
    </div>
</template>
