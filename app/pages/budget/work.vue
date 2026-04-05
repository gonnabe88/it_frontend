<!--
================================================================================
[pages/budget/work.vue] 예산 작업 페이지
================================================================================
편성비목별 편성률을 입력하여 결재완료 예산에 일괄 적용하는 페이지입니다.

[주요 기능]
  - 예산년도 선택: Select로 연도 변경 시 편성비목 자동 로드
  - 편성비목 설정 테이블: DataTable + InputNumber로 편성률(0~100%) 입력
  - 저장: POST /api/budget/work/apply → BBUGTM Upsert
  - 편성 결과 테이블: 비목별 요청금액/편성금액/편성률 + 합계 표시

[데이터 흐름]
  1. 연도 선택 → useApiFetch로 편성비목 GET 조회
  2. 편성률 입력 → 로컬 ref 바인딩
  3. 저장 클릭 → $apiFetch POST → 결과 표시
  4. 결과 테이블에 합계 행 포함

// Design Ref: §5.1 — 페이지 레이아웃 (Select + DataTable × 2 + Button)
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatBudget } from '~/utils/common'
import type { IoeCategoryResponse, SummaryResponse, ApplyResponse } from '~/types/budget-work'
import type { Project } from '~/composables/useProjects'
import type { ItCost } from '~/composables/useCost'

/** 페이지 메타 설정 */
definePageMeta({
    title: '예산 작업'
})

const toast = useToast()
const config = useRuntimeConfig()

/* ── 예산년도 선택 ── */

/** 현재 선택된 예산년도 */
const selectedYear = ref<number>(new Date().getFullYear())

/** 연도 선택 옵션 (현재 연도 기준 ±2년) */
const currentYear = new Date().getFullYear()
const yearOptions = [
    { label: `${currentYear - 1}년`, value: currentYear - 1 },
    { label: `${currentYear}년`, value: currentYear },
    { label: `${currentYear + 1}년`, value: currentYear + 1 }
]

/* ── 대상 목록 (결재완료 프로젝트 + 전산업무비) 조회 ── */

/** 결재완료된 프로젝트 목록 조회 */
const { data: approvedProjectsData, pending: projectsPending } = useApiFetch<Project[]>(
    `${config.public.apiBase}/api/projects`,
    { query: { bgYy: selectedYear, apfSts: '결재완료' } }
)

/** 결재완료된 전산업무비 목록 조회 */
const { data: approvedCostsData, pending: costsPending } = useApiFetch<ItCost[]>(
    `${config.public.apiBase}/api/cost`,
    { query: { bgYy: selectedYear, apfSts: '결재완료' } }
)

/** 대상 목록 로딩 상태 */
const targetLoading = computed(() => projectsPending.value || costsPending.value)

/**
 * 통합 대상 목록 (정보화사업 + 전산업무비)
 * /budget/list의 [전체] 탭과 동일한 구조: 구분/총예산/자본예산/일반관리비 표시
 */
interface TargetItem {
    _id: string
    _type: string
    _link: string
    name: string
    totalBg: number
    assetBg: number
    costBg: number
    deptNm: string
}

const targetItems = computed<TargetItem[]>(() => {
    /* 정보화사업: totalBg = assetBg + costBg (개별 품목 Σ(gclAmt*xcr) 기준, prjBg 대신) */
    const projects = (approvedProjectsData.value || []).map((p: Project) => ({
        _id: p.prjMngNo,
        _type: '사업',
        _link: `/info/projects/${p.prjMngNo}`,
        name: p.prjNm,
        totalBg: (p.assetBg || 0) + (p.costBg || 0),
        assetBg: p.assetBg || 0,
        costBg: p.costBg || 0,
        deptNm: p.svnDpmNm || ''
    }))
    /* 전산업무비: totalBg = assetBg + costBg (백엔드에서 비목코드 기준으로 계산) */
    const costs = (approvedCostsData.value || []).map((c: ItCost) => ({
        _id: c.itMngcNo || '',
        _type: '비용',
        _link: '/info/cost/',
        name: c.cttNm,
        totalBg: (c.assetBg || 0) + (c.costBg || 0),
        assetBg: c.assetBg || 0,
        costBg: c.costBg || 0,
        deptNm: c.biceDpmNm || ''
    }))
    return [...projects, ...costs]
})

/** 대상 목록 합계 */
const targetTotals = computed(() => ({
    totalBg: targetItems.value.reduce((s, i) => s + i.totalBg, 0),
    assetBg: targetItems.value.reduce((s, i) => s + i.assetBg, 0),
    costBg: targetItems.value.reduce((s, i) => s + i.costBg, 0)
}))

/* ── 편성비목 데이터 조회 ── */

/**
 * 편성비목 목록 조회 (GET /api/budget/work/ioe-categories)
 * selectedYear 변경 시 자동 재요청 (useApiFetch의 반응형 query)
 */
const { data: categoriesData, pending: categoriesPending } = useApiFetch<IoeCategoryResponse[]>(
    `${config.public.apiBase}/api/budget/work/ioe-categories`,
    { query: { bgYy: selectedYear } }
)

/** 편성비목 목록 (null 안전 처리) */
const categories = computed(() => categoriesData.value || [])

/**
 * 편성률 로컬 상태 관리
 * API 응답의 dupRt를 초기값으로 사용하고, 사용자 입력을 반영합니다.
 * key: cdId, value: dupRt
 */
const rateMap = ref<Record<string, number>>({})

/**
 * 편성비목 데이터 로드 시 rateMap 초기화
 * 기존 편성률이 있으면 해당 값, 없으면 100(기본값)으로 설정
 */
watch(categories, (newCategories) => {
    const newMap: Record<string, number> = {}
    for (const cat of newCategories) {
        newMap[cat.cdId] = cat.dupRt ?? 100
    }
    rateMap.value = newMap
}, { immediate: true })

/**
 * 특정 비목의 편성률 반환 (rateMap 우선, 없으면 100)
 */
const getRate = (cdId: string): number => {
    return rateMap.value[cdId] ?? 100
}

/**
 * 특정 비목의 편성률 설정
 */
const setRate = (cdId: string, value: number | null) => {
    rateMap.value[cdId] = value ?? 0
}

/** 편성비목 요청금액 합계 */
const categoriesTotalRequestAmount = computed(() =>
    categories.value.reduce((sum, cat) => sum + (cat.requestAmount || 0), 0)
)

/**
 * 특정 비목의 편성금액 계산 (요청금액 × 편성률 / 100, 소수점 반올림)
 */
const getDupAmount = (cat: IoeCategoryResponse): number => {
    const amount = cat.requestAmount || 0
    const rate = getRate(cat.cdId)
    return Math.round(amount * rate / 100)
}

/** 편성비목 편성금액 합계 (편성률 변경 시 실시간 재계산) */
const categoriesTotalDupAmount = computed(() =>
    categories.value.reduce((sum, cat) => sum + getDupAmount(cat), 0)
)

/* ── 저장 처리 ── */

/** 저장 진행 중 플래그 */
const saving = ref(false)

/** 편성 결과 요약 데이터 (저장 후 표시) */
const summaryData = ref<SummaryResponse | null>(null)

/**
 * 편성률 일괄 적용 (POST /api/budget/work/apply)
 *
 * [처리 순서]
 * 1. categories의 각 비목별 cdId + rateMap의 dupRt를 rates 배열로 구성
 * 2. $apiFetch POST 요청
 * 3. 성공 시 summaryData에 결과 설정 + Toast 표시
 * 4. 실패 시 에러 Toast 표시
 *
 * [최적화 메모]
 * Design §7.4에서 GET /summary를 별도 호출하도록 계획했으나,
 * POST /apply 응답 body에 summary가 이미 포함(ApplyResponse.summary)되므로
 * 추가 네트워크 호출 없이 직접 summaryData에 설정합니다.
 * GET /api/budget/work/summary는 페이지 초기 로드 시 별도로 활용 가능합니다.
 *
 * // Plan SC: SC-02 — 편성률 입력 후 저장 시 결과 테이블 표시
 */
const onSave = async () => {
    saving.value = true
    try {
        const { $apiFetch } = useNuxtApp()
        const result = await $apiFetch<ApplyResponse>(`${config.public.apiBase}/api/budget/work/apply`, {
            method: 'POST',
            body: {
                bgYy: selectedYear.value,
                rates: categories.value.map(c => ({
                    cdId: c.cdId,
                    dupRt: getRate(c.cdId)
                }))
            }
        })
        summaryData.value = result.summary
        toast.add({
            severity: 'success',
            summary: '저장 완료',
            detail: `${result.totalRecords}건이 처리되었습니다.`,
            life: 3000
        })
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '저장 실패',
            detail: '편성률 적용 중 오류가 발생했습니다.',
            life: 5000
        })
    } finally {
        saving.value = false
    }
}

/* ── 금액 포맷 ── */

/** 예산 단위 (기본: 원) */
const budgetUnit = ref('원')
const unitOptions = ['원', '천원', '백만원', '억원']

/**
 * 금액 포맷 헬퍼
 * formatBudget 유틸을 현재 선택된 단위로 적용합니다.
 *
 * // Plan SC: SC-04 — 금액 포맷 (formatBudget 유틸 사용)
 */
const fmt = (amount: number | null | undefined): string => {
    if (amount == null) return '0'
    return formatBudget(amount, budgetUnit.value)
}
</script>

<template>
    <div class="flex flex-col gap-6 p-4">

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">예산 작업</h1>

            <!-- 예산 단위 선택 -->
            <SelectButton v-model="budgetUnit" :options="unitOptions" :allowEmpty="false" />
        </div>

        <!-- 예산년도 선택 -->
        <div class="flex items-center gap-3">
            <label class="font-semibold text-zinc-700 dark:text-zinc-300">예산년도</label>
            <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value"
                class="w-40" />
        </div>

        <!-- 대상 목록 (결재완료 정보화사업 + 전산업무비) -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                대상 목록
                <span class="text-sm font-normal text-zinc-500 ml-2">결재완료된 정보화사업 · 전산업무비</span>
            </h2>

            <DataTable :value="targetItems" :loading="targetLoading" stripedRows dataKey="_id"
                class="text-sm" tableStyle="min-width: 50rem">

                <!-- 구분 -->
                <Column field="_type" header="구분" style="width: 5rem">
                    <template #body="{ data }">
                        <Tag :value="data._type"
                            :class="data._type === '사업'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 사업명/계약명 -->
                <Column field="name" header="사업명/계약명" style="min-width: 16rem">
                    <template #body="{ data }">
                        <NuxtLink :to="data._link"
                            class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                            {{ data.name }}
                        </NuxtLink>
                    </template>
                </Column>

                <!-- 담당부서 -->
                <Column field="deptNm" header="담당부서" style="min-width: 8rem" />

                <!-- 총예산 -->
                <Column field="totalBg" header="총예산" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(data.totalBg) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(targetTotals.totalBg) }}</span>
                    </template>
                </Column>

                <!-- 자본예산 -->
                <Column field="assetBg" header="자본예산" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(data.assetBg) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(targetTotals.assetBg) }}</span>
                    </template>
                </Column>

                <!-- 일반관리비 -->
                <Column field="costBg" header="일반관리비" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(data.costBg) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(targetTotals.costBg) }}</span>
                    </template>
                </Column>

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        결재완료된 항목이 없습니다.
                    </div>
                </template>
            </DataTable>
        </div>

        <!-- 편성비목 설정 테이블 -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">편성비목 설정</h2>

            <DataTable :value="categories" :loading="categoriesPending" stripedRows
                class="text-sm" tableStyle="min-width: 40rem">

                <!-- 편성비목명 -->
                <Column field="cdNm" header="편성비목" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="font-medium">{{ data.cdNm }}</span>
                    </template>
                    <template #footer>
                        <span class="font-bold">합계</span>
                    </template>
                </Column>

                <!-- 편성률 입력 -->
                <Column header="편성률(%)" style="width: 10rem">
                    <template #body="{ data }">
                        <InputNumber :modelValue="getRate(data.cdId)"
                            @update:modelValue="(val) => setRate(data.cdId, val)" :min="0" :max="100"
                            suffix=" %" :showButtons="true" :step="5"
                            class="w-full" inputClass="text-right" />
                    </template>
                    <template #footer>
                        <span class="text-right block">-</span>
                    </template>
                </Column>

                <!-- 요청금액 -->
                <Column header="요청금액" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(data.requestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(categoriesTotalRequestAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성금액 (요청금액 × 편성률 / 100, 실시간 계산) -->
                <Column header="편성금액" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(getDupAmount(data)) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(categoriesTotalDupAmount) }}</span>
                    </template>
                </Column>

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        편성비목 데이터가 없습니다.
                    </div>
                </template>
            </DataTable>

            <!-- 저장 버튼 -->
            <div class="flex justify-end mt-4">
                <Button label="저장" severity="primary" icon="pi pi-save" :loading="saving"
                    :disabled="categories.length === 0" @click="onSave" />
            </div>
        </div>

        <!-- 편성 결과 테이블 (저장 후 표시) -->
        <div v-if="summaryData" class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">편성 결과</h2>

            <DataTable :value="summaryData.data" stripedRows class="text-sm" tableStyle="min-width: 40rem">

                <!-- 비목명 -->
                <Column field="ioeCategory" header="비목" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="font-medium">{{ data.ioeCategory }}</span>
                    </template>
                    <template #footer>
                        <span class="font-bold">합계</span>
                    </template>
                </Column>

                <!-- 요청금액 -->
                <Column header="요청금액" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(data.requestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(summaryData!.totals.requestAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성금액 -->
                <Column header="편성금액" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(data.dupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(summaryData!.totals.dupAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성률 -->
                <Column field="dupRt" header="편성률(%)" style="width: 8rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ data.dupRt }}%</span>
                    </template>
                    <template #footer>
                        <span class="text-right block">-</span>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
