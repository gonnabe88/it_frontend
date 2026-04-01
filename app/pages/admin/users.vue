<!--
================================================================================
[pages/admin/users.vue] 사용자 관리 페이지
================================================================================
시스템관리자가 사용자(TAAABB_CUSERI)를 조회·추가·수정·삭제하는 화면입니다.

[주요 기능]
  - 전체 사용자 목록 조회 (조직 join — 소속팀·부서 포함)
  - 인라인 편집: 기본정보 즉시 수정 (비밀번호 변경 미포함)
  - 행 추가: [행 추가] 버튼 → 다이얼로그 → POST API 호출 (초기 비밀번호 설정)
  - 행 삭제: 휴지통 버튼 → ConfirmDialog → Soft Delete
  - ENO 클릭: 직원정보 팝업

[Design Ref: §3.6 — CRUD 화면 공통 패턴]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import type { DataTableRowEditSaveEvent } from 'primevue/datatable';
import { useAdminApi, type AdminUserResponse, type AdminUserRequest } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const confirm = useConfirm();
const { fetchUsers, createUser, updateUser, deleteUser } = useAdminApi();

// 사용자 목록 (반응형)
const { data: users, pending, refresh } = await fetchUsers();

// 인라인 편집 상태
const editingRows = ref<AdminUserResponse[]>([]);

// 신규 사용자 추가 다이얼로그 상태
const newRowVisible = ref(false);
const blankRow = (): AdminUserRequest => ({
    eno: '', usrNm: '', ptCNm: '', temC: '', bbrC: '',
    etrMilAddrNm: '', inleNo: '', cpnTpn: '', password: '',
});
const newRow = reactive<AdminUserRequest>(blankRow());

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 인라인 편집 저장 — 즉시 PUT API 호출 (비밀번호 제외)
 */
const onRowEditSave = async (event: DataTableRowEditSaveEvent) => {
    const { newData } = event;
    try {
        await updateUser(newData.eno, {
            eno: newData.eno,
            usrNm: newData.usrNm,
            ptCNm: newData.ptCNm,
            temC: newData.temC,
            bbrC: newData.bbrC,
            etrMilAddrNm: newData.etrMilAddrNm,
            inleNo: newData.inleNo,
            cpnTpn: newData.cpnTpn,
        });
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: `사용자 [${newData.usrNm}] 정보가 수정되었습니다.`, life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: '저장 실패', detail: '사용자 수정 중 오류가 발생했습니다.', life: 5000 });
    }
};

/**
 * 행 삭제 확인 → Soft Delete
 */
const onDeleteConfirm = (eno: string, usrNm: string) => {
    confirm.require({
        message: `사용자 [${usrNm}(${eno})]를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteUser(eno);
                await refresh();
                toast.add({ severity: 'success', summary: '삭제 완료', detail: `사용자 [${usrNm}]가 삭제되었습니다.`, life: 3000 });
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '사용자 삭제 중 오류가 발생했습니다.', life: 5000 });
            }
        },
    });
};

const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

const saveNewRow = async () => {
    if (!newRow.eno?.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '사원번호는 필수입니다.', life: 3000 });
        return;
    }
    try {
        await createUser({ ...newRow });
        newRowVisible.value = false;
        await refresh();
        toast.add({ severity: 'success', summary: '추가 완료', detail: `사용자 [${newRow.usrNm}]가 추가되었습니다.`, life: 3000 });
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '사용자 추가 중 오류가 발생했습니다.', life: 5000 });
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
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">사용자 관리</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">TAAABB_CUSERI — 사용자 조회·추가·수정·삭제</p>
            </div>
            <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
        </div>

        <!-- 사용자 DataTable -->
        <DataTable
            :value="users ?? []"
            :loading="pending"
            editMode="row"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            dataKey="eno"
            scrollable
            scrollHeight="calc(100vh - 300px)"
            class="p-datatable-sm"
            stripedRows>

            <!-- ENO 클릭 → 직원정보 팝업 -->
            <Column field="eno" header="사원번호" :style="{ width: '120px' }" frozen>
                <template #body="{ data }">
                    <span class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.eno)">
                        {{ data.eno }}
                    </span>
                </template>
            </Column>

            <Column field="usrNm" header="사용자명" :style="{ width: '120px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="ptCNm" header="직위" :style="{ width: '100px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="bbrNm" header="부서" :style="{ width: '150px' }" />

            <Column field="temNm" header="팀" :style="{ width: '130px' }" />

            <Column field="inleNo" header="내선번호" :style="{ width: '110px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="cpnTpn" header="휴대폰" :style="{ width: '130px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="etrMilAddrNm" header="이메일" :style="{ width: '200px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="fstEnrDtm" header="생성시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.fstEnrDtm) }}
                </template>
            </Column>

            <Column field="lstChgDtm" header="수정시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.lstChgDtm) }}
                </template>
            </Column>

            <!-- 편집/삭제 버튼 -->
            <Column rowEditor :style="{ width: '80px' }" bodyStyle="text-align:center" frozen alignFrozen="right" />
            <Column :style="{ width: '60px' }" bodyStyle="text-align:center" frozen alignFrozen="right">
                <template #body="{ data }">
                    <Button icon="pi pi-trash" severity="danger" text rounded
                            @click="onDeleteConfirm(data.eno, data.usrNm)"
                            v-tooltip.top="'삭제'" />
                </template>
            </Column>
        </DataTable>

        <!-- 신규 사용자 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="사용자 추가" :style="{ width: '500px' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">사원번호 <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.eno" placeholder="예: 12345678" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">사용자명</label>
                    <InputText v-model="newRow.usrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">직위</label>
                    <InputText v-model="newRow.ptCNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">부서코드</label>
                    <InputText v-model="newRow.bbrC" placeholder="예: 001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">이메일</label>
                    <InputText v-model="newRow.etrMilAddrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">초기 비밀번호</label>
                    <InputText v-model="newRow.password" type="password" placeholder="미입력 시 기본값 적용" class="w-full" />
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
