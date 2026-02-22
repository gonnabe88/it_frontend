<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

import { useApprovals, type BulkApprovalItem } from '~/composables/useApprovals';
import { usePdfReport } from '~/composables/usePdfReport';

const { fetchApprovals, bulkApprove } = useApprovals();
const { generateReport } = usePdfReport();

const { user } = useAuth();
// const expandedRows = ref({}); // 제거
const { data: approvals, error, refresh } = await fetchApprovals();
const showEmployeeSearch = ref(false);
const selectedApprovals = ref<any[]>([]);

// Approval Dialog
const showApprovalDialog = ref(false);
const approvalOpinion = ref('');
const isSubmitting = ref(false);

const onEmployeeSelect = (_user: any) => {
    // Future implementation: handle selection
};

// Check if it's currently user's turn to approve
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

// Check if a row is selectable (current user is the next approver)
const isRowSelectable = (event: any) => {
    // PrimeVue 버전에 따라 event.data 또는 event 자체가 데이터일 수 있음
    const data = event.data || event;
    return isMyTurn(data);
};

// Target status for individual processing ('승인' | '반려' | null)
// null means bulk action (show both buttons)
const targetApprovalStatus = ref<'승인' | '반려' | null>(null);

const openApprovalDialog = () => {
    if (selectedApprovals.value.length === 0) return;
    targetApprovalStatus.value = null; // Reset for bulk action
    approvalOpinion.value = '';
    showApprovalDialog.value = true;
};

// 선택된 항목 감시하여 비활성화 항목 제거 (안전장치)
watch(selectedApprovals, (newVal) => {
    const validSelection = newVal.filter(item => isMyTurn(item));
    if (newVal.length !== validSelection.length) {
        selectedApprovals.value = validSelection;
    }
});

// 행 스타일 클래스 (비활성화 된 행의 체크박스 숨김 처리용)
const rowClass = (data: any) => {
    return !isMyTurn(data) ? 'row-disabled-checkbox' : '';
};

const openIndividualApprovalDialog = (item: any, status: '승인' | '반려') => {
    selectedApprovals.value = [item];
    targetApprovalStatus.value = status;
    approvalOpinion.value = '';
    showApprovalDialog.value = true;
};

const processApproval = async (status: '승인' | '반려') => {
    if (!user.value) return;

    isSubmitting.value = true;
    try {
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

// Timeline Dialog
// Timeline Dialog
const showTimelineDialog = ref(false);
const timelineApprovers = ref<any[]>([]);
const currentTimelineApfNm = ref('');
const currentTimelineApfMngNo = ref('');

const openTimeline = (data: any) => {
    // 기안자 정보를 타임라인 첫 번째 항목으로 구성
    const drafter = {
        dcdEno: data.rqsEno,
        dcdDt: data.rqsDt,
        dcdTp: '기안',
        dcdSts: '승인', // 기안은 승인 상태로 간주
        dcdOpnn: data.rqsOpnn
    };

    // 기안자 + 결재자 목록 합치기
    timelineApprovers.value = [drafter, ...(data.approvers || [])];
    currentTimelineApfNm.value = data.apfNm;
    currentTimelineApfMngNo.value = data.apfMngNo;
    showTimelineDialog.value = true;
};

// Report Dialog
const showReportDialog = ref(false);
const currentPdfUrl = ref<string | null>(null);

const openReport = async (data: any) => {
    if (!data.apfDtlCone) {
        alert('상세 내용이 없습니다.');
        return;
    }
    try {
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
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">전자결재 목록</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    신청한 결재 내역을 조회합니다.
                </p>
            </div>
            <div class="flex gap-2">
                <Button label="직원 조회" icon="pi pi-search" outlined @click="showEmployeeSearch = true" />
                <Button v-if="selectedApprovals.length > 0" label="일괄 결재" icon="pi pi-check-square" severity="success"
                    @click="openApprovalDialog" />
                <Button icon="pi pi-refresh" outlined rounded @click="refresh()" />
            </div>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <DataTable :value="approvals || []" dataKey="apfMngNo" v-model:selection="selectedApprovals"
                :isDataSelectable="isRowSelectable" :rowClass="rowClass" sortField="apfMngNo" :sortOrder="-1"
                stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" tableStyle="min-width: 50rem">
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        데이터가 없습니다.
                    </div>
                </template>

                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
                <!-- <Column expander style="width: 5rem" /> 제거 -->
                <Column field="apfNm" header="신청서명" sortable class="font-medium">
                    <template #body="{ data }">
                        <span @click="openReport(data)" class="text-blue-600 hover:underline cursor-pointer">
                            {{ data.apfNm }}
                        </span>
                    </template>
                </Column>
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

                <!-- Action Column for Individual Approval -->
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

        <EmployeeSearchDialog v-model:visible="showEmployeeSearch" @select="onEmployeeSelect" />

        <!-- Approval Dialog -->
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

                    <!-- 승인 버튼 (일괄 처리 또는 승인 개별 처리 시 표시) -->
                    <Button v-if="!targetApprovalStatus || targetApprovalStatus === '승인'" label="승인" severity="success"
                        icon="pi pi-check" :loading="isSubmitting" @click="processApproval('승인')" />

                    <!-- 반려 버튼 (일괄 처리 또는 반려 개별 처리 시 표시) -->
                    <Button v-if="!targetApprovalStatus || targetApprovalStatus === '반려'" label="반려" severity="danger"
                        icon="pi pi-times" :loading="isSubmitting" @click="processApproval('반려')" />
                </div>
            </template>
        </Dialog>


        <!-- Timeline Dialog -->
        <Dialog v-model:visible="showTimelineDialog" modal class="w-[90vw]" :style="{ maxWidth: '1000px' }"
            :showHeader="false">
            <!-- Custom Header -->
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

            <div class="p-6 bg-slate-50 dark:bg-zinc-900/50 overflow-x-auto rounded-b-lg">
                <div class="relative flex items-start justify-between min-w-[600px] px-4 pt-4 pb-8">
                    <!-- Horizontal Connecting Line -->
                    <div class="absolute top-9 left-10 right-10 h-0.5 bg-gray-200 dark:bg-gray-700 -z-0"></div>

                    <!-- Items -->
                    <div v-for="(approver, index) in timelineApprovers" :key="index"
                        class="relative z-10 flex flex-col items-center flex-1 min-w-[150px]">
                        <!-- Dot -->
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

                        <!-- Content Card -->
                        <div
                            class="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-700 w-full max-w-[220px] text-center group relative">
                            <!-- Triangle Pointer -->
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

                            <!-- Status & Opinion -->
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


        <!-- Report Viewer Dialog -->
        <Dialog v-model:visible="showReportDialog" header="신청서 조회" modal class="w-[90vw] h-[90vh]"
            :style="{ maxWidth: '1000px' }" maximizable>
            <div class="w-full h-[80vh] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <iframe v-if="currentPdfUrl" :src="currentPdfUrl" class="w-full h-full border-none"></iframe>
                <div v-else class="text-gray-500">
                    보고서를 불러오는 중...
                </div>
            </div>
        </Dialog>
    </div>
</template>



<style scoped>
:deep(.row-disabled-checkbox .p-checkbox),
:deep(.row-disabled-checkbox .p-selection-column .p-checkbox) {
    visibility: hidden !important;
    pointer-events: none !important;
}

:deep(.row-disabled-checkbox .p-selection-column) {
    pointer-events: none !important;
}
</style>
