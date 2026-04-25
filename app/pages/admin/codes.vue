<!--
================================================================================
[pages/admin/codes.vue] 공통코드 관리 페이지
================================================================================
시스템관리자가 공통코드(TAAABB_CCODEM)를 조회·추가·수정·삭제하는 화면입니다.

[주요 기능]
  - 전체 코드 목록 조회 (코드순서 오름차순)
  - 인라인 편집: 행 클릭 후 편집, 체크 버튼 클릭 시 즉시 PUT API 호출
  - 행 추가: [행 추가] 버튼 클릭 시 빈 행 삽입 후 POST API 호출
  - 행 삭제: 휴지통 버튼 클릭 → ConfirmDialog → Soft Delete
  - 이름 클릭: 최초생성자·마지막수정자 이름 클릭 시 직원정보 팝업

[Design Ref: §3.6 — CRUD 화면 공통 패턴]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import type { DataTableRowEditSaveEvent } from 'primevue/datatable';
import { useAdminApi, type AdminCodeResponse, type AdminCodeRequest } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import ExcelJS from 'exceljs';
import { exportRowsToExcel } from '~/utils/excel';

// 관리자 미들웨어 + 레이아웃 적용
definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const confirm = useConfirm();
const { fetchCodes, createCode, updateCode, deleteCode, bulkUpsertCodes } = useAdminApi();

// 공통코드 목록 (반응형)
const { data: codes, pending, refresh } = await fetchCodes();

// 인라인 편집 상태
const editingRows = ref<AdminCodeResponse[]>([]);

// ── 조회 Drawer ──────────────────────────────────────────────
const visibleDrawer = ref(false);

/** 검색 필터 조건 (실시간 반영) */
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

// AutoComplete suggestions (타이핑에 따라 필터링)
const filteredCttTp    = ref<string[]>([]);
const filteredCttTpDes = ref<string[]>([]);

const searchCttTp    = (e: { query: string }) => {
    filteredCttTp.value = cttTpOptions.value.filter(v => v.toLowerCase().includes(e.query.toLowerCase()));
};
const searchCttTpDes = (e: { query: string }) => {
    filteredCttTpDes.value = cttTpDesOptions.value.filter(v => v.toLowerCase().includes(e.query.toLowerCase()));
};

/** 적용된 필터 건수 (헤더 배지용) */
const activeFilterCount = computed(() => {
    const f = searchFilters.value;
    return [f.cdId, f.cdNm, f.cdva, f.cdDes].filter(v => v.trim()).length
        + (f.cttTp.length > 0 ? 1 : 0)
        + (f.cttTpDes.length > 0 ? 1 : 0)
        + (f.baseDate ? 1 : 0);
});

/** 필터가 적용된 목록 */
const filteredCodes = computed(() => {
    const list = codes.value ?? [];
    const { cdId, cdNm, cdva, cdDes, cttTp, cttTpDes, baseDate } = searchFilters.value;
    const gk = globalSearch.value.trim().toLowerCase();
    return list.filter(c => {
        // 통합검색: 주요 텍스트 필드 중 하나라도 매칭되면 통과
        if (gk) {
            const haystack = [c.cdId, c.cdNm, c.cdva, c.cdDes, c.cttTp, c.cttTpDes]
                .filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(gk)) return false;
        }
        // Drawer 상세 필터
        if (cdId  && !c.cdId?.toLowerCase().includes(cdId.trim().toLowerCase()))   return false;
        if (cdNm  && !c.cdNm?.toLowerCase().includes(cdNm.trim().toLowerCase()))   return false;
        if (cdva  && !c.cdva?.toLowerCase().includes(cdva.trim().toLowerCase()))   return false;
        if (cdDes && !c.cdDes?.toLowerCase().includes(cdDes.trim().toLowerCase())) return false;
        if (cttTp.length    > 0 && !cttTp.includes(c.cttTp))       return false;
        if (cttTpDes.length > 0 && !cttTpDes.includes(c.cttTpDes)) return false;
        if (baseDate) {
            // 기준일자가 sttDt ~ endDt 범위 안에 있는 코드만 반환
            const base = baseDate.toISOString().split('T')[0]!;
            if (c.sttDt && base < c.sttDt) return false;
            if (c.endDt && base > c.endDt) return false;
        }
        return true;
    });
});

/** 필터 초기화 */
const resetFilters = () => {
    searchFilters.value = {
        cdId: '', cdNm: '', cdva: '', cdDes: '',
        cttTp: [], cttTpDes: [],
        baseDate: null,
    };
};

/** 통합검색 키워드 */
const globalSearch = ref('');

// 신규 행 추가 다이얼로그 상태
const newRowVisible = ref(false);
const blankRow = (): AdminCodeRequest => ({
    cdId: '', cdNm: '', cdva: '', cdDes: '', cttTp: '', cttTpDes: '',
    sttDt: undefined, endDt: undefined, cdSqn: undefined,
});
const newRow = reactive<AdminCodeRequest>(blankRow());

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

/**
 * 이름 클릭 시 직원정보 팝업 표시
 * @param eno 사원번호
 */
const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 인라인 편집 저장 — 행 단위 즉시 PUT API 호출
 * @param event DataTable row-edit-save 이벤트
 */
const onRowEditSave = async (event: DataTableRowEditSaveEvent) => {
    const { newData } = event;
    try {
        await updateCode(newData.cdId, {
            cdId: newData.cdId,
            cdNm: newData.cdNm,
            cdva: newData.cdva,
            cdDes: newData.cdDes,
            cttTp: newData.cttTp,
            cttTpDes: newData.cttTpDes,
            sttDt: newData.sttDt,
            endDt: newData.endDt,
            cdSqn: newData.cdSqn,
        });
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: `코드 [${newData.cdId}]가 수정되었습니다.`, life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: '저장 실패', detail: '코드 수정 중 오류가 발생했습니다.', life: 5000 });
    }
};

/**
 * 행 삭제 확인 → Soft Delete
 * @param cdId 코드ID
 */
const onDeleteConfirm = (cdId: string) => {
    confirm.require({
        message: `코드 [${cdId}]를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteCode(cdId);
                await refresh();
                toast.add({ severity: 'success', summary: '삭제 완료', detail: `코드 [${cdId}]가 삭제되었습니다.`, life: 3000 });
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '코드 삭제 중 오류가 발생했습니다.', life: 5000 });
            }
        },
    });
};

/**
 * 신규 행 추가 다이얼로그 초기화 후 표시
 */
const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

// 업로드용 hidden file input 참조
const uploadInput = ref<HTMLInputElement | null>(null);

/**
 * 현재 코드 목록을 엑셀 파일로 다운로드
 * 조회·수정에 사용하는 9개 필드만 포함합니다.
 */
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

/**
 * 엑셀 파일을 파싱하여 일괄 Upsert API 호출
 * 헤더(코드ID 필수)와 데이터 행을 매핑합니다.
 */
const onUploadFile = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // input 초기화 (같은 파일 재선택 허용)
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

    // 헤더 → 필드 매핑
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
    })).filter(r => r.cdId);  // 코드ID 없는 행 제외

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

/**
 * 신규 행 저장 — POST API 호출
 */
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
</script>

<template>
    <div>
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">공통코드 관리</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">TAAABB_CCODEM — 공통코드 조회·추가·수정·삭제</p>
            </div>
            <div class="flex items-center gap-2">
                <!-- hidden file input (업로드) -->
                <input
                    ref="uploadInput"
                    type="file"
                    accept=".xlsx,.xls"
                    class="hidden"
                    @change="onUploadFile"
                >
                <!-- 조회 버튼 (활성 필터 건수 배지) -->
                <div class="relative inline-flex">
                    <Button
                        label="조회"
                        icon="pi pi-search"
                        severity="secondary"
                        outlined
                        @click="visibleDrawer = true"
                    />
                    <Badge
                        v-if="activeFilterCount > 0"
                        :value="activeFilterCount"
                        severity="danger"
                        class="absolute -top-2 -right-2"
                    />
                </div>
                <Button
                    v-tooltip.bottom="'현재 코드 목록을 엑셀로 다운로드'"
                    label="일괄 다운로드"
                    icon="pi pi-download"
                    severity="secondary"
                    outlined
                    @click="downloadExcel"
                />
                <Button
                    v-tooltip.bottom="'엑셀 파일로 코드 일괄 등록/수정'"
                    label="일괄 업로드"
                    icon="pi pi-upload"
                    severity="secondary"
                    outlined
                    @click="uploadInput?.click()"
                />
                <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
            </div>
        </div>

        <!-- 통합검색 -->
        <div class="mb-4">
            <TableSearchInput
                v-model="globalSearch"
                placeholder="통합검색 (코드ID, 코드명, 코드값, 코드설명, 구분...)"
                width="100%"
            />
        </div>

        <!-- 필터 적용 중 표시 -->
        <div v-if="activeFilterCount > 0" class="flex items-center gap-2 mb-3 flex-wrap">
            <span class="text-sm text-zinc-500 dark:text-zinc-400">적용된 필터:</span>
            <Chip v-if="searchFilters.cdId"         :label="`코드ID: ${searchFilters.cdId}`"         removable @remove="searchFilters.cdId = ''" />
            <Chip v-if="searchFilters.cdNm"         :label="`코드명: ${searchFilters.cdNm}`"         removable @remove="searchFilters.cdNm = ''" />
            <Chip v-if="searchFilters.cdva"         :label="`코드값: ${searchFilters.cdva}`"         removable @remove="searchFilters.cdva = ''" />
            <Chip v-if="searchFilters.cdDes"        :label="`코드설명: ${searchFilters.cdDes}`"      removable @remove="searchFilters.cdDes = ''" />
            <Chip v-if="searchFilters.cttTp.length > 0"    :label="`코드값구분: ${searchFilters.cttTp.join(', ')}`"  removable @remove="searchFilters.cttTp = []" />
            <Chip v-if="searchFilters.cttTpDes.length > 0" :label="`구분설명: ${searchFilters.cttTpDes.join(', ')}`" removable @remove="searchFilters.cttTpDes = []" />
            <Chip v-if="searchFilters.baseDate"     :label="`기준일자: ${searchFilters.baseDate!.toISOString().split('T')[0]}`" removable @remove="searchFilters.baseDate = null" />
            <span class="text-sm text-zinc-400">— {{ filteredCodes.length }}건</span>
        </div>

        <!-- 공통코드 DataTable -->
        <StyledDataTable
            v-model:editing-rows="editingRows"
            :value="filteredCodes"
            :loading="pending"
            edit-mode="row"
            data-key="cdId"
            scrollable
            scroll-height="calc(100vh - 300px)"
            paginator
            :rows="50"
            :rows-per-page-options="[50, 100, 200]"
            class="p-datatable-sm"
            striped-rows
            @row-edit-save="onRowEditSave">

            <Column
field="cdId" header="코드ID" :style="{ width: '120px' }" frozen
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.cdId">{{ data.cdId }}</span>
                </template>
            </Column>
            <Column
field="cdNm" header="코드명" :style="{ width: '150px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.cdNm">{{ data.cdNm }}</span>
                </template>
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column
field="cdva" header="코드값" :style="{ width: '150px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.cdva">{{ data.cdva }}</span>
                </template>
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column
field="cdDes" header="코드설명" :style="{ width: '200px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.cdDes">{{ data.cdDes }}</span>
                </template>
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column
field="cttTp" header="코드값구분" :style="{ width: '120px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.cttTp">{{ data.cttTp }}</span>
                </template>
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column
field="cttTpDes" header="구분설명" :style="{ width: '180px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.cttTpDes">{{ data.cttTpDes }}</span>
                </template>
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column
field="sttDt" header="시작일자" :style="{ width: '130px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.sttDt">{{ data.sttDt }}</span>
                </template>
                <template #editor="{ data, field }">
                    <DatePicker v-model="data[field]" date-format="yy-mm-dd" class="w-full" />
                </template>
            </Column>
            <Column
field="endDt" header="종료일자" :style="{ width: '130px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="data.endDt">{{ data.endDt }}</span>
                </template>
                <template #editor="{ data, field }">
                    <DatePicker v-model="data[field]" date-format="yy-mm-dd" class="w-full" />
                </template>
            </Column>
            <Column field="cdSqn" header="순서" :style="{ width: '80px' }">
                <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <!-- 최초생성자 — 이름 클릭 시 직원정보 팝업 -->
            <Column
header="최초생성자" :style="{ width: '120px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span
v-if="data.fstEnrUsid"
                          class="block truncate cursor-pointer text-blue-500 hover:underline"
                          :title="data.fstEnrUsNm || data.fstEnrUsid"
                          @click="showEmployeeDialog(data.fstEnrUsid)">
                        {{ data.fstEnrUsNm || data.fstEnrUsid }}
                    </span>
                </template>
            </Column>
            <Column
field="fstEnrDtm" header="최초생성시간" :style="{ width: '160px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="formatDateTime(data.fstEnrDtm)">
                        {{ formatDateTime(data.fstEnrDtm) }}
                    </span>
                </template>
            </Column>

            <!-- 마지막수정자 — 이름 클릭 시 직원정보 팝업 -->
            <Column
header="마지막수정자" :style="{ width: '120px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span
v-if="data.lstChgUsid"
                          class="block truncate cursor-pointer text-blue-500 hover:underline"
                          :title="data.lstChgUsNm || data.lstChgUsid"
                          @click="showEmployeeDialog(data.lstChgUsid)">
                        {{ data.lstChgUsNm || data.lstChgUsid }}
                    </span>
                </template>
            </Column>
            <Column
field="lstChgDtm" header="마지막수정시간" :style="{ width: '160px' }"
                    :pt="{ bodyCell: { class: 'overflow-hidden' } }">
                <template #body="{ data }">
                    <span class="block truncate" :title="formatDateTime(data.lstChgDtm)">
                        {{ formatDateTime(data.lstChgDtm) }}
                    </span>
                </template>
            </Column>

            <!-- 편집 버튼 -->
            <Column row-editor :style="{ width: '80px' }" body-style="text-align:center" frozen align-frozen="right" />

            <!-- 삭제 버튼 -->
            <Column :style="{ width: '60px' }" body-style="text-align:center" frozen align-frozen="right">
                <template #body="{ data }">
                    <Button
v-tooltip.top="'삭제'" icon="pi pi-trash" severity="danger" text
                            rounded
                            @click="onDeleteConfirm(data.cdId)" />
                </template>
            </Column>
        </StyledDataTable>

        <!-- 신규 행 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="공통코드 추가" :style="{ width: '500px' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">코드ID <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.cdId" placeholder="예: CD001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">코드명</label>
                    <InputText v-model="newRow.cdNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">코드값</label>
                    <InputText v-model="newRow.cdva" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">코드설명</label>
                    <InputText v-model="newRow.cdDes" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">코드값구분</label>
                    <InputText v-model="newRow.cttTp" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">코드순서</label>
                    <InputNumber v-model="newRow.cdSqn" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="취소" severity="secondary" @click="newRowVisible = false" />
                <Button label="추가" @click="saveNewRow" />
            </template>
        </Dialog>

        <!-- 조회 Drawer (오른쪽 슬라이드) -->
        <Drawer v-model:visible="visibleDrawer" header="공통코드 조회" position="right" class="!w-full md:!w-[480px]">
            <div class="flex flex-col gap-6">

                <!-- 코드ID -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">코드ID</label>
                    <InputText v-model="searchFilters.cdId" placeholder="포함 문자열" fluid />
                </div>

                <!-- 코드명 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">코드명</label>
                    <InputText v-model="searchFilters.cdNm" placeholder="포함 문자열" fluid />
                </div>

                <!-- 코드값 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">코드값</label>
                    <InputText v-model="searchFilters.cdva" placeholder="포함 문자열" fluid />
                </div>

                <!-- 코드설명 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">코드설명</label>
                    <InputText v-model="searchFilters.cdDes" placeholder="포함 문자열" fluid />
                </div>

                <!-- 코드값구분 — AutoComplete 다중 선택 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">코드값구분</label>
                    <AutoComplete
                        v-model="searchFilters.cttTp"
                        :suggestions="filteredCttTp"
                        multiple
                        dropdown
                        placeholder="구분 선택 (다중)"
                        fluid
                        @complete="searchCttTp"
                    />
                </div>

                <!-- 구분설명 — AutoComplete 다중 선택 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">구분설명</label>
                    <AutoComplete
                        v-model="searchFilters.cttTpDes"
                        :suggestions="filteredCttTpDes"
                        multiple
                        dropdown
                        placeholder="구분설명 선택 (다중)"
                        fluid
                        @complete="searchCttTpDes"
                    />
                </div>

                <!-- 기준일자 — sttDt ≤ 기준일 ≤ endDt -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">기준일자</label>
                    <p class="text-xs text-zinc-400 dark:text-zinc-500 -mt-1">시작일자 ≤ 기준일자 ≤ 종료일자 범위의 코드를 조회합니다.</p>
                    <DatePicker
                        v-model="searchFilters.baseDate"
                        placeholder="기준일자 선택"
                        show-icon
                        date-format="yy-mm-dd"
                        fluid
                    />
                </div>

                <!-- 액션 버튼 -->
                <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button label="초기화" icon="pi pi-refresh" severity="secondary" class="flex-1" @click="resetFilters" />
                    <Button label="조회" icon="pi pi-search" class="flex-1" @click="visibleDrawer = false" />
                </div>
            </div>
        </Drawer>

        <!-- 직원정보 팝업 — 기존 EmployeeSearchDialog 재사용 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
