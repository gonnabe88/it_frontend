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
import { ref, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import type { DataTableRowEditSaveEvent } from 'primevue/datatable';
import { useAdminApi, type AdminOrgResponse, type AdminOrgRequest } from '~/composables/useAdminApi';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

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
const newRow = reactive<AdminOrgRequest>({
    prlmOgzCCone: '',
    bbrNm: '',
    bbrWrenNm: '',
    itmSqnSno: '',
    prlmHrkOgzCCone: '',
});

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
    Object.assign(newRow, { prlmOgzCCone: '', bbrNm: '', bbrWrenNm: '', itmSqnSno: '', prlmHrkOgzCCone: '' });
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
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '추가 실패', detail: e?.data?.message ?? '조직 추가 중 오류가 발생했습니다.', life: 5000 });
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
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">조직 관리</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">TAAABB_CORGNI — 조직(부점) 조회·추가·수정·삭제</p>
            </div>
            <Button label="행 추가" icon="pi pi-plus" @click="openNewRowDialog" />
        </div>

        <!-- 조직 DataTable -->
        <DataTable
            :value="organizations ?? []"
            :loading="pending"
            editMode="row"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            dataKey="prlmOgzCCone"
            scrollable
            scrollHeight="calc(100vh - 300px)"
            class="p-datatable-sm"
            stripedRows>

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
                    <span v-if="data.fstEnrUsid"
                          class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.fstEnrUsid)">
                        {{ data.fstEnrUsNm || data.fstEnrUsid }}
                    </span>
                </template>
            </Column>
            <Column field="fstEnrDtm" header="최초생성시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ data.fstEnrDtm ? new Date(data.fstEnrDtm).toLocaleString('ko-KR') : '' }}
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
                    {{ data.lstChgDtm ? new Date(data.lstChgDtm).toLocaleString('ko-KR') : '' }}
                </template>
            </Column>

            <!-- 편집/삭제 버튼 -->
            <Column rowEditor :style="{ width: '80px' }" bodyStyle="text-align:center" frozen alignFrozen="right" />
            <Column :style="{ width: '60px' }" bodyStyle="text-align:center" frozen alignFrozen="right">
                <template #body="{ data }">
                    <Button icon="pi pi-trash" severity="danger" text rounded
                            @click="onDeleteConfirm(data.prlmOgzCCone, data.bbrNm)"
                            v-tooltip.top="'삭제'" />
                </template>
            </Column>
        </DataTable>

        <!-- 신규 행 추가 다이얼로그 -->
        <Dialog v-model:visible="newRowVisible" header="조직 추가" :style="{ width: '480px' }" modal>
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">조직코드 <span class="text-red-500">*</span></label>
                    <InputText v-model="newRow.prlmOgzCCone" placeholder="예: 001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">부점명</label>
                    <InputText v-model="newRow.bbrNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">부점영문명</label>
                    <InputText v-model="newRow.bbrWrenNm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">순서</label>
                    <InputText v-model="newRow.itmSqnSno" placeholder="예: 001" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">상위조직코드</label>
                    <InputText v-model="newRow.prlmHrkOgzCCone" placeholder="예: 000 (최상위이면 공란)" class="w-full" />
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
