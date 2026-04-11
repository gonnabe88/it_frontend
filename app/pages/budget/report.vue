<!--
================================================================================
[pages/budget/report.vue] 예산 통합 PDF 보고서 + 결재 상신 페이지
================================================================================
선택된 정보화사업/전산업무비 목록을 기반으로 PDF 보고서를 생성하고,
결재 라인(기안자/팀장/부서장)을 지정하여 전자결재를 상신하는 페이지입니다.

[데이터 흐름]
  1. /budget/list에서 정보화사업/전산업무비 각각 체크박스로 선택
  2. sessionStorage에 관리번호 배열 저장
     - 'selectedBudgetProjectIds': 정보화사업 prjMngNo 배열
     - 'selectedBudgetCostIds'   : 전산업무비 itMngcNo 배열
  3. 이 페이지 onMounted에서 sessionStorage 읽기 후 삭제 (재사용 방지)
  4. fetchProjectsBulk / fetchCostsBulk로 상세 데이터 일괄 조회
  5. generateReport(projects, approvalLine, costs)로 PDF 생성 → iframe 표시

[결재 라인 구성]
  - 기안자: 현재 로그인 사용자 자동 설정
  - 팀장: EmployeeSearchDialog로 직원 검색하여 선택
  - 부서장: EmployeeSearchDialog로 직원 검색하여 선택
  - 결재자 변경 시 PDF 자동 재생성

[결재 상신 로직 (submitApproval)]
  1. 팀장/부서장 미지정 시 경고 후 중단
  2. orcItems 구성: 정보화사업 → orcTbCd:'BPROJM', 전산업무비 → orcTbCd:'BCOSTM'
  3. apfDtlCone: { projects:[...], costs:[...], approvalLine } 단일 JSON
  4. createApplication 1회 호출 → APF_MNG_NO 1개, CAPPLA N행
  5. 성공 시 /budget/list 로 이동

[라우팅]
  - 접근: /budget/report
  - 완료 후: /budget/list
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onActivated } from 'vue';
import { type ProjectDetail, useProjects } from '~/composables/useProjects';
import { type ItCost, useCost } from '~/composables/useCost';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import { usePdfReport } from '~/composables/usePdfReport';
import { useApprovals, type CreateApplicationRequest, type OrcItem } from '~/composables/useApprovals';
import { useAuth } from '~/composables/useAuth';
import type { OrgUser } from '~/composables/useOrganization';

/**
 * EmployeeSearchDialog emit 데이터 타입
 * OrgUser에 EmployeeSearchDialog에서 추가하는 부서코드(orgCode) 필드를 포함합니다.
 */
interface EmployeeSelectResult extends OrgUser {
    orgCode: string; // 선택된 Tree 노드의 부서코드
}

const { fetchProjectsBulk } = useProjects();
const { fetchCostsBulk } = useCost();
const { generateReport } = usePdfReport();
const { createApplication } = useApprovals();
const { user } = useAuth();

/** sessionStorage에서 로드한 정보화사업 관리번호 목록 */
const projectIds = ref<string[]>([]);
/** sessionStorage에서 로드한 전산업무비 관리번호 목록 */
const costIds = ref<string[]>([]);

/** 상세 데이터가 로드된 정보화사업 목록 */
const projects = ref<ProjectDetail[]>([]);
/** 상세 데이터가 로드된 전산업무비 목록 */
const costs = ref<ItCost[]>([]);

/** 데이터 로딩 중 상태 (spinner 표시용) */
const loading = ref(true);
/** 생성된 PDF Blob URL (iframe src에 사용, 이전 URL은 revoke) */
const pdfUrl = ref<string | null>(null);

/** 선택된 총 항목 수 (안내 문구에 사용) */
const totalCount = computed(() => projects.value.length + costs.value.length);

/**
 * 결재 라인 상태
 * 기안자는 로그인 사용자 정보로 자동 초기화됩니다.
 */
const approvalLine = ref({
    /** 기안자 정보 (로그인 사용자 자동 설정) */
    drafter: {
        name: user.value?.empNm || '',
        rank: '',
        date: new Date().toISOString(),
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
 * @param employee - EmployeeSearchDialog에서 emit하는 EmployeeSelectResult
 */
const onEmployeeSelect = (employee: EmployeeSelectResult) => {
    const name = employee.usrNm;
    const rank = employee.ptCNm || '';
    const id = employee.eno;

    if (currentSearchTarget.value === 'teamLead') {
        approvalLine.value.teamLead = { name, rank, date: '', id };
    } else {
        approvalLine.value.deptHead = { name, rank, date: '', id };
    }

    /* 결재자 변경 시 PDF 자동 재생성 */
    generatePdf();
    showEmployeeSearch.value = false;
};

/**
 * PDF 보고서 생성
 * generateReport(projects, approvalLine, costs)를 호출하여
 * Blob URL을 받아 iframe에 설정합니다.
 * 이전 URL은 메모리 누수 방지를 위해 revoke합니다.
 */
const generatePdf = async () => {
    /* 정보화사업/전산업무비 중 하나라도 있어야 생성 가능 */
    if (projects.value.length === 0 && costs.value.length === 0) return;

    try {
        const url = await generateReport(projects.value, approvalLine.value, costs.value);

        if (url) {
            /* 이전 Blob URL 메모리 해제 */
            if (pdfUrl.value) {
                URL.revokeObjectURL(pdfUrl.value);
            }
            pdfUrl.value = url;
        }
    } catch (error) {
        console.error('PDF 생성 실패:', error);
    }
};

/**
 * 초기 데이터 로드
 * app.vue에서 <NuxtPage keepalive>로 페이지가 캐시되므로,
 * onMounted 대신 onActivated를 사용하여 재방문 시에도 데이터를 새로 로드합니다.
 * - 첫 방문/재방문: sessionStorage 읽기 → 데이터 병렬 조회 → PDF 생성
 * - sessionStorage가 비어 있고 기존 데이터가 있으면 PDF만 재생성
 */
onActivated(async () => {
    /* 이전 PDF URL 메모리 해제 및 상태 초기화 */
    if (pdfUrl.value) {
        URL.revokeObjectURL(pdfUrl.value);
        pdfUrl.value = null;
    }
    loading.value = true;

    let pIds: string[] = [];
    let cIds: string[] = [];

    if (process.client) {
        /* 정보화사업 ID 복원 */
        const storedProjectIds = sessionStorage.getItem('selectedBudgetProjectIds');
        if (storedProjectIds) {
            try {
                pIds = JSON.parse(storedProjectIds);
                sessionStorage.removeItem('selectedBudgetProjectIds');
            } catch (e) {
                console.error('Failed to parse stored project IDs', e);
            }
        }

        /* 전산업무비 ID 복원 */
        const storedCostIds = sessionStorage.getItem('selectedBudgetCostIds');
        if (storedCostIds) {
            try {
                cIds = JSON.parse(storedCostIds);
                sessionStorage.removeItem('selectedBudgetCostIds');
            } catch (e) {
                console.error('Failed to parse stored cost IDs', e);
            }
        }
    }

    /* sessionStorage에 새 데이터가 없으면 기존 상태 유지 (탭 클릭으로 재방문한 경우) */
    if (pIds.length === 0 && cIds.length === 0) {
        if (projects.value.length === 0 && costs.value.length === 0) {
            loading.value = false;
            alert('선택된 항목이 없습니다.');
            navigateTo('/budget/list');
            return;
        }
        /* 이전 데이터가 있으면 PDF만 재생성 */
        await generatePdf();
        loading.value = false;
        return;
    }

    projectIds.value = pIds;
    costIds.value = cIds;

    try {
        /* 정보화사업/전산업무비 상세 데이터 병렬 조회 */
        const [fetchedProjects, fetchedCosts] = await Promise.all([
            pIds.length > 0 ? fetchProjectsBulk(pIds) : Promise.resolve([] as ProjectDetail[]),
            cIds.length > 0 ? fetchCostsBulk(cIds) : Promise.resolve([] as ItCost[])
        ]);

        projects.value = fetchedProjects;
        costs.value = fetchedCosts;

        /* 초기 PDF 생성 */
        await generatePdf();
    } catch (e) {
        console.error('Failed to load data', e);
    } finally {
        loading.value = false;
    }
});

/**
 * 전자결재 상신 처리
 * 팀장/부서장 지정 확인 후 정보화사업/전산업무비를 통합하여 단일 결재 신청을 생성합니다.
 *
 * [apfDtlCone 구조]
 * { projects: [ProjectDetail], costs: [ItCost], approvalLine } 단일 JSON 문자열
 */
const submitApproval = async () => {
    /* 1. 결재 라인 유효성 검사 */
    if (!approvalLine.value.teamLead.id || !approvalLine.value.deptHead.id) {
        alert('결재 라인을 모두 지정해주세요 (팀장/부서장).');
        return;
    }

    /* 결재 저장 시 결재 날짜를 빈 값으로 초기화 (처리 시점에 채워짐) */
    const savedApprovalLine = {
        ...approvalLine.value,
        teamLead: { ...approvalLine.value.teamLead, date: '' },
        deptHead: { ...approvalLine.value.deptHead, date: '' }
    };

    const approverEnos = [
        approvalLine.value.teamLead.id,
        approvalLine.value.deptHead.id
    ];

    try {
        /* 2. 원본 데이터 연결 항목 구성 (정보화사업 + 전산업무비 통합) */
        const orcItems: OrcItem[] = [
            ...projects.value.map(p => ({
                orcTbCd: 'BPROJM',           // 정보화사업 연계 테이블 코드 (ProjectService.setApplicationInfo 참조값과 일치)
                orcPkVl: p.prjMngNo,         // 프로젝트 관리번호
                orcSnoVl: '1'
            })),
            ...costs.value.map(c => ({
                orcTbCd: 'BCOSTM',          // 전산업무비 연계 테이블 코드
                orcPkVl: c.itMngcNo || '',   // 전산업무비 관리번호
                orcSnoVl: '1'
            }))
        ];

        /* 3. APF_DTL_CONE: 전체 목록 + 결재선을 하나의 JSON으로 통합 */
        const apfDtlCone = JSON.stringify({
            projects: projects.value,
            costs: costs.value,
            approvalLine: savedApprovalLine
        });

        /* 4. 신청의견: 단일이면 항목명, 복수이면 "대표항목명 외 N건" */
        const totalItems = projects.value.length + costs.value.length;
        const firstItemName = projects.value[0]?.prjNm || costs.value[0]?.cttNm || '';
        const rqsOpnn = totalItems === 1
            ? firstItemName
            : `${firstItemName} 외 ${totalItems - 1}건`;

        /* 5. 단일 createApplication 호출로 통합 상신 */
        await createApplication({
            apfNm: '전산예산 작성',
            apfDtlCone,
            orcItems,
            rqsEno: approvalLine.value.drafter.id,
            rqsOpnn,
            approverEnos
        });

        alert(`${totalCount.value}건의 결재 상신이 완료되었습니다.`);
        navigateTo('/budget/list');
    } catch (e) {
        console.error('Approval failed', e);
        alert('결재 상신 중 오류가 발생했습니다.');
    }
};
</script>

<template>
    <!-- 보고서 페이지 전체 컨테이너 -->
    <div class="h-full flex flex-col p-4 rounded shadow-sm bg-gray-50 dark:bg-zinc-900">

        <!-- 툴바: 목록으로 버튼 + 선택 요약 + 결재자 지정 + 상신 버튼 -->
        <div class="flex justify-end gap-2 mb-4 shrink-0">
            <Button label="목록으로" icon="pi pi-arrow-left" severity="secondary" outlined
                @click="navigateTo('/budget/list')" />

            <!-- 선택 항목 요약 안내 -->
            <div v-if="!loading"
                class="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                <i class="pi pi-list text-indigo-500"></i>
                <span v-if="projects.length > 0">정보화사업 {{ projects.length }}건</span>
                <span v-if="projects.length > 0 && costs.length > 0" class="text-gray-300">+</span>
                <span v-if="costs.length > 0">전산업무비 {{ costs.length }}건</span>
            </div>

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
            <div v-else class="flex flex-col items-center text-gray-500 dark:text-gray-400">
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
