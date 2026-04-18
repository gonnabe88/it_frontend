<!--
================================================================================
[pages/budget/status.vue] 예산 현황 페이지
================================================================================
정보화사업, 전산업무비, 경상사업 예산을 3개 탭으로 분리하여 조회하는 페이지입니다.
정보화사업 탭은 편성요청/조정(편성), 전산업무비 탭은 전년도/당해연도 금액을 병렬로 표시합니다.

[주요 기능]
  - 3개 탭: 정보화사업 / 전산업무비 / 경상사업
  - 2단 헤더: ColumnGroup으로 기본정보/편성요청/조정 그룹핑
  - 컬럼 조정: MultiSelect로 표시 컬럼 선택 (localStorage 저장)
  - 고정 컬럼: 사업명(첫 번째 컬럼) 고정 + 가로 스크롤
  - 금액 단위 변환: 원/천원/백만원/억원
  - 엑셀 다운로드

// Design Ref: §4.2 — pages/budget/status.vue 구조
================================================================================
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ExcelJS from 'exceljs'
import DOMPurify from 'isomorphic-dompurify'
import StyledDataTable from '~/components/common/StyledDataTable.vue'
import EmployeeInfoDialog from '~/components/common/EmployeeInfoDialog.vue'
import { useBudgetStatus } from '~/composables/useBudgetStatus'
import { formatBudget as formatBudgetUtil } from '~/utils/common'
import type { ProjectStatusItem, CostStatusItem, OrdinaryStatusItem, ColumnDef } from '~/types/budgetStatus'

definePageMeta({
    title: '예산 현황'
})

/* ── 연도 선택 ── */
const bgYy = ref(new Date().getFullYear().toString())
const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - i
    return { label: `${y}년`, value: String(y) }
})

/* ── 탭 상태 ── */
const activeTab = ref('0')

/* ── 금액 단위 ── */
const unit = ref('백만원')
const unitOptions = ['원', '천원', '백만원', '억원']

/** 금액 포맷 헬퍼 */
const fmt = (val: number | null | undefined) => {
    if (val == null) return '-'
    return formatBudgetUtil(val, unit.value)
}

/* ── 공통코드 코드명 변환 ── */
const { getCodeName: getPrjTpName } = useCodeOptions('PRJ_TP')
const { getCodeName: getPulDttName } = useCodeOptions('PUL_DTT')

/* ── API 호출 ── */
const { fetchProjectStatus, fetchCostStatus, fetchOrdinaryStatus } = useBudgetStatus()
const { data: projectsData, pending: projectsPending } = await fetchProjectStatus(bgYy)
const { data: costsData, pending: costsPending } = await fetchCostStatus(bgYy)
const { data: ordinaryData, pending: ordinaryPending } = await fetchOrdinaryStatus(bgYy)

/** null 안전 처리 */
const projects = computed(() => projectsData.value || [])
const costs = computed(() => costsData.value || [])
const ordinary = computed(() => ordinaryData.value || [])

/* ── 정보화사업 컬럼 정의 ── */
const projectColumns: ColumnDef[] = [
    // 기본정보
    { field: 'prjTp', header: '프로젝트유형', group: '기본정보', align: 'center', width: 100 },
    { field: 'pulDtt', header: '신규/계속', group: '기본정보', align: 'center', width: 80 },
    { field: 'prjDes', header: '사업개요', group: '기본정보', align: 'left', width: 250 },
    { field: 'svnHdq', header: '주관부문', group: '기본정보', align: 'center', width: 100 },
    { field: 'svnDpm', header: '주관부서', group: '기본정보', align: 'center', width: 100 },
    { field: 'svnDpmTlrNm', header: '주관팀장', group: '기본정보', align: 'center', width: 100 },
    { field: 'svnDpmCgprNm', header: '주관담당자', group: '기본정보', align: 'center', width: 100 },
    { field: 'itDpm', header: 'IT담당부서', group: '기본정보', align: 'center', width: 100 },
    { field: 'itDpmTlrNm', header: 'IT담당팀장', group: '기본정보', align: 'center', width: 100 },
    { field: 'itDpmCgprNm', header: 'IT담당자', group: '기본정보', align: 'center', width: 100 },
    { field: 'prjPulPtt', header: '추진가능성', group: '기본정보', align: 'center', width: 80 },
    { field: 'sttDt', header: '시작일자', group: '기본정보', align: 'center', width: 100 },
    { field: 'endDt', header: '종료일자', group: '기본정보', align: 'center', width: 100 },
    // 편성요청
    { field: 'reqDevBg', header: '개발비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqMachBg', header: '기계장치', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqIntanBg', header: '기타무형자산', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqAssetBg', header: '자본예산(소계)', group: '편성요청', align: 'right', width: 130, isCurrency: true },
    { field: 'reqRentBg', header: '전산임차료', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqTravelBg', header: '전산여비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqServiceBg', header: '전산용역비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqMiscBg', header: '전산제비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqCostBg', header: '일반관리비(소계)', group: '편성요청', align: 'right', width: 130, isCurrency: true },
    { field: 'reqTotalBg', header: '총예산(합계)', group: '편성요청', align: 'right', width: 140, isCurrency: true },
    // 기타
    { field: 'rprSts', header: '사전보고', group: '기타', align: 'center', width: 80 },
    { field: 'edrt', header: '전결권', group: '기타', align: 'center', width: 80 },
    // 조정(편성)
    { field: 'adjDevBg', header: '개발비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjMachBg', header: '기계장치', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjIntanBg', header: '기타무형자산', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjAssetBg', header: '자본예산(소계)', group: '조정(편성)', align: 'right', width: 130, isCurrency: true },
    { field: 'adjRentBg', header: '전산임차료', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjTravelBg', header: '전산여비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjServiceBg', header: '전산용역비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjMiscBg', header: '전산제비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjCostBg', header: '일반관리비(소계)', group: '조정(편성)', align: 'right', width: 130, isCurrency: true },
    { field: 'adjTotalBg', header: '총예산(합계)', group: '조정(편성)', align: 'right', width: 140, isCurrency: true },
]

/* ── 전산업무비 컬럼 정의 (REQ-3: 편성요청→전년도, 조정(편성)→당해년도) ── */
/** 전년도/당해연도 그룹 헤더 (연도 선택에 따라 동적) */
const prevYearLabel = computed(() => `${Number(bgYy.value) - 1}년`)
const currYearLabel = computed(() => `${bgYy.value}년`)

/** 전산업무비 컬럼 (연도 동적 그룹 헤더) */
const costColumns = computed<ColumnDef[]>(() => [
    { field: 'pulDtt', header: '신규/계속', group: '기본정보', align: 'center', width: 80 },
    { field: 'abusC', header: '사업코드', group: '기본정보', align: 'center', width: 100 },
    { field: 'ioeC', header: '비목코드', group: '기본정보', align: 'center', width: 100 },
    { field: 'biceDpm', header: '담당부서', group: '기본정보', align: 'center', width: 100 },
    { field: 'biceTem', header: '담당팀', group: '기본정보', align: 'center', width: 100 },
    { field: 'cttOpp', header: '계약업체', group: '기본정보', align: 'left', width: 150 },
    { field: 'infPrtYn', header: '정보보호', group: '기본정보', align: 'center', width: 70 },
    { field: 'itMngcTp', header: '유형', group: '기본정보', align: 'center', width: 80 },
    // 전년도 (이전 편성요청)
    { field: 'reqRentBg', header: '전산임차료', group: prevYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'reqTravelBg', header: '전산여비', group: prevYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'reqServiceBg', header: '전산용역비', group: prevYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'reqMiscBg', header: '전산제비', group: prevYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'reqTotalBg', header: '합계', group: prevYearLabel.value, align: 'right', width: 130, isCurrency: true },
    // 당해연도 (이전 조정/편성)
    { field: 'adjRentBg', header: '전산임차료', group: currYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'adjTravelBg', header: '전산여비', group: currYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'adjServiceBg', header: '전산용역비', group: currYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'adjMiscBg', header: '전산제비', group: currYearLabel.value, align: 'right', width: 120, isCurrency: true },
    { field: 'adjTotalBg', header: '합계', group: currYearLabel.value, align: 'right', width: 130, isCurrency: true },
])

/** 전산업무비 컬럼 필드 목록 (localStorage 용, 정적) */
const costColumnFields = [
    'pulDtt', 'abusC', 'ioeC', 'biceDpm', 'biceTem', 'cttOpp', 'infPrtYn', 'itMngcTp',
    'reqRentBg', 'reqTravelBg', 'reqServiceBg', 'reqMiscBg', 'reqTotalBg',
    'adjRentBg', 'adjTravelBg', 'adjServiceBg', 'adjMiscBg', 'adjTotalBg'
]

/* ── 경상사업 컬럼 정의 ── */
const ordinaryColumns: ColumnDef[] = [
    { field: 'pulDtt', header: '신규/계속', group: '기본정보', align: 'center', width: 80 },
    { field: 'prjDes', header: '사업개요', group: '기본정보', align: 'left', width: 250 },
    // 기계장치
    { field: 'machCur', header: '통화', group: '기계장치', align: 'center', width: 70 },
    { field: 'machQtt', header: '수량', group: '기계장치', align: 'right', width: 80 },
    { field: 'machUnitPrice', header: '단가', group: '기계장치', align: 'right', width: 120, isCurrency: true },
    { field: 'machAmt', header: '금액', group: '기계장치', align: 'right', width: 120, isCurrency: true },
    { field: 'machAmtKrw', header: '금액(원화)', group: '기계장치', align: 'right', width: 130, isCurrency: true },
    // 기타무형자산
    { field: 'intanCur', header: '통화', group: '기타무형자산', align: 'center', width: 70 },
    { field: 'intanQtt', header: '수량', group: '기타무형자산', align: 'right', width: 80 },
    { field: 'intanUnitPrice', header: '단가', group: '기타무형자산', align: 'right', width: 120, isCurrency: true },
    { field: 'intanAmt', header: '금액', group: '기타무형자산', align: 'right', width: 120, isCurrency: true },
    { field: 'intanAmtKrw', header: '금액(원화)', group: '기타무형자산', align: 'right', width: 130, isCurrency: true },
]

/* ── 컬럼 조정 기능 (localStorage 저장) ── */
const STORAGE_KEY_PREFIX = 'budgetStatus_visibleCols_'

/** localStorage에서 저장된 컬럼 설정 로드 */
const loadVisibleCols = (tabKey: string, allCols: ColumnDef[]) => {
    if (import.meta.client) {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + tabKey)
        if (saved) {
            try { return JSON.parse(saved) } catch { /* 무시 */ }
        }
    }
    return allCols.map(c => c.field)
}

const visibleProjectCols = ref<string[]>(loadVisibleCols('project', projectColumns))
const visibleCostCols = ref<string[]>(loadVisibleCols('cost', costColumns.value))
const visibleOrdinaryCols = ref<string[]>(loadVisibleCols('ordinary', ordinaryColumns))

/** 컬럼 설정 변경 시 localStorage 저장 */
watch(visibleProjectCols, (v) => { if (import.meta.client) localStorage.setItem(STORAGE_KEY_PREFIX + 'project', JSON.stringify(v)) }, { deep: true })
watch(visibleCostCols, (v) => { if (import.meta.client) localStorage.setItem(STORAGE_KEY_PREFIX + 'cost', JSON.stringify(v)) }, { deep: true })
watch(visibleOrdinaryCols, (v) => { if (import.meta.client) localStorage.setItem(STORAGE_KEY_PREFIX + 'ordinary', JSON.stringify(v)) }, { deep: true })

/** 필터된 컬럼 목록 */
const filteredProjectCols = computed(() => projectColumns.filter(c => visibleProjectCols.value.includes(c.field)))
const filteredCostCols = computed(() => costColumns.value.filter(c => visibleCostCols.value.includes(c.field)))
const filteredOrdinaryCols = computed(() => ordinaryColumns.filter(c => visibleOrdinaryCols.value.includes(c.field)))

/** 컬럼 설정 Drawer 표시 상태 */
const showColSettings = ref(false)

/** 현재 탭에 따른 컬럼 설정 데이터 */
const currentColOptions = computed(() => {
    if (activeTab.value === '0') return projectColumns
    if (activeTab.value === '1') return costColumns.value
    return ordinaryColumns
})
const currentVisibleCols = computed({
    get: () => {
        if (activeTab.value === '0') return visibleProjectCols.value
        if (activeTab.value === '1') return visibleCostCols.value
        return visibleOrdinaryCols.value
    },
    set: (v) => {
        if (activeTab.value === '0') visibleProjectCols.value = v
        else if (activeTab.value === '1') visibleCostCols.value = v
        else visibleOrdinaryCols.value = v
    }
})

/** 그룹별 컬럼 목록 (Drawer에서 그룹 단위로 표시) */
const groupedColOptions = computed(() => {
    const groups: { name: string; columns: ColumnDef[] }[] = []
    const map = new Map<string, ColumnDef[]>()
    for (const col of currentColOptions.value) {
        const g = col.group || '기타'
        if (!map.has(g)) {
            const arr: ColumnDef[] = []
            map.set(g, arr)
            groups.push({ name: g, columns: arr })
        }
        map.get(g)!.push(col)
    }
    return groups
})

/** 개별 컬럼 토글 */
const toggleCol = (field: string) => {
    const cols = [...currentVisibleCols.value]
    const idx = cols.indexOf(field)
    if (idx >= 0) cols.splice(idx, 1)
    else cols.push(field)
    currentVisibleCols.value = cols
}

/** 그룹 전체 선택/해제 */
const toggleGroup = (group: { name: string; columns: ColumnDef[] }) => {
    const fields = group.columns.map(c => c.field)
    const allChecked = fields.every(f => currentVisibleCols.value.includes(f))
    const cols = [...currentVisibleCols.value]
    if (allChecked) {
        currentVisibleCols.value = cols.filter(f => !fields.includes(f))
    } else {
        const toAdd = fields.filter(f => !cols.includes(f))
        currentVisibleCols.value = [...cols, ...toAdd]
    }
}

/** 그룹 내 모든 컬럼이 선택되었는지 */
const isGroupAllChecked = (group: { name: string; columns: ColumnDef[] }) =>
    group.columns.every(c => currentVisibleCols.value.includes(c.field))

/** 그룹 내 일부 컬럼만 선택되었는지 */
const isGroupPartial = (group: { name: string; columns: ColumnDef[] }) =>
    !isGroupAllChecked(group) && group.columns.some(c => currentVisibleCols.value.includes(c.field))

/* ── 2단 헤더 그룹 (편성요청/조정(편성) + 전년도/당해연도 + 기계장치/기타무형자산만 2행 처리) ── */
const MULTI_ROW_GROUPS = computed(() => [
    '편성요청', '조정(편성)',
    prevYearLabel.value, currYearLabel.value,
    '기계장치', '기타무형자산'
])

/**
 * ColumnGroup 헤더 행 데이터 생성
 * row1: 단일 컬럼은 rowspan=2, 다행 그룹은 colspan + 그룹명
 * row2: 다행 그룹의 세부 헤더만
 */
const buildHeaderRows = (cols: ColumnDef[]) => {
    const row1: { header: string; colspan?: number; rowspan?: number; field?: string; width?: number; align?: string }[] = []
    const row2: { header: string; field: string; width?: number; align?: string }[] = []

    let i = 0
    while (i < cols.length) {
        const col = cols[i]!
        if (col.group && MULTI_ROW_GROUPS.value.includes(col.group)) {
            // 같은 그룹의 연속 컬럼 수 카운트
            const groupName = col.group
            let count = 0
            while (i + count < cols.length && cols[i + count]!.group === groupName) count++
            // row1에 그룹 헤더 (colspan)
            row1.push({ header: groupName, colspan: count })
            // row2에 세부 헤더
            for (let j = 0; j < count; j++) {
                const c = cols[i + j]!
                row2.push({ header: c.header, field: c.field, width: c.width, align: c.align })
            }
            i += count
        } else {
            // rowspan=2 단일 컬럼
            row1.push({ header: col.header, rowspan: 2, field: col.field, width: col.width, align: col.align })
            i++
        }
    }
    return { row1, row2 }
}

const projectHeaderRows = computed(() => buildHeaderRows(filteredProjectCols.value))
const costHeaderRows = computed(() => buildHeaderRows(filteredCostCols.value))
const ordinaryHeaderRows = computed(() => buildHeaderRows(filteredOrdinaryCols.value))

/* ── 고정 컬럼 (사업명/계약명) ── */
const frozenField = computed(() => {
    if (activeTab.value === '1') return 'cttNm'
    return 'prjNm'
})
const frozenHeader = computed(() => {
    if (activeTab.value === '1') return '계약명'
    return '사업명'
})

/* ── 직원 정보 다이얼로그 ── */
const showEmployeeInfo = ref(false)
const selectedEno = ref<string | null>(null)

/** 직원 이름 필드 목록 및 행번 필드 매핑 */
const EMPLOYEE_FIELDS = ['svnDpmTlrNm', 'svnDpmCgprNm', 'itDpmTlrNm', 'itDpmCgprNm'] as const
const EMPLOYEE_ENO_FIELDS: Record<string, string> = {
    svnDpmTlrNm: 'svnDpmTlr',
    svnDpmCgprNm: 'svnDpmCgpr',
    itDpmTlrNm: 'itDpmTlr',
    itDpmCgprNm: 'itDpmCgpr',
}

/** 직원 이름 클릭 시 직원 정보 다이얼로그 열기 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openEmployeeInfo = (data: any, field: string) => {
    const enoField = EMPLOYEE_ENO_FIELDS[field]
    if (enoField && data[enoField]) {
        selectedEno.value = data[enoField]
        showEmployeeInfo.value = true
    }
}

/** 직원 이름 필드인지 여부 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isEmployeeField = (field: string) => EMPLOYEE_FIELDS.includes(field as any)

/* ── 엑셀 다운로드 ── */
const exportExcel = async () => {
    const tabNames = ['정보화사업', '전산업무비', '경상사업']
    const tabName = tabNames[Number(activeTab.value)] || '예산현황'
    const fileName = `예산현황_${tabName}_${bgYy.value}.xlsx`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = []
    let cols: ColumnDef[] = []

    if (activeTab.value === '0') {
        data = projects.value
        cols = [{ field: 'prjNm', header: '사업명' } as ColumnDef, ...filteredProjectCols.value]
    } else if (activeTab.value === '1') {
        data = costs.value
        cols = [{ field: 'cttNm', header: '계약명' } as ColumnDef, ...filteredCostCols.value]
    } else {
        data = ordinary.value
        cols = [{ field: 'prjNm', header: '사업명' } as ColumnDef, ...filteredOrdinaryCols.value]
    }

    // 헤더 행 구성
    const headers = cols.map(c => c.header)
    // 데이터 행 구성
    const rows = data.map(row =>
        cols.map(c => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const val = (row as any)[c.field]
            return val ?? ''
        })
    )

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(tabName)
    ws.addRow(headers)
    rows.forEach(row => ws.addRow(row))
    const buf = await wb.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
}
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">예산 현황</h1>
            <div class="flex items-center gap-2">
                <!-- 연도 선택 -->
                <Select v-model="bgYy" :options="yearOptions" option-label="label" option-value="value" class="w-32" />
                <!-- 금액 단위 -->
                <SelectButton v-model="unit" :options="unitOptions" :allow-empty="false" />
                <!-- 컬럼 설정 -->
                <Button label="컬럼 설정" icon="pi pi-cog" severity="secondary" outlined @click="showColSettings = true" />
                <!-- 엑셀 다운로드 -->
                <Button label="엑셀" icon="pi pi-file-excel" severity="success" outlined @click="exportExcel" />
            </div>
        </div>

        <!-- 탭 -->
        <Tabs v-model:value="activeTab">
            <TabList class="mb-4">
                <Tab value="0">정보화사업</Tab>
                <Tab value="1">전산업무비</Tab>
                <Tab value="2">경상사업</Tab>
            </TabList>

            <!-- 정보화사업 탭 -->
            <TabPanel value="0">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <StyledDataTable
                        :value="projects" :loading="projectsPending" scrollable scroll-height="70vh"
                        data-key="prjMngNo" striped-rows>
                        <!-- 2단 헤더 그룹 -->
                        <ColumnGroup type="header">
                            <Row>
                                <Column header="사업명" :rowspan="2" frozen style="min-width: 200px" />
                                <template v-for="(h, idx) in projectHeaderRows.row1" :key="'pr1-' + idx">
                                    <Column
                                        :header="h.header" :colspan="h.colspan" :rowspan="h.rowspan"
                                        :style="{ minWidth: h.width ? h.width + 'px' : undefined, textAlign: h.align || 'left' }" />
                                </template>
                            </Row>
                            <Row v-if="projectHeaderRows.row2.length">
                                <template v-for="(h, idx) in projectHeaderRows.row2" :key="'pr2-' + idx">
                                    <Column
                                        :header="h.header"
                                        :style="{ minWidth: h.width ? h.width + 'px' : undefined, textAlign: h.align || 'left' }" />
                                </template>
                            </Row>
                        </ColumnGroup>
                        <!-- 고정 컬럼: 사업명 (클릭 시 상세 화면 이동) -->
                        <Column field="prjNm" frozen style="min-width: 200px">
                            <template #body="{ data }">
                                <NuxtLink
                                    :to="`/info/projects/${(data as ProjectStatusItem).prjMngNo}`"
                                    class="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">
                                    {{ (data as ProjectStatusItem).prjNm }}
                                </NuxtLink>
                            </template>
                        </Column>
                        <!-- 동적 컬럼 -->
                        <Column
v-for="col in filteredProjectCols" :key="col.field" :field="col.field"
                            :style="{ minWidth: (col.width || 100) + 'px', textAlign: col.align || 'left' }">
                            <template #body="{ data }">
                                <template v-if="col.isCurrency">
                                    <span class="block text-right">{{ fmt((data as any)[col.field]) }}</span>
                                </template>
                                <template v-else-if="col.field === 'prjTp'">
                                    {{ getPrjTpName((data as ProjectStatusItem).prjTp) }}
                                </template>
                                <template v-else-if="col.field === 'pulDtt'">
                                    {{ getPulDttName((data as ProjectStatusItem).pulDtt) }}
                                </template>
                                <template v-else-if="col.field === 'svnDpm'">
                                    {{ (data as ProjectStatusItem).svnDpmNm ?? (data as ProjectStatusItem).svnDpm }}
                                </template>
                                <template v-else-if="col.field === 'itDpm'">
                                    {{ (data as ProjectStatusItem).itDpmNm ?? (data as ProjectStatusItem).itDpm }}
                                </template>
                                <template v-else-if="col.field === 'prjPulPtt'">
                                    {{ (data as ProjectStatusItem).prjPulPtt != null ? (data as
                                    ProjectStatusItem).prjPulPtt + '%' : '-' }}
                                </template>
                                <template v-else-if="isEmployeeField(col.field)">
                                    <a
v-if="(data as any)[col.field]"
                                        class="text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300"
                                        @click="openEmployeeInfo(data, col.field)">
                                        {{ (data as any)[col.field] }}
                                    </a>
                                    <span v-else>-</span>
                                </template>
                                <template v-else-if="col.field === 'prjDes'">
                                    <div class="line-clamp-2" v-html="DOMPurify.sanitize((data as any).prjDes || '')" />
                                </template>
                                <template v-else>
                                    {{ (data as any)[col.field] ?? '-' }}
                                </template>
                            </template>
                        </Column>
                    </StyledDataTable>
                </div>
            </TabPanel>

            <!-- 전산업무비 탭 -->
            <TabPanel value="1">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <StyledDataTable
                        :value="costs" :loading="costsPending" scrollable scroll-height="70vh"
                        data-key="itMngcNo" striped-rows>
                        <!-- 2단 헤더 그룹 -->
                        <ColumnGroup type="header">
                            <Row>
                                <Column header="계약명" :rowspan="2" frozen style="min-width: 200px" />
                                <template v-for="(h, idx) in costHeaderRows.row1" :key="'cr1-' + idx">
                                    <Column
                                        :header="h.header" :colspan="h.colspan" :rowspan="h.rowspan"
                                        :style="{ minWidth: h.width ? h.width + 'px' : undefined, textAlign: h.align || 'left' }" />
                                </template>
                            </Row>
                            <Row v-if="costHeaderRows.row2.length">
                                <template v-for="(h, idx) in costHeaderRows.row2" :key="'cr2-' + idx">
                                    <Column
                                        :header="h.header"
                                        :style="{ minWidth: h.width ? h.width + 'px' : undefined, textAlign: h.align || 'left' }" />
                                </template>
                            </Row>
                        </ColumnGroup>
                        <!-- 고정 컬럼: 계약명 (클릭 시 상세 화면 이동) -->
                        <Column field="cttNm" frozen style="min-width: 200px">
                            <template #body="{ data }">
                                <NuxtLink
                                    :to="`/info/cost/${(data as CostStatusItem).itMngcNo}`"
                                    class="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">
                                    {{ (data as CostStatusItem).cttNm }}
                                </NuxtLink>
                            </template>
                        </Column>
                        <Column
                            v-for="col in filteredCostCols" :key="col.field" :field="col.field"
                            :style="{ minWidth: (col.width || 100) + 'px', textAlign: col.align || 'left' }">
                            <template #body="{ data }">
                                <template v-if="col.isCurrency">
                                    <span class="block text-right">{{ fmt((data as any)[col.field]) }}</span>
                                </template>
                                <template v-else-if="col.field === 'pulDtt'">
                                    {{ getPulDttName((data as CostStatusItem).pulDtt) }}
                                </template>
                                <template v-else>
                                    {{ (data as any)[col.field] ?? '-' }}
                                </template>
                            </template>
                        </Column>
                    </StyledDataTable>
                </div>
            </TabPanel>

            <!-- 경상사업 탭 -->
            <TabPanel value="2">
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <StyledDataTable
                        :value="ordinary" :loading="ordinaryPending" scrollable scroll-height="70vh"
                        data-key="prjMngNo" striped-rows>
                        <!-- 2단 헤더 그룹 -->
                        <ColumnGroup type="header">
                            <Row>
                                <Column header="사업명" :rowspan="2" frozen style="min-width: 200px" />
                                <template v-for="(h, idx) in ordinaryHeaderRows.row1" :key="'or1-' + idx">
                                    <Column
                                        :header="h.header" :colspan="h.colspan" :rowspan="h.rowspan"
                                        :style="{ minWidth: h.width ? h.width + 'px' : undefined, textAlign: h.align || 'left' }" />
                                </template>
                            </Row>
                            <Row v-if="ordinaryHeaderRows.row2.length">
                                <template v-for="(h, idx) in ordinaryHeaderRows.row2" :key="'or2-' + idx">
                                    <Column
                                        :header="h.header"
                                        :style="{ minWidth: h.width ? h.width + 'px' : undefined, textAlign: h.align || 'left' }" />
                                </template>
                            </Row>
                        </ColumnGroup>
                        <!-- 고정 컬럼: 사업명 (클릭 시 상세 화면 이동) -->
                        <Column field="prjNm" frozen style="min-width: 200px">
                            <template #body="{ data }">
                                <NuxtLink
                                    :to="`/info/projects/${(data as OrdinaryStatusItem).prjMngNo}`"
                                    class="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">
                                    {{ (data as OrdinaryStatusItem).prjNm }}
                                </NuxtLink>
                            </template>
                        </Column>
                        <Column
                            v-for="col in filteredOrdinaryCols" :key="col.field" :field="col.field"
                            :style="{ minWidth: (col.width || 100) + 'px', textAlign: col.align || 'left' }">
                            <template #body="{ data }">
                                <template v-if="col.isCurrency">
                                    <span class="block text-right">{{ fmt((data as any)[col.field]) }}</span>
                                </template>
                                <template v-else-if="col.field === 'pulDtt'">
                                    {{ getPulDttName((data as OrdinaryStatusItem).pulDtt) }}
                                </template>
                                <template v-else-if="col.field === 'prjDes'">
                                    <div class="line-clamp-2" v-html="DOMPurify.sanitize((data as any).prjDes || '')" />
                                </template>
                                <template v-else>
                                    {{ (data as any)[col.field] ?? '-' }}
                                </template>
                            </template>
                        </Column>
                    </StyledDataTable>
                </div>
            </TabPanel>
        </Tabs>

        <!-- 컬럼 설정 Drawer (우측) -->
        <Drawer v-model:visible="showColSettings" header="표시할 컬럼 선택" position="right" :style="{ width: '340px' }">
            <!-- 전체 선택 / 전체 해제 버튼 -->
            <div class="flex gap-2 mb-4">
                <Button
label="전체 선택" severity="secondary" text size="small"
                    @click="currentVisibleCols = currentColOptions.map(c => c.field)" />
                <Button
label="전체 해제" severity="secondary" text size="small"
                    @click="currentVisibleCols = []" />
            </div>

            <!-- 그룹별 컬럼 체크박스 -->
            <div v-for="group in groupedColOptions" :key="group.name" class="mb-4">
                <!-- 그룹 헤더 (전체 토글) -->
                <div class="flex items-center gap-2 mb-2 cursor-pointer" @click="toggleGroup(group)">
                    <Checkbox
:model-value="isGroupAllChecked(group)" :binary="true"
                        :indeterminate="isGroupPartial(group)" @click.stop="toggleGroup(group)" />
                    <span class="font-semibold text-sm text-zinc-700 dark:text-zinc-300">{{ group.name }}</span>
                    <span class="text-xs text-zinc-400">({{ group.columns.filter(c => currentVisibleCols.includes(c.field)).length }}/{{ group.columns.length }})</span>
                </div>
                <!-- 개별 컬럼 -->
                <div
v-for="col in group.columns" :key="col.field"
                    class="flex items-center gap-2 py-1 pl-6 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded"
                    @click="toggleCol(col.field)">
                    <Checkbox
:model-value="currentVisibleCols.includes(col.field)" :binary="true"
                        @click.stop="toggleCol(col.field)" />
                    <span class="text-sm">{{ col.header }}</span>
                </div>
            </div>
        </Drawer>

        <!-- 직원 정보 다이얼로그 -->
        <EmployeeInfoDialog v-model:visible="showEmployeeInfo" :eno="selectedEno" />
    </div>
</template>
