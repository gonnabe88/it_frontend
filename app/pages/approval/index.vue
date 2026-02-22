<!--
================================================================================
[pages/approval/index.vue] 전자결재 목록 페이지
================================================================================
기안된 전자결재 내역을 조회하고, 결재 처리(승인/반려)를 수행하는 페이지입니다.

[주요 기능]
  - 전자결재 목록 DataTable 조회 (전체 기안 건)
  - 결재 차례 판별: isMyTurn()으로 현재 대기자가 로그인 사용자인지 확인
  - 개별 결재: 행의 승인/반려 버튼으로 단건 처리
  - 일괄 결재: 체크박스 선택 후 '일괄 결재' 버튼으로 다건 일괄 처리
  - 결재 진행 상황 타임라인: 기안자 + 결재자 순서를 수평 타임라인으로 시각화
  - PDF 보고서 뷰어: 신청서명 클릭 시 원문 PDF 생성 후 iframe으로 표시

[선택 가능 조건]
  - DataTable 체크박스는 isMyTurn()이 true인 행만 선택 가능
  - 비활성화 행은 CSS(.row-disabled-checkbox)로 체크박스 숨김 처리

[isMyTurn 판별 로직]
  1. 이미 최종 승인/반려된 건은 false 반환
  2. 결재자 목록(approvers)을 dcdSqn 오름차순 정렬
  3. dcdDt(처리일자)가 없는 첫 번째 결재자가 로그인 사용자(dcdEno === user.eno)이면 true

[결재 다이얼로그]
  - targetApprovalStatus: null이면 일괄(승인/반려 버튼 모두 표시)
  - '승인'이면 승인 버튼만, '반려'면 반려 버튼만 표시

[라우팅]
  - 접근: /approval
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

import { useApprovals, type BulkApprovalItem } from '~/composables/useApprovals';
import { usePdfReport } from '~/composables/usePdfReport';

const { fetchApprovals, bulkApprove } = useApprovals();
const { generateReport } = usePdfReport();

const { user } = useAuth();
/** 전자결재 목록 데이터 및 새로고침 함수 */
const { data: approvals, error, refresh } = await fetchApprovals();
/** 직원 검색 다이얼로그 표시 여부 */
const showEmployeeSearch = ref(false);
/** 체크박스로 선택된 결재 항목 목록 */
const selectedApprovals = ref<any[]>([]);

/* ── 결재 처리 다이얼로그 상태 ── */
const showApprovalDialog = ref(false);
/** 결재 의견 입력값 */
const approvalOpinion = ref('');
/** 결재 처리 중 로딩 상태 (버튼 비활성화용) */
const isSubmitting = ref(false);

/**
 * 직원 검색 선택 콜백 (미래 구현용 placeholder)
 *
 * @param _user - 선택된 직원 정보 (현재 미사용)
 */
const onEmployeeSelect = (_user: any) => {
    // Future implementation: handle selection
};

/**
 * 현재 로그인한 사용자가 해당 결재 건의 다음 결재자인지 판별
 * 결재 차례 아닌 행의 체크박스를 비활성화하는 데 사용합니다.
 *
 * @param data - 결재 항목 데이터 (approvers 배열 포함)
 * @returns 현재 사용자가 결재 차례이면 true, 아니면 false
 */
const isMyTurn = (data: any) => {
    if (!user.value || !data.approvers) return false;

    // 이미 최종 승인/반려된 건은 불가
    if (data.apfSts === '승인' || data.apfSts === '반려') return false;

    // 결재자 목록을 순번(dcdSqn) 오름차순 정렬 (안전한 로직을 위해 필수)
    const sortedApprovers = [...data.approvers].sort((a: any, b: any) => Number(a.dcdSqn) - Number(b.dcdSqn));

    // 결재자 목록에서 아직 처리일자(dcdDt)가 없는 첫 번째 대기자 찾기
    const nextApprover = sortedApprovers.find((a: any) => !a.dcdDt);

    if (!nextApprover) return false;

    // 디버깅용 로그 (필요시 주석 처리)
    // console.log(`Doc: ${data.apfMngNo}, My: ${user.value.eno}, Next: ${nextApprover.dcdEno}, IsMe: ${String(nextApprover.dcdEno) === String(user.value.eno)}`);

    // 대기자가 있고, 그 대기자가 본인(dcdEno)인 경우만 true
    return String(nextApprover.dcdEno) === String(user.value.eno);
};

/**
 * DataTable 행 선택 가능 여부 판단 (isDataSelectable prop에 전달)
 * PrimeVue 버전에 따라 event.data 또는 event 자체가 행 데이터임.
 *
 * @param event - PrimeVue DataTable 선택 이벤트
 * @returns 결재 차례인 행만 true 반환
 */
const isRowSelectable = (event: any) => {
    // PrimeVue 버전에 따라 event.data 또는 event 자체가 데이터일 수 있음
    const data = event.data || event;
    return isMyTurn(data);
};

/**
 * 결재 대상 상태값 (개별 처리용)
 * null: 일괄 처리 (승인/반려 버튼 모두 표시)
 * '승인': 승인 버튼만 표시
 * '반려': 반려 버튼만 표시
 */
const targetApprovalStatus = ref<'승인' | '반려' | null>(null);

/**
 * 일괄 결재 다이얼로그 열기
 * 선택된 항목이 없으면 아무 동작도 하지 않습니다.
 */
const openApprovalDialog = () => {
    if (selectedApprovals.value.length === 0) return;
    targetApprovalStatus.value = null; // 일괄 처리 모드로 초기화
    approvalOpinion.value = '';
    showApprovalDialog.value = true;
};

/**
 * 선택된 항목 감시하여 비활성화 항목 제거 (안전장치)
 * isMyTurn이 false인 항목이 선택 목록에 포함될 경우 자동 제거합니다.
 */
watch(selectedApprovals, (newVal) => {
    const validSelection = newVal.filter(item => isMyTurn(item));
    if (newVal.length !== validSelection.length) {
        selectedApprovals.value = validSelection;
    }
});

/**
 * 행 CSS 클래스 결정
 * 결재 차례가 아닌 행에 row-disabled-checkbox 클래스를 적용하여
 * scoped 스타일로 체크박스를 숨깁니다.
 *
 * @param data - DataTable 행 데이터
 * @returns CSS 클래스 문자열
 */
const rowClass = (data: any) => {
    return !isMyTurn(data) ? 'row-disabled-checkbox' : '';
};

/**
 * 개별 결재 다이얼로그 열기
 * 단건 항목을 선택 목록에 설정하고 지정된 처리 상태로 다이얼로그를 엽니다.
 *
 * @param item - 결재 처리할 단건 항목
 * @param status - 처리 상태 ('승인' | '반려')
 */
const openIndividualApprovalDialog = (item: any, status: '승인' | '반려') => {
    selectedApprovals.value = [item];
    targetApprovalStatus.value = status;
    approvalOpinion.value = '';
    showApprovalDialog.value = true;
};

/**
 * 결재 처리 실행 (승인 또는 반려)
 * 선택된 모든 항목에 대해 bulkApprove API를 호출합니다.
 * 성공 시 목록을 새로고침하고 선택 상태를 초기화합니다.
 *
 * @param status - 처리 상태 ('승인' | '반려')
 */
const processApproval = async (status: '승인' | '반려') => {
    if (!user.value) return;

    isSubmitting.value = true;
    try {
        /* 선택된 항목들을 BulkApprovalItem 형식으로 변환 */
        const items: BulkApprovalItem[] = selectedApprovals.value.map(item => ({
            apfMngNo: item.apfMngNo,
            dcdEno: user.value!.eno,
            dcdOpnn: approvalOpinion.value,
            dcdSts: status
        }));

        await bulkApprove(items);

        await refresh(); // 목록 새로고침
        selectedApprovals.value = []; // 선택 초기화
        showApprovalDialog.value = false;
        alert(`${items.length}건이 ${status} 처리되었습니다.`);
    } catch (e) {
        console.error('Approval failed', e);
        alert('결재 처리 중 오류가 발생했습니다.');
    } finally {
        isSubmitting.value = false;
    }
};

/* ── 결재 진행 상황 타임라인 다이얼로그 ── */
const showTimelineDialog = ref(false);
/** 타임라인에 표시할 기안자 + 결재자 통합 목록 */
const timelineApprovers = ref<any[]>([]);
/** 현재 타임라인에 표시 중인 신청서명 */
const currentTimelineApfNm = ref('');
/** 현재 타임라인에 표시 중인 결재 관리번호 */
const currentTimelineApfMngNo = ref('');

/**
 * 결재 진행 상황 타임라인 다이얼로그 열기
 * 기안자 정보를 첫 번째 항목으로 구성하고 결재자 목록을 합쳐 표시합니다.
 *
 * @param data - 결재 항목 데이터 (rqsEno, rqsDt 등 기안 정보 포함)
 */
const openTimeline = (data: any) => {
    /* 기안자 정보를 타임라인 첫 번째 항목으로 구성 */
    const drafter = {
        dcdEno: data.rqsEno,
        dcdDt: data.rqsDt,
        dcdTp: '기안',
        dcdSts: '승인', // 기안은 승인 상태로 간주
        dcdOpnn: data.rqsOpnn
    };

    /* 기안자 + 결재자 목록 합치기 */
    timelineApprovers.value = [drafter, ...(data.approvers || [])];
    currentTimelineApfNm.value = data.apfNm;
    currentTimelineApfMngNo.value = data.apfMngNo;
    showTimelineDialog.value = true;
};

/* ── PDF 보고서 뷰어 다이얼로그 ── */
const showReportDialog = ref(false);
/** 생성된 PDF Blob URL (iframe src에 사용) */
const currentPdfUrl = ref<string | null>(null);

/**
 * 보고서 PDF 생성 및 뷰어 다이얼로그 열기
 * apfDtlCone(신청 상세 JSON)을 파싱하여 generateReport를 호출합니다.
 *
 * @param data - 결재 항목 데이터 (apfDtlCone 필드에 JSON 형태의 사업/결재선 정보 포함)
 */
const openReport = async (data: any) => {
    if (!data.apfDtlCone) {
        alert('상세 내용이 없습니다.');
        return;
    }
    try {
        /* apfDtlCone는 { projects: ProjectDetail[], approvalLine: ApprovalLine } JSON 문자열 */
        const detail = JSON.parse(data.apfDtlCone);
        // generateReport expects (projects, approvalLine)
        const url = await generateReport(detail.projects, detail.approvalLine);
        currentPdfUrl.value = url;
        showReportDialog.value = true;
    } catch (e) {
        console.error('Failed to generate report', e);
        alert('보고서를 생성할 수 없습니다.');
    }
};

definePageMeta({
    title: '전자결재 목록'
});
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더: 제목 + 설명 + 액션 버튼 그룹 -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">전자결재 목록</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    신청한 결재 내역을 조회합니다.
                </p>
            </div>
            <div class="flex gap-2">
                <!-- 직원 검색 다이얼로그 열기 -->
                <Button label="직원 조회" icon="pi pi-search" outlined @click="showEmployeeSearch = true" />
                <!-- 선택된 항목이 있을 때만 일괄 결재 버튼 표시 -->
                <Button v-if="selectedApprovals.length > 0" label="일괄 결재" icon="pi pi-check-square" severity="success"
                    @click="openApprovalDialog" />
                <!-- 목록 새로고침 -->
                <Button icon="pi pi-refresh" outlined rounded @click="refresh()" />
            </div>
        </div>

        <!-- 전자결재 목록 DataTable -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <DataTable :value="approvals || []" dataKey="apfMngNo" v-model:selection="selectedApprovals"
                :isDataSelectable="isRowSelectable" :rowClass="rowClass" sortField="apfMngNo" :sortOrder="-1"
                stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" tableStyle="min-width: 50rem">
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        데이터가 없습니다.
                    </div>
                </template>

                <!-- 다중 선택 체크박스: 결재 차례인 행만 활성화 -->
                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

                <!-- 신청서명: 클릭 시 PDF 보고서 뷰어 열기 -->
                <Column field="apfNm" header="신청서명" sortable class="font-medium">
                    <template #body="{ data }">
                        <span @click="openReport(data)" class="text-blue-600 hover:underline cursor-pointer">
                            {{ data.apfNm }}
                        </span>
                    </template>
                </Column>

                <!-- 결재 상태: 클릭 시 진행 상황 타임라인 다이얼로그 열기 -->
                <Column field="apfSts" header="상태" sortable>
                    <template #body="{ data }">
                        <Tag :value="data.apfSts" :class="getApprovalTagClass(data.apfSts)"
                            class="cursor-pointer hover:opacity-80 transition-opacity" @click="openTimeline(data)"
                            v-tooltip="'결재 진행 상황 보기'" />
                    </template>
                </Column>

                <Column field="rqsEno" header="신청자" sortable></Column>
                <Column field="rqsDt" header="신청일자" sortable></Column>
                <Column field="rqsOpnn" header="신청의견" class="max-w-xs truncate"></Column>

                <!-- 개별 결재 처리: isMyTurn인 행에만 승인/반려 버튼 표시 -->
                <Column header="결재 처리" class="text-center" style="width: 12rem">
                    <template #body="{ data }">
                        <div v-if="isMyTurn(data)" class="flex justify-center gap-2">
                            <Button label="승인" icon="pi pi-check" severity="success" size="small"
                                @click="openIndividualApprovalDialog(data, '승인')" />
                            <Button label="반려" icon="pi pi-times" severity="danger" size="small"
                                @click="openIndividualApprovalDialog(data, '반려')" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- 직원 검색 다이얼로그 -->
        <EmployeeSearchDialog v-model:visible="showEmployeeSearch" @select="onEmployeeSelect" />

        <!-- 결재 처리 다이얼로그 (승인/반려 의견 입력) -->
        <Dialog v-model:visible="showApprovalDialog"
            :header="targetApprovalStatus ? `${targetApprovalStatus} 처리` : '일괄 결재 처리'" modal
            :style="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <p class="text-zinc-600 dark:text-zinc-300">
                    선택한 <span class="font-bold">{{ selectedApprovals.length }}</span>건에 대해 결재를 진행합니다.
                </p>
                <div class="flex flex-col gap-2">
                    <label for="opinion" class="font-medium">결재 의견</label>
                    <Textarea id="opinion" v-model="approvalOpinion" rows="4" placeholder="의견을 입력하세요" class="w-full" />
                </div>
            </div>
            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="취소" severity="secondary" text @click="showApprovalDialog = false" />

                    <!-- 승인 버튼: 일괄 처리 또는 승인 개별 처리 시 표시 -->
                    <Button v-if="!targetApprovalStatus || targetApprovalStatus === '승인'" label="승인" severity="success"
                        icon="pi pi-check" :loading="isSubmitting" @click="processApproval('승인')" />

                    <!-- 반려 버튼: 일괄 처리 또는 반려 개별 처리 시 표시 -->
                    <Button v-if="!targetApprovalStatus || targetApprovalStatus === '반려'" label="반려" severity="danger"
                        icon="pi pi-times" :loading="isSubmitting" @click="processApproval('반려')" />
                </div>
            </template>
        </Dialog>


        <!-- 결재 진행 상황 타임라인 다이얼로그 -->
        <Dialog v-model:visible="showTimelineDialog" modal class="w-[90vw]" :style="{ maxWidth: '1000px' }"
            :showHeader="false">
            <!-- 커스텀 헤더: 신청서명 + 관리번호 표시 -->
            <div
                class="flex items-start justify-between p-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-t-lg">
                <div class="flex gap-4">
                    <div
                        class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <i class="pi pi-sitemap text-xl text-blue-600 dark:text-blue-400"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">결재 진행 상황</h3>
                        <div class="flex flex-col gap-0.5 text-sm text-gray-500 dark:text-gray-400">
                            <span class="font-medium text-gray-700 dark:text-gray-300">{{ currentTimelineApfNm }}</span>
                            <span class="text-xs font-mono">No. {{ currentTimelineApfMngNo }}</span>
                        </div>
                    </div>
                </div>
                <Button icon="pi pi-times" text rounded severity="secondary" @click="showTimelineDialog = false" />
            </div>

            <!-- 타임라인 본문: 수평 배치 + 상태별 색상 마커 -->
            <div class="p-6 bg-slate-50 dark:bg-zinc-900/50 overflow-x-auto rounded-b-lg">
                <div class="relative flex items-start justify-between min-w-[600px] px-4 pt-4 pb-8">
                    <!-- 수평 연결선 (배경) -->
                    <div class="absolute top-9 left-10 right-10 h-0.5 bg-gray-200 dark:bg-gray-700 -z-0"></div>

                    <!-- 타임라인 각 항목 (기안자 + 결재자) -->
                    <div v-for="(approver, index) in timelineApprovers" :key="index"
                        class="relative z-10 flex flex-col items-center flex-1 min-w-[150px]">
                        <!-- 상태별 색상 원형 마커 -->
                        <div class="w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-900 shadow-sm transition-all duration-300 mb-4"
                            :class="{
                                'bg-indigo-100 text-indigo-600 ring-4 ring-indigo-50': approver.dcdTp === '기안',
                                'bg-green-100 text-green-600 ring-4 ring-green-50': approver.dcdTp !== '기안' && (approver.dcdSts === '승인' || (!approver.dcdSts && approver.dcdDt)),
                                'bg-red-100 text-red-600 ring-4 ring-red-50': approver.dcdSts === '반려',
                                'bg-gray-100 text-gray-400': !approver.dcdSts && !approver.dcdDt && approver.dcdTp !== '기안',
                                'bg-blue-100 text-blue-600': approver.dcdSts === '결재중'
                            }">
                            <i class="pi" :class="{
                                'pi-file-edit': approver.dcdTp === '기안',
                                'pi-check': approver.dcdTp !== '기안' && (approver.dcdSts === '승인' || (!approver.dcdSts && approver.dcdDt)),
                                'pi-times': approver.dcdSts === '반려',
                                'pi-user': !approver.dcdSts && !approver.dcdDt && approver.dcdTp !== '기안',
                                'pi-spin pi-spinner': approver.dcdSts === '결재중'
                            }"></i>
                        </div>

                        <!-- 결재자 정보 카드 -->
                        <div
                            class="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-700 w-full max-w-[220px] text-center group relative">
                            <!-- 카드 위쪽 삼각형 포인터 -->
                            <div
                                class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-zinc-800 border-t border-l border-gray-100 dark:border-zinc-700 transform rotate-45 transition-colors">
                            </div>

                            <div class="flex flex-col items-center gap-1 mb-2">
                                <Badge :value="approver.dcdTp || '결재'"
                                    :severity="approver.dcdTp === '기안' ? 'info' : 'secondary'" size="small"
                                    class="mb-1" />
                                <span class="font-bold text-gray-900 dark:text-gray-100 text-lg">{{ approver.dcdEno
                                    }}</span>
                                <span class="text-xs text-gray-500 font-mono">{{ approver.dcdDt || '-' }}</span>
                            </div>

                            <!-- 결재 상태 및 의견 표시 -->
                            <div v-if="approver.dcdSts || approver.dcdDt || approver.dcdOpnn"
                                class="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
                                <div class="mb-2">
                                    <span class="font-bold text-sm px-2 py-0.5 rounded" :class="{
                                        'bg-indigo-50 text-indigo-700': approver.dcdTp === '기안',
                                        'bg-green-50 text-green-700': approver.dcdTp !== '기안' && (approver.dcdSts === '승인' || (!approver.dcdSts && approver.dcdDt)),
                                        'bg-red-50 text-red-700': approver.dcdSts === '반려'
                                    }">
                                        {{ approver.dcdTp === '기안' ? '기안 상신' : (approver.dcdSts || (approver.dcdDt ?
                                        '결재완료'
                                        :'')) }}
                                    </span>
                                </div>
                                <p v-if="approver.dcdOpnn"
                                    class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded text-left break-keep italic">
                                    "{{ approver.dcdOpnn }}"
                                </p>
                            </div>
                            <div v-else class="mt-2 text-sm text-gray-400">
                                대기 중
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>


        <!-- PDF 보고서 뷰어 다이얼로그 -->
        <Dialog v-model:visible="showReportDialog" header="신청서 조회" modal class="w-[90vw] h-[90vh]"
            :style="{ maxWidth: '1000px' }" maximizable>
            <div class="w-full h-[80vh] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <!-- 생성된 PDF를 iframe으로 표시 -->
                <iframe v-if="currentPdfUrl" :src="currentPdfUrl" class="w-full h-full border-none"></iframe>
                <div v-else class="text-gray-500">
                    보고서를 불러오는 중...
                </div>
            </div>
        </Dialog>
    </div>
</template>


<style scoped>
/**
 * 결재 차례가 아닌 행의 체크박스 숨김 처리
 * isMyTurn()이 false인 행에 row-disabled-checkbox 클래스를 적용하여
 * 선택 자체가 불가능함을 UI로 명시합니다.
 */
:deep(.row-disabled-checkbox .p-checkbox),
:deep(.row-disabled-checkbox .p-selection-column .p-checkbox) {
    visibility: hidden !important;
    pointer-events: none !important;
}

:deep(.row-disabled-checkbox .p-selection-column) {
    pointer-events: none !important;
}
</style>
