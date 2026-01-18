<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Project } from '~/composables/useProjects';
import 'quill/dist/quill.core.css';

const route = useRoute();
const router = useRouter();
const projectId = Number(route.params.id);

const { projects, getApprovalAuthority } = useProjects();
const project = computed(() => projects.value.find(p => p.id === projectId));

const getStatusClass = (status: string) => {
    switch (status) {
        case '예산 신청': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
        case '사전 협의': return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
        case '정실협 진행중': return 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
        case '요건 상세화': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
        case '소요예산 산정': return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
        case '과심위 진행중': return 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
        case '입찰/계약 진행중': return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
        case '사업 진행중': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
        case '사업 완료': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        case '대금지급 완료': return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
        case '성과평가(대기)': return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
        case '성과평가(완료)': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        default: return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
    }
};

const formatCurrency = (value: number) => {
    return value.toLocaleString('ko-KR') + ' 원';
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

const itemTotalSummary = computed(() => {
    if (!project.value || !project.value.items || project.value.items.length === 0) return '0';
    
    const totals: Record<string, number> = {};
    project.value.items.forEach(item => {
        const curr = item.currency || 'KRW(원)';
        const amount = item.amount || 0;
        const quantity = item.quantity || 1;
        if (!totals[curr]) totals[curr] = 0;
        totals[curr] += (amount * quantity);
    });

    return Object.entries(totals)
        .map(([curr, amount]) => `${amount.toLocaleString()} ${curr}`)
        .join(' + ');
});

const approvalAuthority = computed(() => {
     return project.value ? getApprovalAuthority(project.value.items || []) : { authority: '', reason: '' };
});
</script>

<template>
    <div v-if="project" class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="router.back()" />
                <div>
                     <div class="flex items-center gap-2 mb-1 text-sm text-zinc-500">
                        <Tag :value="project?.prj_type" class="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-0" rounded />
                        <span>ID: {{ project?.id }}</span>
                        <span class="mx-1">|</span>
                        <span>{{ project?.sta_date }} ~ {{ project?.end_date }}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ project?.name }}</h1>
                         <Tag :value="project?.status" :class="getStatusClass(project?.status || '')" class="text-sm px-3 py-1" rounded />
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="목록" icon="pi pi-list" severity="secondary" outlined @click="navigateTo('/info/projects')" />
                <Button label="수정" icon="pi pi-pencil" @click="navigateTo(`/info/projects/form?id=${project?.id}`)" />
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
                            getCurrentStageIndex(project?.status) > index ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-zinc-200 dark:bg-zinc-700'
                         ]"
                    ></div>
                    
                    <!-- Circle -->
                    <div class="z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 bg-white dark:bg-zinc-900"
                        :class="[
                            getCurrentStageIndex(project?.status) > index 
                                ? 'border-indigo-600 bg-indigo-600 text-white' 
                                : getCurrentStageIndex(project?.status) === index
                                    ? 'border-indigo-600 text-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-900/30'
                                    : 'border-zinc-300 text-zinc-300 dark:border-zinc-600 dark:text-zinc-600'
                        ]"
                    >
                        <i v-if="getCurrentStageIndex(project?.status) > index" class="pi pi-check text-xs text-white"></i>
                        <span v-else class="text-xs font-bold">{{ index + 1 }}</span>
                    </div>
                    
                    <!-- Label -->
                    <div class="mt-3 text-xs w-24 text-center font-medium transition-colors duration-300"
                        :class="[
                            getCurrentStageIndex(project?.status) >= index ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600'
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
                                <div class="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-none">{{ project?.major_department }}</div>
                            </div>
                         </div>
                         
                         <div class="hidden md:block w-px h-8 bg-zinc-300 dark:bg-zinc-600"></div>
                         
                         <div class="flex items-center gap-8 flex-1">
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">팀장</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project?.managers?.major_expr?.name }} <span class="text-xs text-zinc-500 font-normal">{{ project?.managers?.major_expr?.position }}</span></span>
                             </div>
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">담당</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project?.managers?.major_mng?.name }} <span class="text-xs text-zinc-500 font-normal">{{ project?.managers?.major_mng?.position }}</span></span>
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
                                <div class="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-none">{{ project?.it_department }}</div>
                            </div>
                         </div>

                         <div class="hidden md:block w-px h-8 bg-zinc-300 dark:bg-zinc-600"></div>

                         <div class="flex items-center gap-8 flex-1">
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">팀장</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project?.managers?.it_expr?.name }} <span class="text-xs text-zinc-500 font-normal">{{ project?.managers?.it_expr?.position }}</span></span>
                             </div>
                             <div class="flex items-center gap-2">
                                 <span class="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm">담당</span>
                                 <span class="text-zinc-900 dark:text-zinc-100 font-medium whitespace-nowrap">{{ project?.managers?.it_mng?.name }} <span class="text-xs text-zinc-500 font-normal">{{ project?.managers?.it_mng?.position }}</span></span>
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
                        <div class="ql-editor text-zinc-700 dark:text-zinc-300 leading-relaxed px-0" v-html="project?.description"></div>
                    </section>

                    <section>
                        <h3 class="text-sm font-bold text-zinc-500 mb-2">추진 배경</h3>
                        <div class="ql-editor p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-zinc-700 dark:text-zinc-300 text-sm" v-html="project?.background || '내용 없음'"></div>
                    </section>

                    <section>
                        <h3 class="text-sm font-bold text-zinc-500 mb-2">기대 효과</h3>
                        <div class="ql-editor p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-blue-800 dark:text-blue-200 text-sm" v-html="project?.effect || '내용 없음'"></div>
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
                                    {{ formatCurrency(project?.budget || 0) }}
                                </div>
                                <small class="text-zinc-500 mt-2 text-xs">
                                    * 환율 적용: 1 USD = 1,450원, 1 EUR = 1,550원
                                </small>
                            </div>
                            
                            <div class="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                <h3 class="text-indigo-800 dark:text-indigo-200 font-medium mb-1">전결권</h3>
                                <div class="flex flex-col items-center">
                                    <span class="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{{ approvalAuthority.authority }}</span>
                                    <span class="text-xs text-indigo-500 dark:text-indigo-400 mt-1">({{ approvalAuthority.reason }})</span>
                                </div>
                            </div>
                        </div>

                        <!-- 품목 상세 내역 -->
                         <div>
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">품목 상세 내역</h4>
                                <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                                    합계: {{ itemTotalSummary }}
                                </span>
                            </div>
                            <div class="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-800/10">
                                <DataTable :value="project?.items" stripedRows size="small"
                                    :pt="{
                                        headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 text-xs uppercase tracking-wider' },
                                        bodyRow: { class: 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors' }
                                    }"
                                >
                                    <Column field="category" header="비목" style="width: 15%">
                                        <template #body="{ data }">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                    <i v-if="data.category === '기계장치'" class="pi pi-cog text-zinc-500 text-sm"></i>
                                                    <i v-else-if="data.category === '기타무형자산'" class="pi pi-file text-zinc-500 text-sm"></i>
                                                    <i v-else-if="data.category === '개발비'" class="pi pi-code text-zinc-500 text-sm"></i>
                                                    <i v-else-if="data.category === '임차료'" class="pi pi-building text-zinc-500 text-sm"></i>
                                                    <i v-else-if="data.category === '유지보수료'" class="pi pi-wrench text-zinc-500 text-sm"></i>
                                                    <i v-else class="pi pi-box text-zinc-500 text-sm"></i>
                                                </div>
                                                <span class="font-medium text-zinc-700 dark:text-zinc-300">{{ data.category }}</span>
                                            </div>
                                        </template>
                                    </Column>
                                    <Column field="name" header="품목명" style="width: 25%">
                                        <template #body="{ data }">
                                            <span class="font-semibold text-zinc-800 dark:text-zinc-200">{{ data.name }}</span>
                                        </template>
                                    </Column>
                                    <Column field="quantity" header="수량" style="width: 10%">
                                        <template #body="{ data }">
                                            <span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium text-sm">
                                                {{ data.quantity }}
                                            </span>
                                        </template>
                                    </Column>
                                    <Column field="amount" header="단가 / 금액" style="width: 20%">
                                        <template #body="{ data }">
                                            <div class="flex flex-col items-end">
                                                <span class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                    {{ data.amount ? data.amount.toLocaleString() : '0' }} <span class="text-xs font-normal text-zinc-500">{{ data.currency }}</span>
                                                </span>
                                                <span class="text-[10px] text-zinc-400">
                                                    (총 {{ ((data.amount || 0) * (data.quantity || 1)).toLocaleString() }} {{ data.currency }})
                                                </span>
                                            </div>
                                        </template>
                                    </Column>
                                    <Column field="description" header="주요기능">
                                        <template #body="{ data }">
                                            <span class="text-zinc-600 dark:text-zinc-400 text-sm">{{ data.description || '-' }}</span>
                                        </template>
                                    </Column>
                                    <template #empty>
                                        <div class="flex flex-col items-center justify-center py-8 text-zinc-400">
                                            <i class="pi pi-inbox text-3xl mb-2 opacity-50"></i>
                                            <span>등록된 품목 정보가 없습니다.</span>
                                        </div>
                                    </template>
                                </DataTable>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            <!-- 일정/마일스톤 -->
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <h3 class="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-6">주요 마일스톤</h3>
                 <Timeline :value="project?.milestones" layout="horizontal" align="top" class="w-full overflow-x-auto pb-4">
                    <template #content="slotProps">
                        <Card class="mt-2 w-48 shrink-0">
                            <template #title>
                                <div class="text-base font-bold truncate" :title="slotProps.item.title">{{ slotProps.item.title }}</div>
                            </template>
                            <template #subtitle>
                                <div class="text-xs">{{ slotProps.item.date }}</div>
                            </template>
                           <template #content>
                                <Tag :value="slotProps.item.status" severity="info" class="text-xs" />
                           </template>
                        </Card>
                    </template>
                </Timeline>
                <div v-if="!project?.milestones?.length" class="text-center py-10 text-zinc-500">
                    등록된 마일스톤이 없습니다.
                </div>
            </div>


        </div>

    </div>
    <div v-else class="flex flex-col items-center justify-center py-20">
        <div class="text-4xl mb-4">😢</div>
        <h2 class="text-xl font-bold text-zinc-800 dark:text-zinc-200">사업 정보를 찾을 수 없습니다.</h2>
        <Button label="목록으로 돌아가기" link @click="router.back()" class="mt-4" />
    </div>
</template>
