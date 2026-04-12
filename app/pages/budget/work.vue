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
import type { IoeCategoryResponse, SummaryResponse, SummaryItem, ApplyResponse, ProjectSummaryResponse } from '~/types/budget-work'
import type { Project } from '~/composables/useProjects'
import type { ItCost } from '~/composables/useCost'
import StyledDataTable from '~/components/common/StyledDataTable.vue'

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

/**
 * 특정 비목의 편성금액 계산 (요청금액 × 편성률 / 100, 소수점 반올림)
 */
const getDupAmount = (cat: IoeCategoryResponse): number => {
    const amount = cat.requestAmount || 0
    const rate = getRate(cat.cdId)
    return Math.round(amount * rate / 100)
}

/** 자본예산 해당 비목명 키워드 (개발비, 기계장치, 기타무형자산) */
const CAPITAL_KEYWORDS = ['개발비', '기계장치', '기타무형자산']

/** 자본예산 편성비목 */
const capitalCategories = computed(() =>
    categories.value.filter(cat =>
        CAPITAL_KEYWORDS.some(kw => cat.cdNm.includes(kw))
    )
)

/** 일반관리비 편성비목 (자본예산 제외 나머지) */
const expenseCategories = computed(() =>
    categories.value.filter(cat =>
        !CAPITAL_KEYWORDS.some(kw => cat.cdNm.includes(kw))
    )
)

/** 자본예산 요청금액 합계 */
const capitalTotalRequestAmount = computed(() =>
    capitalCategories.value.reduce((sum, cat) => sum + (cat.requestAmount || 0), 0)
)

/** 자본예산 편성금액 합계 */
const capitalTotalDupAmount = computed(() =>
    capitalCategories.value.reduce((sum, cat) => sum + getDupAmount(cat), 0)
)

/** 일반관리비 요청금액 합계 */
const expenseTotalRequestAmount = computed(() =>
    expenseCategories.value.reduce((sum, cat) => sum + (cat.requestAmount || 0), 0)
)

/** 일반관리비 편성금액 합계 */
const expenseTotalDupAmount = computed(() =>
    expenseCategories.value.reduce((sum, cat) => sum + getDupAmount(cat), 0)
)

/* ── 비목별 편성 결과 계층 구조 ── */

/** 행 유형 */
type SummaryRowType = 'data' | 'subtotal' | 'total'

/** 비목 표시용 행 데이터 */
interface SummaryDisplayRow {
    /** 고유 키 */
    id: string
    /** 비목 표시 텍스트 (하위 호환용) */
    ioeCategory: string
    /** 행 유형 (그룹헤더/서브그룹헤더/데이터/소계/합계) */
    rowType: SummaryRowType
    /** 들여쓰기 레벨 (하위 호환용) */
    indent: number
    /** 대분류 비목 (자본예산/일반관리비 그룹 헤더 행에 표시) */
    bigNm: string
    /** 대분류 비목 rowspan (첫 행: 병합할 행 수, 0: 병합으로 숨김) */
    bigNmRowspan: number
    /** 중분류 비목 (자본예산 세부비목, 일반관리비 서브그룹명, 합계 행에 표시) */
    midNm: string
    /** 세부비목 (일반관리비 데이터 및 소계 행에 표시) */
    dtlNm: string
    /** 당해 요청금액 */
    requestAmount: number
    /** 당해 편성금액 */
    dupAmount: number
    /** 전년 요청금액 */
    prevRequestAmount: number
    /** 전년 편성금액 */
    prevDupAmount: number
    /** 편성률 (%) */
    dupRt: number | null
}

/** 자본예산 그룹 판별: API에서 cttTp 기반으로 판정한 capital 필드 사용 */

/** 일반관리비 중분류 그룹 표시 순서 */
const EXPENSE_GROUP_ORDER = ['전산임차료', '전산여비', '전산용역비', '전산제비'] as const

/**
 * 비목명/그룹명으로 일반관리비 중분류 그룹 자동 분류
 * groupName 또는 ioeCategory에 포함된 키워드 패턴으로 매칭합니다.
 */
const getExpenseGroup = (name: string): string => {
    if (name.includes('임차')) return '전산임차료'
    if (name.includes('출장') || name.includes('여비')) return '전산여비'
    if (name.includes('용역') || name.includes('원고') || name.includes('강사') || name.includes('심사')) return '전산용역비'
    return '전산제비'
}

/**
 * 비목별 편성 결과 행 스타일 클래스
 * DataTable rowClass 콜백으로 사용합니다.
 */
const summaryRowClass = (data: SummaryDisplayRow) => {
    const classes: string[] = []
    // 행 유형별 클래스
    if (data.rowType === 'subtotal') classes.push('summary-row-subtotal')
    if (data.rowType === 'total') classes.push('summary-row-total')
    // bigNm 병합 위치별 클래스 (CSS로 셀 경계 제거용)
    if (data.bigNmRowspan > 1) classes.push('bigNm-merge-start')
    else if (data.bigNmRowspan === 0) classes.push('bigNm-merge-cont')
    return classes.join(' ')
}

/**
 * 비목별 편성 결과 표시용 행 데이터
 * summaryData를 계층 구조(자본예산/일반관리비 → 비목그룹 → 세부비목)로 변환합니다.
 * 실제 summaryData 항목을 기반으로 동적 그룹핑하므로 DB 비목명과의 불일치가 발생하지 않습니다.
 */
const summaryRows = computed<SummaryDisplayRow[]>(() => {
    if (!summaryData.value) return []

    const allItems = summaryData.value.data
    const rows: SummaryDisplayRow[] = []

    /** 전년 데이터 조회 헬퍼 (ioeC 기준) */
    const prev = (ioeC: string) => prevSummaryMap.value[ioeC]

    /** 합산 헬퍼 */
    const sum = (items: typeof allItems) => ({
        req: items.reduce((s, it) => s + it.requestAmount, 0),
        dup: items.reduce((s, it) => s + it.dupAmount, 0),
        prevReq: items.reduce((s, it) => s + (prev(it.ioeC)?.requestAmount || 0), 0),
        prevDup: items.reduce((s, it) => s + (prev(it.ioeC)?.dupAmount || 0), 0),
    })

    // ── 자본예산: API groupName으로 분류 ──
    const capitalItems = allItems.filter(item => item.capital)

    /* 자본예산 행 수: 개별 비목 + 합계 1행 */
    const capRowCount = capitalItems.length + 1

    /* 자본예산 개별 비목: 첫 행에 bigNm='자본예산' + rowspan 설정 */
    capitalItems.forEach((item, idx) => {
        const p = prev(item.ioeC)
        rows.push({ id: `cap-${item.ioeC}`, ioeCategory: item.ioeCategory, rowType: 'data', indent: 0,
            bigNm: idx === 0 ? '자본예산' : '', bigNmRowspan: idx === 0 ? capRowCount : 0,
            midNm: item.ioeCategory, dtlNm: '',
            requestAmount: item.requestAmount, dupAmount: item.dupAmount,
            prevRequestAmount: p?.requestAmount || 0, prevDupAmount: p?.dupAmount || 0, dupRt: item.dupRt })
    })
    /* 자본예산 합계 */
    const capSum = sum(capitalItems)
    rows.push({ id: 'cap-total', ioeCategory: '합계', rowType: 'total', indent: 0,
        bigNm: capitalItems.length === 0 ? '자본예산' : '', bigNmRowspan: capitalItems.length === 0 ? 1 : 0,
        midNm: '합계', dtlNm: '',
        requestAmount: capSum.req, dupAmount: capSum.dup,
        prevRequestAmount: capSum.prevReq, prevDupAmount: capSum.prevDup, dupRt: null })

    // ── 일반관리비: 중분류 그룹(전산임차료/전산여비/전산용역비/전산제비) 기반 그룹핑 ──
    const expenseItems = allItems.filter(item => !item.capital)

    /* 중분류 그룹별 분류 (groupName 또는 ioeCategory 키워드 매칭) */
    const grouped = new Map<string, typeof expenseItems>()
    for (const gn of EXPENSE_GROUP_ORDER) grouped.set(gn, [])
    for (const item of expenseItems) {
        const gn = getExpenseGroup(item.groupName || item.ioeCategory)
        if (!grouped.has(gn)) grouped.set(gn, [])
        grouped.get(gn)!.push(item)
    }

    /* 일반관리비 전체 행 수 계산 (데이터 + 소계 + 합계) */
    let expRowCount = 1 // 합계 행
    for (const gn of EXPENSE_GROUP_ORDER) {
        const items = grouped.get(gn) || []
        if (items.length > 0) expRowCount += items.length + 1 // 데이터 + 소계
    }

    /** 일반관리비 첫 행 여부 (bigNm 표시용) */
    let isFirstExpenseRow = true

    for (const gn of EXPENSE_GROUP_ORDER) {
        const items = grouped.get(gn) || []
        if (items.length === 0) continue

        /* 세부 비목: 중분류 그룹 첫 행에 midNm, 일반관리비 첫 행에 bigNm 표시 */
        items.forEach((item, idx) => {
            const p = prev(item.ioeC)
            rows.push({ id: `exp-${item.ioeC}`, ioeCategory: item.ioeCategory, rowType: 'data', indent: 0,
                bigNm: isFirstExpenseRow ? '일반관리비' : '', bigNmRowspan: isFirstExpenseRow ? expRowCount : 0,
                midNm: idx === 0 ? gn : '',
                dtlNm: item.ioeCategory,
                requestAmount: item.requestAmount, dupAmount: item.dupAmount,
                prevRequestAmount: p?.requestAmount || 0, prevDupAmount: p?.dupAmount || 0, dupRt: item.dupRt })
            isFirstExpenseRow = false
        })

        /* 소계 */
        const gSum = sum(items)
        rows.push({ id: `exp-sub-${gn}`, ioeCategory: '소계', rowType: 'subtotal', indent: 0,
            bigNm: '', bigNmRowspan: 0, midNm: '', dtlNm: '소계',
            requestAmount: gSum.req, dupAmount: gSum.dup,
            prevRequestAmount: gSum.prevReq, prevDupAmount: gSum.prevDup, dupRt: null })
    }

    /* 일반관리비 합계 */
    const expSum = sum(expenseItems)
    rows.push({ id: 'exp-total', ioeCategory: '합계', rowType: 'total', indent: 0,
        bigNm: isFirstExpenseRow ? '일반관리비' : '', bigNmRowspan: isFirstExpenseRow ? 1 : 0,
        midNm: '합계', dtlNm: '',
        requestAmount: expSum.req, dupAmount: expSum.dup,
        prevRequestAmount: expSum.prevReq, prevDupAmount: expSum.prevDup, dupRt: null })

    return rows
})

/* ── 저장 처리 ── */

/** 저장 진행 중 플래그 */
const saving = ref(false)

/* ── 비목별 편성 결과 조회 (해당 예산년도 + 전년도 비교) ── */

/**
 * 비목별 편성 결과 요약 데이터 조회 (GET /api/budget/work/summary)
 * selectedYear 변경 시 자동 재요청
 */
const { data: summaryData, refresh: refreshSummary } = useApiFetch<SummaryResponse>(
    `${config.public.apiBase}/api/budget/work/summary`,
    { query: { bgYy: selectedYear } }
)

/**
 * 사업별 편성 결과 조회 (GET /api/budget/work/project-summary)
 * selectedYear 변경 시 자동 재요청
 */
const { data: projectSummaryData, refresh: refreshProjectSummary } = useApiFetch<ProjectSummaryResponse>(
    `${config.public.apiBase}/api/budget/work/project-summary`,
    { query: { bgYy: selectedYear } }
)

/** 전년도 예산년도 (비교용) */
const prevYear = computed(() => selectedYear.value - 1)

/** 전년도 비목별 편성 결과 조회 */
const { data: prevSummaryData } = useApiFetch<SummaryResponse>(
    `${config.public.apiBase}/api/budget/work/summary`,
    { query: { bgYy: prevYear } }
)

/**
 * 전년도 비목별 데이터 맵 (ioeC → SummaryItem)
 * 증감율 계산 시 O(1) 조회용
 */
const prevSummaryMap = computed(() => {
    const map: Record<string, { requestAmount: number; dupAmount: number }> = {}
    if (prevSummaryData.value) {
        for (const item of prevSummaryData.value.data) {
            map[item.ioeC] = { requestAmount: item.requestAmount, dupAmount: item.dupAmount }
        }
    }
    return map
})

/**
 * 증감율 계산 (전년 대비 %)
 * 전년도 값이 0이면 '-' 반환, 그 외 ((당해-전년)/전년)*100
 */
const calcChangeRate = (current: number, prev: number): string => {
    if (prev === 0) return current > 0 ? '+∞' : '-'
    const rate = ((current - prev) / prev) * 100
    const sign = rate > 0 ? '+' : ''
    return `${sign}${rate.toFixed(1)}%`
}

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
        await Promise.all([refreshSummary(), refreshProjectSummary()])
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
    <div class="space-y-6">

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

            <StyledDataTable :value="targetItems" :loading="targetLoading" stripedRows dataKey="_id">

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
            </StyledDataTable>
        </div>

        <!-- 편성비목 설정 테이블 -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">편성비목 설정</h2>

            <!-- 자본예산 테이블 (개발비, 기계장치, 기타무형자산) -->
            <h3 class="text-base font-semibold text-indigo-700 dark:text-indigo-400 mb-2">자본예산</h3>
            <StyledDataTable :value="capitalCategories" :loading="categoriesPending" stripedRows class="mb-6">

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
                        <span class="text-right block font-bold">{{ fmt(capitalTotalRequestAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성금액 (실시간 계산) -->
                <Column header="편성금액" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(getDupAmount(data)) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(capitalTotalDupAmount) }}</span>
                    </template>
                </Column>

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        자본예산 편성비목 데이터가 없습니다.
                    </div>
                </template>
            </StyledDataTable>

            <!-- 일반관리비 테이블 (나머지) -->
            <h3 class="text-base font-semibold text-emerald-700 dark:text-emerald-400 mb-2">일반관리비</h3>
            <StyledDataTable :value="expenseCategories" :loading="categoriesPending" stripedRows>

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
                        <span class="text-right block font-bold">{{ fmt(expenseTotalRequestAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성금액 (실시간 계산) -->
                <Column header="편성금액" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-right block">{{ fmt(getDupAmount(data)) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(expenseTotalDupAmount) }}</span>
                    </template>
                </Column>

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        일반관리비 편성비목 데이터가 없습니다.
                    </div>
                </template>
            </StyledDataTable>

            <!-- 저장 버튼 -->
            <div class="flex justify-end mt-4">
                <Button label="저장" severity="primary" icon="pi pi-save" :loading="saving"
                    :disabled="categories.length === 0" @click="onSave" />
            </div>
        </div>

        <!-- 비목별 편성 결과 테이블 (계층 구조: 자본예산/일반관리비 → 비목그룹 → 세부비목) -->
        <div v-if="summaryData" class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">비목별 편성 결과</h2>

            <StyledDataTable :value="summaryRows" dataKey="id" :rowClass="summaryRowClass">

                <!-- 2단 헤더 그룹: 비목(3컬럼) + 요청금액(3컬럼) + 편성금액(3컬럼) + 편성률 -->
                <ColumnGroup type="header">
                    <Row>
                        <Column header="비목" :colspan="3" />
                        <Column header="요청금액" :colspan="3" />
                        <Column header="편성금액" :colspan="3" />
                        <Column header="편성률(%)" :rowspan="2" style="width: 7rem" />
                    </Row>
                    <Row>
                        <!-- 비목 3단계 서브헤더 (레이블 없음) -->
                        <Column header="" style="min-width: 6rem" />
                        <Column header="" style="min-width: 7rem" />
                        <Column header="" style="min-width: 10rem" />
                        <!-- 요청금액 서브헤더 -->
                        <Column :header="`${prevYear}`" style="min-width: 8rem" />
                        <Column :header="`${selectedYear}`" style="min-width: 8rem" />
                        <Column header="증감율" style="width: 6rem" />
                        <!-- 편성금액 서브헤더 -->
                        <Column :header="`${prevYear}`" style="min-width: 8rem" />
                        <Column :header="`${selectedYear}`" style="min-width: 8rem" />
                        <Column header="증감율" style="width: 6rem" />
                    </Row>
                </ColumnGroup>

                <!-- 대분류 비목 (자본예산/일반관리비 그룹 헤더 행) -->
                <Column field="bigNm">
                    <template #body="{ data }">
                        <span v-if="data.bigNm" class="font-bold text-blue-900 dark:text-blue-300">{{ data.bigNm }}</span>
                    </template>
                    <template #footer></template>
                </Column>

                <!-- 중분류 비목 (자본예산 세부비목 · 일반관리비 서브그룹명 · 합계) -->
                <Column field="midNm">
                    <template #body="{ data }">
                        <span v-if="data.midNm" :class="{
                            'font-semibold': data.rowType === 'data' && data.dtlNm,
                            'font-bold': data.rowType === 'total',
                        }">{{ data.midNm }}</span>
                    </template>
                    <template #footer>
                        <span class="font-bold">합계</span>
                    </template>
                </Column>

                <!-- 세부비목 (일반관리비 데이터 항목 · 소계) -->
                <Column field="dtlNm">
                    <template #body="{ data }">
                        <span v-if="data.dtlNm" :class="{
                            'font-bold': data.rowType === 'subtotal',
                        }">{{ data.dtlNm }}</span>
                    </template>
                    <template #footer></template>
                </Column>

                <!-- 전년 요청금액 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block text-zinc-500">{{ fmt(data.prevRequestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold text-zinc-500">{{ fmt(prevSummaryData?.totals.requestAmount) }}</span>
                    </template>
                </Column>

                <!-- 당해 요청금액 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block">{{ fmt(data.requestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(summaryData!.totals.requestAmount) }}</span>
                    </template>
                </Column>

                <!-- 요청금액 증감율 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block" :class="{
                            'text-red-600': data.requestAmount - data.prevRequestAmount > 0,
                            'text-blue-600': data.requestAmount - data.prevRequestAmount < 0
                        }">{{ calcChangeRate(data.requestAmount, data.prevRequestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold" :class="{
                            'text-red-600': (summaryData!.totals.requestAmount - (prevSummaryData?.totals.requestAmount || 0)) > 0,
                            'text-blue-600': (summaryData!.totals.requestAmount - (prevSummaryData?.totals.requestAmount || 0)) < 0
                        }">{{ calcChangeRate(summaryData!.totals.requestAmount, prevSummaryData?.totals.requestAmount || 0) }}</span>
                    </template>
                </Column>

                <!-- 전년 편성금액 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block text-zinc-500">{{ fmt(data.prevDupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold text-zinc-500">{{ fmt(prevSummaryData?.totals.dupAmount) }}</span>
                    </template>
                </Column>

                <!-- 당해 편성금액 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block">{{ fmt(data.dupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(summaryData!.totals.dupAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성금액 증감율 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block" :class="{
                            'text-red-600': data.dupAmount - data.prevDupAmount > 0,
                            'text-blue-600': data.dupAmount - data.prevDupAmount < 0
                        }">{{ calcChangeRate(data.dupAmount, data.prevDupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold" :class="{
                            'text-red-600': (summaryData!.totals.dupAmount - (prevSummaryData?.totals.dupAmount || 0)) > 0,
                            'text-blue-600': (summaryData!.totals.dupAmount - (prevSummaryData?.totals.dupAmount || 0)) < 0
                        }">{{ calcChangeRate(summaryData!.totals.dupAmount, prevSummaryData?.totals.dupAmount || 0) }}</span>
                    </template>
                </Column>

                <!-- 편성률 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data'" class="text-right block">{{ data.dupRt != null ? `${data.dupRt}%` : '-' }}</span>
                        <span v-else-if="data.rowType === 'subtotal' || data.rowType === 'total'" class="text-right block">-</span>
                    </template>
                    <template #footer>
                        <span class="text-right block">-</span>
                    </template>
                </Column>
            </StyledDataTable>
        </div>

        <!-- 사업별 편성 결과 테이블 (비목별 편성률 동적 컬럼) -->
        <div v-if="projectSummaryData && projectSummaryData.data.length > 0"
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">사업별 편성 결과</h2>

            <StyledDataTable :value="projectSummaryData.data" stripedRows dataKey="orcPkVl"
                scrollable scrollHeight="flex">

                <!-- 2단 헤더: 고정 컬럼 + 비목별 동적 컬럼 + 합계 -->
                <ColumnGroup type="header">
                    <Row>
                        <Column header="구분" :rowspan="2" style="width: 5rem" />
                        <Column header="사업명/계약명" :rowspan="2" style="min-width: 14rem" />
                        <Column v-for="cat in projectSummaryData.categories" :key="cat.ioePrefix"
                            :header="cat.cdNm" :colspan="2" />
                        <Column header="합계" :colspan="2" />
                    </Row>
                    <Row>
                        <!-- 비목별 서브 헤더 (편성률 표시) -->
                        <template v-for="cat in projectSummaryData.categories" :key="'sub-' + cat.ioePrefix">
                            <Column header="요청" style="min-width: 7rem" />
                            <Column :header="`편성(${cat.dupRt}%)`" style="min-width: 7rem" />
                        </template>
                        <!-- 합계 서브 헤더 -->
                        <Column header="요청" style="min-width: 8rem" />
                        <Column header="편성" style="min-width: 8rem" />
                    </Row>
                </ColumnGroup>

                <!-- 구분 -->
                <Column>
                    <template #body="{ data }">
                        <Tag :value="data.orcTb === 'BPROJM' ? '사업' : '비용'"
                            :class="data.orcTb === 'BPROJM'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 사업명/계약명 -->
                <Column field="name">
                    <template #body="{ data }">
                        <span class="font-medium">{{ data.name }}</span>
                    </template>
                    <template #footer>
                        <span class="font-bold">합계</span>
                    </template>
                </Column>

                <!-- 비목별 동적 컬럼 (요청금액 + 편성금액) -->
                <template v-for="cat in projectSummaryData.categories" :key="'col-' + cat.ioePrefix">
                    <!-- 비목 요청금액 -->
                    <Column>
                        <template #body="{ data }">
                            <span class="text-right block text-zinc-500">{{
                                fmt(data.categoryAmounts[cat.ioePrefix]?.requestAmount)
                            }}</span>
                        </template>
                        <template #footer>
                            <span class="text-right block font-bold text-zinc-500">{{
                                fmt(projectSummaryData!.data.reduce(
                                    (s, d) => s + (d.categoryAmounts[cat.ioePrefix]?.requestAmount || 0), 0))
                            }}</span>
                        </template>
                    </Column>
                    <!-- 비목 편성금액 -->
                    <Column>
                        <template #body="{ data }">
                            <span class="text-right block">{{
                                fmt(data.categoryAmounts[cat.ioePrefix]?.dupAmount)
                            }}</span>
                        </template>
                        <template #footer>
                            <span class="text-right block font-bold">{{
                                fmt(projectSummaryData!.data.reduce(
                                    (s, d) => s + (d.categoryAmounts[cat.ioePrefix]?.dupAmount || 0), 0))
                            }}</span>
                        </template>
                    </Column>
                </template>

                <!-- 합계 요청금액 -->
                <Column>
                    <template #body="{ data }">
                        <span class="text-right block font-semibold">{{ fmt(data.requestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(projectSummaryData!.totals.requestAmount) }}</span>
                    </template>
                </Column>

                <!-- 합계 편성금액 -->
                <Column>
                    <template #body="{ data }">
                        <span class="text-right block font-semibold">{{ fmt(data.dupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(projectSummaryData!.totals.dupAmount) }}</span>
                    </template>
                </Column>
            </StyledDataTable>
        </div>
    </div>
</template>

<style>
/* 비목별 편성 결과 — 행 유형별 배경색 */
/* PrimeVue v4에서 <td>에 클래스가 없으므로 data-pc-section 속성으로 타겟팅 */
.kdb-it-table .summary-row-subtotal > td {
    background-color: rgb(244 244 245) !important;
}
.dark .kdb-it-table .summary-row-subtotal > td {
    background-color: rgb(39 39 42 / 0.3) !important;
}
.kdb-it-table .summary-row-total > td {
    background-color: rgb(228 228 231) !important;
}
.dark .kdb-it-table .summary-row-total > td {
    background-color: rgb(39 39 42) !important;
}

/*
 * 대분류 비목(bigNm) 셀 병합 — CSS로 시각적 rowspan 구현
 * bigNm-merge-start: 병합 시작 행 (하단 경계선 제거)
 * bigNm-merge-cont:  병합 연속 행 (상/하단 경계선 제거)
 * 마지막 행(total)은 하단 경계선 유지
 */
/* 병합 시작 행: 첫 번째 셀 하단 경계 제거 */
.kdb-it-table .bigNm-merge-start > td:first-child {
    border-bottom-color: transparent !important;
}
/* 병합 연속 행: 첫 번째 셀 상/하단 경계 제거 + 배경색 통일 */
.kdb-it-table .bigNm-merge-cont > td:first-child {
    border-top-color: transparent !important;
    border-bottom-color: transparent !important;
    background-color: white !important;
}
.dark .kdb-it-table .bigNm-merge-cont > td:first-child {
    background-color: rgb(24 24 27) !important;
}
/* 병합 연속 행 중 소계 행: 첫 셀 배경색 유지 (소계 색상 무시) */
.kdb-it-table .bigNm-merge-cont.summary-row-subtotal > td:first-child {
    background-color: white !important;
}
.dark .kdb-it-table .bigNm-merge-cont.summary-row-subtotal > td:first-child {
    background-color: rgb(24 24 27) !important;
}
/* 병합 연속 행 중 합계 행: 하단 경계 복원 (그룹 끝) + 첫 셀 배경색 유지 */
.kdb-it-table .bigNm-merge-cont.summary-row-total > td:first-child {
    border-bottom-color: var(--p-datatable-body-cell-border-color, rgb(228 228 231)) !important;
    background-color: white !important;
}
.dark .kdb-it-table .bigNm-merge-cont.summary-row-total > td:first-child {
    background-color: rgb(24 24 27) !important;
}
</style>
