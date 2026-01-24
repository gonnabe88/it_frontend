<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { type ProjectDetail, useProjects } from '~/composables/useProjects';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

const route = useRoute();
const { fetchProject } = useProjects();

const projectIds = ref<string[]>([]);
const projects = ref<ProjectDetail[]>([]);
const loading = ref(true);

// View Mode State
const viewMode = ref<'scroll' | 'slide'>('scroll');
const currentIndex = ref(0);

// Approval Line State
const approvalLine = ref({
    drafter: { name: '홍길동', rank: '과장', date: new Date().toISOString().split('T')[0] }, // Mock current user
    teamLead: { name: '', rank: '', date: '', id: '' },
    deptHead: { name: '', rank: '', date: '', id: '' }
});

// Employee Search Dialog
const showEmployeeSearch = ref(false);
const currentSearchRole = ref<'teamLead' | 'deptHead' | null>(null);

const openEmployeeSearch = (role: 'teamLead' | 'deptHead') => {
    currentSearchRole.value = role;
    showEmployeeSearch.value = true;
};

const onEmployeeSelect = (user: any) => {
    if (currentSearchRole.value && user) {
        approvalLine.value[currentSearchRole.value] = {
            name: user.usrNm,
            rank: user.ptCNm || '',
            date: '',
            id: user.eno
        };
    }
    showEmployeeSearch.value = false;
};

// Load Data
onMounted(async () => {
    const ids = route.query.ids as string;
    if (ids) {
        projectIds.value = ids.split(',');
        try {
            const promises = projectIds.value.map(id => fetchProject(id));
            const results = await Promise.all(promises);
            projects.value = results.map(r => r.data.value).filter(Boolean) as ProjectDetail[];
        } catch (e) {
            console.error('Failed to load projects', e);
        } finally {
            loading.value = false;
        }
    } else {
        loading.value = false;
    }


});

// Actions
const setViewMode = (mode: 'scroll' | 'slide') => {
    viewMode.value = mode;
    currentIndex.value = 0;
};

const nextProject = () => {
    if (currentIndex.value + 2 < projects.value.length) {
        currentIndex.value += 2;
        window.scrollTo(0, 0);
    }
};

const prevProject = () => {
    if (currentIndex.value - 2 >= 0) {
        currentIndex.value -= 2;
        window.scrollTo(0, 0);
    } else if (currentIndex.value > 0) {
        // Handle case where we might be at index 1 (unlikely with +=2 from 0, but good safety)
        currentIndex.value = 0;
        window.scrollTo(0, 0);
    }
};

const printPdf = () => {
    window.print();
};

const submitApproval = async () => {
    // 1. Validate Approval Line
    if (!approvalLine.value.teamLead.id || !approvalLine.value.deptHead.id) {
        alert('결재 라인을 모두 지정해주세요 (팀장/부서장).');
        return;
    }

    try {
        // Mock Application Creation to get apfMngNo
        // In reality, you'd likely POST to /api/applications here
        const newApfMngNo = 'APP-' + Math.floor(Math.random() * 10000);

        // Call the requested approve endpoint
        await $fetch(`/api/applications/${newApfMngNo}/approve`, {
            method: 'POST', // or PUT, usually approve is a state change
            body: {
                projectIds: projectIds.value,
                approvalLine: approvalLine.value
            }
        });

        alert(`결재 상신이 완료되었습니다. (문서번호: ${newApfMngNo})`);
        navigateTo('/info/projects');
    } catch (e) {
        console.error('Approval failed', e);
        // Fallback for demo if API doesn't exist
        alert('결재 시스템과 연동되지 않았습니다. (Demo Mode)');
    }
};
</script>

<template>
    <div class="min-h-screen print:p-0 relative">

        <!-- Toolbar -->
        <div class="flex justify-end gap-2 mb-8 print:hidden max-w-[210mm] mx-auto">
            <Button label="목록으로" icon="pi pi-arrow-left" severity="secondary" outlined
                @click="navigateTo('/info/projects')" />

            <div class="flex-1"></div>

            <!-- View Mode Toggles -->
            <div class="flex bg-gray-100 p-1 rounded-lg mr-4">
                <Button icon="pi pi-list" @click="setViewMode('scroll')" :text="viewMode !== 'scroll'"
                    :class="{ 'bg-white shadow-sm': viewMode === 'scroll' }" v-tooltip="'스크롤 보기'" />
                <Button icon="pi pi-clone" @click="setViewMode('slide')" :text="viewMode !== 'slide'"
                    :class="{ 'bg-white shadow-sm': viewMode === 'slide' }" v-tooltip="'슬라이드 보기 (2쪽)'" />
            </div>

            <Button label="PDF 출력" icon="pi pi-print" severity="secondary" @click="printPdf" />
            <Button label="상신" icon="pi pi-send" @click="submitApproval" />
        </div>

        <!-- Main Content Area with Inline Navigation -->
        <div class="flex justify-center items-start gap-4">

            <!-- Left Arrow (Inline) -->
            <div v-if="viewMode === 'slide'" class="sticky top-1/2 -translate-y-1/2 print:hidden z-10">
                <Button icon="pi pi-chevron-left" rounded outlined
                    class="!w-12 !h-12 !bg-white shadow-lg border-gray-200" @click="prevProject"
                    :disabled="currentIndex === 0" />
            </div>

            <!-- Approval Document (Print Area) -->
            <div id="report" class="print:m-0 flex-1 flex justify-center">
                <!-- Wrapper: Flex Row for Slide (2-up), Flex Col for Scroll -->
                <div :class="[
                    viewMode === 'slide' ? 'flex flex-row gap-8' : 'flex flex-col items-center',
                    'w-full justify-center print:!flex-col print:items-center print:!gap-0'
                ]">

                    <!-- Iterate over projects -->
                    <div v-for="(project, index) in projects" :key="project.prjMngNo"
                        v-show="viewMode === 'scroll' || (index >= currentIndex && index < currentIndex + 2)"
                        class="bg-white p-12 border border-gray-200 shadow-sm mb-8
                            print:shadow-none print:border-none print:m-0 print:p-0 print:mb-0 print:!bg-none print:!block
                            w-[210mm] print:w-[99%] min-h-[297mm] box-border flex flex-col break-after-page relative shrink-0"
                        style="background-image: linear-gradient(to bottom, transparent calc(297mm - 1px), #e5e7eb calc(297mm - 1px), #e5e7eb 297mm); background-size: 100% 297mm;">

                        <!-- Header / Approval Line -->
                        <div class="flex justify-between items-start mb-8 shrink-0">
                            <div>
                                <h1 class="text-3xl font-bold mb-2">예산편성 신청</h1>
                                <p class="text-gray-500">문서번호: (자동생성)</p>
                                <p class="text-gray-500">보존연한: 5년</p>
                            </div>

                            <!-- Approval Table -->
                            <div class="border border-black flex text-center text-sm">
                                <div class="flex flex-col w-20 border-r border-black">
                                    <div class="bg-gray-100 h-8 flex items-center justify-center border-b border-black">
                                        기안자</div>
                                    <div class="h-20 flex flex-col items-center justify-center p-1">
                                        <span class="text-sm cursor-pointer"> {{ approvalLine.drafter.name }} </span>
                                        <span class="text-sm cursor-pointer"> {{ approvalLine.drafter.rank }} </span>
                                    </div>
                                    <div class="h-6 border-t border-black flex items-center justify-center text-xs">
                                        {{ approvalLine.drafter.date }}
                                    </div>
                                </div>
                                <div class="flex flex-col w-20 border-r border-black cursor-pointer hover:bg-gray-50 print:hover:bg-white"
                                    @click="openEmployeeSearch('teamLead')">
                                    <div class="bg-gray-100 h-8 flex items-center justify-center border-b border-black">
                                        팀장</div>
                                    <div class="h-20 flex flex-col items-center justify-center p-1">
                                        <span v-if="approvalLine.teamLead.name">{{ approvalLine.teamLead.name }} </span>
                                        <span v-if="approvalLine.teamLead.rank">{{ approvalLine.teamLead.rank }} </span>
                                        <span v-else class="text-gray-400 print:hidden">선택</span>
                                    </div>
                                    <div class="h-6 border-t border-black flex items-center justify-center text-xs">
                                        {{ approvalLine.teamLead.date }}
                                    </div>
                                </div>
                                <div class="flex flex-col w-20 cursor-pointer hover:bg-gray-50 print:hover:bg-white"
                                    @click="openEmployeeSearch('deptHead')">
                                    <div class="bg-gray-100 h-8 flex items-center justify-center border-b border-black">
                                        부서장</div>
                                    <div class="h-20 flex flex-col items-center justify-center p-1">
                                        <span v-if="approvalLine.deptHead.name">{{ approvalLine.deptHead.name }} </span>
                                        <span v-if="approvalLine.deptHead.rank">{{ approvalLine.deptHead.rank }} </span>
                                        <span v-else class="text-gray-400 print:hidden">선택</span>
                                    </div>
                                    <div class="h-6 border-t border-black flex items-center justify-center text-xs">
                                        {{ approvalLine.deptHead.date }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Title Row -->
                        <div class="border-b-2 border-black pb-2 mb-4 shrink-0">
                            <h2 class="text-xl font-bold flex items-center gap-2">
                                <span
                                    class="bg-black text-white px-2 py-0.5 text-sm rounded-none print:bg-black print:text-white">{{
                                        index + 1 }}</span>
                                {{ project.prjNm }}
                            </h2>
                        </div>

                        <!-- Content Table (Flex Grow to fill page) -->
                        <div class="flex-1 flex flex-col">
                            <table class="w-full h-full border-collapse border border-black text-xs table-fixed">
                                <colgroup>
                                    <col class="w-24 bg-gray-100 print:bg-gray-100 border-r border-black" />
                                    <col class="w-[30%] border-r border-black" />
                                    <col class="w-24 bg-gray-100 print:bg-gray-100 border-r border-black" />
                                    <col />
                                </colgroup>
                                <tbody>
                                    <!-- Row 1: Fixed Height -->
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">사업명</th>
                                        <td colspan="3" class="border-b border-black p-1 pl-2 font-bold">{{
                                            project.prjNm }}</td>
                                    </tr>
                                    <!-- Row 2: Fixed Height -->
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">관리번호</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.prjMngNo }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">사업유형</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.prjTp }}</td>
                                    </tr>
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">상태</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.prjSts }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">보고상태</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.rprSts }}</td>
                                    </tr>
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">예산년도</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.bgYy }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">소요예산</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.prjBg?.toLocaleString() }}
                                            원</td>
                                    </tr>
                                    <!-- Row 3: Fixed Height -->
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">시작일</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.sttDt }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">종료일</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.endDt }}</td>
                                    </tr>
                                    <!-- Row 4: Fixed Height -->
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">주관부문</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.svnHdq }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">주관부서</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.svnDpm }}</td>
                                    </tr>
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">현업담당자</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.svnDpmCgpr }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">현업팀장</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.svnDpmTlr }}</td>
                                    </tr>
                                    <!-- Row 5: Fixed Height -->
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">IT담당부서</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.itDpm }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">IT담당자</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.itDpmCgpr }} / {{
                                            project.itDpmTlr }} (팀장)</td>
                                    </tr>
                                    <!-- Row 6: Fixed Height -->
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">주요사용자</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.mnUsr }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">업무구분</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.bzDtt }}</td>
                                    </tr>
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">기술유형</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.tchnTp }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">전결권</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.edrt }}</td>
                                    </tr>
                                    <tr class="h-[1px]">
                                        <th class="border-b border-black p-1 pl-2 text-left">중복여부</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.dplYn }}</td>
                                        <th class="border-b border-black p-1 pl-2 text-left">의무완료</th>
                                        <td class="border-b border-black p-1 pl-2">{{ project.lblFsgTlm }}</td>
                                    </tr>

                                    <!-- Long Text Rows (Auto Height to Fill) -->
                                    <!-- Note: 'h-auto' triggers flexible height distribution in some browsers when table height is 100% -->
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">현황(Situation)
                                        </th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.saf"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">필요성(Needs)
                                        </th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.ncs"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">사업내용(Des)
                                        </th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.prjDes"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">사업범위(Scope)
                                        </th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.prjRng"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">기대효과(Effect)
                                        </th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.xptEff"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">추진사유</th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.pulRsn"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">추진경과</th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.pulPsg"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">문제점</th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.plm"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">향후계획</th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.hrfPln"></td>
                                    </tr>
                                    <tr>
                                        <th class="border-b border-black p-1 pl-2 text-left bg-gray-50/50">추진가능성</th>
                                        <td colspan="3" class="border-b border-black p-2 align-top whitespace-pre-wrap"
                                            v-html="project.prjPulPtt"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Arrow (Inline) -->
            <div v-if="viewMode === 'slide'" class="sticky top-1/2 -translate-y-1/2 print:hidden z-10">
                <Button icon="pi pi-chevron-right" rounded outlined
                    class="!w-12 !h-12 !bg-white shadow-lg border-gray-200" @click="nextProject"
                    :disabled="currentIndex + 2 >= projects.length" />
            </div>

            <div v-if="loading" class="flex justify-center p-20">
                <ProgressSpinner />
            </div>
        </div>

        <EmployeeSearchDialog v-model:visible="showEmployeeSearch" @select="onEmployeeSelect" header="결재권자 검색" />
    </div>
</template>

<style scoped>
@media print {
    @page {
        margin: 10mm;
        /* Top 0 hides header for cleaner print */
        size: A4;
    }

    .print\:hidden {
        display: none !important;
    }

    /* Force visible because v-show might have hidden it in slide mode */
    .print\:block {
        display: block !important;
    }

    .print\:bg-none {
        background-image: none !important;
    }

    /* Ensure all projects are visible when printing */
    .break-after-page {
        display: flex !important;
    }

    /* Ensure background colors print */
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
}
</style>
