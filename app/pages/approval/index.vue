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
  - 결재 진행 상황 타임라인: ApprovalTimeline 컴포넌트로 분리 (기안자 + 결재자 수평 타임라인)
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
import StyledDataTable from '~/components/common/StyledDataTable.vue';

import { useApprovals, type BulkApprovalItem } from '~/composables/useApprovals';

const { fetchApprovals, bulkApprove } = useApprovals();

const { user } = useAuth();
/** 전자결재 목록 데이터 및 새로고침 함수 */
const { data: approvals, error, refresh } = await fetchApprovals();
/** 직원 검색 다이얼로그 표시 여부 */
const showEmployeeSearch = ref(false);
/** 체크박스로 선택된 결재 항목 목록 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectedApprovals = ref<any[]>([]);

/* ── 결재 처리 다이얼로그 상태 ── */
const showApprovalDialog = ref(false);
/** 결재 의견 입력값 */
const approvalOpinion = ref('');
/** 결재 처리 중 로딩 상태 (버튼 비활성화용) */
const isSubmitting = ref(false);

/* ── 결재 완료 다이얼로그 상태 ── */
/** 결재 완료 다이얼로그 표시 여부 */
const showResultDialog = ref(false);
/** 결재 완료 메시지 */
const resultMessage = ref('');

/**
 * 직원 검색 선택 콜백 (미래 구현용 placeholder)
 *
 * @param _user - 선택된 직원 정보 (현재 미사용)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMyTurn = (data: any) => {
    if (!user.value || !data.approvers) return false;

    // 이미 최종 승인/반려된 건은 불가
    if (data.apfSts === '승인' || data.apfSts === '반려') return false;

    // 결재자 목록을 순번(dcdSqn) 오름차순 정렬 (안전한 로직을 위해 필수)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedApprovers = [...data.approvers].sort((a: any, b: any) => Number(a.dcdSqn) - Number(b.dcdSqn));

    // 결재자 목록에서 아직 처리일자(dcdDt)가 없는 첫 번째 대기자 찾기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        resultMessage.value = `${items.length}건이 ${status} 처리되었습니다.`;
        showResultDialog.value = true;
    } catch (e) {
        console.error('Approval failed', e);
        alert('결재 처리 중 오류가 발생했습니다.');
    } finally {
        isSubmitting.value = false;
    }
};

/* ── 결재 진행 상황 타임라인 (ApprovalTimeline 컴포넌트 연동) ── */
const showTimelineDialog = ref(false);
/** 타임라인에 전달할 선택된 결재 항목 데이터 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectedTimelineData = ref<any>(null);

/**
 * 결재 진행 상황 타임라인 다이얼로그 열기
 * 선택된 결재 데이터를 ApprovalTimeline 컴포넌트에 전달합니다.
 *
 * @param data - 결재 항목 데이터 (rqsEno, rqsDt 등 기안 정보 포함)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openTimeline = (data: any) => {
    selectedTimelineData.value = data;
    showTimelineDialog.value = true;
};

/* ── 신청서 조회 PDF 뷰어 다이얼로그 ── */
/** ApplicationViewerDialog 표시 여부 */
const showReportDialog = ref(false);
/** 조회할 신청관리번호 */
const currentApfMngNo = ref('');

/**
 * 신청서 조회 다이얼로그 열기
 * @param data - 결재 항목 데이터 (apfMngNo 포함)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openReport = (data: any) => {
    if (!data.apfMngNo) {
        alert('신청관리번호가 없습니다.');
        return;
    }
    currentApfMngNo.value = data.apfMngNo;
    showReportDialog.value = true;
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
            <StyledDataTable :value="approvals || []" dataKey="apfMngNo" v-model:selection="selectedApprovals"
                :isDataSelectable="isRowSelectable" :rowClass="rowClass" sortField="apfMngNo" :sortOrder="-1"
                stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]">
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
            </StyledDataTable>
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


        <!-- 결재 진행 상황 타임라인 (컴포넌트 분리) -->
        <ApprovalTimeline v-model:visible="showTimelineDialog" :approvalData="selectedTimelineData" />


        <!-- 결재 완료 다이얼로그 -->
        <Dialog v-model:visible="showResultDialog" header="결재 처리 완료" modal :closable="false"
            :style="{ width: '400px' }">
            <div class="flex items-center gap-3">
                <i class="pi pi-check-circle text-green-500 text-2xl"></i>
                <span>{{ resultMessage }}</span>
            </div>
            <template #footer>
                <Button label="확인" icon="pi pi-check" @click="showResultDialog = false" />
            </template>
        </Dialog>

        <!-- 신청서 조회 PDF 뷰어 다이얼로그 (재사용 컴포넌트) -->
        <ApplicationViewerDialog
            v-model:visible="showReportDialog"
            :apfMngNo="currentApfMngNo" />
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
