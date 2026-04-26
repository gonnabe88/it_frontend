<!--
================================================================================
[pages/admin/organizations.vue] 조직 관리 페이지
================================================================================
시스템관리자가 조직(TAAABB_CORGNI)을 조회·추가·수정·삭제하는 화면입니다.

[주요 기능]
  - 전체 조직 목록 조회
  - 인라인 편집: 부점명·부점영문명·순서·상위조직코드 즉시 수정
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
import { useAdminApi, type AdminOrgResponse, type AdminOrgRequest } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const confirm = useConfirm();
const { fetchOrganizations, createOrganization, updateOrganization, deleteOrganization } = useAdminApi();

// 조직 목록 (반응형)
const { data: organizations, pending, refresh } = await fetchOrganizations();

// 인라인 편집 상태
const editingRows = ref<AdminOrgResponse[]>([]);

// 신규 행 추가 다이얼로그 상태
const newRowVisible = ref(false);
const blankRow = (): AdminOrgRequest => ({
    prlmOgzCCone: '', bbrNm: '', bbrWrenNm: '', itmSqnSno: '', prlmHrkOgzCCone: '',
});
const newRow = reactive<AdminOrgRequest>(blankRow());

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

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
        await updateOrganization(newData.prlmOgzCCone, {
            prlmOgzCCone: newData.prlmOgzCCone,
            bbrNm: newData.bbrNm,
            bbrWrenNm: newData.bbrWrenNm,
            itmSqnSno: newData.itmSqnSno,
            prlmHrkOgzCCone: newData.prlmHrkOgzCCone,
        });
        await refresh();
        toast.add({ severity: 'success', summary: '저장 완료', detail: `조직 [${newData.bbrNm}] 정보가 수정되었습니다.`, life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: '저장 실패', detail: '조직 수정 중 오류가 발생했습니다.', life: 5000 });
    }
};

/**
 * 행 삭제 확인 → Soft Delete
 */
const onDeleteConfirm = (orgC: string, bbrNm: string) => {
    confirm.require({
        message: `조직 [${bbrNm}(${orgC})]를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteOrganization(orgC);
                await refresh();
                toast.add({ severity: 'success', summary: '삭제 완료', detail: `조직 [${bbrNm}]가 삭제되었습니다.`, life: 3000 });
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '조직 삭제 중 오류가 발생했습니다.', life: 5000 });
            }
        },
    });
};

const openNewRowDialog = () => {
    Object.assign(newRow, blankRow());
    newRowVisible.value = true;
};

const saveNewRow = async () => {
    if (!newRow.prlmOgzCCone?.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '조직코드는 필수입니다.', life: 3000 });
        return;
    }
    try {
        await createOrganization({ ...newRow });
        newRowVisible.value = false;
        await refresh();
        toast.add({ severity: 'success', summary: '추가 완료', detail: `조직 [${newRow.bbrNm}]가 추가되었습니다.`, life: 3000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '조직 추가 중 오류가 발생했습니다.', life: 5000 });
    }
};
</script>

<template>
    <div class="flex flex-col h-full gap-6">
        <!-- 페이지 헤더 -->
        <PageHeader title="조직 관리" subtitle="TAAABB_CORGNI — 조직(부점) 조회·추가·수정·삭제">
            <template #actions>
                <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
            </template>
        </PageHeader>

        <!-- 조직 DataTable -->
        <TableCard fill>
        <div class="flex-1 min-h-0 flex flex-col">
        <StyledDataTable
            v-model:editing-rows="editingRows"
            :value="organizations ?? []"
            :loading="pending"
            edit-mode="row"
            data-key="prlmOgzCCone"
            scrollable
            scroll-height="flex"
            class="p-datatable-sm"
            striped-rows
            @row-edit-save="onRowEditSave">

            <Column field="prlmOgzCCone" header="조직코드" :style="{ width: '140px' }" frozen />

            <Column field="bbrNm" header="부점명" :style="{ width: '160px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="bbrWrenNm" header="부점영문명" :style="{ width: '180px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="itmSqnSno" header="순서" :style="{ width: '80px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
                </template>
            </Column>

            <Column field="prlmHrkOgzCCone" header="상위조직코드" :style="{ width: '140px' }">
                <template #editor="{ data, field }">
                    <InputText v-model="data[field]" class="w-full" />
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
            <Column field="fstEnrDtm" header="최초생성시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.fstEnrDtm) }}
                </template>
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
            <Column field="lstChgDtm" header="마지막수정시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.lstChgDtm) }}
                </template>
            </Column>

            <!-- 편집/삭제 버튼 -->
            <Column row-editor :style="{ width: '80px' }" body-style="text-align:center" frozen align-frozen="right" />
            <Column :style="{ width: '60px' }" body-style="text-align:center" frozen align-frozen="right">
                <template #body="{ data }">
                    <Button
v-tooltip.top="'삭제'" icon="pi pi-trash" severity="danger" text
                            rounded
                            @click="onDeleteConfirm(data.prlmOgzCCone, data.bbrNm)" />
                </template>
            </Column>
        </StyledDataTable>
        </div>
        </TableCard>

        <!-- 신규 행 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="조직 추가" :style="{ width: 'var(--dialog-md)' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">조직코드 <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.prlmOgzCCone" placeholder="예: 001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">부점명</label>
                    <InputText v-model="newRow.bbrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">부점영문명</label>
                    <InputText v-model="newRow.bbrWrenNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">순서</label>
                    <InputText v-model="newRow.itmSqnSno" placeholder="예: 001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">상위조직코드</label>
                    <InputText v-model="newRow.prlmHrkOgzCCone" placeholder="예: 000 (최상위이면 공란)" class="w-full" />
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
