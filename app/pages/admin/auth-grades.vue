<!--
================================================================================
[pages/admin/auth-grades.vue] 자격등급 관리 페이지
================================================================================
시스템관리자가 자격등급(TAAABB_CAUTHI)을 조회·추가·수정·삭제하는 화면입니다.

[주요 기능]
  - 전체 자격등급 목록 조회
  - 조회/편집 모드 전환: [수정] → 편집 모드, [취소]/[저장] → 조회 모드 복귀
  - 편집 모드: InlineEditCell 로 셀 직접 수정, 변경 상태 컬럼(신규/수정/삭제) 표시
  - 행 추가: [행 추가] 버튼 → 다이얼로그 → POST API 호출 (조회 모드에서만 노출)
  - 행 삭제: 편집 모드에서 휴지통 → 취소선 표시, [저장] 시 일괄 DELETE
  - [저장] 시 수정/삭제 행을 분류하여 PUT/DELETE 일괄 처리

[연동 API]
  - GET  /api/admin/auth-grades         (fetchAuthGrades)
  - POST /api/admin/auth-grades         (createAuthGrade)
  - PUT  /api/admin/auth-grades/:athId  (updateAuthGrade)
  - DELETE /api/admin/auth-grades/:athId (deleteAuthGrade)
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useAdminApi, type AdminAuthGradeResponse, type AdminAuthGradeRequest } from '~/composables/useAdminApi';
import { useAdminTableEdit } from '~/composables/useAdminTableEdit';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import InlineEditCell from '~/components/common/InlineEditCell.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import { exportRowsToExcel } from '~/utils/excel';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const { fetchAuthGrades, createAuthGrade, updateAuthGrade, deleteAuthGrade } = useAdminApi();

// 자격등급 목록 (반응형)
const { data: authGrades, pending, refresh } = await fetchAuthGrades();

// 사용여부 셀렉트 옵션
const useYnOptions = [
    { label: '사용', value: 'Y' },
    { label: '미사용', value: 'N' },
];

// ============================================================================
// 조회/편집 모드 관리
// ============================================================================

const {
    viewMode, editRows, selectedRows, saving,
    enterEditMode, cancelEdit, saveAndExitEdit,
    rowStatus, rowClass, isRowEditing, markDirty,
    deleteRow, deleteSelectedRows,
} = useAdminTableEdit<AdminAuthGradeResponse>({
    sourceData: authGrades,
    toast,
    onBatchSave: async ({ modifiedRows, deletedRows }) => {
        // 수정 행 PUT, 삭제 행 DELETE 일괄 처리
        await Promise.all([
            ...modifiedRows.map(r => updateAuthGrade(r.athId, {
                athId: r.athId,
                qlfGrNm: r.qlfGrNm,
                qlfGrMat: r.qlfGrMat,
                useYn: r.useYn,
            })),
            ...deletedRows.map(r => deleteAuthGrade(r.athId)),
        ]);
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: '변경사항이 저장되었습니다.', life: 3000 });
    },
});

// ============================================================================
// 검색 및 엑셀
// ============================================================================

const search = ref('');

// 편집 모드에서는 editRows, 조회 모드에서는 authGrades 를 대상으로 검색
const filteredAuthGrades = computed(() => {
    const source = viewMode.value === 'edit' ? editRows.value : (authGrades.value ?? []);
    const q = search.value.trim().toLowerCase();
    if (!q) return source;
    return source.filter(a =>
        [a.athId, a.qlfGrNm, a.qlfGrMat]
            .some(v => v?.toLowerCase().includes(q))
    );
});

const downloadExcel = async () => {
    const rows = filteredAuthGrades.value.map(a => ({
        '자격등급ID': a.athId,
        '자격등급명': a.qlfGrNm,
        '자격등급사항': a.qlfGrMat,
        '사용여부': a.useYn,
    }));
    await exportRowsToExcel(rows, '자격등급', `자격등급_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================================================
// 신규 행 추가 다이얼로그 (다이얼로그 방식, 조회 모드 전용)
// ============================================================================

const newRowVisible = ref(false);
const blankRow = (): AdminAuthGradeRequest => ({ athId: '', qlfGrNm: '', qlfGrMat: '', useYn: 'Y' });
const newRow = reactive<AdminAuthGradeRequest>(blankRow());

const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

/**
 * 신규 자격등급 저장 — POST API 호출
 */
const saveNewRow = async () => {
    if (!newRow.athId?.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '자격등급ID는 필수입니다.', life: 3000 });
        return;
    }
    try {
        await createAuthGrade({ ...newRow });
        newRowVisible.value = false;
        await refresh();
        toast.add({ severity: 'success', summary: '추가 완료', detail: `자격등급 [${newRow.athId}]가 추가되었습니다.`, life: 3000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '자격등급 추가 중 오류가 발생했습니다.', life: 5000 });
    }
};

// ============================================================================
// 직원정보 팝업
// ============================================================================

const employeeDialogVisible = ref(false);

const showEmployeeDialog = (eno: string) => {
    employeeDialogVisible.value = true;
    // EmployeeSearchDialog 가 eno 를 props 로 받지 않으므로 별도 상태 불필요
    void eno;
};
</script>

<template>
    <div class="flex flex-col h-full gap-6">
        <!-- 페이지 헤더 -->
        <PageHeader title="자격등급 관리" subtitle="TAAABB_CAUTHI — 자격등급 조회·추가·수정·삭제">
            <template #actions>
                <!-- 조회 모드: [수정] -->
                <template v-if="viewMode === 'view'">
                    <Button
                        label="수정" severity="primary"
                        class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                        @click="enterEditMode" />
                </template>
                <!-- 편집 모드: [취소] + [저장] -->
                <template v-else>
                    <Button label="취소" severity="secondary" outlined class="!px-5 !rounded-lg" @click="cancelEdit" />
                    <Button
                        label="저장" severity="primary" :loading="saving"
                        class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                        @click="saveAndExitEdit" />
                </template>
            </template>
        </PageHeader>

        <!-- 자격등급 DataTable -->
        <TableCard fill icon="pi-shield" title="자격등급 목록" :count="filteredAuthGrades.length">
            <template #toolbar>
                <TableSearchInput v-model="search" placeholder="자격등급ID, 등급명 검색..." width="30rem" />
                <div class="flex-1" />
                <!-- 편집 모드 전용: [행추가] + [행삭제] -->
                <template v-if="viewMode === 'edit'">
                    <Button
                        label="행 추가" icon="pi pi-plus"
                        severity="secondary" outlined size="small"
                        @click="openNewRowDialog" />
                    <Button
                        label="행삭제" icon="pi pi-trash" severity="danger" outlined size="small"
                        :disabled="!selectedRows.length" @click="deleteSelectedRows" />
                </template>
                <button
                    class="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    @click="downloadExcel">
                    <i class="pi pi-file-excel text-xs" style="color:#16a34a;" />
                    Excel
                </button>
            </template>

            <!-- 편집 모드에서 mode-edit 클래스로 입력 폼 테두리 숨김 -->
            <div class="flex-1 min-h-0 flex flex-col" :class="{ 'mode-edit': viewMode === 'edit' }">
                <StyledDataTable
                    v-model:selection="selectedRows"
                    :value="filteredAuthGrades"
                    :loading="pending"
                    :row-class="rowClass"
                    data-key="athId"
                    scrollable
                    scroll-height="flex">

                    <!-- 체크박스 컬럼: 편집 모드 전용 -->
                    <Column
                        v-if="viewMode === 'edit'" selection-mode="multiple"
                        header-style="width: 3rem; text-align: center" body-style="text-align: center" />

                    <!-- 상태 컬럼: 편집 모드 전용 -->
                    <Column
                        v-if="viewMode === 'edit'" header="상태"
                        header-style="width: 5rem; text-align: center" body-style="text-align: center">
                        <template #body="{ data }">
                            <Tag v-if="rowStatus(data) === 'new'" value="신규" severity="info" class="text-xs" />
                            <Tag v-else-if="rowStatus(data) === 'modified'" value="수정" severity="warn" class="text-xs" />
                            <Tag v-else-if="rowStatus(data) === 'deleted'" value="삭제" severity="danger" class="text-xs" />
                            <span v-else class="text-zinc-300">-</span>
                        </template>
                    </Column>

                    <!-- 자격등급ID (PK, 읽기 전용) -->
                    <Column sortable field="athId" header="자격등급ID" :style="{ width: '140px' }" frozen />

                    <!-- 자격등급명 -->
                    <Column sortable field="qlfGrNm" header="자격등급명" :style="{ width: '180px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.qlfGrNm" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 자격등급사항 -->
                    <Column sortable field="qlfGrMat" header="자격등급사항" :style="{ width: '300px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.qlfGrMat" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 사용여부: 조회 모드 Tag / 편집 모드 Select -->
                    <Column sortable field="useYn" header="사용여부" :style="{ width: '100px' }" body-style="text-align: center">
                        <template #body="{ data }">
                            <Tag
                                v-if="!isRowEditing(data)"
                                :value="data.useYn === 'Y' ? '사용' : '미사용'"
                                :severity="data.useYn === 'Y' ? 'success' : 'secondary'" />
                            <InlineEditCell
                                v-else
                                v-model="data.useYn" type="select" :options="useYnOptions"
                                :force-edit="true" :readonly="false"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 최초생성자 -->
                    <Column header="최초생성자" :style="{ width: '120px' }">
                        <template #body="{ data }">
                            <span
                                v-if="data.fstEnrUsid"
                                class="cursor-pointer text-indigo-600 hover:underline"
                                @click="showEmployeeDialog(data.fstEnrUsid)">
                                {{ data.fstEnrUsNm || data.fstEnrUsid }}
                            </span>
                        </template>
                    </Column>
                    <Column sortable field="fstEnrDtm" header="최초생성시간" :style="{ width: '160px' }">
                        <template #body="{ data }">{{ formatDateTime(data.fstEnrDtm) }}</template>
                    </Column>

                    <!-- 마지막수정자 -->
                    <Column header="마지막수정자" :style="{ width: '120px' }">
                        <template #body="{ data }">
                            <span
                                v-if="data.lstChgUsid"
                                class="cursor-pointer text-indigo-600 hover:underline"
                                @click="showEmployeeDialog(data.lstChgUsid)">
                                {{ data.lstChgUsNm || data.lstChgUsid }}
                            </span>
                        </template>
                    </Column>
                    <Column sortable field="lstChgDtm" header="마지막수정시간" :style="{ width: '160px' }">
                        <template #body="{ data }">{{ formatDateTime(data.lstChgDtm) }}</template>
                    </Column>

                    <!-- 삭제/복구 컬럼: 편집 모드 전용 -->
                    <Column v-if="viewMode === 'edit'" header="" style="width: 48px; text-align: center">
                        <template #body="{ data }">
                            <Button
                                v-if="rowStatus(data) === 'deleted'"
                                v-tooltip.top="'복구'" icon="pi pi-undo" text rounded size="small"
                                severity="success" @click="deleteRow(data)" />
                            <Button
                                v-else
                                v-tooltip.top="'삭제'" icon="pi pi-trash" text rounded size="small"
                                severity="danger" @click="deleteRow(data)" />
                        </template>
                    </Column>
                </StyledDataTable>
            </div>
        </TableCard>

        <!-- 신규 자격등급 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="자격등급 추가" :style="{ width: 'var(--dialog-sm)' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">자격등급ID <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.athId" placeholder="예: ITPAD001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">자격등급명</label>
                    <InputText v-model="newRow.qlfGrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">자격등급사항</label>
                    <Textarea v-model="newRow.qlfGrMat" rows="3" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사용여부</label>
                    <Select
                        v-model="newRow.useYn"
                        :options="useYnOptions"
                        option-label="label" option-value="value" class="w-full" />
                </div>
            </div>
            <template #footer>
                <AppDialogFooter>
                    <Button label="취소" severity="secondary" outlined @click="newRowVisible = false" />
                    <Button label="추가" @click="saveNewRow" />
                </AppDialogFooter>
            </template>
        </Dialog>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>

<style>
/* 수정 모드: PrimeVue 입력 폼 테두리 제거 → 스프레드시트 느낌 */
.mode-edit :is(.p-inputtext, .p-select, .p-autocomplete, .p-autocomplete-input) {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}
.mode-edit :is(.p-inputtext, .p-autocomplete-input):focus,
.mode-edit :is(.p-select, .p-autocomplete).p-focus {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}
</style>
