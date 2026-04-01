<!--
================================================================================
[pages/admin/roles.vue] 역할 관리 페이지
================================================================================
시스템관리자가 역할(TAAABB_CROLEI, 사용자↔자격등급 매핑)을 관리하는 화면입니다.

[주요 기능]
  - 전체 역할 목록 조회 (사원번호 → 이름 변환 포함)
  - 인라인 편집: 사용여부 즉시 수정
  - 행 추가: [행 추가] 버튼 → 다이얼로그 → POST API 호출
  - 행 삭제: 휴지통 버튼 → ConfirmDialog → Soft Delete
  - 이름 클릭: 사용자·최초생성자·마지막수정자 이름 클릭 시 직원정보 팝업

[Design Ref: §3.6 — CRUD 화면 공통 패턴]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import type { DataTableRowEditSaveEvent } from 'primevue/datatable';
import { useAdminApi, type AdminRoleResponse, type AdminRoleRequest } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const confirm = useConfirm();
const { fetchRoles, createRole, updateRole, deleteRole } = useAdminApi();

// 역할 목록 (반응형)
const { data: roles, pending, refresh } = await fetchRoles();

// 인라인 편집 상태
const editingRows = ref<AdminRoleResponse[]>([]);

// 신규 행 추가 다이얼로그 상태
const newRowVisible = ref(false);
const blankRow = (): AdminRoleRequest => ({ athId: '', eno: '', useYn: 'Y' });
const newRow = reactive<AdminRoleRequest>(blankRow());

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 인라인 편집 저장 — 사용여부 즉시 PUT API 호출
 */
const onRowEditSave = async (event: DataTableRowEditSaveEvent) => {
    const { newData } = event;
    try {
        await updateRole(newData.athId, newData.eno, {
            athId: newData.athId,
            eno: newData.eno,
            useYn: newData.useYn,
        });
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: `역할 [${newData.athId}/${newData.eno}]가 수정되었습니다.`, life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: '저장 실패', detail: '역할 수정 중 오류가 발생했습니다.', life: 5000 });
    }
};

/**
 * 행 삭제 확인 → Soft Delete
 */
const onDeleteConfirm = (athId: string, eno: string, usrNm: string) => {
    confirm.require({
        message: `[${athId}] ${usrNm} 역할을 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteRole(athId, eno);
                await refresh();
                toast.add({ severity: 'success', summary: '삭제 완료', detail: `역할이 삭제되었습니다.`, life: 3000 });
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '역할 삭제 중 오류가 발생했습니다.', life: 5000 });
            }
        },
    });
};

const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

const saveNewRow = async () => {
    if (!newRow.athId?.trim() || !newRow.eno?.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '자격등급ID와 사원번호는 필수입니다.', life: 3000 });
        return;
    }
    try {
        await createRole({ ...newRow });
        newRowVisible.value = false;
        await refresh();
        toast.add({ severity: 'success', summary: '추가 완료', detail: `역할이 추가되었습니다.`, life: 3000 });
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '역할 추가 중 오류가 발생했습니다.', life: 5000 });
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
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">역할 관리</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">TAAABB_CROLEI — 사용자↔자격등급 매핑 조회·추가·수정·삭제</p>
            </div>
            <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
        </div>

        <!-- 역할 DataTable -->
        <DataTable
            :value="roles ?? []"
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

            <Column header="사용자" :style="{ width: '130px' }">
                <template #body="{ data }">
                    <span class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.eno)">
                        {{ data.usrNm || data.eno }}
                    </span>
                </template>
            </Column>

            <Column field="eno" header="사원번호" :style="{ width: '120px' }" />

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
                            @click="onDeleteConfirm(data.athId, data.eno, data.usrNm)"
                            v-tooltip.top="'삭제'" />
                </template>
            </Column>
        </DataTable>

        <!-- 신규 행 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="역할 추가" :style="{ width: '400px' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">자격등급ID <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.athId" placeholder="예: ITPAD001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">사원번호 <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.eno" placeholder="예: 12345678" class="w-full" />
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
