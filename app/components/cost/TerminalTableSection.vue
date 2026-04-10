<!--
================================================================================
[components/cost/TerminalTableSection.vue] 단말기 상세목록 테이블 컴포넌트
================================================================================
금융정보단말기 전산업무비의 단말기 상세목록을 관리하는 컴포넌트입니다.
terminal/form.vue의 DataTable 2를 컴포넌트로 분리했습니다.

[담당자 입력]
  AutoComplete(이름 검색) + 직원조회 다이얼로그 버튼 (index.vue와 동일 로직)

[Props]
  modelValue    - Terminal[] (단말기 목록)
  dfrCleOptions - 지급주기 옵션
  tmnSvcOptions - 단말기서비스 옵션
  currencyOptions - 통화 선택지
================================================================================
-->
<script setup lang="ts">
import { type Terminal } from '~/composables/useCost';
import { useEmployeeSearch, type UserSuggestion, type DialogEmployeeResult } from '~/composables/useEmployeeSearch';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

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

const { employeeSuggestions, employeeDialogVisible, selectedRowIndex, searchEmployee, openEmployeeSearch } = useEmployeeSearch();

/* ── 행 추가/삭제 ─────────────────────────────────────────── */

/** 단말기 행 추가 */
const addRow = () => {
    emit('update:modelValue', [
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
    ]);
};

/** 단말기 행 삭제 */
const removeRow = (index: number) => {
    const updated = [...props.modelValue];
    updated.splice(index, 1);
    emit('update:modelValue', updated);
};

/** AutoComplete 선택 완료 시 해당 행에 담당자 정보 직접 반영 */
const onEmployeeAutoSelect = (data: Terminal, selected: UserSuggestion) => {
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.bbrC;
    data.biceTem = selected.temC ?? '';
};

/** 직원조회 다이얼로그 선택 완료 시 해당 행에 담당자 정보 직접 반영 */
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
</script>

<template>
    <div class="space-y-3">
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">단말기 상세목록</h3>
            <Button label="행 추가" icon="pi pi-plus" severity="secondary" size="small" @click="addRow" />
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
                <template #body="{ data }">
                    <InputText v-model="data.tmnNm" class="w-full" />
                </template>
            </Column>

            <!-- 이용방법 -->
            <Column header="이용방법" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-model="data.tmnTuzManr" class="w-full" />
                </template>
            </Column>

            <!-- 용도 -->
            <Column header="용도" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-model="data.tmnUsg" class="w-full" />
                </template>
            </Column>

            <!-- 금액 -->
            <Column header="금액" style="min-width: 120px">
                <template #body="{ data }">
                    <InputNumber v-model="data.tmlAmt" mode="currency" :currency="data.cur || 'KRW'"
                        locale="ko-KR" class="w-full" :min="0" />
                </template>
            </Column>

            <!-- 통화 -->
            <Column header="통화" style="width: 100px">
                <template #body="{ data }">
                    <Select v-model="data.cur" :options="currencyOptions" class="w-full" />
                </template>
            </Column>

            <!-- 지급주기 -->
            <Column header="지급주기" style="min-width: 140px">
                <template #body="{ data }">
                    <Select v-model="data.dfrCle" :options="dfrCleOptions" option-label="cdNm"
                        option-value="cdId" placeholder="지급주기 선택" class="w-full" />
                </template>
            </Column>

            <!-- 단말기서비스 -->
            <Column header="단말기서비스" style="min-width: 160px">
                <template #body="{ data }">
                    <Select v-model="data.tmnSvc" :options="tmnSvcOptions" option-label="cdNm"
                        option-value="cdId" placeholder="서비스 선택" class="w-full" />
                </template>
            </Column>

            <!-- 증감사유 -->
            <Column header="증감사유" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-model="data.indRsn" class="w-full" />
                </template>
            </Column>

            <!-- 담당자 (AutoComplete + 직원조회 버튼) -->
            <Column header="담당자" style="min-width: 150px; width: 170px">
                <template #body="{ data, index }">
                    <div class="cgpr-cell">
                        <AutoComplete :modelValue="data.cgprNm || ''" :suggestions="employeeSuggestions"
                            optionLabel="usrNm" :placeholder="data.cgprNm || '이름 검색'"
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
                        <Button icon="pi pi-search" text size="small" class="!pe-1"
                            @click="openEmployeeSearch(index)" v-tooltip.top="'직원조회'" />
                    </div>
                </template>
            </Column>

            <!-- 비고 -->
            <Column header="비고" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-model="data.rmk" class="w-full" />
                </template>
            </Column>

            <!-- 행 삭제 -->
            <Column header="삭제" style="width: 50px; text-align: center">
                <template #body="{ index }">
                    <Button icon="pi pi-trash" text severity="danger" @click="removeRow(index)" />
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
