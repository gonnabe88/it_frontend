<!--
================================================================================
[components/cost/TerminalTableSection.vue] 단말기 상세목록 테이블 컴포넌트
================================================================================
금융정보단말기 전산업무비의 단말기 상세목록을 관리하는 컴포넌트입니다.

[편집 방식]
  - 셀 단위 인라인 편집 제거(기존 InlineEditCell 삭제)
  - "수정" 버튼 클릭 → 행 전체가 편집 모드로 전환되어 입력 폼 노출
  - "저장(체크)" 버튼 클릭 → 편집 모드 종료(실제 서버 저장은 다이얼로그 저장 시)

[일괄 기능]
  - 일괄다운로드: 현재 단말기 목록을 Excel(xlsx) 파일로 내보내기
  - 일괄업로드:   Excel(xlsx) 파일을 읽어 단말기 목록으로 반영 (기존 목록 치환)

[담당자 입력]
  AutoComplete(이름 검색) + 직원조회 다이얼로그 버튼 (편집 모드에서만 활성화)

[Props]
  modelValue    - Terminal[] (단말기 목록)
  dfrCleOptions - 지급주기 옵션
  tmnSvcOptions - 단말기서비스 옵션
  currencyOptions - 통화 선택지
================================================================================
-->
<script setup lang="ts">
import type { Terminal } from '~/composables/useCost';
import { useEmployeeSearch, type UserSuggestion, type DialogEmployeeResult } from '~/composables/useEmployeeSearch';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { exportRowsToExcel } from '~/utils/excel';

interface CodeOption { cdId: string; cdNm: string; }

const props = defineProps<{
    modelValue: Terminal[];
    dfrCleOptions: CodeOption[];
    tmnSvcOptions: CodeOption[];
    currencyOptions: string[];
}>();

const emit = defineEmits<{
    'update:modelValue': [value: Terminal[]];
}>();

const toast = useToast();

/* ── Select 옵션 변환 (CodeOption → { label, value }) ─────────── */
const dfrCleSelectOptions = computed(() => props.dfrCleOptions.map(o => ({ label: o.cdNm, value: o.cdId })));
const tmnSvcSelectOptions = computed(() => props.tmnSvcOptions.map(o => ({ label: o.cdNm, value: o.cdId })));
const curSelectOptions = computed(() => props.currencyOptions.map(c => ({ label: c, value: c })));

/** 코드 ID → 코드명 변환 헬퍼 (조회 모드 표시용) */
const codeName = (options: CodeOption[], cdId: string | undefined) =>
    options.find(o => o.cdId === cdId)?.cdNm ?? cdId ?? '';

/** 코드명 → 코드 ID 역변환 헬퍼 (업로드 시 사용) */
const codeId = (options: CodeOption[], cdNm: string | undefined) =>
    options.find(o => o.cdNm === cdNm)?.cdId ?? cdNm ?? '';

const { employeeSuggestions, employeeDialogVisible, selectedRowIndex, searchEmployee, openEmployeeSearch } = useEmployeeSearch();

/* ── 행 전체 편집 모드 ────────────────────────────────────── */

/** 현재 편집 중인 행 인덱스 (-1이면 편집 없음) */
const editingIndex = ref<number>(-1);

/** 해당 행이 편집 모드인지 여부 */
const isRowEditing = (index: number) => editingIndex.value === index;

/** 행 편집 시작 (다른 행이 편집 중이면 그대로 종료 후 전환) */
const startRowEdit = (index: number) => {
    editingIndex.value = index;
};

/** 행 편집 종료 (실제 서버 저장은 상위 다이얼로그에서 수행) */
const finishRowEdit = () => {
    editingIndex.value = -1;
};

/* ── 행 추가/삭제 ─────────────────────────────────────────── */

/** 단말기 행 추가 → 새 행을 즉시 편집 모드로 진입 */
const addRow = () => {
    const next: Terminal[] = [
        ...props.modelValue,
        {
            tmnNm: '',
            tmnTuzManr: '',
            tmnUsg: '',
            tmnSvc: '',
            tmlAmt: 0,
            cur: 'KRW',
            xcr: 1,
            xcrBseDt: new Date().toISOString().split('T')[0],
            dfrCle: '',
            indRsn: '',
            cgpr: '',
            cgprNm: '',
            biceTem: '',
            biceDpm: '',
            rmk: ''
        }
    ];
    emit('update:modelValue', next);
    editingIndex.value = next.length - 1;
};

/** 단말기 행 삭제 */
const removeRow = (index: number) => {
    const updated = [...props.modelValue];
    updated.splice(index, 1);
    emit('update:modelValue', updated);
    /* 편집 중이던 행이 삭제/변경되면 편집 해제 */
    if (editingIndex.value === index) editingIndex.value = -1;
    else if (editingIndex.value > index) editingIndex.value -= 1;
};

/** AutoComplete 선택 완료 시 해당 행에 담당자 정보 반영 */
const onEmployeeAutoSelect = (data: Terminal, selected: UserSuggestion) => {
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.bbrC;
    data.biceTem = selected.temC ?? '';
};

/** 직원조회 다이얼로그 선택 완료 시 해당 행에 담당자 정보 반영 */
const onDialogEmployeeSelect = (selected: DialogEmployeeResult) => {
    if (selectedRowIndex.value < 0) return;
    const data = props.modelValue[selectedRowIndex.value];
    if (!data) return;
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.orgCode ?? '';
    data.biceTem = selected.temC ?? '';
    employeeDialogVisible.value = false;
};

/* ── 일괄다운로드 (Excel) ───────────────────────────────── */

/** 현재 단말기 목록을 Excel 파일로 다운로드 (공통 유틸 사용) */
const downloadExcel = async () => {
    const rows = props.modelValue.map((t, i) => ({
        'No': i + 1,
        '단말기명': t.tmnNm ?? '',
        '이용방법': t.tmnTuzManr ?? '',
        '용도': t.tmnUsg ?? '',
        '금액': t.tmlAmt ?? 0,
        '통화': t.cur ?? 'KRW',
        '지급주기': codeName(props.dfrCleOptions, t.dfrCle),
        '단말기서비스': codeName(props.tmnSvcOptions, t.tmnSvc),
        '증감사유': t.indRsn ?? '',
        '담당자사번': t.cgpr ?? '',
        '담당자명': t.cgprNm ?? '',
        '담당부서': t.biceDpm ?? '',
        '담당팀': t.biceTem ?? '',
        '비고': t.rmk ?? '',
    }));
    await exportRowsToExcel(
        rows,
        '단말기상세목록',
        `단말기상세목록_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
};

/* ── 일괄업로드 (Excel) ────────────────────────────────── */

const uploadInputRef = ref<HTMLInputElement | null>(null);

/** 파일 선택 트리거 */
const triggerUpload = () => uploadInputRef.value?.click();

/** Excel 파일을 읽어 단말기 목록을 치환 */
const handleUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        const { default: ExcelJS } = await import('exceljs');
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];
        if (!ws) {
            toast.add({ severity: 'error', summary: '업로드', detail: '시트가 없는 파일입니다.', life: 2000 });
            return;
        }

        const headers: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawRows: Record<string, any>[] = [];
        ws.eachRow((row, rowIndex) => {
            if (rowIndex === 1) {
                row.eachCell(cell => headers.push(String(cell.value ?? '')));
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const obj: Record<string, any> = {};
                row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                    obj[headers[colIndex - 1] ?? ''] = cell.value ?? '';
                });
                rawRows.push(obj);
            }
        });

        if (!rawRows.length) {
            toast.add({ severity: 'warn', summary: '업로드', detail: '데이터가 없습니다.', life: 2000 });
            return;
        }

        /* 각 Excel 행을 Terminal로 매핑 (코드명 → 코드ID 역변환 포함) */
        const nextTerminals: Terminal[] = rawRows.map(row => ({
            tmnNm: String(row['단말기명'] ?? ''),
            tmnTuzManr: String(row['이용방법'] ?? ''),
            tmnUsg: String(row['용도'] ?? ''),
            tmnSvc: codeId(props.tmnSvcOptions, String(row['단말기서비스'] ?? '')),
            tmlAmt: Number(row['금액']) || 0,
            cur: String(row['통화'] || 'KRW'),
            xcr: 1,
            xcrBseDt: new Date().toISOString().split('T')[0],
            dfrCle: codeId(props.dfrCleOptions, String(row['지급주기'] ?? '')),
            indRsn: String(row['증감사유'] ?? ''),
            cgpr: String(row['담당자사번'] ?? ''),
            cgprNm: String(row['담당자명'] ?? ''),
            biceDpm: String(row['담당부서'] ?? ''),
            biceTem: String(row['담당팀'] ?? ''),
            rmk: String(row['비고'] ?? ''),
        }));

        emit('update:modelValue', nextTerminals);
        editingIndex.value = -1;
        toast.add({ severity: 'success', summary: '일괄업로드', detail: `${nextTerminals.length}건을 불러왔습니다.`, life: 2500 });
    } catch (e) {
        console.error('단말기 업로드 실패', e);
        toast.add({ severity: 'error', summary: '오류', detail: '파일 처리 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        /* 같은 파일 재선택 가능하도록 초기화 */
        if (uploadInputRef.value) uploadInputRef.value.value = '';
    }
};
</script>

<template>
    <div class="space-y-3">
        <!-- 헤더 영역: 제목 + 액션 버튼 -->
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">단말기 상세목록</h3>
            <div class="flex items-center gap-2">
                <Button label="행 추가" icon="pi pi-plus" severity="secondary" outlined size="small" @click="addRow" />
                <Button
label="일괄업로드" icon="pi pi-upload" severity="secondary" outlined size="small"
                    @click="triggerUpload" />
                <input ref="uploadInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleUpload">
                <Button
label="일괄다운로드" icon="pi pi-download" severity="secondary" outlined size="small"
                    @click="downloadExcel" />
            </div>
        </div>

        <StyledDataTable :value="modelValue">
            <!-- No -->
            <Column header="No" style="width: 50px">
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <!-- 단말기명 -->
            <Column header="단말기명" style="min-width: 150px">
                <template #body="{ data, index }">
                    <InputText v-if="isRowEditing(index)" v-model="data.tmnNm" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.tmnNm || '-' }}</span>
                </template>
            </Column>

            <!-- 이용방법 -->
            <Column header="이용방법" style="min-width: 150px">
                <template #body="{ data, index }">
                    <InputText v-if="isRowEditing(index)" v-model="data.tmnTuzManr" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.tmnTuzManr || '-' }}</span>
                </template>
            </Column>

            <!-- 용도 -->
            <Column header="용도" style="min-width: 150px">
                <template #body="{ data, index }">
                    <InputText v-if="isRowEditing(index)" v-model="data.tmnUsg" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.tmnUsg || '-' }}</span>
                </template>
            </Column>

            <!-- 금액 -->
            <Column header="금액" style="min-width: 140px">
                <template #body="{ data, index }">
                    <InputNumber
v-if="isRowEditing(index)" v-model="data.tmlAmt" :suffix="' ' + (data.cur || 'KRW')"
                        class="w-full" input-class="text-right w-full" />
                    <span v-else class="inline-block w-full text-right">
                        {{ (data.tmlAmt ?? 0).toLocaleString() }} {{ data.cur || 'KRW' }}
                    </span>
                </template>
            </Column>

            <!-- 통화 -->
            <Column header="통화" style="width: 100px">
                <template #body="{ data, index }">
                    <Select
v-if="isRowEditing(index)" v-model="data.cur" :options="curSelectOptions"
                        option-label="label" option-value="value" class="w-full" />
                    <span v-else class="inline-block w-full text-center">{{ data.cur || 'KRW' }}</span>
                </template>
            </Column>

            <!-- 지급주기 -->
            <Column header="지급주기" style="min-width: 140px">
                <template #body="{ data, index }">
                    <Select
v-if="isRowEditing(index)" v-model="data.dfrCle" :options="dfrCleSelectOptions"
                        option-label="label" option-value="value" placeholder="지급주기 선택" class="w-full" />
                    <span v-else class="inline-block w-full">{{ codeName(dfrCleOptions, data.dfrCle) || '-' }}</span>
                </template>
            </Column>

            <!-- 단말기서비스 -->
            <Column header="단말기서비스" style="min-width: 160px">
                <template #body="{ data, index }">
                    <Select
v-if="isRowEditing(index)" v-model="data.tmnSvc" :options="tmnSvcSelectOptions"
                        option-label="label" option-value="value" placeholder="서비스 선택" class="w-full" />
                    <span v-else class="inline-block w-full">{{ codeName(tmnSvcOptions, data.tmnSvc) || '-' }}</span>
                </template>
            </Column>

            <!-- 증감사유 -->
            <Column header="증감사유" style="min-width: 150px">
                <template #body="{ data, index }">
                    <InputText v-if="isRowEditing(index)" v-model="data.indRsn" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.indRsn || '-' }}</span>
                </template>
            </Column>

            <!-- 담당자 (AutoComplete + 직원조회 버튼, 편집 모드에서만 입력 가능) -->
            <Column header="담당자" style="min-width: 150px; width: 200px">
                <template #body="{ data, index }">
                    <div v-if="isRowEditing(index)" class="cgpr-cell">
                        <AutoComplete
                            :model-value="data.cgprNm || ''" :suggestions="employeeSuggestions"
                            option-label="usrNm" :placeholder="data.cgprNm || '이름 검색'"
                            @complete="searchEmployee"
                            @item-select="onEmployeeAutoSelect(data, $event.value)">
                            <template #option="{ option }">
                                <div class="py-1.5 pl-2.5 border-l-[3px] border-blue-900">
                                    <div class="leading-tight">
                                        <div class="flex items-baseline gap-1.5">
                                            <span class="font-semibold text-sm">{{ option.usrNm }}</span>
                                            <span class="text-[11px] text-surface-400">{{ option.eno }}</span>
                                            <span v-if="option.ptCNm" class="text-xs text-primary/70">{{ option.ptCNm }}</span>
                                        </div>
                                        <div class="flex items-center gap-1 text-xs text-surface-400 mt-0.5">
                                            <i class="pi pi-building text-[10px]" />
                                            <span>{{ option.bbrNm }}</span>
                                            <template v-if="option.temNm">
                                                <span class="text-surface-300">·</span>
                                                <span>{{ option.temNm }}</span>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </AutoComplete>
                        <Button
v-tooltip.top="'직원조회'" icon="pi pi-search" text size="small"
                            class="!pe-1" @click="openEmployeeSearch(index)" />
                    </div>
                    <span v-else class="inline-block w-full">{{ data.cgprNm || '-' }}</span>
                </template>
            </Column>

            <!-- 비고 -->
            <Column header="비고" style="min-width: 150px">
                <template #body="{ data, index }">
                    <InputText v-if="isRowEditing(index)" v-model="data.rmk" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.rmk || '-' }}</span>
                </template>
            </Column>

            <!-- 액션: 수정/저장 + 삭제 -->
            <Column header="작업" style="width: 96px; text-align: center">
                <template #body="{ index }">
                    <div class="flex justify-center gap-0.5">
                        <!-- 수정 모드 토글: 편집 중이면 저장(체크), 아니면 수정(연필) -->
                        <Button
v-if="isRowEditing(index)" v-tooltip.top="'완료'" icon="pi pi-check" text rounded
                            size="small" severity="success" @click="finishRowEdit" />
                        <Button
v-else v-tooltip.top="'수정'" icon="pi pi-pencil" text rounded size="small"
                            severity="secondary" @click="startRowEdit(index)" />
                        <!-- 삭제 버튼 -->
                        <Button
v-tooltip.top="'삭제'" icon="pi pi-trash" text rounded size="small" severity="danger"
                            @click="removeRow(index)" />
                    </div>
                </template>
            </Column>
        </StyledDataTable>

        <!-- 직원조회 다이얼로그 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" @select="onDialogEmployeeSelect" />
    </div>
</template>

<style scoped>
/* 담당자 셀: grid로 AutoComplete(1fr)와 버튼(auto) 분배 */
.cgpr-cell {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 4px;
    overflow: hidden;
}

.cgpr-cell :deep(.p-autocomplete) {
    width: 100% !important;
    min-width: 0 !important;
}

.cgpr-cell :deep(.p-autocomplete input) {
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
}
</style>
