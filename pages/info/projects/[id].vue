<script setup lang="ts">
import 'quill/dist/quill.core.css';

const route = useRoute();
const router = useRouter();
const prjMngNo = route.params.id;

const { fetchProject } = useProjects();
const { data: project, error } = await fetchProject(prjMngNo as string);

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

const getPrjTypeClass = (type: string) => {
    return type === '신규' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
};

definePageMeta({
    title: '사업 상세 정보'
});

const projectStages = [
    '예산 신청', '사전 협의', '정실협 진행중', '요건 상세화', '소요예산 산정',
    '과심위 진행중', '입찰/계약 진행중', '사업 진행중', '사업 완료',
    '대금지급 완료', '성과평가(대기)', '성과평가(완료)', '완료'
];

const getCurrentStageIndex = (status?: string) => {
    if (!status) return -1;
    return projectStages.indexOf(status);
};
</script>

<template>
    <div v-if="project" class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="router.back()" />
                <div>
                     <div class="flex items-center gap-2 mb-1 text-sm text-zinc-500">
                        <Tag :value="project.prjTp" class="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-0" rounded />
                        <span>ID: {{ project.prjMngNo }}</span>
                        <span class="mx-1">|</span>
                        <span>{{ project.sttDt }} ~ {{ project.endDt }}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ project.prjNm }}</h1>
                         <Tag :value="project.prjSts" :class="getStatusClass(project.prjSts || '')" class="text-sm px-3 py-1" rounded />
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="목록" icon="pi pi-list" severity="secondary" outlined @click="navigateTo('/info/projects')" />
                <Button label="수정" icon="pi pi-pencil" @click="navigateTo(`/info/projects/form?id=${project.prjMngNo}`)" />
            </div>
        </div>

        <!-- Project Stages (Stepper) -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
             <h3 class="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-6">사업 진행 현황</h3>
             <div class="flex items-center min-w-full px-4">
                <div v-for="(step, index) in projectStages" :key="index" class="flex flex-col items-center relative group flex-1">
                    <!-- Line -->
                    <div v-if="index < projectStages.length - 1" 
                         class="absolute top-4 left-[50%] w-full h-1"
                         :class="[
                            getCurrentStageIndex(project.prjSts) > index ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-zinc-200 dark:bg-zinc-700'
                         ]"
                    ></div>
                    
                    <!-- Circle -->
                    <div class="z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 bg-white dark:bg-zinc-900"
                        :class="[
                            getCurrentStageIndex(project.prjSts) > index 
                                ? 'border-indigo-600 bg-indigo-600 text-white' 
                                : getCurrentStageIndex(project.prjSts) === index
                                    ? 'border-indigo-600 text-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-900/30'
                                    : 'border-zinc-300 text-zinc-300 dark:border-zinc-600 dark:text-zinc-600'
                        ]"
                    >
                        <i v-if="getCurrentStageIndex(project.prjSts) > index" class="pi pi-check text-xs text-white"></i>
                        <span v-else class="text-xs font-bold">{{ index + 1 }}</span>
                    </div>
                    
                    <!-- Label -->
                    <div class="mt-3 text-xs w-24 text-center font-medium transition-colors duration-300"
                        :class="[
                            getCurrentStageIndex(project.prjSts) >= index ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600'
                        ]"
                    >
                        {{ step }}
                    </div>
                </div>
             </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
             <!-- Manager Info -->
             <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm md:col-span-4">
                 <h3 class="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-4">담당자 정보</h3>
                 
                 <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                     <!-- 주관부서 Row -->
                     <div class="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                         <div class="flex items-center gap-3 w-[200px] shrink-0">
                            <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                <i class="pi pi-briefcase text-base"></i>
                            </span>
                            <div>
                                <div class="text-[11px] text-zinc-500 leading-none mb-1">주관부서</div>
                                <div class="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-none">{{ project.svnDpm }}</div>
                            </div>
                         </div>
                         
                         <div class="hidden md:block w-px h-8 bg-zinc-300 dark:bg-zinc-600"></div>
                         
                         <div class="flex items-center gap-8 flex-1">
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">팀장</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project.svnDpmTlr || '-' }}</span>
                             </div>
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">담당</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project.svnDpmCgpr || '-' }}</span>
                             </div>
                         </div>
                     </div>

                     <!-- IT부서 Row -->
                     <div class="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                         <div class="flex items-center gap-3 w-[200px] shrink-0">
                            <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                <i class="pi pi-desktop text-base"></i>
                            </span>
                             <div>
                                <div class="text-[11px] text-zinc-500 leading-none mb-1">IT부서</div>
                                <div class="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-none">{{ project.itDpm }}</div>
                            </div>
                         </div>

                         <div class="hidden md:block w-px h-8 bg-zinc-300 dark:bg-zinc-600"></div>

                         <div class="flex items-center gap-8 flex-1">
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">팀장</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project.itDpmTlr || '-' }}</span>
                             </div>
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">담당</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project.itDpmCgpr || '-' }}</span>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
        
        <!-- Detailed Content (Vertical Layout) -->
        <div class="space-y-6">
            
            <!-- 개요 & 예산 (Grid) -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <!-- 개요 -->
                <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">
                    <section>
                        <h3 class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">사업 개요</h3>
                        <div class="ql-editor text-zinc-700 dark:text-zinc-300 leading-relaxed px-0" v-html="project.prjDes"></div>
                    </section>

                    <section>
                        <h3 class="text-sm font-bold text-zinc-500 mb-2">추진 배경 및 필요성</h3>
                        <div class="ql-editor p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-zinc-700 dark:text-zinc-300 text-sm" v-html="project.pulRsn || '내용 없음'"></div>
                         <div class="mt-2 text-xs text-zinc-400">필요성: {{ project.ncs || '-' }}</div>
                    </section>

                    <section>
                        <h3 class="text-sm font-bold text-zinc-500 mb-2">기대 효과</h3>
                        <div class="ql-editor p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-blue-800 dark:text-blue-200 text-sm" v-html="project.xptEff || '내용 없음'"></div>
                    </section>
                </div>

                <!-- 예산 -->
                <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                    <h3 class="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-4">예산 및 전결권</h3>
                    <div class="space-y-6">
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                <h3 class="text-zinc-500 font-medium mb-1">총 예산</h3>
                                <div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {{ formatCurrency(project.prjBg) }}
                                </div>
                                <small class="text-zinc-500 mt-2 text-xs">
                                    * 부가세 포함
                                </small>
                            </div>
                            
                            <div class="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                <h3 class="text-indigo-800 dark:text-indigo-200 font-medium mb-1">전결권</h3>
                                <div class="flex flex-col items-center">
                                    <span class="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{{ project.edrt || '-' }}</span>
                                </div>
                            </div>
                        </div>

                         <!-- 기타 정보 -->
                         <div class="grid grid-cols-2 gap-4 text-sm">
                             <div class="flex flex-col gap-1">
                                 <span class="text-zinc-500">업무 구분</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.bzDtt || '-' }}</span>
                             </div>
                             <div class="flex flex-col gap-1">
                                 <span class="text-zinc-500">기술 유형</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.tchnTp || '-' }}</span>
                             </div>
                             <div class="flex flex-col gap-1">
                                 <span class="text-zinc-500">주요 사용자</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.mnUsr || '-' }}</span>
                             </div>
                              <div class="flex flex-col gap-1">
                                 <span class="text-zinc-500">의무 완료 기한</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.lblFsgTlm || '-' }}</span>
                             </div>
                             <!-- Full width items -->
                             <div class="col-span-2 flex flex-col gap-1">
                                 <span class="text-zinc-500">향후 계획</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.hrfPln || '-' }}</span>
                             </div>
                              <div class="col-span-2 flex flex-col gap-1">
                                 <span class="text-zinc-500">사업 범위</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.prjRng || '-' }}</span>
                             </div>
                             <div class="col-span-2 flex flex-col gap-1">
                                 <span class="text-zinc-500">문제점</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.plm || '-' }}</span>
                             </div>
                             <div class="col-span-2 flex flex-col gap-1">
                                 <span class="text-zinc-500">현황</span>
                                 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.saf || '-' }}</span>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500">
        <i class="pi pi-exclamation-circle text-4xl mb-4"></i>
        <h2 class="text-xl font-bold">오류가 발생했습니다</h2>
        <p>{{ error.message }}</p>
         <Button label="목록으로 돌아가기" link @click="router.back()" class="mt-4" />
    </div>
    <div v-else class="flex flex-col items-center justify-center py-20">
        <div class="text-4xl mb-4">😢</div>
        <h2 class="text-xl font-bold text-zinc-800 dark:text-zinc-200">사업 정보를 찾을 수 없습니다.</h2>
        <Button label="목록으로 돌아가기" link @click="router.back()" class="mt-4" />
    </div>
</template>
