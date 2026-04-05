<!--
================================================================================
[components/cost/CostFormTableSection.vue] 전산업무비 신청 테이블 컴포넌트
================================================================================
cost/form.vue 및 cost/terminal/form.vue에서 공통으로 사용하는
전산업무비 신청 DataTable 컴포넌트입니다.
index.vue와 동일한 헤더 스타일(blue-900, showGridlines)을 적용합니다.

[담당자 입력]
  AutoComplete(이름 검색) + 직원조회 다이얼로그 버튼 (index.vue와 동일 로직)

[Props]
  modelValue       - ItCost[] (단일 행 또는 다중 행)
  ioeCOptions      - 비목코드 옵션
  pulDttOptions    - 신규/계속 옵션
  dfrCleOptions    - 지급주기 옵션
  abusCOptions     - 사업코드 옵션
  budgetDisabled   - 예산/통화 비활성화 여부 (금융정보단말기용, default: false)
  currencyFixed    - 통화 고정값 (설정 시 해당 통화 고정 표시, default: undefined)
  currencyOptions  - 통화 선택지 (default: KRW·USD·EUR·JPY·CNY)
  showDeleteColumn - 행 삭제 버튼 컬럼 표시 여부 (default: false)
================================================================================
-->
<script setup lang="ts">
import { type ItCost } from '~/composables/useCost';
import { useEmployeeSearch, type UserSuggestion, type DialogEmployeeResult } from '~/composables/useEmployeeSearch';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

interface CodeOption { cdId: string; cdNm: string; }

const props = withDefaults(defineProps<{
    modelValue: ItCost[];
    ioeCOptions: CodeOption[];
    pulDttOptions: CodeOption[];
    dfrCleOptions: CodeOption[];
    abusCOptions: CodeOption[];
    budgetDisabled?: boolean;
    currencyFixed?: string;
    currencyOptions?: string[];
    showDeleteColumn?: boolean;
}>(), {
    budgetDisabled: false,
    currencyFixed: undefined,
    currencyOptions: () => ['KRW', 'USD', 'EUR', 'JPY', 'CNY'],
    showDeleteColumn: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: ItCost[]];
}>();

const { employeeSuggestions, employeeDialogVisible, selectedRowIndex, searchEmployee, openEmployeeSearch } = useEmployeeSearch();

/** AutoComplete 선택 완료 시 행 데이터에 담당자 정보 반영 */
const onEmployeeAutoSelect = (data: ItCost, selected: UserSuggestion) => {
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.bbrC;
    data.biceDpmNm = selected.bbrNm;
    data.biceTem = selected.temC ?? '';
    data.biceTemNm = selected.temNm ?? '';
};

/** 직원조회 다이얼로그 선택 완료 시 행 데이터에 담당자 정보 반영 */
const onDialogEmployeeSelect = (selected: DialogEmployeeResult) => {
    if (selectedRowIndex.value < 0) return;
    const data = props.modelValue[selectedRowIndex.value];
    if (!data) return;
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.orgCode ?? '';
    data.biceDpmNm = selected.bbrNm ?? '';
    data.biceTem = selected.temC ?? '';
    data.biceTemNm = selected.temNm ?? '';
    employeeDialogVisible.value = false;
};

/** 행 삭제 */
const deleteRow = (index: number) => {
    const updated = [...props.modelValue];
    updated.splice(index, 1);
    emit('update:modelValue', updated);
};
</script>

<template>
    <StyledDataTable :value="modelValue">

        <!-- 사업코드 -->
        <Column header="사업코드" style="min-width: 160px">
            <template #body="{ data }">
                <Select v-model="data.abusC" :options="abusCOptions" option-label="cdNm"
                    option-value="cdId" placeholder="사업코드 선택" class="w-full" />
            </template>
        </Column>

        <!-- 비목코드 -->
        <Column header="비목코드" style="min-width: 180px">
            <template #body="{ data }">
                <Select v-model="data.ioeC" :options="ioeCOptions" option-label="cdNm"
                    option-value="cdId" placeholder="비목코드 선택" class="w-full" />
            </template>
        </Column>

        <!-- 신규/계속 (PUL_DTT) -->
        <Column header="신규/계속" style="min-width: 140px">
            <template #body="{ data }">
                <Select v-model="data.pulDtt" :options="pulDttOptions" option-label="cdNm"
                    option-value="cdId" placeholder="신규/계속 선택" class="w-full" />
            </template>
        </Column>

        <!-- 계약명 -->
        <Column header="계약명" style="min-width: 150px">
            <template #body="{ data }">
                <InputText v-model="data.cttNm" class="w-full" />
            </template>
        </Column>

        <!-- 계약상대처 -->
        <Column header="계약상대처" style="min-width: 120px">
            <template #body="{ data }">
                <InputText v-model="data.cttOpp" class="w-full" />
            </template>
        </Column>

        <!-- 예산 -->
        <Column header="예산" style="min-width: 120px">
            <template #body="{ data }">
                <InputNumber v-model="data.itMngcBg" mode="currency" :currency="data.cur || 'KRW'"
                    locale="ko-KR" class="w-full" :disabled="budgetDisabled" />
            </template>
        </Column>

        <!-- 통화: currencyFixed 설정 시 고정 표시, 아니면 Select -->
        <Column header="통화" style="width: 100px">
            <template #body="{ data }">
                <InputText v-if="currencyFixed" :model-value="currencyFixed" class="w-full" disabled />
                <Select v-else v-model="data.cur" :options="currencyOptions" class="w-full" />
            </template>
        </Column>

        <!-- 지급주기 -->
        <Column header="지급주기" style="min-width: 140px">
            <template #body="{ data }">
                <Select v-model="data.dfrCle" :options="dfrCleOptions" option-label="cdNm"
                    option-value="cdId" placeholder="지급주기 선택" class="w-full" />
            </template>
        </Column>

        <!-- 최초지급일 -->
        <Column header="최초지급일" style="min-width: 140px">
            <template #body="{ data }">
                <DatePicker v-model="data.fstDfrDt" view="month" dateFormat="yy-mm" showIcon fluid
                    placeholder="최초지급일" class="w-full" />
            </template>
        </Column>

        <!-- 담당자 (AutoComplete + 직원조회 버튼, index.vue와 동일 로직) -->
        <Column header="담당자" style="min-width: 150px; width: 170px">
            <template #body="{ data, index }">
                <div class="cgpr-cell">
                    <AutoComplete :modelValue="data.cgprNm || ''" :suggestions="employeeSuggestions"
                        optionLabel="usrNm" :placeholder="data.cgprNm || '이름 검색'" @complete="searchEmployee"
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

        <!-- 행 삭제 버튼 (showDeleteColumn 설정 시만 표시) -->
        <Column v-if="showDeleteColumn" header="삭제" style="width: 50px; text-align: center">
            <template #body="{ index }">
                <Button icon="pi pi-trash" text severity="danger" @click="deleteRow(index)" />
            </template>
        </Column>
    </StyledDataTable>

    <!-- 직원조회 다이얼로그 -->
    <EmployeeSearchDialog v-model:visible="employeeDialogVisible" @select="onDialogEmployeeSelect" />
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
