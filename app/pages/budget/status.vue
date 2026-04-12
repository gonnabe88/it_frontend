<!--
================================================================================
[pages/budget/status.vue] 예산 현황 페이지
================================================================================
정보화사업, 전산업무비, 경상사업 예산을 3개 탭으로 분리하여 조회하는 페이지입니다.
각 탭은 편성요청 금액과 조정(편성) 금액을 병렬로 표시합니다.

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
import * as XLSX from 'xlsx'
import DOMPurify from 'isomorphic-dompurify'
import StyledDataTable from '~/components/common/StyledDataTable.vue'
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
    { field: 'svnDpmTlr', header: '주관팀장', group: '기본정보', align: 'center', width: 100 },
    { field: 'svnDpmCgpr', header: '주관담당자', group: '기본정보', align: 'center', width: 100 },
    { field: 'itDpm', header: 'IT담당부서', group: '기본정보', align: 'center', width: 100 },
    { field: 'itDpmTlr', header: 'IT담당팀장', group: '기본정보', align: 'center', width: 100 },
    { field: 'itDpmCgpr', header: 'IT담당자', group: '기본정보', align: 'center', width: 100 },
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

/* ── 전산업무비 컬럼 정의 ── */
const costColumns: ColumnDef[] = [
    { field: 'pulDtt', header: '신규/계속', group: '기본정보', align: 'center', width: 80 },
    { field: 'abusC', header: '사업코드', group: '기본정보', align: 'center', width: 100 },
    { field: 'ioeC', header: '비목코드', group: '기본정보', align: 'center', width: 100 },
    { field: 'biceDpm', header: '담당부서', group: '기본정보', align: 'center', width: 100 },
    { field: 'biceTem', header: '담당팀', group: '기본정보', align: 'center', width: 100 },
    { field: 'cttOpp', header: '계약업체', group: '기본정보', align: 'left', width: 150 },
    { field: 'infPrtYn', header: '정보보호', group: '기본정보', align: 'center', width: 70 },
    { field: 'itMngcTp', header: '유형', group: '기본정보', align: 'center', width: 80 },
    // 편성요청
    { field: 'reqRentBg', header: '전산임차료', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqTravelBg', header: '전산여비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqServiceBg', header: '전산용역비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqMiscBg', header: '전산제비', group: '편성요청', align: 'right', width: 120, isCurrency: true },
    { field: 'reqTotalBg', header: '합계', group: '편성요청', align: 'right', width: 130, isCurrency: true },
    // 조정(편성)
    { field: 'adjRentBg', header: '전산임차료', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjTravelBg', header: '전산여비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjServiceBg', header: '전산용역비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjMiscBg', header: '전산제비', group: '조정(편성)', align: 'right', width: 120, isCurrency: true },
    { field: 'adjTotalBg', header: '합계', group: '조정(편성)', align: 'right', width: 130, isCurrency: true },
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
const visibleCostCols = ref<string[]>(loadVisibleCols('cost', costColumns))
const visibleOrdinaryCols = ref<string[]>(loadVisibleCols('ordinary', ordinaryColumns))

/** 컬럼 설정 변경 시 localStorage 저장 */
watch(visibleProjectCols, (v) => { if (import.meta.client) localStorage.setItem(STORAGE_KEY_PREFIX + 'project', JSON.stringify(v)) }, { deep: true })
watch(visibleCostCols, (v) => { if (import.meta.client) localStorage.setItem(STORAGE_KEY_PREFIX + 'cost', JSON.stringify(v)) }, { deep: true })
watch(visibleOrdinaryCols, (v) => { if (import.meta.client) localStorage.setItem(STORAGE_KEY_PREFIX + 'ordinary', JSON.stringify(v)) }, { deep: true })

/** 필터된 컬럼 목록 */
const filteredProjectCols = computed(() => projectColumns.filter(c => visibleProjectCols.value.includes(c.field)))
const filteredCostCols = computed(() => costColumns.filter(c => visibleCostCols.value.includes(c.field)))
const filteredOrdinaryCols = computed(() => ordinaryColumns.filter(c => visibleOrdinaryCols.value.includes(c.field)))

/** 컬럼 설정 다이얼로그 표시 상태 */
const showColSettings = ref(false)

/** 현재 탭에 따른 컬럼 설정 데이터 */
const currentColOptions = computed(() => {
    if (activeTab.value === '0') return projectColumns
    if (activeTab.value === '1') return costColumns
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

/* ── 고정 컬럼 (사업명/계약명) ── */
const frozenField = computed(() => {
    if (activeTab.value === '1') return 'cttNm'
    return 'prjNm'
})
const frozenHeader = computed(() => {
    if (activeTab.value === '1') return '계약명'
    return '사업명'
})

/* ── 엑셀 다운로드 ── */
const exportExcel = () => {
    const tabNames = ['정보화사업', '전산업무비', '경상사업']
    const tabName = tabNames[Number(activeTab.value)] || '예산현황'
    const fileName = `예산현황_${tabName}_${bgYy.value}.xlsx`

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
            const val = (row as any)[c.field]
            return val ?? ''
        })
    )

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, tabName)
    XLSX.writeFile(wb, fileName)
}
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">예산 현황</h1>
            <div class="flex items-center gap-2">
                <!-- 연도 선택 -->
                <Select v-model="bgYy" :options="yearOptions" optionLabel="label" optionValue="value"
                    class="w-32" />
                <!-- 금액 단위 -->
                <SelectButton v-model="unit" :options="unitOptions" :allowEmpty="false" />
                <!-- 컬럼 설정 -->
                <Button label="컬럼 설정" icon="pi pi-cog" severity="secondary" outlined
                    @click="showColSettings = true" />
                <!-- 엑셀 다운로드 -->
                <Button label="엑셀" icon="pi pi-file-excel" severity="success" outlined
                    @click="exportExcel" />
            </div>
        </div>

        <!-- 탭 -->
        <Tabs v-model:value="activeTab">
            <TabList>
                <Tab value="0">정보화사업</Tab>
                <Tab value="1">전산업무비</Tab>
                <Tab value="2">경상사업</Tab>
            </TabList>

            <!-- 정보화사업 탭 -->
            <TabPanel value="0">
              <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <StyledDataTable :value="projects" :loading="projectsPending"
                    scrollable scrollHeight="70vh" dataKey="prjMngNo"
                    stripedRows>
                    <!-- 고정 컬럼: 사업명 -->
                    <Column field="prjNm" header="사업명" frozen style="min-width: 200px" />
                    <!-- 동적 컬럼 -->
                    <Column v-for="col in filteredProjectCols" :key="col.field"
                        :field="col.field" :header="col.header"
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
                            <template v-else-if="col.field === 'prjPulPtt'">
                                {{ (data as ProjectStatusItem).prjPulPtt != null ? (data as ProjectStatusItem).prjPulPtt + '%' : '-' }}
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
                <StyledDataTable :value="costs" :loading="costsPending"
                    scrollable scrollHeight="70vh" dataKey="itMngcNo"
                    stripedRows>
                    <Column field="cttNm" header="계약명" frozen style="min-width: 200px" />
                    <Column v-for="col in filteredCostCols" :key="col.field"
                        :field="col.field" :header="col.header"
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
                <StyledDataTable :value="ordinary" :loading="ordinaryPending"
                    scrollable scrollHeight="70vh" dataKey="prjMngNo"
                    stripedRows>
                    <Column field="prjNm" header="사업명" frozen style="min-width: 200px" />
                    <Column v-for="col in filteredOrdinaryCols" :key="col.field"
                        :field="col.field" :header="col.header"
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

        <!-- 컬럼 설정 다이얼로그 -->
        <Dialog v-model:visible="showColSettings" header="표시할 컬럼 선택" modal
            :style="{ width: '500px' }">
            <MultiSelect
                v-model="currentVisibleCols"
                :options="currentColOptions"
                optionLabel="header"
                optionValue="field"
                placeholder="컬럼 선택"
                display="chip"
                :maxSelectedLabels="5"
                class="w-full"
                filter
            />
            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="전체 선택" severity="secondary" text
                        @click="currentVisibleCols = currentColOptions.map(c => c.field)" />
                    <Button label="닫기" @click="showColSettings = false" />
                </div>
            </template>
        </Dialog>
    </div>
</template>
