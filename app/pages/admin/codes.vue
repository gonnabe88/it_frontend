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

// 관리자 미들웨어 + 레이아웃 적용
definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const confirm = useConfirm();
const { fetchCodes, createCode, updateCode, deleteCode } = useAdminApi();

// 공통코드 목록 (반응형)
const { data: codes, pending, refresh } = await fetchCodes();

// 인라인 편집 상태
const editingRows = ref<AdminCodeResponse[]>([]);

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
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '코드 추가 중 오류가 발생했습니다.', life: 5000 });
    }
};
</script>

<template>
    <div>
        <Toast />
        <ConfirmDialog />

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">공통코드 관리</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">TAAABB_CCODEM — 공통코드 조회·추가·수정·삭제</p>
            </div>
            <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
        </div>

        <!-- 공통코드 DataTable -->
        <DataTable
            :value="codes ?? []"
            :loading="pending"
            editMode="row"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            dataKey="cdId"
            scrollable
            scrollHeight="calc(100vh - 300px)"
            class="p-datatable-sm"
            stripedRows>

            <Column field="cdId" header="코드ID" :style="{ width: '120px' }" frozen />
            <Column field="cdNm" header="코드명" :style="{ width: '150px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column field="cdva" header="코드값" :style="{ width: '150px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column field="cdDes" header="코드설명" :style="{ width: '200px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column field="cttTp" header="코드값구분" :style="{ width: '120px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column field="cttTpDes" header="구분설명" :style="{ width: '180px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>
            <Column field="sttDt" header="시작일자" :style="{ width: '130px' }">
                <template #editor="{ data, field }">
                    <DatePicker v-model="data[field]" dateFormat="yy-mm-dd" class="w-full" />
                </template>
            </Column>
            <Column field="endDt" header="종료일자" :style="{ width: '130px' }">
                <template #editor="{ data, field }">
                    <DatePicker v-model="data[field]" dateFormat="yy-mm-dd" class="w-full" />
                </template>
            </Column>
            <Column field="cdSqn" header="순서" :style="{ width: '80px' }">
                <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <!-- 최초생성자 — 이름 클릭 시 직원정보 팝업 -->
            <Column header="최초생성자" :style="{ width: '120px' }">
                <template #body="{ data }">
                    <span v-if="data.fstEnrUsid"
                          class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.fstEnrUsid)">
                        {{ data.fstEnrUsNm || data.fstEnrUsid }}
                    </span>
                </template>
            </Column>
            <Column field="fstEnrDtm" header="최초생성시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.fstEnrDtm) }}
                </template>
            </Column>

            <!-- 마지막수정자 — 이름 클릭 시 직원정보 팝업 -->
            <Column header="마지막수정자" :style="{ width: '120px' }">
                <template #body="{ data }">
                    <span v-if="data.lstChgUsid"
                          class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.lstChgUsid)">
                        {{ data.lstChgUsNm || data.lstChgUsid }}
                    </span>
                </template>
            </Column>
            <Column field="lstChgDtm" header="마지막수정시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.lstChgDtm) }}
                </template>
            </Column>

            <!-- 편집 버튼 -->
            <Column rowEditor :style="{ width: '80px' }" bodyStyle="text-align:center" frozen alignFrozen="right" />

            <!-- 삭제 버튼 -->
            <Column :style="{ width: '60px' }" bodyStyle="text-align:center" frozen alignFrozen="right">
                <template #body="{ data }">
                    <Button icon="pi pi-trash" severity="danger" text rounded
                            @click="onDeleteConfirm(data.cdId)"
                            v-tooltip.top="'삭제'" />
                </template>
            </Column>
        </DataTable>

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

        <!-- 직원정보 팝업 — 기존 EmployeeSearchDialog 재사용 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
