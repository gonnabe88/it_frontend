<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { type ProjectDetail, useProjects } from '~/composables/useProjects';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import { usePdfReport } from '~/composables/usePdfReport';
import { useApprovals, type CreateApplicationRequest } from '~/composables/useApprovals';
import { useAuth } from '~/composables/useAuth';

const { fetchProjectsBulk } = useProjects();
const { generateReport } = usePdfReport();
const { createApplication } = useApprovals();
const { user } = useAuth();

const projectIds = ref<string[]>([]);
const projects = ref<ProjectDetail[]>([]);
const loading = ref(true);
const pdfUrl = ref<string | null>(null);

// Approval Line State
const approvalLine = ref({
    drafter: {
        name: user.value?.empNm || '',
        rank: '', // 직위 정보가 없으면 빈 문자열
        date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
        id: user.value?.eno || ''
    },
    teamLead: {
        name: '',
        rank: '',
        date: '',
        id: ''
    },
    deptHead: {
        name: '',
        rank: '',
        date: '',
        id: ''
    }
});

// Employee Search Dialog
const showEmployeeSearch = ref(false);
const currentSearchTarget = ref<'teamLead' | 'deptHead'>('teamLead');

const openEmployeeSearch = (target: 'teamLead' | 'deptHead') => {
    currentSearchTarget.value = target;
    showEmployeeSearch.value = true;
};

const onEmployeeSelect = (employee: any) => {
    console.log('Selected employee:', employee);

    // EmployeeSearchDialog에서 전달하는 User 타입의 필드명 사용
    const name = employee.usrNm || employee.name || '';
    const rank = employee.ptCNm || employee.rank || '';
    const id = employee.eno || employee.id || '';

    if (currentSearchTarget.value === 'teamLead') {
        approvalLine.value.teamLead = {
            name,
            rank,
            date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
            id
        };
    } else {
        approvalLine.value.deptHead = {
            name,
            rank,
            date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
            id
        };
    }
    // Re-generate PDF when approval line changes
    generatePdf();
    showEmployeeSearch.value = false;
};

const generatePdf = async () => {
    if (projects.value.length === 0) return;

    try {
        console.log('=== STARTING PDF GENERATION ===');
        // generateReport now returns a Promise<string> (Blob URL)
        const url = await generateReport(projects.value, approvalLine.value);

        console.log('=== PDF URL RECEIVED ===');
        console.log('URL:', url);

        if (url) {
            // Revoke old URL if exists
            if (pdfUrl.value) {
                URL.revokeObjectURL(pdfUrl.value);
            }
            pdfUrl.value = url;
            console.log('✓ PDF URL set successfully');
        } else {
            console.error('✗ No URL received from generateReport');
        }
    } catch (error) {
        console.error('✗ Error generating PDF:', error);
    }
};

// Load Data
onMounted(async () => {
    // Read from sessionStorage instead of query params
    let ids: string[] = [];

    if (process.client) {
        const storedIds = sessionStorage.getItem('selectedProjectIds');
        if (storedIds) {
            try {
                ids = JSON.parse(storedIds);
                // Clear after reading to prevent reuse
                sessionStorage.removeItem('selectedProjectIds');
            } catch (e) {
                console.error('Failed to parse stored project IDs', e);
            }
        }
    }

    if (ids.length > 0) {
        projectIds.value = ids;
        try {
            // Use bulk-get API instead of individual requests
            projects.value = await fetchProjectsBulk(projectIds.value);

            // Initial generation
            await generatePdf();
        } catch (e) {
            console.error('Failed to load projects', e);
        } finally {
            loading.value = false;
        }
    } else {
        loading.value = false;
        alert('선택된 프로젝트가 없습니다.');
        navigateTo('/info/projects');
    }
});

const submitApproval = async () => {
    // 1. Validate Approval Line
    if (!approvalLine.value.teamLead.id || !approvalLine.value.deptHead.id) {
        alert('결재 라인을 모두 지정해주세요 (팀장/부서장).');
        return;
    }

    try {
        // Create application for each project
        const applicationPromises = projects.value.map((project) => {
            const request: CreateApplicationRequest = {
                apfNm: '전산예산 신청', // 신청서명
                apfDtlCone: JSON.stringify({
                    projects: [project],
                    approvalLine: {
                        ...approvalLine.value,
                        teamLead: { ...approvalLine.value.teamLead, date: '' },
                        deptHead: { ...approvalLine.value.deptHead, date: '' }
                    }
                }),
                orcTbCd: 'BPRJTM', // 프로젝트 테이블 코드
                orcPkVl: project.prjMngNo, // 프로젝트 관리번호 (PK)
                orcSnoVl: '1', // 일련번호 (기본값)
                rqsEno: approvalLine.value.drafter.id, // 신청자 사원번호
                rqsOpnn: `${project.prjNm}`, // 신청 의견
                approverEnos: [
                    approvalLine.value.teamLead.id,
                    approvalLine.value.deptHead.id
                ] // 결재자 목록 (순서대로: 팀장, 부서장)
            };

            return createApplication(request);
        });

        // Wait for all applications to be created
        await Promise.all(applicationPromises);

        alert(`${projects.value.length}건의 결재 상신이 완료되었습니다.`);
        navigateTo('/info/projects');
    } catch (e) {
        console.error('Approval failed', e);
        alert('결재 상신 중 오류가 발생했습니다.');
    }
};
</script>

<template>
    <!-- Report Page -->
    <div class="h-full flex flex-col p-4 rounded shadow-sm bg-gray-50 dark:bg-zinc-900">

        <!-- Toolbar -->
        <div class="flex justify-end gap-2 mb-4 shrink-0">
            <Button label="목록으로" icon="pi pi-arrow-left" severity="secondary" outlined
                @click="navigateTo('/info/projects')" />

            <div class="flex-1"></div>

            <!-- Approval Line Settings (Moved here since we can't click PDF to change) -->
            <div
                class="flex gap-2 mr-4 items-center bg-white dark:bg-gray-800 px-3 py-1 rounded shadow-sm border border-gray-200 dark:border-gray-700">
                <span class="text-sm font-bold text-gray-700 dark:text-gray-200 mr-2">결재자 지정</span>
                <Button :label="approvalLine.teamLead.name ? `${approvalLine.teamLead.name} (팀장)` : '팀장 선택'"
                    size="small" severity="secondary" text @click="openEmployeeSearch('teamLead')"
                    :class="!approvalLine.teamLead.name ? 'text-blue-600' : ''" />
                <span class="text-gray-300 dark:text-gray-600">|</span>
                <Button :label="approvalLine.deptHead.name ? `${approvalLine.deptHead.name} (부서장)` : '부서장 선택'"
                    size="small" severity="secondary" text @click="openEmployeeSearch('deptHead')"
                    :class="!approvalLine.deptHead.name ? 'text-blue-600' : ''" />
            </div>

            <Button label="상신" icon="pi pi-send" @click="submitApproval" />
        </div>

        <!-- PDF Viewer Area -->
        <div
            class="h-[75vh] bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden relative shadow-inner border border-gray-300 dark:border-gray-700 flex justify-center items-center">

            <div v-if="loading" class="flex flex-col items-center">
                <ProgressSpinner />
                <p class="mt-4 text-gray-500 dark:text-gray-400">데이터를 불러오는 중입니다...</p>
            </div>

            <iframe v-else-if="pdfUrl" :src="pdfUrl" class="w-full h-full border-none"></iframe>

            <div v-else class="text-gray-500 dark:text-gray-400">
                <i class="pi pi-exclamation-circle text-2xl mb-2"></i>
                <p>PDF를 생성할 수 없습니다.</p>
            </div>

        </div>

        <EmployeeSearchDialog v-model:visible="showEmployeeSearch" @select="onEmployeeSelect" header="결재권자 검색" />
    </div>
</template>

<style scoped>
/* No specific print styles needed as iframe handles printing */
</style>
