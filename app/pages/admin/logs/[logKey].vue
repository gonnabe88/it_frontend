<!--
================================================================================
[pages/admin/logs/[logKey].vue] 관리자 상세 로그 조회 화면
================================================================================
TAAABB_*L 로그 테이블을 공통 레이아웃으로 조회하는 화면입니다.

[주요 기능]
  - 로그 테이블별 목록 조회
  - 조회 Drawer 필터 + 통합검색
  - 현재 조회 결과 Excel 내보내기
  - 로그번호 클릭 시 상세내용 다이얼로그 표시
  - 사용자 컬럼 이름 링크 표시 + 직원정보 다이얼로그
  - 2개 행 선택 후 변경사항 비교 다이얼로그 표시
================================================================================
-->
<!-- eslint-disable vue/no-v-html -->
<script setup lang="ts">
/* eslint-disable vue/no-v-html */
import DOMPurify from 'isomorphic-dompurify';
import { exportRowsToExcel } from '~/utils/excel';
import { formatDateTime } from '~/utils/common';
import { ADMIN_LOG_TABLES } from '~/utils/adminLogs';
import { useAdminApi, type AdminLogColumnResponse, type AdminLogDetailResponse } from '~/composables/useAdminApi';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import EmployeeInfoDialog from '~/components/common/EmployeeInfoDialog.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const route = useRoute();
const toast = useToast();
const { fetchLogs, fetchLogDetail } = useAdminApi();

/** 현재 URL의 로그 키 */
const logKey = computed(() => String(route.params.logKey ?? 'bprojm'));

/** API 조회는 한 번에 500건까지 허용하며, 화면 페이지네이션은 클라이언트에서 처리합니다. */
const page = ref(0);
const pageSize = ref(500);
const tableRows = ref(30);

const { data: logData, pending, error, refresh } = await fetchLogs(logKey, page, pageSize);

/** 사이드바 메타와 API 메타를 조합한 현재 테이블 정보 */
const currentMeta = computed(() => {
    return logData.value?.table ?? ADMIN_LOG_TABLES.find(item => item.key === logKey.value) ?? {
        key: logKey.value,
        title: '상세 로그',
        tableName: '',
        entityName: '',
    };
});

const columns = computed(() => logData.value?.columns ?? []);
const rows = computed(() => logData.value?.content ?? []);
const userNames = computed(() => logData.value?.userNames ?? {});

/* ── 컬럼 설정 ── */
const COLUMN_STORAGE_KEY_PREFIX = 'adminLogs_visibleCols_';
const showColSettings = ref(false);
const visibleColumnFields = ref<string[]>([]);
const loadedColumnKey = ref('');

/** 화면에 표시할 컬럼: 로그번호와 변경 공통 필드를 앞쪽에 고정합니다. */
const orderedColumns = computed(() => {
    const priority = ['logSno', 'chgTp', 'chgDtm', 'chgUsid'];
    return [...columns.value].sort((a, b) => {
        const ai = priority.indexOf(a.field);
        const bi = priority.indexOf(b.field);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return 0;
    });
});

const displayColumns = computed(() => {
    const visible = new Set(visibleColumnFields.value);
    return orderedColumns.value.filter(col => col.primary || visible.has(col.field));
});

const groupedColumnOptions = computed(() => {
    const groups: { name: string; columns: AdminLogColumnResponse[] }[] = [];
    const map = new Map<string, AdminLogColumnResponse[]>();
    for (const col of orderedColumns.value) {
        const groupName = getColumnGroup(col);
        if (!map.has(groupName)) {
            const groupColumns: AdminLogColumnResponse[] = [];
            map.set(groupName, groupColumns);
            groups.push({ name: groupName, columns: groupColumns });
        }
        map.get(groupName)!.push(col);
    }
    return groups;
});

/* ── 조회 조건 ── */
const visibleDrawer = ref(false);
const globalSearch = ref('');
const filters = ref({
    logSno: '',
    chgTp: null as string | null,
    user: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
});

const changeTypeOptions = [
    { label: '생성', value: 'C' },
    { label: '수정', value: 'U' },
    { label: '삭제', value: 'D' },
];

const activeFilterCount = computed(() => {
    const f = filters.value;
    return [f.logSno, f.user].filter(v => v.trim()).length
        + (f.chgTp ? 1 : 0)
        + (f.dateFrom ? 1 : 0)
        + (f.dateTo ? 1 : 0);
});

const resetFilters = () => {
    filters.value = {
        logSno: '',
        chgTp: null,
        user: '',
        dateFrom: null,
        dateTo: null,
    };
    globalSearch.value = '';
};

/** 조회 조건과 통합검색이 반영된 로그 목록 */
const filteredRows = computed(() => {
    const f = filters.value;
    const keyword = globalSearch.value.trim().toLowerCase();
    const from = f.dateFrom ? toDateKey(f.dateFrom) : '';
    const to = f.dateTo ? toDateKey(f.dateTo) : '';
    const userKeyword = f.user.trim().toLowerCase();

    return rows.value.filter(row => {
        if (f.logSno && !String(row.logSno ?? '').toLowerCase().includes(f.logSno.trim().toLowerCase())) return false;
        if (f.chgTp && row.chgTp !== f.chgTp) return false;
        if (from && String(row.chgDtm ?? '').slice(0, 10) < from) return false;
        if (to && String(row.chgDtm ?? '').slice(0, 10) > to) return false;
        if (userKeyword && !displayColumns.value.some(col => col.userField && getUserDisplay(row[col.field]).toLowerCase().includes(userKeyword))) return false;
        if (keyword) {
            const haystack = displayColumns.value
                .map(col => col.userField ? getUserDisplay(row[col.field]) : formatCellValue(row[col.field]))
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(keyword)) return false;
        }
        return true;
    });
});

/* ── 행 선택 및 비교 ── */
const selectedRows = ref<Record<string, unknown>[]>([]);
const compareVisible = ref(false);

const compareRows = computed(() => selectedRows.value.slice(0, 2));
const compareColumns = computed(() => orderedColumns.value.filter(col => {
    if (compareRows.value.length !== 2) return false;
    if (getColumnGroup(col) !== '업무 데이터') return false;
    return formatCellValue(compareRows.value[0]?.[col.field]) !== formatCellValue(compareRows.value[1]?.[col.field]);
}));

const openCompare = () => {
    if (selectedRows.value.length !== 2) {
        toast.add({ severity: 'warn', summary: '비교 조건', detail: '변경사항 비교는 2개의 행을 선택해야 합니다.', life: 3000 });
        return;
    }
    compareVisible.value = true;
};

/* ── 상세 조회 다이얼로그 ── */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref<AdminLogDetailResponse | null>(null);

const openDetail = async (row: Record<string, unknown>) => {
    const logSno = String(row.logSno ?? '');
    if (!logSno) return;
    detailVisible.value = true;
    detailLoading.value = true;
    detailData.value = null;
    try {
        detailData.value = await fetchLogDetail(logKey.value, logSno);
    } catch {
        toast.add({ severity: 'error', summary: '상세 조회 실패', detail: '로그 상세내용을 조회하지 못했습니다.', life: 4000 });
    } finally {
        detailLoading.value = false;
    }
};

/* ── 직원 정보 다이얼로그 ── */
const employeeDialogVisible = ref(false);
const selectedEno = ref<string | null>(null);

const openEmployee = (value: unknown) => {
    const eno = String(value ?? '');
    if (!eno) return;
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/* ── Excel 내보내기 ── */
const downloadExcel = async () => {
    const excelRows = filteredRows.value.map(row => {
        const item: Record<string, string> = {};
        for (const col of displayColumns.value) {
            item[normalizeColumnHeader(col.header)] = col.userField ? getUserDisplay(row[col.field]) : formatCellValue(row[col.field]);
        }
        return item;
    });
    await exportRowsToExcel(
        excelRows,
        currentMeta.value.title,
        `${currentMeta.value.tableName || currentMeta.value.key}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
};

watch(logKey, async () => {
    selectedRows.value = [];
    page.value = 0;
    await refresh();
});

watch([logKey, orderedColumns], ([key, cols]) => {
    if (!cols.length || loadedColumnKey.value === key) return;
    visibleColumnFields.value = loadVisibleColumns(key, cols);
    loadedColumnKey.value = key;
}, { immediate: true });

watch(visibleColumnFields, (fields) => {
    if (!import.meta.client || !loadedColumnKey.value) return;
    localStorage.setItem(COLUMN_STORAGE_KEY_PREFIX + loadedColumnKey.value, JSON.stringify(fields));
}, { deep: true });

function toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function formatChangeType(value: unknown): string {
    switch (value) {
        case 'C': return '생성';
        case 'U': return '수정';
        case 'D': return '삭제';
        default: return String(value ?? '-');
    }
}

function changeTypeSeverity(value: unknown): 'success' | 'info' | 'danger' | 'secondary' {
    switch (value) {
        case 'C': return 'success';
        case 'U': return 'info';
        case 'D': return 'danger';
        default: return 'secondary';
    }
}

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return value.toLocaleString();
    const text = decodeMaybeBase64(String(value));
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return formatDateTime(text);
    return text;
}

function getUserDisplay(value: unknown): string {
    const eno = String(value ?? '');
    if (!eno) return '-';
    const name = userNames.value[eno] ?? detailData.value?.userNames?.[eno];
    return name ? `${name} (${eno})` : eno;
}

function getColumnWidth(col: AdminLogColumnResponse): string {
    if (col.primary) return '220px';
    if (isHtmlColumn(col)) return '300px';
    if (col.field.endsWith('Dtm')) return '170px';
    if (col.userField) return '140px';
    if (['chgTp', 'delYn', 'lstYn'].includes(col.field)) return '90px';
    return '160px';
}

function getCompareRow(index: number): Record<string, unknown> {
    return compareRows.value[index] ?? {};
}

function getCompareCell(index: number, field: string, userField: boolean): string {
    const value = getCompareRow(index)[field];
    return userField ? getUserDisplay(value) : formatCellValue(value);
}

function normalizeColumnHeader(header: string): string {
    return header.replaceAll('자사번', '자').replaceAll('사번', '').trim();
}

function getColumnHeader(col: AdminLogColumnResponse): string {
    return normalizeColumnHeader(col.header);
}

function getColumnStyle(col: AdminLogColumnResponse): Record<string, string> {
    const width = getColumnWidth(col);
    return { width, maxWidth: '300px' };
}

function getColumnGroup(col: AdminLogColumnResponse): string {
    if (['logSno', 'chgTp', 'chgDtm', 'chgUsid'].includes(col.field)) return '변경정보';
    if (['delYn', 'guid', 'guidPrgSno', 'fstEnrDtm', 'fstEnrUsid', 'lstChgDtm', 'lstChgUsid'].includes(col.field)) return '등록/수정 스냅샷';
    return '업무 데이터';
}

function loadVisibleColumns(key: string, cols: AdminLogColumnResponse[]): string[] {
    if (import.meta.client) {
        const saved = localStorage.getItem(COLUMN_STORAGE_KEY_PREFIX + key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(field => cols.some(col => col.field === field));
            } catch {
                // 저장값 파싱 실패 시 기본 컬럼으로 복원합니다.
            }
        }
    }
    return cols.map(col => col.field);
}

function toggleColumn(field: string) {
    const required = orderedColumns.value.find(col => col.field === field)?.primary;
    if (required) return;
    const fields = [...visibleColumnFields.value];
    const idx = fields.indexOf(field);
    if (idx >= 0) fields.splice(idx, 1);
    else fields.push(field);
    visibleColumnFields.value = fields;
}

function toggleColumnGroup(group: { name: string; columns: AdminLogColumnResponse[] }) {
    const togglableFields = group.columns.filter(col => !col.primary).map(col => col.field);
    const allChecked = togglableFields.every(field => visibleColumnFields.value.includes(field));
    if (allChecked) {
        visibleColumnFields.value = visibleColumnFields.value.filter(field => !togglableFields.includes(field));
        return;
    }
    visibleColumnFields.value = [...new Set([...visibleColumnFields.value, ...togglableFields])];
}

function isColumnChecked(col: AdminLogColumnResponse): boolean {
    return col.primary || visibleColumnFields.value.includes(col.field);
}

function isGroupAllChecked(group: { name: string; columns: AdminLogColumnResponse[] }): boolean {
    return group.columns.every(isColumnChecked);
}

function isGroupPartial(group: { name: string; columns: AdminLogColumnResponse[] }): boolean {
    return !isGroupAllChecked(group) && group.columns.some(isColumnChecked);
}

function selectAllColumns() {
    visibleColumnFields.value = orderedColumns.value.map(col => col.field);
}

function resetVisibleColumns() {
    visibleColumnFields.value = orderedColumns.value
        .filter(col => col.primary || ['logSno', 'chgTp', 'chgDtm', 'chgUsid'].includes(col.field))
        .map(col => col.field);
}

function isHtmlColumn(col: AdminLogColumnResponse): boolean {
    const htmlFieldsByLog: Record<string, string[]> = {
        bprojm: ['prjDes', 'prjRng'],
        bgdocm: ['docCone'],
        brdocm: ['reqCone'],
        brivgm: ['ivgCone', 'qtdCone'],
    };
    return htmlFieldsByLog[logKey.value]?.includes(col.field) ?? false;
}

function looksLikeHtml(value: unknown): boolean {
    const text = formatCellValue(value);
    return /<\/?[a-z][\s\S]*>/i.test(text);
}

function getSanitizedHtml(value: unknown): string {
    const html = formatCellValue(value);
    return DOMPurify.sanitize(html === '-' ? '' : html);
}

function decodeMaybeBase64(value: string): string {
    if (!/^[a-z0-9+/]+={0,2}$/i.test(value) || value.length < 12 || value.length % 4 !== 0) {
        return value;
    }
    try {
        const binary = atob(value);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        return decoded.includes('\u0000') ? value : decoded;
    } catch {
        return value;
    }
}
</script>

<template>
    <div class="flex flex-col h-full gap-6">
        <PageHeader :title="currentMeta.title" :subtitle="`${currentMeta.tableName} — 상세 변경 로그 조회`">
            <template #actions>
                <div class="relative inline-flex">
                    <Button label="조회" icon="pi pi-search" severity="secondary" outlined @click="visibleDrawer = true" />
                    <Badge v-if="activeFilterCount > 0" :value="activeFilterCount" severity="danger" class="absolute -top-2 -right-2" />
                </div>
                <Button label="컬럼 설정" icon="pi pi-cog" severity="secondary" outlined @click="showColSettings = true" />
                <Button label="Excel 내보내기" icon="pi pi-file-excel" severity="secondary" outlined @click="downloadExcel" />
                <Button
                    label="변경사항 비교"
                    icon="pi pi-code"
                    severity="secondary"
                    outlined
                    :disabled="selectedRows.length !== 2"
                    @click="openCompare"
                />
            </template>
        </PageHeader>

        <TableCard
            fill
            title="상세 로그 내역"
            icon="pi-history"
            :count="filteredRows.length"
            :subtitle="`최신순 최대 ${pageSize}건 조회${logData?.totalElements ? ` / 전체 ${logData.totalElements.toLocaleString()}건` : ''}`"
        >
            <template #toolbar>
                <Select
                    v-model="tableRows"
                    :options="[{ label: '30건', value: 30 }, { label: '50건', value: 50 }, { label: '100건', value: 100 }]"
                    option-label="label"
                    option-value="value"
                    class="!text-sm w-auto"
                />
                <InputText v-model="globalSearch" placeholder="통합검색" class="w-full max-w-xl" />
                <Button v-tooltip="'새로고침'" icon="pi pi-refresh" severity="secondary" outlined :loading="pending" @click="() => refresh()" />
            </template>

            <div v-if="error" class="p-6 text-center">
                <i class="pi pi-exclamation-circle text-4xl text-red-400 mb-3 block" />
                <p class="text-red-500">로그 데이터를 불러오는 중 오류가 발생했습니다.</p>
                <p class="text-sm text-zinc-400 mt-1">{{ error.message }}</p>
            </div>

            <div v-else class="flex-1 min-h-0 flex flex-col">
                <StyledDataTable
                    v-model:selection="selectedRows"
                    :value="filteredRows"
                    :loading="pending"
                    data-key="logSno"
                    selection-mode="multiple"
                    paginator
                    :rows="tableRows"
                    :rows-per-page-options="[30, 50, 100]"
                    scrollable
                    scroll-height="flex"
                    sort-field="logSno"
                    :sort-order="-1"
                    striped-rows
                >
                    <Column selection-mode="multiple" header-style="width: 3rem" frozen />

                    <Column
                        v-for="col in displayColumns"
                        :key="col.field"
                        :field="col.field"
                        :header="getColumnHeader(col)"
                        sortable
                        :style="getColumnStyle(col)"
                        :frozen="col.primary"
                        :pt="{ bodyCell: { class: 'overflow-hidden' } }"
                    >
                        <template #body="{ data }">
                            <Button
                                v-if="col.primary"
                                :label="formatCellValue(data[col.field])"
                                link
                                class="!p-0 max-w-full !justify-start overflow-hidden whitespace-nowrap"
                                @click.stop="openDetail(data)"
                            />
                            <Tag v-else-if="col.field === 'chgTp'" :value="formatChangeType(data[col.field])" :severity="changeTypeSeverity(data[col.field])" />
                            <button
                                v-else-if="col.userField && data[col.field]"
                                type="button"
                                class="block truncate text-indigo-600 hover:underline"
                                :title="getUserDisplay(data[col.field])"
                                @click.stop="openEmployee(data[col.field])"
                            >
                                {{ getUserDisplay(data[col.field]) }}
                            </button>
                            <!-- DOMPurify로 정제한 제한 필드 HTML만 렌더링합니다. -->
                            <!-- eslint-disable-next-line vue/no-v-html -->
                            <div
                                v-else-if="isHtmlColumn(col) && looksLikeHtml(data[col.field])"
                                class="log-html-cell"
                                :title="formatCellValue(data[col.field])"
                                v-html="getSanitizedHtml(data[col.field])"
                            />
                            <span v-else class="block truncate" :title="formatCellValue(data[col.field])">
                                {{ formatCellValue(data[col.field]) }}
                            </span>
                        </template>
                    </Column>

                    <template #empty>
                        <div class="py-12 text-center text-zinc-400">
                            <i class="pi pi-history text-4xl mb-3 block" />
                            <p>조회된 상세 로그가 없습니다.</p>
                        </div>
                    </template>
                </StyledDataTable>
            </div>
        </TableCard>

        <!-- 조회 Drawer -->
        <Drawer v-model:visible="visibleDrawer" header="상세 로그 조회" position="right" class="!w-full md:!w-[480px]">
            <div class="flex flex-col gap-6">
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">로그번호</label>
                    <InputText v-model="filters.logSno" placeholder="로그번호 포함 문자열" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">변경유형</label>
                    <Select v-model="filters.chgTp" :options="changeTypeOptions" option-label="label" option-value="value" show-clear fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사용자</label>
                    <InputText v-model="filters.user" placeholder="이름 또는 사번" fluid />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">변경일자 시작</label>
                        <DatePicker v-model="filters.dateFrom" date-format="yy-mm-dd" show-icon fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">변경일자 종료</label>
                        <DatePicker v-model="filters.dateTo" date-format="yy-mm-dd" show-icon fluid />
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button label="초기화" icon="pi pi-refresh" severity="secondary" class="flex-1" @click="resetFilters" />
                    <Button label="조회" icon="pi pi-search" class="flex-1" @click="visibleDrawer = false" />
                </div>
            </div>
        </Drawer>

        <!-- 컬럼 설정 Drawer -->
        <Drawer v-model:visible="showColSettings" header="표시할 컬럼 선택" position="right" class="!w-full md:!w-[380px]">
            <div class="flex gap-2 mb-4">
                <Button label="전체 선택" severity="secondary" text size="small" @click="selectAllColumns" />
                <Button label="기본 컬럼" severity="secondary" text size="small" @click="resetVisibleColumns" />
            </div>

            <div v-for="group in groupedColumnOptions" :key="group.name" class="mb-5">
                <div class="flex items-center gap-2 mb-2 cursor-pointer" @click="toggleColumnGroup(group)">
                    <Checkbox
                        :model-value="isGroupAllChecked(group)"
                        :binary="true"
                        :indeterminate="isGroupPartial(group)"
                        @click.stop="toggleColumnGroup(group)"
                    />
                    <span class="font-semibold text-sm text-zinc-700 dark:text-zinc-300">{{ group.name }}</span>
                    <span class="text-xs text-zinc-400">
                        ({{ group.columns.filter(isColumnChecked).length }}/{{ group.columns.length }})
                    </span>
                </div>

                <div
                    v-for="col in group.columns"
                    :key="col.field"
                    :class="[
                        'flex items-center gap-2 py-1.5 pl-6 rounded',
                        col.primary ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    ]"
                    @click="toggleColumn(col.field)"
                >
                    <Checkbox
                        :model-value="isColumnChecked(col)"
                        :binary="true"
                        :disabled="col.primary"
                        @click.stop="toggleColumn(col.field)"
                    />
                    <span class="text-sm">{{ getColumnHeader(col) }}</span>
                    <span v-if="col.primary" class="text-[11px] text-zinc-400">필수</span>
                </div>
            </div>
        </Drawer>

        <!-- 상세내용 조회 다이얼로그 -->
        <Dialog v-model:visible="detailVisible" header="상세내용 조회" modal :style="{ width: 'min(1100px, 96vw)' }">
            <div v-if="detailLoading" class="flex justify-center py-10">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>
            <div v-else-if="detailData" class="max-h-[70vh] overflow-auto">
                <div class="grid grid-cols-[180px_1fr] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden text-sm">
                    <template v-for="col in detailData.columns" :key="col.field">
                        <div class="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 font-medium text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                            {{ getColumnHeader(col) }}
                        </div>
                        <div class="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 break-all">
                            <button
                                v-if="col.userField && detailData.row[col.field]"
                                type="button"
                                class="text-indigo-600 hover:underline"
                                @click="openEmployee(detailData.row[col.field])"
                            >
                                {{ getUserDisplay(detailData.row[col.field]) }}
                            </button>
                            <Tag v-else-if="col.field === 'chgTp'" :value="formatChangeType(detailData.row[col.field])" :severity="changeTypeSeverity(detailData.row[col.field])" />
                            <!-- DOMPurify로 정제한 제한 필드 HTML만 렌더링합니다. -->
                            <!-- eslint-disable-next-line vue/no-v-html -->
                            <div
                                v-else-if="isHtmlColumn(col) && looksLikeHtml(detailData.row[col.field])"
                                class="log-html-detail"
                                v-html="getSanitizedHtml(detailData.row[col.field])"
                            />
                            <span v-else>{{ formatCellValue(detailData.row[col.field]) }}</span>
                        </div>
                    </template>
                </div>
            </div>
            <template #footer>
                <AppDialogFooter>
                    <Button label="닫기" severity="secondary" outlined @click="detailVisible = false" />
                </AppDialogFooter>
            </template>
        </Dialog>

        <!-- 변경사항 비교 다이얼로그 -->
        <Dialog v-model:visible="compareVisible" header="변경사항 비교" modal :style="{ width: 'min(1100px, 96vw)' }">
            <div v-if="compareRows.length === 2" class="max-h-[70vh] overflow-auto">
                <div class="mb-3 text-sm text-zinc-500">
                    {{ formatCellValue(getCompareRow(0).logSno) }} ↔ {{ formatCellValue(getCompareRow(1).logSno) }}
                </div>
                <StyledDataTable :value="compareColumns" data-key="field" scrollable scroll-height="480px" :cell-selectable="false">
                    <Column header="항목" :style="{ width: '180px' }">
                        <template #body="{ data }">
                            {{ getColumnHeader(data) }}
                        </template>
                    </Column>
                    <Column header="선택 1">
                        <template #body="{ data }">
                            <span class="whitespace-pre-wrap break-all">{{ getCompareCell(0, data.field, data.userField) }}</span>
                        </template>
                    </Column>
                    <Column header="선택 2">
                        <template #body="{ data }">
                            <span class="whitespace-pre-wrap break-all">{{ getCompareCell(1, data.field, data.userField) }}</span>
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-10 text-center text-zinc-400">두 로그 행의 값 차이가 없습니다.</div>
                    </template>
                </StyledDataTable>
            </div>
            <template #footer>
                <AppDialogFooter>
                    <Button label="닫기" severity="secondary" outlined @click="compareVisible = false" />
                </AppDialogFooter>
            </template>
        </Dialog>

        <EmployeeInfoDialog v-model:visible="employeeDialogVisible" :eno="selectedEno" />
    </div>
</template>

<style scoped>
.log-html-cell {
    display: block;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.log-html-cell :deep(*) {
    display: inline;
    margin: 0;
    padding: 0;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
}

.log-html-detail {
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
}

.log-html-detail :deep(p) {
    margin: 0 0 0.5rem;
}

.log-html-detail :deep(ul),
.log-html-detail :deep(ol) {
    margin: 0.25rem 0 0.5rem 1.25rem;
}

.log-html-detail :deep(table) {
    max-width: 100%;
    border-collapse: collapse;
}

.log-html-detail :deep(td),
.log-html-detail :deep(th) {
    border: 1px solid rgb(228 228 231);
    padding: 0.25rem 0.5rem;
}
</style>
