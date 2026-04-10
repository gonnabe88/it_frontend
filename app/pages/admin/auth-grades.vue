<!--
================================================================================
[pages/admin/auth-grades.vue] 자격등급 관리 페이지
================================================================================
시스템관리자가 자격등급(TAAABB_CAUTHI)을 조회·추가·수정·삭제하는 화면입니다.

[주요 기능]
  - 전체 자격등급 목록 조회
  - 인라인 편집: 행 클릭 후 편집, 체크 버튼 클릭 시 즉시 PUT API 호출
  - 행 추가: [행 추가] 버튼 → 다이얼로그 → POST API 호출
  - 행 삭제: 휴지통 버튼 → ConfirmDialog → Soft Delete
  - 이름 클릭: 최초생성자·마지막수정자 이름 클릭 시 직원정보 팝업

[Design Ref: §3.6 — CRUD 화면 공통 패턴]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import type { DataTableRowEditSaveEvent } from 'primevue/datatable';
import { useAdminApi, type AdminAuthGradeResponse, type AdminAuthGradeRequest } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

// 관리자 미들웨어 + 레이아웃 적용
definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const confirm = useConfirm();
const { fetchAuthGrades, createAuthGrade, updateAuthGrade, deleteAuthGrade } = useAdminApi();

// 자격등급 목록 (반응형)
const { data: authGrades, pending, refresh } = await fetchAuthGrades();

// 인라인 편집 상태
const editingRows = ref<AdminAuthGradeResponse[]>([]);

// 신규 행 추가 다이얼로그 상태
const newRowVisible = ref(false);
const blankRow = (): AdminAuthGradeRequest => ({ athId: '', qlfGrNm: '', qlfGrMat: '', useYn: 'Y' });
const newRow = reactive<AdminAuthGradeRequest>(blankRow());

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

/**
 * 이름 클릭 시 직원정보 팝업 표시
 */
const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 인라인 편집 저장 — 즉시 PUT API 호출
 */
const onRowEditSave = async (event: DataTableRowEditSaveEvent) => {
    const { newData } = event;
    try {
        await updateAuthGrade(newData.athId, {
            athId: newData.athId,
            qlfGrNm: newData.qlfGrNm,
            qlfGrMat: newData.qlfGrMat,
            useYn: newData.useYn,
        });
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: `자격등급 [${newData.athId}]가 수정되었습니다.`, life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: '저장 실패', detail: '자격등급 수정 중 오류가 발생했습니다.', life: 5000 });
    }
};

/**
 * 행 삭제 확인 → Soft Delete
 */
const onDeleteConfirm = (athId: string) => {
    confirm.require({
        message: `자격등급 [${athId}]를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteAuthGrade(athId);
                await refresh();
                toast.add({ severity: 'success', summary: '삭제 완료', detail: `자격등급 [${athId}]가 삭제되었습니다.`, life: 3000 });
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '자격등급 삭제 중 오류가 발생했습니다.', life: 5000 });
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
    if (!newRow.athId?.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '자격등급ID는 필수입니다.', life: 3000 });
        return;
    }
    try {
        await createAuthGrade({ ...newRow });
        newRowVisible.value = false;
        await refresh();
        toast.add({ severity: 'success', summary: '추가 완료', detail: `자격등급 [${newRow.athId}]가 추가되었습니다.`, life: 3000 });
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '자격등급 추가 중 오류가 발생했습니다.', life: 5000 });
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
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">자격등급 관리</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">TAAABB_CAUTHI — 자격등급 조회·추가·수정·삭제</p>
            </div>
            <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
        </div>

        <!-- 자격등급 DataTable -->
        <DataTable
            :value="authGrades ?? []"
            :loading="pending"
            editMode="row"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            dataKey="athId"
            scrollable
            scrollHeight="calc(100vh - 300px)"
            class="p-datatable-sm"
            stripedRows>

            <Column field="athId" header="자격등급ID" :style="{ width: '140px' }" frozen />

            <Column field="qlfGrNm" header="자격등급명" :style="{ width: '180px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="qlfGrMat" header="자격등급사항" :style="{ width: '300px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="useYn" header="사용여부" :style="{ width: '90px' }">
                <template #body="{ data }">
                    <Tag :value="data.useYn === 'Y' ? '사용' : '미사용'"
                         :severity="data.useYn === 'Y' ? 'success' : 'secondary'" />
                </template>
                <template #editor="{ data, field }">
                    <Select v-model="data[field]"
                            :options="[{ label: '사용', value: 'Y' }, { label: '미사용', value: 'N' }]"
                            optionLabel="label" optionValue="value" class="w-full" />
                </template>
            </Column>

            <!-- 최초생성자 -->
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

            <!-- 마지막수정자 -->
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

            <!-- 편집/삭제 버튼 -->
            <Column rowEditor :style="{ width: '80px' }" bodyStyle="text-align:center" frozen alignFrozen="right" />
            <Column :style="{ width: '60px' }" bodyStyle="text-align:center" frozen alignFrozen="right">
                <template #body="{ data }">
                    <Button icon="pi pi-trash" severity="danger" text rounded
                            @click="onDeleteConfirm(data.athId)"
                            v-tooltip.top="'삭제'" />
                </template>
            </Column>
        </DataTable>

        <!-- 신규 행 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="자격등급 추가" :style="{ width: '460px' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">자격등급ID <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.athId" placeholder="예: ITPAD001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">자격등급명</label>
                    <InputText v-model="newRow.qlfGrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">자격등급사항</label>
                    <Textarea v-model="newRow.qlfGrMat" rows="3" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">사용여부</label>
                    <Select v-model="newRow.useYn"
                            :options="[{ label: '사용', value: 'Y' }, { label: '미사용', value: 'N' }]"
                            optionLabel="label" optionValue="value" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="취소" severity="secondary" @click="newRowVisible = false" />
                <Button label="추가" @click="saveNewRow" />
            </template>
        </Dialog>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
