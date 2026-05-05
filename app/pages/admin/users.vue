<!--
================================================================================
[pages/admin/users.vue] 사용자 관리 페이지
================================================================================
시스템관리자가 사용자(TAAABB_CUSERI)를 조회·추가·수정·삭제하는 화면입니다.

[주요 기능]
  - 전체 사용자 목록 조회 (조직 join — 소속팀·부서 포함)
  - 조회/편집 모드 전환: [수정] → 편집 모드, [취소]/[저장] → 조회 모드 복귀
  - 편집 모드: InlineEditCell 로 셀 직접 수정, 변경 상태 컬럼 표시
  - 행 추가: [행 추가] 버튼 → 다이얼로그 → POST API (초기 비밀번호 설정, 조회 모드 전용)
  - 행 삭제: 편집 모드에서 휴지통 → 취소선, [저장] 시 일괄 DELETE
  - ENO 클릭: 직원정보 팝업

[연동 API]
  - GET    /api/admin/users/:eno  (fetchUsers)
  - POST   /api/admin/users       (createUser)
  - PUT    /api/admin/users/:eno  (updateUser)
  - DELETE /api/admin/users/:eno  (deleteUser)
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { useAdminApi, type AdminUserResponse, type AdminUserRequest } from '~/composables/useAdminApi';
import { useAdminTableEdit } from '~/composables/useAdminTableEdit';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import InlineEditCell from '~/components/common/InlineEditCell.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import PageHeader from '~/components/PageHeader.vue';
import TableCard from '~/components/TableCard.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import { exportRowsToExcel } from '~/utils/excel';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const { fetchUsers, createUser, updateUser, deleteUser } = useAdminApi();

// 사용자 목록 (반응형)
const { data: users, pending, refresh } = await fetchUsers();

// ============================================================================
// 조회/편집 모드 관리
// ============================================================================

const {
    viewMode, editRows, selectedRows, saving,
    enterEditMode, cancelEdit, saveAndExitEdit,
    rowStatus, rowClass, isRowEditing, markDirty,
    deleteRow, deleteSelectedRows,
} = useAdminTableEdit<AdminUserResponse>({
    sourceData: users,
    toast,
    onBatchSave: async ({ modifiedRows, deletedRows }) => {
        // 사용자 수정: usrNm, ptCNm, inleNo, cpnTpn, etrMilAddrNm, temNm, temC, bbrC 변경 가능
        await Promise.all([
            ...modifiedRows.map(r => updateUser(r.eno, {
                eno: r.eno,
                usrNm: r.usrNm,
                ptCNm: r.ptCNm,
                temC: r.temC,
                temNm: r.temNm,
                bbrC: r.bbrC,
                etrMilAddrNm: r.etrMilAddrNm,
                inleNo: r.inleNo,
                cpnTpn: r.cpnTpn,
            })),
            ...deletedRows.map(r => deleteUser(r.eno)),
        ]);
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: '변경사항이 저장되었습니다.', life: 3000 });
    },
});

// ============================================================================
// 검색 및 엑셀
// ============================================================================

const search = ref('');

const filteredUsers = computed(() => {
    const source = viewMode.value === 'edit' ? editRows.value : (users.value ?? []);
    const q = search.value.trim().toLowerCase();
    if (!q) return source;
    return source.filter(u =>
        [u.eno, u.usrNm, u.ptCNm, u.bbrNm, u.temNm, u.etrMilAddrNm, u.inleNo]
            .some(v => v?.toLowerCase().includes(q))
    );
});

const downloadExcel = async () => {
    const rows = filteredUsers.value.map(u => ({
        '사원번호': u.eno,
        '사용자명': u.usrNm,
        '직위': u.ptCNm,
        '부서': u.bbrNm,
        '팀': u.temNm,
        '내선번호': u.inleNo,
        '휴대폰': u.cpnTpn,
        '이메일': u.etrMilAddrNm,
    }));
    await exportRowsToExcel(rows, '사용자', `사용자_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================================================
// 신규 사용자 추가 다이얼로그 (비밀번호 필요 → 다이얼로그 방식, 조회 모드 전용)
// ============================================================================

const newRowVisible = ref(false);
const blankRow = (): AdminUserRequest => ({
    eno: '', usrNm: '', ptCNm: '', temC: '', bbrC: '',
    etrMilAddrNm: '', inleNo: '', cpnTpn: '', password: '',
});
const newRow = reactive<AdminUserRequest>(blankRow());

const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

/**
 * 신규 사용자 저장 — POST API 호출 (초기 비밀번호 포함)
 */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '사용자 추가 중 오류가 발생했습니다.', life: 5000 });
    }
};

// ============================================================================
// 직원정보 팝업
// ============================================================================

const employeeDialogVisible = ref(false);

const showEmployeeDialog = (eno: string) => {
    void eno;
    employeeDialogVisible.value = true;
};
</script>

<template>
    <div class="flex flex-col h-full gap-6">
        <!-- 페이지 헤더 -->
        <PageHeader title="사용자 관리" subtitle="TAAABB_CUSERI — 사용자 조회·추가·수정·삭제">
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

        <!-- 사용자 DataTable -->
        <TableCard fill icon="pi-users" title="사용자 목록" :count="filteredUsers.length">
            <template #toolbar>
                <TableSearchInput v-model="search" placeholder="사원번호, 이름, 부서, 이메일 검색..." width="30rem" />
                <div class="flex-1" />
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

            <div class="flex-1 min-h-0 flex flex-col" :class="{ 'mode-edit': viewMode === 'edit' }">
                <StyledDataTable
                    v-model:selection="selectedRows"
                    :value="filteredUsers"
                    :loading="pending"
                    :row-class="rowClass"
                    data-key="eno"
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

                    <!-- ENO: 조회=클릭시 직원정보 팝업, 편집=직접 입력 -->
                    <Column sortable field="eno" header="사원번호" :style="{ width: '120px' }" frozen>
                        <template #body="{ data }">
                            <template v-if="isRowEditing(data)">
                                <InlineEditCell v-model="data.eno" type="text" :force-edit="true" :readonly="false" @save="markDirty(data)" />
                            </template>
                            <span
                                v-else
                                class="cursor-pointer text-indigo-600 hover:underline"
                                @click="showEmployeeDialog(data.eno)">
                                {{ data.eno }}
                            </span>
                        </template>
                    </Column>

                    <!-- 사용자명 -->
                    <Column sortable field="usrNm" header="사용자명" :style="{ width: '120px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.usrNm" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 직위 -->
                    <Column sortable field="ptCNm" header="직위" :style="{ width: '100px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.ptCNm" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 부서: 조회=부서명, 편집=부서코드(bbrC) 입력 -->
                    <Column sortable field="bbrNm" header="부서" :style="{ width: '150px' }">
                        <template #body="{ data }">
                            <template v-if="isRowEditing(data)">
                                <InlineEditCell v-model="data.bbrC" type="text" :force-edit="true" :readonly="false" @save="markDirty(data)" />
                            </template>
                            <span v-else>{{ data.bbrNm }}</span>
                        </template>
                    </Column>

                    <!-- 팀명: 조회=temNm 표시, 편집=temNm 직접 입력 -->
                    <Column sortable field="temNm" header="팀" :style="{ width: '130px' }">
                        <template #body="{ data }">
                            <InlineEditCell v-model="data.temNm" type="text" :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)" @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 팀코드: 편집 모드에서 temC 직접 입력 -->
                    <Column sortable field="temC" header="팀코드" :style="{ width: '100px' }">
                        <template #body="{ data }">
                            <InlineEditCell v-model="data.temC" type="text" :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)" @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 내선번호 -->
                    <Column sortable field="inleNo" header="내선번호" :style="{ width: '110px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.inleNo" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 휴대폰 -->
                    <Column sortable field="cpnTpn" header="휴대폰" :style="{ width: '130px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.cpnTpn" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 이메일 -->
                    <Column sortable field="etrMilAddrNm" header="이메일" :style="{ width: '200px' }">
                        <template #body="{ data }">
                            <InlineEditCell
                                v-model="data.etrMilAddrNm" type="text"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 생성/수정 시간 (읽기 전용) -->
                    <Column sortable field="fstEnrDtm" header="생성시간" :style="{ width: '160px' }">
                        <template #body="{ data }">{{ formatDateTime(data.fstEnrDtm) }}</template>
                    </Column>
                    <Column sortable field="lstChgDtm" header="수정시간" :style="{ width: '160px' }">
                        <template #body="{ data }">{{ formatDateTime(data.lstChgDtm) }}</template>
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

        <!-- 신규 사용자 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="사용자 추가" :style="{ width: 'var(--dialog-md)' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사원번호 <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.eno" placeholder="예: 12345678" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사용자명</label>
                    <InputText v-model="newRow.usrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">직위</label>
                    <InputText v-model="newRow.ptCNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">부서코드</label>
                    <InputText v-model="newRow.bbrC" placeholder="예: 001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">이메일</label>
                    <InputText v-model="newRow.etrMilAddrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">초기 비밀번호</label>
                    <InputText v-model="newRow.password" type="password" placeholder="미입력 시 기본값 적용" class="w-full" />
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
