<!--
================================================================================
[components/cost/TerminalTableSection.vue] 단말기 상세목록 테이블 컴포넌트
================================================================================
금융정보단말기 전산업무비의 단말기 상세목록을 관리하는 컴포넌트입니다.

[편집 방식]
  - [조회모드/편집모드] SelectButton으로 모드 전환
  - 조회 모드: 모든 셀을 텍스트로 표시
  - 편집 모드: 모든 셀이 인라인 입력 폼으로 전환 (스프레드시트 방식)
            + 행추가·일괄업로드 버튼 활성화
            + showSave=true 시 저장 버튼 활성화 → 부모에 'save' 이벤트 전달
  - 실제 서버 저장은 부모의 저장 이벤트 핸들러에서 처리

[일괄 기능]
  - 일괄다운로드: 현재 단말기 목록을 Excel(xlsx) 파일로 내보내기
  - 일괄업로드:   Excel(xlsx) 파일을 읽어 단말기 목록으로 반영 (기존 목록 치환)

[담당자 입력]
  AutoComplete(이름 검색) + 직원조회 다이얼로그 버튼

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
    /** true면 카드 래퍼 없이 렌더링 — 다이얼로그처럼 부모가 컨테이너를 제공할 때 사용 */
    flat?: boolean;
    /** 초기 모드 지정 (기본값 'view') */
    defaultMode?: 'view' | 'edit';
    /** 편집 모드에서 저장 버튼 표시 여부 (기본값 false) — true 시 저장 클릭 → 'save' 이벤트 발행 */
    showSave?: boolean;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: Terminal[]];
    /** 저장 버튼 클릭 시 부모에게 저장 요청 */
    'save': [];
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

/* ── 조회/편집 모드 ───────────────────────────────────────── */
/** defaultMode prop으로 초기 모드 결정 (기본값 'view') */
const mode = ref<'view' | 'edit'>(props.defaultMode ?? 'view');
const isEdit = computed(() => mode.value === 'edit');

/** SelectButton 옵션 */
const modeOptions = [
    { label: '조회', value: 'view' },
    { label: '편집', value: 'edit' },
];

/* ── 넓게 보기 토글 ───────────────────────────────────────── */
const isExpanded = ref(false);
const toggleExpand = () => { isExpanded.value = !isExpanded.value; };

/* ── 행 추가/삭제 ─────────────────────────────────────────── */

/** 단말기 행 추가 */
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
            xcr: 0,
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
};

/** 단말기 행 삭제 */
const removeRow = (index: number) => {
    const updated = [...props.modelValue];
    updated.splice(index, 1);
    emit('update:modelValue', updated);
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
    <!--
        flat=false(기본): 독립 카드 (terminal-section으로 min-height CSS 타겟팅)
        flat=true: 다이얼로그 내 — 카드 스타일 없이 bare 렌더링
    -->
    <div
        class="terminal-table space-y-3 transition-all duration-300"
        :class="flat ? '' : [
            'terminal-section',
            'bg-white', 'dark:bg-zinc-900', 'p-6', 'rounded-xl',
            'border', 'border-zinc-200', 'dark:border-zinc-800', 'shadow-sm',
            isExpanded ? 'w-full' : 'max-w-[1440px] mx-auto w-full'
        ]"
    >
        <!-- 헤더: 3등분 그리드 — Title(좌) / 조회·편집 토글(중앙) / 액션 버튼(우) -->
        <div class="grid grid-cols-3 items-center">
            <!-- 좌: Title + 넓게 보기 토글(독립 카드 모드만) -->
            <div class="flex items-center gap-2 justify-start">
                <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">금융정보단말기 상세목록</h3>
                <Button
                    v-if="!flat"
                    v-tooltip.top="isExpanded ? '기본 폭으로' : '넓게 보기'"
                    :icon="isExpanded ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
                    variant="text" severity="secondary" rounded
                    @click="toggleExpand"
                />
            </div>
            <!-- 중앙: 조회/편집 모드 전환 SelectButton -->
            <div class="flex justify-center">
                <SelectButton
                    v-model="mode"
                    :options="modeOptions"
                    option-label="label"
                    option-value="value"
                    size="small"
                />
            </div>
            <!-- 우: 액션 버튼 그룹 -->
            <div class="flex items-center gap-2 justify-end">
                <!-- 일괄다운로드: 항상 표시 -->
                <Button label="일괄다운로드" icon="pi pi-download" severity="secondary" outlined size="small" @click="downloadExcel" />
                <!-- 편집 모드 액션 버튼: 업로드·행추가·저장 -->
                <template v-if="isEdit">
                    <Button label="일괄업로드" icon="pi pi-upload" severity="secondary" outlined size="small" @click="triggerUpload" />
                    <input ref="uploadInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleUpload">
                    <Button v-tooltip.top="'행추가'" icon="pi pi-plus" size="small" @click="addRow" />
                    <Button v-if="showSave" label="저장" icon="pi pi-save" size="small" @click="emit('save')" />
                </template>
            </div>
        </div>

        <StyledDataTable :value="modelValue" size="small">
            <!-- No -->
            <Column header="No" style="width: 50px">
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <!-- 단말기명 -->
            <Column header="단말기명" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-if="isEdit" v-model="data.tmnNm" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.tmnNm || '-' }}</span>
                </template>
            </Column>

            <!-- 이용방법 -->
            <Column header="이용방법" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-if="isEdit" v-model="data.tmnTuzManr" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.tmnTuzManr || '-' }}</span>
                </template>
            </Column>

            <!-- 용도 -->
            <Column header="용도" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-if="isEdit" v-model="data.tmnUsg" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.tmnUsg || '-' }}</span>
                </template>
            </Column>

            <!-- 금액 -->
            <Column header="금액" style="min-width: 140px">
                <template #body="{ data }">
                    <InputNumber
                        v-if="isEdit"
                        v-model="data.tmlAmt" :suffix="' ' + (data.cur || 'KRW')"
                        class="w-full" input-class="text-right w-full" />
                    <span v-else class="inline-block w-full text-right">
                        {{ (data.tmlAmt ?? 0).toLocaleString() }} {{ data.cur || 'KRW' }}
                    </span>
                </template>
            </Column>

            <!-- 통화 -->
            <Column header="통화" style="width: 100px">
                <template #body="{ data }">
                    <Select
                        v-if="isEdit"
                        v-model="data.cur" :options="curSelectOptions"
                        option-label="label" option-value="value" class="w-full cur-select" />
                    <span v-else class="inline-block w-full text-center">{{ data.cur || 'KRW' }}</span>
                </template>
            </Column>

            <!-- 지급주기 -->
            <Column header="지급주기" style="min-width: 140px">
                <template #body="{ data }">
                    <Select
                        v-if="isEdit"
                        v-model="data.dfrCle" :options="dfrCleSelectOptions"
                        option-label="label" option-value="value" placeholder="지급주기 선택" class="w-full" />
                    <span v-else class="inline-block w-full">{{ codeName(dfrCleOptions, data.dfrCle) || '-' }}</span>
                </template>
            </Column>

            <!-- 단말기서비스 -->
            <Column header="단말기서비스" style="min-width: 160px">
                <template #body="{ data }">
                    <Select
                        v-if="isEdit"
                        v-model="data.tmnSvc" :options="tmnSvcSelectOptions"
                        option-label="label" option-value="value" placeholder="서비스 선택" class="w-full" />
                    <span v-else class="inline-block w-full">{{ codeName(tmnSvcOptions, data.tmnSvc) || '-' }}</span>
                </template>
            </Column>

            <!-- 증감사유 -->
            <Column header="증감사유" style="min-width: 150px">
                <template #body="{ data }">
                    <InputText v-if="isEdit" v-model="data.indRsn" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.indRsn || '-' }}</span>
                </template>
            </Column>

            <!-- 담당자 (AutoComplete + 직원조회 버튼) -->
            <Column header="담당자" style="min-width: 150px; width: 200px">
                <template #body="{ data, index }">
                    <div v-if="isEdit" class="cgpr-cell">
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
                <template #body="{ data }">
                    <InputText v-if="isEdit" v-model="data.rmk" class="w-full" />
                    <span v-else class="inline-block w-full">{{ data.rmk || '-' }}</span>
                </template>
            </Column>

            <!-- 액션(삭제): 편집 모드에서만 표시 -->
            <Column v-if="isEdit" header="작업" style="width: 52px; text-align: center">
                <template #body="{ index }">
                    <div class="flex justify-center">
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

<style>
/*
 * terminal-section: TerminalTableSection 카드 루트 클래스 (비스코프 타겟팅)
 * kdb-it-table .p-datatable-table-container 의 min-height:0 을 400px로 재정의.
 * 행이 없어도 400px 확보, 행이 많으면 자연스럽게 늘어나고 스크롤 없음.
 * 특이도 0,4,0 > StyledDataTable 의 0,2,0 으로 우선순위 확보.
 */
.terminal-section .kdb-it-table .p-datatable .p-datatable-table-container {
    min-height: 400px;
}

/* ─────────────────────────────────────────────────────────────────────
   terminal-table: /info/cost 수정 모드와 동일한 컴팩트·편집 스타일
   ───────────────────────────────────────────────────────────────────── */

/* 셀 패딩 밀도 축소 */
.terminal-table .kdb-it-table .p-datatable-tbody>tr>td {
    padding: 0.4rem 0.4rem !important;
}
.terminal-table .kdb-it-table .p-datatable-thead>tr>th {
    padding: 0.4rem 0.4rem !important;
}

/* 편집 행의 입력 폼 테두리 완전 제거 — border-color:transparent는 1px 공간이 남아 행 높이가 달라지므로 border:none 사용 */
.terminal-table :is(.p-inputtext,
    .p-inputnumber,
    .p-inputnumber-input,
    .p-select,
    .p-autocomplete,
    .p-autocomplete-input) {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}
.terminal-table :is(.p-inputtext,
    .p-inputnumber-input,
    .p-autocomplete-input):focus,
.terminal-table :is(.p-select,
    .p-autocomplete).p-focus {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}

/* 입력 폼 내부 패딩/높이 축소 */
.terminal-table :is(.p-inputtext,
    .p-inputnumber-input,
    .p-autocomplete-input,
    .p-select-label) {
    padding: 0.2rem 0.4rem !important;
    min-height: 1.6rem !important;
    line-height: 1.25 !important;
}

/* Select 드롭다운 아이콘 영역 폭 축소 */
.terminal-table .p-select-dropdown {
    width: 1.6rem !important;
}

/* 통화 Select 라벨 가운데 정렬 */
.terminal-table .cur-select .p-select-label {
    text-align: center !important;
}

/* 조회 모드 span 높이·패딩 정규화 (편집 셀과 행 높이 통일) */
.terminal-table .p-datatable-body-cell span.inline-block {
    padding: 0.15rem 0.4rem;
    min-height: 1.6rem;
    line-height: 1.25;
}
</style>

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
