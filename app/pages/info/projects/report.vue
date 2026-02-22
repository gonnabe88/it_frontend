<!--
================================================================================
[pages/info/projects/report.vue] 정보화사업 PDF 보고서 + 결재 상신 페이지
================================================================================
선택된 정보화사업 목록을 기반으로 PDF 보고서를 생성하고,
결재 라인(기안자/팀장/부서장)을 지정하여 전자결재를 상신하는 페이지입니다.

[데이터 흐름]
  1. /info/projects 목록에서 프로젝트 선택
  2. sessionStorage('selectedProjectIds')에 prjMngNo 배열 저장
  3. 이 페이지 onMounted에서 sessionStorage 읽기 후 삭제 (재사용 방지)
  4. fetchProjectsBulk로 선택된 프로젝트 상세 데이터 일괄 조회
  5. generateReport로 PDF Blob URL 생성 → iframe에 표시

[결재 라인 구성]
  - 기안자: 현재 로그인 사용자 자동 설정 (empNm, eno)
  - 팀장: EmployeeSearchDialog로 직원 검색하여 선택
  - 부서장: EmployeeSearchDialog로 직원 검색하여 선택
  - 결재자 변경 시 PDF 자동 재생성 (generatePdf 재호출)

[결재 상신 로직 (submitApproval)]
  1. 팀장/부서장 미지정 시 경고 후 중단
  2. 선택된 프로젝트별로 CreateApplicationRequest 구성
     - apfDtlCone: { projects, approvalLine } JSON 문자열 (PDF 재생성용)
     - approverEnos: [teamLead.id, deptHead.id] (결재 순서대로)
  3. Promise.all로 모든 건 동시 상신 처리
  4. 성공 시 /info/projects 목록으로 이동

[라우팅]
  - 접근: /info/projects/report
  - 완료 후: /info/projects
================================================================================
-->
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

/** 대상 프로젝트 관리번호 목록 (sessionStorage에서 로드) */
const projectIds = ref<string[]>([]);
/** 상세 데이터가 로드된 프로젝트 목록 */
const projects = ref<ProjectDetail[]>([]);
/** 데이터 로딩 중 상태 (spinner 표시용) */
const loading = ref(true);
/** 생성된 PDF Blob URL (iframe src에 사용, 이전 URL은 revoke) */
const pdfUrl = ref<string | null>(null);

/**
 * 결재 라인 상태
 * 기안자는 로그인 사용자 정보로 자동 초기화됩니다.
 */
const approvalLine = ref({
    /** 기안자 정보 (로그인 사용자 자동 설정) */
    drafter: {
        name: user.value?.empNm || '',
        rank: '', // 직위 정보가 없으면 빈 문자열
        date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
        id: user.value?.eno || ''
    },
    /** 팀장 결재자 (직원 검색으로 설정) */
    teamLead: {
        name: '',
        rank: '',
        date: '',
        id: ''
    },
    /** 부서장 결재자 (직원 검색으로 설정) */
    deptHead: {
        name: '',
        rank: '',
        date: '',
        id: ''
    }
});

/* ── 직원 검색 다이얼로그 ── */
/** 직원 검색 다이얼로그 표시 여부 */
const showEmployeeSearch = ref(false);
/** 현재 검색 대상 결재자 타입 ('teamLead' | 'deptHead') */
const currentSearchTarget = ref<'teamLead' | 'deptHead'>('teamLead');

/**
 * 직원 검색 다이얼로그 열기
 * 어떤 결재자 슬롯에 선택 결과를 채울지 target으로 지정합니다.
 *
 * @param target - 검색 대상 결재자 타입
 */
const openEmployeeSearch = (target: 'teamLead' | 'deptHead') => {
    currentSearchTarget.value = target;
    showEmployeeSearch.value = true;
};

/**
 * 직원 검색 선택 완료 콜백
 * 선택된 직원 정보를 결재 라인에 반영하고 PDF를 재생성합니다.
 *
 * @param employee - EmployeeSearchDialog에서 전달하는 직원 객체 (usrNm, ptCNm, eno 등)
 */
const onEmployeeSelect = (employee: any) => {
    console.log('Selected employee:', employee);

    /* EmployeeSearchDialog에서 전달하는 OrgUser 타입의 필드명 사용 */
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
    /* 결재자 변경 시 PDF 자동 재생성 */
    generatePdf();
    showEmployeeSearch.value = false;
};

/**
 * PDF 보고서 생성
 * generateReport(projects, approvalLine)을 호출하여 Blob URL을 받아 iframe에 설정합니다.
 * 이전 URL은 메모리 누수 방지를 위해 revoke합니다.
 */
const generatePdf = async () => {
    if (projects.value.length === 0) return;

    try {
        console.log('=== STARTING PDF GENERATION ===');
        /* generateReport는 Promise<string> (Blob URL)을 반환 */
        const url = await generateReport(projects.value, approvalLine.value);

        console.log('=== PDF URL RECEIVED ===');
        console.log('URL:', url);

        if (url) {
            /* 이전 Blob URL 메모리 해제 */
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

/**
 * 초기 데이터 로드
 * sessionStorage에서 선택된 프로젝트 ID를 읽고,
 * fetchProjectsBulk로 상세 데이터를 일괄 조회한 후 PDF를 초기 생성합니다.
 */
onMounted(async () => {
    let ids: string[] = [];

    if (process.client) {
        const storedIds = sessionStorage.getItem('selectedProjectIds');
        if (storedIds) {
            try {
                ids = JSON.parse(storedIds);
                /* 읽은 후 즉시 삭제하여 재사용 방지 */
                sessionStorage.removeItem('selectedProjectIds');
            } catch (e) {
                console.error('Failed to parse stored project IDs', e);
            }
        }
    }

    if (ids.length > 0) {
        projectIds.value = ids;
        try {
            /* 선택된 프로젝트 상세 데이터 일괄 조회 */
            projects.value = await fetchProjectsBulk(projectIds.value);

            /* 초기 PDF 생성 */
            await generatePdf();
        } catch (e) {
            console.error('Failed to load projects', e);
        } finally {
            loading.value = false;
        }
    } else {
        /* 선택된 프로젝트가 없으면 목록으로 리다이렉트 */
        loading.value = false;
        alert('선택된 프로젝트가 없습니다.');
        navigateTo('/info/projects');
    }
});

/**
 * 전자결재 상신 처리
 * 팀장/부서장 지정 확인 후 프로젝트별 CreateApplicationRequest를 구성하여
 * Promise.all로 동시 상신합니다.
 *
 * [apfDtlCone 구조]
 * { projects: [ProjectDetail], approvalLine: ApprovalLine } JSON 문자열
 * 전자결재 목록에서 PDF 재생성 시 이 데이터를 파싱하여 사용합니다.
 */
const submitApproval = async () => {
    /* 1. 결재 라인 유효성 검사 */
    if (!approvalLine.value.teamLead.id || !approvalLine.value.deptHead.id) {
        alert('결재 라인을 모두 지정해주세요 (팀장/부서장).');
        return;
    }

    try {
        /* 2. 프로젝트별 결재 신청 요청 구성 */
        const applicationPromises = projects.value.map((project) => {
            const request: CreateApplicationRequest = {
                apfNm: '전산예산 신청', // 신청서명
                apfDtlCone: JSON.stringify({
                    projects: [project],
                    approvalLine: {
                        ...approvalLine.value,
                        /* 저장 시에는 결재 날짜를 빈 값으로 초기화 (처리 시점에 채워짐) */
                        teamLead: { ...approvalLine.value.teamLead, date: '' },
                        deptHead: { ...approvalLine.value.deptHead, date: '' }
                    }
                }),
                orcTbCd: 'BPRJTM', // 연계 테이블 코드 (프로젝트)
                orcPkVl: project.prjMngNo, // 연계 PK (프로젝트 관리번호)
                orcSnoVl: '1', // 일련번호 기본값
                rqsEno: approvalLine.value.drafter.id, // 기안자 사원번호
                rqsOpnn: `${project.prjNm}`, // 신청 의견 (사업명)
                approverEnos: [
                    approvalLine.value.teamLead.id,
                    approvalLine.value.deptHead.id
                ] // 결재자 순서: 팀장 → 부서장
            };

            return createApplication(request);
        });

        /* 3. 모든 결재 상신 동시 처리 */
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
    <!-- 보고서 페이지 전체 컨테이너 -->
    <div class="h-full flex flex-col p-4 rounded shadow-sm bg-gray-50 dark:bg-zinc-900">

        <!-- 툴바: 목록으로 버튼 + 결재자 지정 + 상신 버튼 -->
        <div class="flex justify-end gap-2 mb-4 shrink-0">
            <Button label="목록으로" icon="pi pi-arrow-left" severity="secondary" outlined
                @click="navigateTo('/info/projects')" />

            <div class="flex-1"></div>

            <!-- 결재자 지정 인라인 컨트롤 -->
            <div
                class="flex gap-2 mr-4 items-center bg-white dark:bg-gray-800 px-3 py-1 rounded shadow-sm border border-gray-200 dark:border-gray-700">
                <span class="text-sm font-bold text-gray-700 dark:text-gray-200 mr-2">결재자 지정</span>
                <!-- 팀장 선택 버튼 (미선택 시 파란색 강조) -->
                <Button :label="approvalLine.teamLead.name ? `${approvalLine.teamLead.name} (팀장)` : '팀장 선택'"
                    size="small" severity="secondary" text @click="openEmployeeSearch('teamLead')"
                    :class="!approvalLine.teamLead.name ? 'text-blue-600' : ''" />
                <span class="text-gray-300 dark:text-gray-600">|</span>
                <!-- 부서장 선택 버튼 (미선택 시 파란색 강조) -->
                <Button :label="approvalLine.deptHead.name ? `${approvalLine.deptHead.name} (부서장)` : '부서장 선택'"
                    size="small" severity="secondary" text @click="openEmployeeSearch('deptHead')"
                    :class="!approvalLine.deptHead.name ? 'text-blue-600' : ''" />
            </div>

            <!-- 결재 상신 버튼 -->
            <Button label="상신" icon="pi pi-send" @click="submitApproval" />
        </div>

        <!-- PDF 뷰어 영역 -->
        <div
            class="h-[75vh] bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden relative shadow-inner border border-gray-300 dark:border-gray-700 flex justify-center items-center">

            <!-- 데이터 로딩 중 스피너 -->
            <div v-if="loading" class="flex flex-col items-center">
                <ProgressSpinner />
                <p class="mt-4 text-gray-500 dark:text-gray-400">데이터를 불러오는 중입니다...</p>
            </div>

            <!-- PDF iframe 뷰어 -->
            <iframe v-else-if="pdfUrl" :src="pdfUrl" class="w-full h-full border-none"></iframe>

            <!-- PDF 생성 실패 상태 -->
            <div v-else class="text-gray-500 dark:text-gray-400">
                <i class="pi pi-exclamation-circle text-2xl mb-2"></i>
                <p>PDF를 생성할 수 없습니다.</p>
            </div>

        </div>

        <!-- 직원 검색 다이얼로그 (결재권자 검색) -->
        <EmployeeSearchDialog v-model:visible="showEmployeeSearch" @select="onEmployeeSelect" header="결재권자 검색" />
    </div>
</template>

<style scoped>
/* iframe이 인쇄를 처리하므로 별도 print 스타일 불필요 */
</style>
