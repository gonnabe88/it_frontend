<!--
================================================================================
[pages/admin/codes.vue] 공통코드 관리 페이지
================================================================================
시스템관리자가 공통코드(TAAABB_CCODEM)를 관리하는 화면입니다.

[주요 기능]
  - 전체 코드 목록 조회 / Drawer 상세 필터 + 통합검색
  - 조회/편집 모드 전환: [수정] → 편집 모드, [취소]/[저장] → 조회 모드 복귀
  - 편집 모드: InlineEditCell 로 각 필드 직접 수정, 변경 상태 컬럼 표시
  - 행 추가: [행 추가] 버튼 → 다이얼로그 → POST API 호출 (조회 모드에서만 노출)
  - 행 삭제: 편집 모드에서 휴지통 → 취소선 표시, [저장] 시 일괄 DELETE
  - 일괄 업로드: 엑셀 파일 파싱 → bulkUpsert API (조회 모드에서만 노출)
  - 복합PK(cdId + sttDt) 처리

[연동 API]
  - GET    /api/admin/codes                  (fetchCodes)
  - POST   /api/admin/codes                  (createCode)
  - PUT    /api/admin/codes/:cdId?sttDt=...  (updateCode)
  - DELETE /api/admin/codes/:cdId?sttDt=...  (deleteCode)
  - POST   /api/admin/codes/bulk             (bulkUpsertCodes)
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useAdminApi, type AdminCodeResponse, type AdminCodeRequest } from '~/composables/useAdminApi';
import { useAdminTableEdit } from '~/composables/useAdminTableEdit';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import InlineEditCell from '~/components/common/InlineEditCell.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import ExcelJS from 'exceljs';
import { exportRowsToExcel } from '~/utils/excel';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const { fetchCodes, createCode, updateCode, deleteCode, bulkUpsertCodes } = useAdminApi();

// 공통코드 목록 (반응형)
const { data: codes, pending, refresh } = await fetchCodes();

// ============================================================================
// 조회/편집 모드 관리
// ============================================================================

const {
    viewMode, editRows, selectedRows, saving,
    enterEditMode, cancelEdit, saveAndExitEdit,
    rowStatus, rowClass, isRowEditing, markDirty,
    deleteRow, deleteSelectedRows,
} = useAdminTableEdit<AdminCodeResponse>({
    sourceData: codes,
    toast,
    onBatchSave: async ({ modifiedRows, deletedRows }) => {
        await Promise.all([
            ...modifiedRows.map(r => updateCode(r.cdId, {
                cdId: r.cdId,
                cdNm: r.cdNm,
                cdva: r.cdva,
                cdDes: r.cdDes,
                cttTp: r.cttTp,
                cttTpDes: r.cttTpDes,
                sttDt: r.sttDt,
                endDt: r.endDt,
                cdSqn: r.cdSqn,
            })),
            ...deletedRows.map(r => deleteCode(r.cdId, r.sttDt ?? '')),
        ]);
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: '변경사항이 저장되었습니다.', life: 3000 });
    },
});

// ============================================================================
// 검색 / 필터 (Drawer)
// ============================================================================

const visibleDrawer = ref(false);
const globalSearch = ref('');

const searchFilters = ref({
    cdId: '',
    cdNm: '',
    cdva: '',
    cdDes: '',
    cttTp: [] as string[],
    cttTpDes: [] as string[],
    baseDate: null as Date | null,
});

// AutoComplete 원본 데이터 — 목록에서 유니크 값 추출
const cttTpOptions    = computed(() => [...new Set((codes.value ?? []).map(c => c.cttTp).filter(Boolean))]);
const cttTpDesOptions = computed(() => [...new Set((codes.value ?? []).map(c => c.cttTpDes).filter(Boolean))]);

const filteredCttTp    = ref<string[]>([]);
const filteredCttTpDes = ref<string[]>([]);

const searchCttTp    = (e: { query: string }) => {
    filteredCttTp.value = cttTpOptions.value.filter(v => v.toLowerCase().includes(e.query.toLowerCase()));
};
const searchCttTpDes = (e: { query: string }) => {
    filteredCttTpDes.value = cttTpDesOptions.value.filter(v => v.toLowerCase().includes(e.query.toLowerCase()));
};

const activeFilterCount = computed(() => {
    const f = searchFilters.value;
    return [f.cdId, f.cdNm, f.cdva, f.cdDes].filter(v => v.trim()).length
        + (f.cttTp.length > 0 ? 1 : 0)
        + (f.cttTpDes.length > 0 ? 1 : 0)
        + (f.baseDate ? 1 : 0);
});

const filteredCodes = computed(() => {
    // 편집 모드에서는 editRows를, 조회 모드에서는 원본 데이터를 사용
    const list = viewMode.value === 'edit' ? editRows.value : (codes.value ?? []);
    const { cdId, cdNm, cdva, cdDes, cttTp, cttTpDes, baseDate } = searchFilters.value;
    const gk = globalSearch.value.trim().toLowerCase();
    return list.filter(c => {
        if (gk) {
            const haystack = [c.cdId, c.cdNm, c.cdva, c.cdDes, c.cttTp, c.cttTpDes]
                .filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(gk)) return false;
        }
        if (cdId  && !c.cdId?.toLowerCase().includes(cdId.trim().toLowerCase()))   return false;
        if (cdNm  && !c.cdNm?.toLowerCase().includes(cdNm.trim().toLowerCase()))   return false;
        if (cdva  && !c.cdva?.toLowerCase().includes(cdva.trim().toLowerCase()))   return false;
        if (cdDes && !c.cdDes?.toLowerCase().includes(cdDes.trim().toLowerCase())) return false;
        if (cttTp.length    > 0 && !cttTp.includes(c.cttTp))       return false;
        if (cttTpDes.length > 0 && !cttTpDes.includes(c.cttTpDes)) return false;
        if (baseDate) {
            const base = baseDate.toISOString().split('T')[0]!;
            if (c.sttDt && base < c.sttDt) return false;
            if (c.endDt && base > c.endDt) return false;
        }
        return true;
    });
});

const resetFilters = () => {
    searchFilters.value = {
        cdId: '', cdNm: '', cdva: '', cdDes: '',
        cttTp: [], cttTpDes: [],
        baseDate: null,
    };
};

// ============================================================================
// 엑셀 다운로드
// ============================================================================

const downloadExcel = async () => {
    const rows = (codes.value ?? []).map(c => ({
        '코드ID':     c.cdId,
        '코드명':     c.cdNm,
        '코드값':     c.cdva,
        '코드설명':   c.cdDes,
        '코드값구분': c.cttTp,
        '구분설명':   c.cttTpDes,
        '시작일자':   c.sttDt ?? '',
        '종료일자':   c.endDt ?? '',
        '순서':       c.cdSqn ?? '',
    }));
    await exportRowsToExcel(rows, '공통코드', `공통코드_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================================================
// 일괄 업로드
// ============================================================================

const uploadInput = ref<HTMLInputElement | null>(null);

const onUploadFile = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (uploadInput.value) uploadInput.value.value = '';

    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) {
        toast.add({ severity: 'error', summary: '업로드', detail: '시트가 없는 파일입니다.', life: 2000 });
        return;
    }
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];
    ws.eachRow((row, rowIndex) => {
        if (rowIndex === 1) {
            row.eachCell(cell => headers.push(String(cell.value ?? '')));
        } else {
            const obj: Record<string, string> = {};
            row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                obj[headers[colIndex - 1] ?? ''] = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
            });
            rows.push(obj);
        }
    });

    if (rows.length === 0) {
        toast.add({ severity: 'warn', summary: '빈 파일', detail: '업로드할 데이터가 없습니다.', life: 3000 });
        return;
    }

    const parsed: AdminCodeRequest[] = rows.map(row => ({
        cdId:     String(row['코드ID'] ?? '').trim(),
        cdNm:     String(row['코드명'] ?? '').trim(),
        cdva:     String(row['코드값'] ?? '').trim(),
        cdDes:    String(row['코드설명'] ?? '').trim(),
        cttTp:    String(row['코드값구분'] ?? '').trim(),
        cttTpDes: String(row['구분설명'] ?? '').trim(),
        sttDt:    String(row['시작일자'] ?? '').trim() || undefined,
        endDt:    String(row['종료일자'] ?? '').trim() || undefined,
        cdSqn:    row['순서'] !== '' ? Number(row['순서']) : undefined,
    })).filter(r => r.cdId);

    if (parsed.length === 0) {
        toast.add({ severity: 'warn', summary: '오류', detail: '코드ID 컬럼이 없거나 모두 비어있습니다.', life: 4000 });
        return;
    }

    try {
        const result = await bulkUpsertCodes(parsed);
        await refresh();
        toast.add({
            severity: 'success',
            summary: '업로드 완료',
            detail: `신규 ${result.created}건, 수정 ${result.updated}건 처리되었습니다.`,
            life: 4000
        });
    } catch {
        toast.add({ severity: 'error', summary: '업로드 실패', detail: '서버 처리 중 오류가 발생했습니다.', life: 5000 });
    }
};

// ============================================================================
// 신규 행 추가 다이얼로그
// ============================================================================

const newRowVisible = ref(false);
const blankRow = (): AdminCodeRequest => ({
    cdId: '', cdNm: '', cdva: '', cdDes: '', cttTp: '', cttTpDes: '',
    sttDt: undefined, endDt: undefined, cdSqn: undefined,
});
const newRow = reactive<AdminCodeRequest>(blankRow());

const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

const saveNewRow = async () => {
    if (!newRow.cdId?.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '코드ID는 필수입니다.', life: 3000 });
        return;
    }
    try {
        await createCode({ ...newRow });
        newRowVisible.value = false;
        await refresh();
        toast.add({ severity: 'success', summary: '추가 완료', detail: `코드 [${newRow.cdId}]가 추가되었습니다.`, life: 3000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '코드 추가 중 오류가 발생했습니다.', life: 5000 });
    }
};

// ============================================================================
// 직원정보 팝업
// ============================================================================

const employeeDialogVisible = ref(false);

const showEmployeeDialog = (eno: string) => {
    employeeDialogVisible.value = true;
    void eno;
};
</script>

<template>
    <div class="flex flex-col h-full gap-6">
        <!-- 페이지 헤더 -->
        <PageHeader title="공통코드 관리" subtitle="TAAABB_CCODEM — 공통코드 조회·추가·수정·삭제">
            <template #actions>
                <!-- hidden file input (업로드) — 위치 무관, 항상 렌더링 -->
                <input
                    ref="uploadInput"
                    type="file"
                    accept=".xlsx,.xls"
                    class="hidden"
                    @change="onUploadFile"
                >
                <template v-if="viewMode === 'view'">
                    <Button
                        icon="pi pi-filter"
                        label="필터"
                        severity="secondary"
                        outlined
                        :badge="activeFilterCount > 0 ? String(activeFilterCount) : undefined"
                        badge-severity="danger"
                        @click="visibleDrawer = true"
                    />
                    <Button
                        label="수정" severity="primary"
                        class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                        @click="enterEditMode" />
                </template>
                <template v-else>
                    <Button label="취소" severity="secondary" outlined class="!px-5 !rounded-lg" @click="cancelEdit" />
                    <Button
                        label="저장" severity="primary" :loading="saving"
                        class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                        @click="saveAndExitEdit" />
                </template>
            </template>
        </PageHeader>

        <!-- 적용된 필터 Chip -->
        <div v-if="activeFilterCount > 0" class="flex items-center gap-2 flex-wrap">
            <span class="text-sm text-zinc-500 dark:text-zinc-400">적용된 필터:</span>
            <Chip v-if="searchFilters.cdId"         :label="`코드ID: ${searchFilters.cdId}`"         removable @remove="searchFilters.cdId = ''" />
            <Chip v-if="searchFilters.cdNm"         :label="`코드명: ${searchFilters.cdNm}`"         removable @remove="searchFilters.cdNm = ''" />
            <Chip v-if="searchFilters.cdva"         :label="`코드값: ${searchFilters.cdva}`"         removable @remove="searchFilters.cdva = ''" />
            <Chip v-if="searchFilters.cdDes"        :label="`코드설명: ${searchFilters.cdDes}`"      removable @remove="searchFilters.cdDes = ''" />
            <Chip v-if="searchFilters.cttTp.length > 0"    :label="`코드값구분: ${searchFilters.cttTp.join(', ')}`"  removable @remove="searchFilters.cttTp = []" />
            <Chip v-if="searchFilters.cttTpDes.length > 0" :label="`구분설명: ${searchFilters.cttTpDes.join(', ')}`" removable @remove="searchFilters.cttTpDes = []" />
            <Chip v-if="searchFilters.baseDate"     :label="`기준일자: ${searchFilters.baseDate!.toISOString().split('T')[0]}`" removable @remove="searchFilters.baseDate = null" />
        </div>

        <!-- 공통코드 DataTable -->
        <TableCard fill icon="pi-code" title="공통코드 목록" :count="filteredCodes.length">
            <template #toolbar>
                <TableSearchInput
                    v-model="globalSearch"
                    placeholder="코드ID, 코드명, 코드값, 코드설명 검색..."
                    width="30rem"
                />
                <div class="flex-1" />
                <template v-if="viewMode === 'edit'">
                    <Button
                        v-tooltip.bottom="'엑셀 파일로 코드 일괄 등록/수정'"
                        label="일괄 업로드" icon="pi pi-upload"
                        severity="secondary" outlined size="small"
                        @click="uploadInput?.click()" />
                    <Button
                        label="행 추가" icon="pi pi-plus"
                        severity="secondary" outlined size="small"
                        @click="openNewRowDialog" />
                    <Button
                        label="행삭제" icon="pi pi-trash" severity="danger" outlined size="small"
                        :disabled="!selectedRows.length" @click="deleteSelectedRows" />
                </template>
                <button
                    v-tooltip.bottom="'현재 코드 목록을 엑셀로 다운로드'"
                    class="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    @click="downloadExcel">
                    <i class="pi pi-file-excel text-xs" style="color:#16a34a;" />
                    Excel
                </button>
            </template>

            <div class="flex-1 min-h-0 flex flex-col" :class="{ 'mode-edit': viewMode === 'edit' }">
                <StyledDataTable
                    v-model:selection="selectedRows"
                    :value="filteredCodes"
                    :loading="pending"
                    :row-class="rowClass"
                    :data-key="(row: AdminCodeResponse) => `${row.cdId}_${row.sttDt ?? ''}`"
                    scrollable
                    scroll-height="flex"
                    paginator
                    :rows="50"
                    :rows-per-page-options="[50, 100, 200]">

                    <Column
                        v-if="viewMode === 'edit'" selection-mode="multiple"
                        header-style="width: 3rem; text-align: center" body-style="text-align: center" />

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

                    <!-- 코드ID: 편집 모드에서 직접 입력 가능 -->
                    <Column sortable field="cdId" header="코드ID" :style="{ width: '120px' }" frozen
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <template v-if="isRowEditing(data)">
                                <InlineEditCell v-model="data.cdId" type="text" :force-edit="true" :readonly="false" @save="markDirty(data)" />
                            </template>
                            <span v-else class="block truncate" :title="data.cdId">{{ data.cdId }}</span>
                        </template>
                    </Column>

                    <!-- 코드명 -->
                    <Column sortable field="cdNm" header="코드명" :style="{ width: '150px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cdNm" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 코드값 -->
                    <Column sortable field="cdva" header="코드값" :style="{ width: '150px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cdva" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 코드설명 -->
                    <Column sortable field="cdDes" header="코드설명" :style="{ width: '200px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cdDes" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 코드값구분 -->
                    <Column sortable field="cttTp" header="코드값구분" :style="{ width: '130px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cttTp" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 구분설명 -->
                    <Column sortable field="cttTpDes" header="구분설명" :style="{ width: '180px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cttTpDes" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 시작일자 -->
                    <Column sortable field="sttDt" header="시작일자" :style="{ width: '130px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.sttDt" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 종료일자 -->
                    <Column sortable field="endDt" header="종료일자" :style="{ width: '130px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.endDt" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 순서 -->
                    <Column sortable field="cdSqn" header="순서" :style="{ width: '80px' }" body-style="text-align: center">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cdSqn" type="number"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 최초생성자 -->
                    <Column header="최초생성자" :style="{ width: '120px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <span
                                v-if="data.fstEnrUsid"
                                class="block truncate cursor-pointer text-indigo-600 hover:underline"
                                :title="data.fstEnrUsNm || data.fstEnrUsid"
                                @click="showEmployeeDialog(data.fstEnrUsid)">
                                {{ data.fstEnrUsNm || data.fstEnrUsid }}
                            </span>
                        </template>
                    </Column>
                    <Column sortable field="fstEnrDtm" header="최초생성시간" :style="{ width: '160px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <span class="block truncate" :title="formatDateTime(data.fstEnrDtm)">
                                {{ formatDateTime(data.fstEnrDtm) }}
                            </span>
                        </template>
                    </Column>

                    <!-- 마지막수정자 -->
                    <Column header="마지막수정자" :style="{ width: '120px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <span
                                v-if="data.lstChgUsid"
                                class="block truncate cursor-pointer text-indigo-600 hover:underline"
                                :title="data.lstChgUsNm || data.lstChgUsid"
                                @click="showEmployeeDialog(data.lstChgUsid)">
                                {{ data.lstChgUsNm || data.lstChgUsid }}
                            </span>
                        </template>
                    </Column>
                    <Column sortable field="lstChgDtm" header="마지막수정시간" :style="{ width: '160px' }"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                        <template #body="{ data }">
                            <span class="block truncate" :title="formatDateTime(data.lstChgDtm)">
                                {{ formatDateTime(data.lstChgDtm) }}
                            </span>
                        </template>
                    </Column>

                    <!-- 삭제/복구 컬럼: 편집 모드 전용 -->
                    <Column v-if="viewMode === 'edit'" header="" style="width: 48px; text-align: center" frozen align-frozen="right">
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

        <!-- 신규 행 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="공통코드 추가" :style="{ width: 'var(--dialog-md)' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드ID <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.cdId" placeholder="예: CD001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드명</label>
                    <InputText v-model="newRow.cdNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드값</label>
                    <InputText v-model="newRow.cdva" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드설명</label>
                    <InputText v-model="newRow.cdDes" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드값구분</label>
                    <InputText v-model="newRow.cttTp" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드순서</label>
                    <InputNumber v-model="newRow.cdSqn" class="w-full" />
                </div>
            </div>
            <template #footer>
                <AppDialogFooter>
                    <Button label="취소" severity="secondary" outlined @click="newRowVisible = false" />
                    <Button label="추가" @click="saveNewRow" />
                </AppDialogFooter>
            </template>
        </Dialog>

        <!-- 조회 Drawer -->
        <Drawer v-model:visible="visibleDrawer" header="공통코드 조회" position="right" class="!w-full md:!w-[480px]">
            <div class="flex flex-col gap-6">
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드ID</label>
                    <InputText v-model="searchFilters.cdId" placeholder="포함 문자열" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드명</label>
                    <InputText v-model="searchFilters.cdNm" placeholder="포함 문자열" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드값</label>
                    <InputText v-model="searchFilters.cdva" placeholder="포함 문자열" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드설명</label>
                    <InputText v-model="searchFilters.cdDes" placeholder="포함 문자열" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">코드값구분</label>
                    <AutoComplete
                        v-model="searchFilters.cttTp"
                        :suggestions="filteredCttTp"
                        multiple dropdown placeholder="구분 선택 (다중)" fluid
                        @complete="searchCttTp"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">구분설명</label>
                    <AutoComplete
                        v-model="searchFilters.cttTpDes"
                        :suggestions="filteredCttTpDes"
                        multiple dropdown placeholder="구분설명 선택 (다중)" fluid
                        @complete="searchCttTpDes"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">기준일자</label>
                    <p class="text-xs text-zinc-400 dark:text-zinc-500 -mt-1">시작일자 ≤ 기준일자 ≤ 종료일자 범위의 코드를 조회합니다.</p>
                    <DatePicker
                        v-model="searchFilters.baseDate"
                        placeholder="기준일자 선택" show-icon date-format="yy-mm-dd" fluid
                    />
                </div>
                <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button label="초기화" icon="pi pi-refresh" severity="secondary" class="flex-1" @click="resetFilters" />
                    <Button label="조회" icon="pi pi-search" class="flex-1" @click="visibleDrawer = false" />
                </div>
            </div>
        </Drawer>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>

<style>
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
