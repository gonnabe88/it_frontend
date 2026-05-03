<!--
================================================================================
[pages/info/cost/index.vue] 전산업무비 목록 페이지
================================================================================
IT 관리비(전산업무비) 항목의 전체 목록을 인라인 편집 가능한 DataTable로 표시합니다.
컬럼 구성은 cost/form.vue와 동일하며, 목록에서 직접 수정 후 저장할 수 있습니다.

[주요 기능]
  - 전산업무비 목록 조회 및 인라인 편집
  - 금융정보단말기(itMngcTp=IT_MNGC_TP_002) 행은 예산·통화 수정 불가 (상세 화면에서 수정)
  - 예산 단위 전환 (원 / 천원 / 백만원 / 억원)
  - 관리번호 클릭 → 상세 페이지 이동
  - 포커스 아웃 / 값 변경 시 해당 행 자동 저장
================================================================================
-->
<script setup lang="ts">
import type { ItCost } from '~/composables/useCost';
import { useCostListPage } from '~/composables/useCostListPage';
import { getApprovalTagClass } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import InlineEditCell from '~/components/common/InlineEditCell.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import TerminalFormDialog from '~/components/cost/TerminalFormDialog.vue';

const title = '전산업무비 목록';
definePageMeta({ title: '전산업무비 목록' });

const {
    yearOptions,
    selectedYear,
    error,
    rowKey,
    markDirty,
    rowStatus,
    rowClass,
    isFieldInvalid,
    employeeDialogVisible,
    employeeSuggestions,
    currentSortField,
    currentSortOrder,
    pageSizeOptions,
    pageSize,
    searchKeyword,
    filteredCosts,
    isTerminal,
    searchEmployee,
    onEmployeeSelect,
    onCgprBlur,
    openEmployeeSearch,
    onDialogEmployeeSelect,
    addRow,
    viewMode,
    enterEditMode,
    saveAndExitEdit,
    cancelEdit,
    selectedRows,
    deleteSelectedRows,
    downloadExcel,
    uploadInputRef,
    triggerUpload,
    handleUpload,
    TERMINAL_TOOLTIP,
    pulDttSelectOptions,
    abusCSelectOptions,
    dfrCleSelectOptions,
    curSelectOptions,
    ioeCascadeOptions,
    getIoeDisplayLabel,
    ioeEditingKey,
    onIoeCSelect,
    isRowEditing,
    deleteRow,
    terminalDialogVisible,
    terminalDialogItMngcNo,
    terminalDialogParentCostId,
    terminalDialogBgYy,
    terminalDialogLocalCost,
    terminalWriteConfirmVisible,
    budgetKrwDisplay,
    budgetTooltip,
    openTerminalDialog,
    openLocalTerminalDialog,
    onLocalTerminalsUpdate,
    onTerminalSaved,
    onTerminalWriteLater,
    onTerminalWriteNow,
    onTerminalCheckClick,
    isKesok,
    continuationSuggestions,
    continuationDialogVisible,
    continuationPending,
    searchContinuation,
    onContinuationSelect,
    applyContinuation,
} = useCostListPage();
</script>

<template>
    <!-- 페이지 루트: 메인 스크롤 영역 전체 높이를 차지하도록 flex 컬럼으로 구성.
         내부 테이블 카드가 남은 영역을 채우며, 페이지네이션은 카드 하단에 고정됩니다. -->
    <div class="flex flex-col h-full gap-6">
        <PageHeader :title="title">
            <template #actions>
                <!-- 예산연도 필터: 편집 모드에서는 연도 변경 불가 -->
                <Select
v-model="selectedYear" :options="yearOptions" option-label="label" option-value="value"
                    :disabled="viewMode === 'edit'" class="w-36" />
                <!-- 조회 모드: [수정] 버튼 단일 / 수정 모드: [취소] + [저장] 버튼 쌍 -->
                <div class="flex items-center gap-2">
                    <Button
v-if="viewMode === 'view'" label="수정" severity="primary"
                        class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                        @click="enterEditMode" />
                    <template v-else>
                        <Button label="취소" severity="secondary" outlined class="!px-5 !rounded-lg" @click="cancelEdit" />
                        <Button
label="저장" severity="primary"
                            class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                            @click="saveAndExitEdit" />
                    </template>
                </div>
            </template>
        </PageHeader>

        <TableCard fill icon="pi-desktop" title="전산업무비 목록" :count="filteredCosts.length">
            <template #toolbar>
                <Select
v-model="pageSize" :options="pageSizeOptions" option-label="label" option-value="value"
                    class="shrink-0" />
                <TableSearchInput
                    v-model="searchKeyword"
                    placeholder="통합 검색"
                    width="16rem"
                />
                <div class="flex-1" />
                <!-- 편집용 액션: 수정 모드에서만 표시 -->
                <template v-if="viewMode === 'edit'">
                    <Button
label="행추가" icon="pi pi-plus" severity="secondary" outlined size="small"
                        @click="addRow" />
                    <Button
label="행삭제" icon="pi pi-trash" severity="danger" outlined size="small"
                        :disabled="!selectedRows.length" @click="deleteSelectedRows" />
                    <Button
label="일괄업로드" icon="pi pi-upload" severity="secondary" outlined size="small"
                        @click="triggerUpload" />
                    <input
ref="uploadInputRef" type="file" accept=".xlsx,.xls" class="hidden"
                        @change="handleUpload">
                </template>
                <!-- 일괄다운로드: 조회/수정 모드 모두 표시 (읽기 전용 작업) -->
                <Button
label="일괄다운로드" icon="pi pi-download" severity="secondary" outlined size="small"
                    @click="downloadExcel" />
            </template>

            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>

            <!-- 수정 모드에서는 mode-edit 클래스로 셀 내 입력 폼 테두리를 숨깁니다.
                 flex-1 + min-h-0으로 남은 영역을 모두 차지하고, DataTable이 내부에서 scroll-height="flex"로 본문만 스크롤 -->
            <div v-else class="cost-table flex-1 min-h-0 flex flex-col" :class="{ 'mode-edit': viewMode === 'edit' }">
                <StyledDataTable
v-model:selection="selectedRows" :value="filteredCosts" paginator :rows="pageSize"
                    :cell-selectable="viewMode === 'view'"
                    scrollable scroll-height="flex" :sort-field="currentSortField" :sort-order="currentSortOrder"
                    removable-sort :row-class="rowClass"
                    :data-key="(row: ItCost & { _localId?: string }) => row.itMngcNo || row._localId">
                    <!-- 체크박스 선택 컬럼: 행삭제가 활성화된 수정 모드에서만 노출
                         header/body 모두 가운데 정렬: 체크박스가 셀 중앙에 위치 -->
                    <Column
v-if="viewMode === 'edit'" selection-mode="multiple"
                        header-style="width: 3rem; text-align: center" body-style="text-align: center" />

                    <!-- 상태 컬럼: 수정 모드에서만 노출. 로컬 변경 상태(_status)를 Tag로 표시 -->
                    <Column
v-if="viewMode === 'edit'" header="상태" header-style="width: 5rem; text-align: center"
                        body-style="text-align: center">
                        <template #body="{ data }">
                            <Tag v-if="rowStatus(data) === 'new'" value="신규" severity="info" class="text-xs" />
                            <Tag
v-else-if="rowStatus(data) === 'modified'" value="수정" severity="warn"
                                class="text-xs" />
                            <Tag
v-else-if="rowStatus(data) === 'deleted'" value="삭제" severity="danger"
                                class="text-xs" />
                            <span v-else class="text-zinc-300">-</span>
                        </template>
                    </Column>

                    <!-- 신규/계속 (PUL_DTT) — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="pulDtt" header="신규/계속" sortable style="width: 100px; min-width: 100px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.pulDtt" type="select" :options="pulDttSelectOptions"
                                :invalid="isFieldInvalid(data, 'pulDtt')" :force-edit="isRowEditing(data)"
                                :readonly="!isRowEditing(data)" placeholder="선택" class="text-center"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 계약명: 신규/계속이 '계속'이면 전년도 계약 자동완성, 아니면 일반 입력 -->
                    <Column field="cttNm" header="계약명" sortable style="min-width: 200px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.cttNm" :type="isKesok(data) ? 'autocomplete' : 'text'"
                                :suggestions="continuationSuggestions" option-label="cttNm" placeholder="계약명 입력"
                                :invalid="isFieldInvalid(data, 'cttNm')" :force-edit="isRowEditing(data)"
                                :readonly="!isRowEditing(data)" @complete="searchContinuation($event, data)"
                                @item-select="onContinuationSelect(data, $event.value)" @save="markDirty(data)">
                                <template #option="{ option }">
                                    <div class="py-1 pl-2 border-l-2 border-indigo-400">
                                        <div class="text-sm font-semibold">{{ option.cttNm }}</div>
                                        <div class="text-xs text-zinc-400">{{ option.cttOpp }} · {{ option.bgYy }}년
                                        </div>
                                    </div>
                                </template>
                            </InlineEditCell>
                        </template>
                    </Column>

                    <!--
                    단말기 체크박스
                    - 체크 상태는 오직 data.terminals 배열에 item이 있는지로 결정 (hasTerminalItems)
                    - 수정 모드에서 클릭해도 즉시 토글되지 않고 단말기 상세목록 다이얼로그만 열림
                    - 다이얼로그에서 저장/삭제 후 @saved=refreshCostsRaw로 terminals가 갱신되면
                      체크박스 상태가 실제 item 존재 여부에 맞춰 자동 반영됨
                    - pointer-events-none: Checkbox가 직접 클릭을 소비하지 않도록 하여
                      래퍼 div의 click 핸들러만 다이얼로그 open을 트리거
                -->
                    <Column field="itMngcTp" header="단말기" sortable style="width: 70px; text-align: center">
                        <template #body="{ data }">
                            <div class="terminal-checkbox-cell flex justify-center items-center">
                                <!-- 수정 모드: 클릭 영역 + 비인터랙티브 체크박스 (유형이 단말기이면 체크) -->
                                <div
v-if="isRowEditing(data)"
                                    class="cursor-pointer p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                                    @click.stop="onTerminalCheckClick(data)">
                                    <Checkbox
:model-value="isTerminal(data)" binary
                                        class="pointer-events-none" />
                                </div>
                                <!-- 조회 모드: 읽기 전용 체크박스 -->
                                <div v-else class="p-1">
                                    <Checkbox :model-value="isTerminal(data)" binary :disabled="true" />
                                </div>
                            </div>
                        </template>
                    </Column>

                    <!-- 계약상대처 — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="cttOpp" header="계약상대처" sortable style="min-width: 120px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.cttOpp" type="text" :invalid="isFieldInvalid(data, 'cttOpp')"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 사업코드 — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="abusC" header="사업코드" sortable style="min-width: 160px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.abusC" type="select" :options="abusCSelectOptions"
                                :invalid="isFieldInvalid(data, 'abusC')" :force-edit="isRowEditing(data)"
                                :readonly="!isRowEditing(data)" placeholder="선택" @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 비목코드 — 수정 모드에서만 CascadeSelect 편집 가능 -->
                    <Column field="ioeC" header="비목코드" sortable style="min-width: 130px">
                        <template #body="{ data }">
                            <!-- 조회 모드: 읽기 전용 텍스트 -->
                            <span
v-if="!isRowEditing(data) && ioeEditingKey !== rowKey(data)" :class="[
                                'inline-block w-full px-2 py-1 rounded cursor-default min-h-[2rem] leading-[2rem]',
                                isFieldInvalid(data, 'ioeC') ? 'ring-1 ring-red-500' : ''
                            ]">
                                {{ data.ioeC ? getIoeDisplayLabel(data.ioeC) : '-' }}
                            </span>
                            <!-- 편집 모드: CascadeSelect
                                 @click.stop/@mousedown.stop/@pointerdown.stop: DataTable 이벤트 차단
                                 appendTo="body": overlay를 DataTable DOM 외부에 렌더링하여
                                                  click-outside 오감지로 인한 두 번 클릭 문제 방지
                                 model-value=null: 기존 선택값을 model-value로 전달하면 CascadeSelect가
                                                   드롭다운 열릴 때 해당 경로를 미리 펼쳐두어 첫 클릭이
                                                   "포커스 이동"으로 처리됨 → 두 번 클릭 문제 발생.
                                                   표시는 #value 슬롯의 data.ioeC 분기가 담당하므로 무방. -->
                            <div v-else class="ioe-cascade-cell" @click.stop @mousedown.stop @pointerdown.stop>
                                <CascadeSelect
:model-value="null"
                                    :options="ioeCascadeOptions" option-label="label" option-group-label="label"
                                    option-group-children="items" placeholder="비목코드 선택" fluid
                                    append-to="body"
                                    :invalid="isFieldInvalid(data, 'ioeC')"
                                    @update:model-value="(v) => onIoeCSelect(data, v)">
                                    <!-- 선택된 값: 마지막 세그먼트만 표시 (예: 국내전산임차료) -->
                                    <template #value="{ value }">
                                        <template v-if="value?.cdId">{{ getIoeDisplayLabel(value.cdId) }}</template>
                                        <template v-else-if="data.ioeC">{{ getIoeDisplayLabel(data.ioeC) }}</template>
                                        <span v-else class="text-zinc-400">비목코드 선택</span>
                                    </template>
                                    <!-- 옵션 항목: 이름 + 코드설명(cdva) -->
                                    <template #option="{ option }">
                                        <div class="py-0.5">
                                            <div class="font-medium text-sm">{{ option.label }}</div>
                                            <div v-if="option.cdva" class="text-xs text-zinc-400 mt-0.5">{{ option.cdva
                                                }}
                                            </div>
                                        </div>
                                    </template>
                                </CascadeSelect>
                            </div>
                        </template>
                    </Column>

                    <!-- 예산: 금융정보단말기는 disabled — 수정 버튼 클릭 후 편집 가능
                         통화 단위는 옆 컬럼에서 따로 표시하므로 여기서는 숫자만 노출, 오른쪽 정렬 -->
                    <Column
field="itMngcBg" header="예산" sortable style="min-width: 120px"
                        body-style="text-align: right">
                        <template #body="{ data }">
                            <!-- 예산: 모든 행 읽기 전용
                                 단말기 → terminals 합계 원화 환산
                                 일반 외화 → itMngcBg × 환율(xcr 우선, 없으면 공통환율) 원화 환산
                                 일반 KRW  → itMngcBg 그대로 -->
                            <span
                                v-tooltip.top="budgetTooltip(data)"
                                class="terminal-readonly-cell inline-block w-full text-right text-zinc-400 cursor-not-allowed">
                                {{ budgetKrwDisplay(data).toLocaleString() }}
                            </span>
                        </template>
                    </Column>

                    <!-- 통화: 금융정보단말기는 disabled — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="cur" header="통화" sortable style="width: 90px">
                        <template #body="{ data }">
                            <div class="cur-col">
                                <span
v-if="isTerminal(data)" v-tooltip.top="TERMINAL_TOOLTIP"
                                    class="terminal-readonly-cell inline-block w-full text-center text-zinc-400 cursor-not-allowed">
                                    KRW
                                </span>
                                <InlineEditCell
v-else v-model="data.cur" type="select" :options="curSelectOptions"
                                    :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                    @save="markDirty(data)" />
                            </div>
                        </template>
                    </Column>

                    <!-- 지급주기 — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="dfrCle" header="지급주기" sortable style="width: 100px; min-width: 100px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.dfrCle" type="select" :options="dfrCleSelectOptions"
                                :invalid="isFieldInvalid(data, 'dfrCle')" :force-edit="isRowEditing(data)"
                                :readonly="!isRowEditing(data)" placeholder="선택" class="text-center"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 최초지급일 — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="fstDfrDt" header="최초지급일" sortable style="min-width: 80px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.fstDfrDt" type="date" view="month" date-format="yy-mm"
                                placeholder="최초지급일" :invalid="isFieldInvalid(data, 'fstDfrDt')"
                                :force-edit="isRowEditing(data)" :readonly="!isRowEditing(data)"
                                @save="markDirty(data)" />
                        </template>
                    </Column>

                    <!-- 담당자 (AutoComplete + 직원조회 버튼) — 수정 버튼 클릭 후 편집 가능 -->
                    <Column field="cgprNm" header="담당자" sortable style="min-width: 80px; width: 140px">
                        <template #body="{ data }">
                            <InlineEditCell
v-model="data.cgprNm" type="autocomplete" :suggestions="employeeSuggestions"
                                option-label="usrNm" :placeholder="data.cgprNm || '이름 검색'" :show-search="true"
                                :invalid="isFieldInvalid(data, 'cgpr')" :force-edit="isRowEditing(data)"
                                :readonly="!isRowEditing(data)" @complete="searchEmployee"
                                @item-select="onEmployeeSelect(data, $event.value)"
                                @search-click="openEmployeeSearch(data)" @save="onCgprBlur(data)">
                                <template #option="{ option }">
                                    <div class="py-1.5 pl-2.5 border-l-[3px] border-blue-900">
                                        <div class="leading-tight">
                                            <div class="flex items-baseline gap-1.5">
                                                <span class="font-semibold text-sm">{{ option.usrNm }}</span>
                                                <span class="text-[11px] text-surface-400">{{ option.eno }}</span>
                                                <span v-if="option.ptCNm" class="text-xs text-primary/70">{{
                                                    option.ptCNm }}</span>
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
                            </InlineEditCell>
                        </template>
                    </Column>

                    <!-- 결재현황 -->
                    <Column field="apfSts" header="결재현황" sortable style="width: 100px; text-align: center">
                        <template #body="{ data }">
                            <Tag
:value="data.apfSts || '예산 작성'" :class="getApprovalTagClass(data.apfSts || '예산 작성')"
                                rounded />
                        </template>
                    </Column>

                    <!-- 상세: 금융정보단말기만 단말기 상세목록 다이얼로그 버튼 표시
                         저장된 행: API 모드 / 미저장 신규 행: 로컬 모드 -->
                    <Column header="상세" style="width: 60px; text-align: center">
                        <template #body="{ data }">
                            <Button
v-if="isTerminal(data)" v-tooltip.top="'금융정보단말기 상세목록'" icon="pi pi-list" text rounded
                                size="small"
                                @click="data.itMngcNo ? openTerminalDialog(data.itMngcNo) : openLocalTerminalDialog(data)" />
                        </template>
                    </Column>

                    <!-- 삭제/복구 액션 컬럼: 수정 모드에서만 노출
                         - 일반 행: 휴지통 아이콘 (삭제 마크 부여)
                         - 삭제 표시된 행: 복구 아이콘 (pi-undo) — 클릭 시 삭제 마크 해제 (deleteRow 내부 토글 로직) -->
                    <Column v-if="viewMode === 'edit'" header="" style="width: 48px; text-align: center">
                        <template #body="{ data }">
                            <Button
v-if="rowStatus(data) === 'deleted'" v-tooltip.top="'복구'" icon="pi pi-undo" text
                                rounded size="small" severity="success" @click="deleteRow(data)" />
                            <Button
v-else v-tooltip.top="'삭제'" icon="pi pi-trash" text rounded size="small"
                                severity="danger" @click="deleteRow(data)" />
                        </template>
                    </Column>
                </StyledDataTable>
            </div>
        </TableCard>

        <!-- 계속 계약 전년도 데이터 불러오기 확인 다이얼로그 -->
        <Dialog
v-model:visible="continuationDialogVisible" modal header="전년도 계약 불러오기" :style="{ width: 'var(--dialog-sm)' }"
            :closable="false">
            <div class="space-y-4 py-2">
                <p class="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    전년도 계약 데이터를 현재 행에 불러옵니다.<br>
                    최초지급일은 전년도 기준 <strong>+1년</strong>으로 자동 설정되며,
                    나머지 항목은 전년도와 동일하게 채워집니다.
                </p>
                <div
v-if="continuationPending"
                    class="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2 text-sm">
                    <div class="flex justify-between gap-2">
                        <span class="text-zinc-500 shrink-0">계약명</span>
                        <span class="font-semibold text-right">{{ continuationPending.source.cttNm }}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-zinc-500 shrink-0">계약상대처</span>
                        <span class="text-right">{{ continuationPending.source.cttOpp }}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-zinc-500 shrink-0">전년도 예산연도</span>
                        <span>{{ continuationPending.source.bgYy }}년</span>
                    </div>
                    <div
v-if="continuationPending.source.itMngcTp === 'IT_MNGC_TP_002'"
                        class="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700 text-indigo-600 dark:text-indigo-400">
                        <i class="pi pi-info-circle text-sm" />
                        <span>단말기 상세목록도 함께 불러옵니다.</span>
                    </div>
                </div>
            </div>
            <template #footer>
                <AppDialogFooter>
                    <Button
label="취소" severity="secondary" outlined
                        @click="continuationDialogVisible = false; continuationPending = null" />
                    <Button label="불러오기" icon="pi pi-download" @click="applyContinuation" />
                </AppDialogFooter>
            </template>
        </Dialog>

        <!-- 직원조회 다이얼로그 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" @select="onDialogEmployeeSelect" />

        <!-- 단말기 상세목록 다이얼로그
             local-cost가 제공되면 로컬 모드(API 저장 없음), 없으면 API 모드 -->
        <TerminalFormDialog
v-model:visible="terminalDialogVisible" :it-mngc-no="terminalDialogItMngcNo"
            :parent-cost-id="terminalDialogParentCostId" :bg-yy="terminalDialogBgYy"
            :local-cost="terminalDialogLocalCost ?? undefined"
            @saved="onTerminalSaved"
            @update:local-terminals="onLocalTerminalsUpdate" />

        <!-- 단말기 작성 여부 확인 다이얼로그 -->
        <Dialog
            v-model:visible="terminalWriteConfirmVisible" modal header="금융정보단말기"
            :style="{ width: '380px' }" :draggable="false">
            <p class="text-sm leading-relaxed py-2">지금 단말기 상세 목록을 작성하시겠습니까?</p>
            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="나중에 작성" severity="secondary" @click="onTerminalWriteLater" />
                    <Button label="지금 작성" @click="onTerminalWriteNow" />
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* 테이블 헤더 텍스트 가운데 정렬 */
:deep(.p-datatable-header-cell) {
    text-align: center;
    color: white !important;
    border-color: rgba(255, 255, 255, 0.2);
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
}

:deep(.p-datatable-column-header-content) {
    justify-content: center;
}

:deep(.p-datatable-header-cell .p-datatable-sort-icon) {
    color: rgba(255, 255, 255, 0.7);
}

:deep(.p-datatable-header-cell[data-p-sorted="true"] .p-datatable-sort-icon) {
    color: white;
}

/* 셀 내부 input이 컬럼 너비에 맞게 축소되도록 처리 */
:deep(.p-datatable-body-cell) {
    overflow: hidden;
}

:deep(.p-datatable-body-cell .p-inputnumber),
:deep(.p-datatable-body-cell .p-inputnumber input) {
    width: 100%;
    min-width: 0;
}

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

/* 통화 컬럼 가운데 정렬 */
.cur-col {
    text-align: center;
}
.cur-col :deep(.p-select-label) {
    text-align: center !important;
}

/* 단말기 비활성 필드 툴팁 한 줄 표시 (teleport 대상이라 :global 필수) */
:global(.p-tooltip) {
    max-width: 450px !important;
}

:global(.p-tooltip .p-tooltip-text) {
    max-width: 450px !important;
    white-space: nowrap;
}
</style>

<!--
    ================================================================================
    엑셀 스타일 셀 선택 전용 전역 스타일 (non-scoped)
    - useTableCellSelection composable이 DOM 조작으로 `cell-selected` / `cell-anchor`
      클래스를 <td>에 직접 부착하므로 scoped 해시가 적용된 셀렉터로는 매칭되지 않습니다.
    - 따라서 여기는 non-scoped <style>로 분리하여 전역 규칙으로 노출합니다.
    ================================================================================
-->
<style>
/* 셀 선택/드래그/복사 스타일은 StyledDataTable.vue의 .kdb-it-table 규칙으로 이관됨 */

/* ────────────────────────────────────────────────────────────────
   수정 모드 (mode-edit): 셀 내부의 모든 PrimeVue 입력 폼 테두리를 숨겨
   "모든 셀이 바로 입력 가능한 스프레드시트" 느낌을 제공합니다.
   - 아웃라인/박스섀도우/링도 함께 제거해 포커스 시에도 깔끔하게 유지
   - 배경색은 건드리지 않아 invalid/hover 등 기존 상태 표시는 보존
   ──────────────────────────────────────────────────────────────── */
.mode-edit :is(.p-inputtext,
    .p-inputnumber,
    .p-inputnumber-input,
    .p-select,
    .p-datepicker,
    .p-datepicker-input,
    .p-autocomplete,
    .p-autocomplete-input,
    .p-cascadeselect) {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}

.mode-edit :is(.p-inputtext,
    .p-inputnumber-input,
    .p-datepicker-input,
    .p-autocomplete-input):focus,
.mode-edit :is(.p-select,
    .p-datepicker,
    .p-autocomplete,
    .p-cascadeselect).p-focus {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}

/* DatePicker 달력 아이콘 버튼: 배경/보더 제거하여 주변 입력 폼과 톤 일치 */
.mode-edit .p-datepicker-button,
.mode-edit .p-datepicker-dropdown {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
}

.mode-edit .p-datepicker-button:hover,
.mode-edit .p-datepicker-dropdown:hover {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
}

/* ────────────────────────────────────────────────────────────────
   테이블 여백 압축
   - 셀(td) 상하/좌우 패딩 축소 → 행 간격이 좁아져 한 화면에 더 많은 정보 표시
   - 각 PrimeVue 입력 폼의 내부 패딩과 min-height 축소 → 폼이 셀에 꽉 차게 맞춰짐
   - 헤더 셀도 비례로 축소
   ──────────────────────────────────────────────────────────────── */

/* 페이지 특화: 셀 패딩 밀도 조정 (표준 테이블보다 촘촘하게 표시)
   PrimeVue는 `.p-datatable-tbody > tr > td { padding: var(--p-datatable-body-cell-padding); }`
   형태로 CSS 변수를 통해 padding을 주입하므로, 클래스 selector로는 override가 안 된다.
   CSS 변수 자체를 덮어쓰는 방식으로 패딩을 축소한다.
   ※ 공통 flex 레이아웃(화면 채움) + paginator 스타일은 StyledDataTable 내부로 이관됨 */
.cost-table .kdb-it-table {
    --p-datatable-body-cell-padding: 0.05rem 0.2rem;
    --p-datatable-header-cell-padding: 0.2rem 0.3rem;
}

.cost-table .kdb-it-table .p-datatable-tbody>tr>td {
    padding: 0.4rem 0.4rem !important;
}

.cost-table .kdb-it-table .p-datatable-thead>tr>th {
    padding: 0.4rem 0.4rem !important;
}

/* 예산 셀: InputNumber 내부 <input>의 text-align을 오른쪽으로 강제
   (InlineEditCell 래퍼에 text-right를 걸어도 PrimeVue 내부 input까지는 전파되지 않음) */
.cost-table .inline-edit-cell.budget-cell .p-inputnumber-input,
.cost-table .inline-edit-cell.budget-cell input {
    text-align: right !important;
}

/* 선택 컬럼 체크박스: td 내부에서 체크박스 래퍼를 가운데 배치 */
.cost-table .kdb-it-table .p-datatable-tbody>tr>td .p-checkbox {
    margin-left: auto;
    margin-right: auto;
}

/* 입력 폼 내부 패딩/높이 축소 */
.cost-table :is(.p-inputtext,
    .p-inputnumber-input,
    .p-datepicker-input,
    .p-autocomplete-input,
    .p-select-label,
    .p-cascadeselect-label) {
    padding-top: 0.15rem !important;
    padding-bottom: 0.15rem !important;
    padding-left: 0.4rem !important;
    padding-right: 0.4rem !important;
    min-height: 1.6rem !important;
    line-height: 1.25 !important;
}

/* Select / CascadeSelect 드롭다운 아이콘 영역 폭 축소 */
.cost-table :is(.p-select-dropdown, .p-cascadeselect-dropdown) {
    width: 1.6rem !important;
}

/* DatePicker 아이콘 버튼 폭/패딩 축소 */
.cost-table .p-datepicker-button,
.cost-table .p-datepicker-dropdown {
    width: 1.6rem !important;
    padding: 0 !important;
    min-width: 1.6rem !important;
}

/* InlineEditCell 조회 모드 span 여백 축소 (px-2 py-1 min-h-[2rem] 오버라이드) */
.cost-table .inline-edit-cell>span {
    padding: 0.15rem 0.4rem !important;
    min-height: 1.6rem !important;
    line-height: 1.25 !important;
}

/* 테이블 body 셀 내 모든 inline-block span 높이 정규화
   — InlineEditCell 밖에 독립 렌더링되는 span(예: 비목코드 조회 span)도 포함
   — min-h-[2rem] Tailwind 클래스가 남아 조회 모드 행이 편집 모드보다 높아지는 현상 방지 */
.cost-table .kdb-it-table .p-datatable-tbody > tr > td span.inline-block {
    min-height: 1.6rem !important;
    line-height: 1.25 !important;
}

/* 금융정보단말기(IT_MNGC_TP_002) 행의 읽기 전용 셀: InlineEditCell 조회 스팬과 동일한 높이/패딩 적용
   (수정 모드에서 IT_MNGC_TP_001 행보다 행 높이가 크게 보이는 문제 해결) */
.cost-table .terminal-readonly-cell {
    padding: 0.15rem 0.4rem !important;
    min-height: 1.6rem !important;
    line-height: 1.25 !important;
}

/* Checkbox 셀 내부 여백 축소 */
.cost-table .terminal-checkbox-cell .p-1 {
    padding: 0.1rem !important;
}

/* 행삭제 표시 행(row-deleted) 공통 스타일은 StyledDataTable.vue에 이관됨.
   rowClass 함수가 'row-deleted'를 반환하면 자동으로 회색+취소선 표시됨 */
</style>

