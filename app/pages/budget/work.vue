<!--
================================================================================
[pages/budget/work.vue] 예산 작업 페이지
================================================================================
사업별 편성률(자본예산/일반관리비)을 입력하여 결재완료 예산에 적용하는 페이지입니다.

[주요 기능]
  - 예산년도 선택: Select로 연도 변경 시 대상 목록 자동 로드
  - 대상 목록: 결재완료 정보화사업/전산업무비 + 사업별 편성률(%) 입력
  - 저장: POST /api/budget/work/apply-items → BBUGTM Upsert
  - 편성 결과 테이블: 비목별 요청금액/편성금액/편성률 + 합계 표시
  - 사업별 편성 결과: 동적 비목 컬럼 + 요청/편성 금액

[데이터 흐름]
  1. 연도 선택 → useApiFetch로 결재완료 프로젝트/전산업무비 조회
  2. DUP 공통코드 로드 → 편성률 기본값 자동 계산
  3. 사업별 편성률 입력 → ref 바인딩
  4. 저장 클릭 → $apiFetch POST /apply-items → 결과 표시

// Design Ref: §3 — REQ-2 예산 작업 편성률 개선
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatBudget } from '~/utils/common'
import type { SummaryResponse, SummaryItem, ApplyResponse, ProjectSummaryResponse } from '~/types/budget-work'
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

/* ── DUP 공통코드 조회 (편성률 기본값 계산용) ── */

/** 자본예산 기준액 (DUP-AMT-300, 기본 2억) */
const capThreshold = ref(200000000)

/** 자본예산 기본 편성률 (DUP-IOE-351, 기본 70%) */
const defaultAssetDupRt = ref(70)

/** 일반관리비 기본 편성률 (DUP-IOE-240, 기본 99%) */
const defaultCostDupRt = ref(99)

/** DUP 공통코드 로드 완료 여부 */
const dupCodesLoaded = ref(false)

/**
 * DUP 공통코드 로드
 * DUP-AMT (기준액), DUP-IOE (비목별 비율) 코드를 조회하여 기본값 설정
 */
const loadDupCodes = async () => {
    try {
        const { $apiFetch } = useNuxtApp()
        // DUP-AMT: 기준액 코드 조회
        const amtCodes = await $apiFetch<Array<{ cdId: string; cdva: string }>>(
            `${config.public.apiBase}/api/codes`, { params: { cttTp: 'DUP_AMT' } }
        )
        const amt300 = amtCodes?.find(c => c.cdId === 'DUP-AMT-300')
        if (amt300?.cdva) capThreshold.value = Number(amt300.cdva)

        // DUP-IOE: 비목별 비율 코드 조회
        const ioeCodes = await $apiFetch<Array<{ cdId: string; cdva: string }>>(
            `${config.public.apiBase}/api/codes`, { params: { cttTp: 'DUP_IOE' } }
        )
        const ioe351 = ioeCodes?.find(c => c.cdId === 'DUP-IOE-351')
        if (ioe351?.cdva) defaultAssetDupRt.value = Number(ioe351.cdva)
        const ioe240 = ioeCodes?.find(c => c.cdId === 'DUP-IOE-240')
        if (ioe240?.cdva) defaultCostDupRt.value = Number(ioe240.cdva)

        dupCodesLoaded.value = true
    } catch {
        // 코드 조회 실패 시 기본값 유지
        dupCodesLoaded.value = true
    }
}

onMounted(() => { loadDupCodes() })

/**
 * 편성률 기본값 계산
 * Design Ref: §3.3 — calculateDefaultRates 의사코드
 */
const calculateDefaultRates = (item: { _type: string; pulDtt?: string; assetBg: number }): { assetDupRt: number | null; costDupRt: number } => {
    if (item._type === '사업') {
        // 자본예산 편성률: 신규 + 기준액 이상이면 비목별 비율, 그 외 100%
        const assetDupRt = (item.pulDtt === 'PUL_DTT_001' && item.assetBg >= capThreshold.value)
            ? defaultAssetDupRt.value
            : 100
        return { assetDupRt, costDupRt: defaultCostDupRt.value }
    }
    // 전산업무비: 자본예산 없음
    return { assetDupRt: null, costDupRt: defaultCostDupRt.value }
}

/**
 * 통합 대상 목록 (정보화사업 + 전산업무비)
 * /budget/list의 [전체] 탭과 동일한 구조: 구분/총예산/자본예산/일반관리비 표시
 */
interface TargetItem {
    _id: string
    _type: string
    _orcTb: string
    _link: string
    name: string
    totalBg: number
    assetBg: number
    costBg: number
    deptNm: string
    /** 자본예산 편성률 (0~100, null=해당없음) — REQ-2 */
    assetDupRt: number | null
    /** 일반관리비 편성률 (0~100) — REQ-2 */
    costDupRt: number
    /** 신규/계속 구분 (PUL_DTT) — 기본률 계산용 */
    pulDtt?: string
}

/** 대상 목록 (반응형 ref — 편성률 v-model 바인딩용) */
const targetItems = ref<TargetItem[]>([])

/** 대상 목록 데이터 변경 시 재구성 */
const buildTargetItems = () => {
    /* 정보화사업: totalBg = assetBg + costBg (개별 품목 Σ(gclAmt*xcr) 기준, prjBg 대신) */
    const projects = (approvedProjectsData.value || []).map((p: Project) => {
        const rates = calculateDefaultRates({
            _type: '사업', pulDtt: p.pulDtt, assetBg: p.assetBg || 0
        })
        return {
            _id: p.prjMngNo,
            _type: '사업',
            _orcTb: 'BPROJM',
            _link: `/info/projects/${p.prjMngNo}`,
            name: p.prjNm,
            totalBg: (p.assetBg || 0) + (p.costBg || 0),
            assetBg: p.assetBg || 0,
            costBg: p.costBg || 0,
            deptNm: p.svnDpmNm || '',
            assetDupRt: rates.assetDupRt,
            costDupRt: rates.costDupRt,
            pulDtt: p.pulDtt
        }
    })
    /* 전산업무비: totalBg = assetBg + costBg (백엔드에서 비목코드 기준으로 계산) */
    const costs = (approvedCostsData.value || []).map((c: ItCost) => ({
        _id: c.itMngcNo || '',
        _type: '비용',
        _orcTb: 'BCOSTM',
        _link: '/info/cost/',
        name: c.cttNm,
        totalBg: (c.assetBg || 0) + (c.costBg || 0),
        assetBg: c.assetBg || 0,
        costBg: c.costBg || 0,
        deptNm: c.biceDpmNm || '',
        assetDupRt: null,
        costDupRt: defaultCostDupRt.value,
        pulDtt: undefined
    }))
    targetItems.value = [...projects, ...costs]
}

/** 프로젝트/전산업무비 데이터 또는 DUP 코드 변경 시 대상 목록 재구성 */
watch([approvedProjectsData, approvedCostsData, dupCodesLoaded], () => {
    buildTargetItems()
}, { immediate: true })

/** 대상 목록 합계 */
const targetTotals = computed(() => ({
    totalBg: targetItems.value.reduce((s, i) => s + i.totalBg, 0),
    assetBg: targetItems.value.reduce((s, i) => s + i.assetBg, 0),
    costBg: targetItems.value.reduce((s, i) => s + i.costBg, 0)
}))

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
    /** 중분류 비목 rowspan (첫 행: 병합할 행 수, 0: 병합으로 숨김) */
    midNmRowspan: number
    /** 자본예산 개별 비목 행 여부 (midNm + dtlNm 가로 병합용) */
    capItem: boolean
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
    // midNm 병합 위치별 클래스
    if (data.midNmRowspan > 1) classes.push('midNm-merge-start')
    else if (data.midNmRowspan === 0) classes.push('midNm-merge-cont')
    // 자본예산 개별 비목: midNm-dtlNm 가로 병합
    if (data.capItem) classes.push('capItem-colspan')
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
        rows.push({
            id: `cap-${item.ioeC}`, ioeCategory: item.ioeCategory, rowType: 'data', indent: 0,
            bigNm: idx === 0 ? '자본예산' : '', bigNmRowspan: idx === 0 ? capRowCount : 0,
            midNm: item.ioeCategory, midNmRowspan: 1, capItem: true, dtlNm: '',
            requestAmount: item.requestAmount, dupAmount: item.dupAmount,
            prevRequestAmount: p?.requestAmount || 0, prevDupAmount: p?.dupAmount || 0, dupRt: item.dupRt
        })
    })
    /* 자본예산 합계 */
    const capSum = sum(capitalItems)
    rows.push({
        id: 'cap-total', ioeCategory: '합계', rowType: 'total', indent: 0,
        bigNm: capitalItems.length === 0 ? '자본예산' : '', bigNmRowspan: capitalItems.length === 0 ? 1 : 0,
        midNm: '합계', midNmRowspan: 1, capItem: false, dtlNm: '',
        requestAmount: capSum.req, dupAmount: capSum.dup,
        prevRequestAmount: capSum.prevReq, prevDupAmount: capSum.prevDup, dupRt: null
    })

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

        /* 중분류 그룹 행 수: 데이터 + 소계 1행 */
        const midRowCount = items.length + 1

        /* 세부 비목: 중분류 그룹 첫 행에 midNm, 일반관리비 첫 행에 bigNm 표시 */
        items.forEach((item, idx) => {
            const p = prev(item.ioeC)
            rows.push({
                id: `exp-${item.ioeC}`, ioeCategory: item.ioeCategory, rowType: 'data', indent: 0,
                bigNm: isFirstExpenseRow ? '일반관리비' : '', bigNmRowspan: isFirstExpenseRow ? expRowCount : 0,
                midNm: idx === 0 ? gn : '', midNmRowspan: idx === 0 ? midRowCount : 0, capItem: false,
                dtlNm: item.ioeCategory,
                requestAmount: item.requestAmount, dupAmount: item.dupAmount,
                prevRequestAmount: p?.requestAmount || 0, prevDupAmount: p?.dupAmount || 0, dupRt: item.dupRt
            })
            isFirstExpenseRow = false
        })

        /* 소계 */
        const gSum = sum(items)
        rows.push({
            id: `exp-sub-${gn}`, ioeCategory: '소계', rowType: 'subtotal', indent: 0,
            bigNm: '', bigNmRowspan: 0, midNm: '', midNmRowspan: 0, capItem: false, dtlNm: '소계',
            requestAmount: gSum.req, dupAmount: gSum.dup,
            prevRequestAmount: gSum.prevReq, prevDupAmount: gSum.prevDup, dupRt: null
        })
    }

    /* 일반관리비 합계 */
    const expSum = sum(expenseItems)
    rows.push({
        id: 'exp-total', ioeCategory: '합계', rowType: 'total', indent: 0,
        bigNm: isFirstExpenseRow ? '일반관리비' : '', bigNmRowspan: isFirstExpenseRow ? 1 : 0,
        midNm: '합계', midNmRowspan: 1, capItem: false, dtlNm: '',
        requestAmount: expSum.req, dupAmount: expSum.dup,
        prevRequestAmount: expSum.prevReq, prevDupAmount: expSum.prevDup, dupRt: null
    })

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
        const result = await $apiFetch<ApplyResponse>(`${config.public.apiBase}/api/budget/work/apply-items`, {
            method: 'POST',
            body: {
                bgYy: selectedYear.value,
                items: targetItems.value.map(item => ({
                    orcTb: item._orcTb,
                    orcPkVl: item._id,
                    assetDupRt: item.assetDupRt,
                    costDupRt: item.costDupRt
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

/** 예산 단위 (기본: 천원) */
const budgetUnit = ref('천원')
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
            <SelectButton v-model="budgetUnit" :options="unitOptions" :allow-empty="false" />
        </div>

        <!-- 예산년도 선택 -->
        <div class="flex items-center gap-3">
            <label class="font-semibold text-zinc-700 dark:text-zinc-300">예산년도</label>
            <Select
v-model="selectedYear" :options="yearOptions" option-label="label" option-value="value"
                class="w-40" />
        </div>

        <!-- 대상 목록 (결재완료 정보화사업 + 전산업무비) -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    대상 목록
                    <span class="text-sm font-normal text-zinc-500 ml-2">결재완료된 정보화사업 · 전산업무비</span>
                </h2>
                <span class="text-sm text-zinc-500">(기준 : {{ budgetUnit }})</span>
            </div>

            <StyledDataTable :value="targetItems" :loading="targetLoading" striped-rows data-key="_id">

                <!-- 구분 -->
                <Column field="_type" header="구분" style="width: 5rem">
                    <template #body="{ data }">
                        <Tag
:value="data._type" :class="data._type === '사업'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'"
                            class="border-0" rounded />
                    </template>
                </Column>

                <!-- 사업명/계약명 -->
                <Column field="name" header="사업명/계약명" style="min-width: 16rem">
                    <template #body="{ data }">
                        <NuxtLink
:to="data._link"
                            class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                            {{ data.name }}
                        </NuxtLink>
                    </template>
                </Column>

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

                <!-- 자본예산 편성률(%) — REQ-2 -->
                <Column header="자본예산 편성률(%)" style="width: 10rem">
                    <template #body="{ data }">
                        <InputNumber
v-if="data.assetDupRt != null"
                            v-model="data.assetDupRt" :min="0" :max="100" suffix=" %"
                            :show-buttons="true" :step="5" class="w-full" input-class="text-right" />
                        <span v-else class="text-right block text-zinc-400">-</span>
                    </template>
                </Column>

                <!-- 일반관리비 편성률(%) — REQ-2 -->
                <Column header="일반관리비 편성률(%)" style="width: 10rem">
                    <template #body="{ data }">
                        <InputNumber
v-model="data.costDupRt" :min="0" :max="100" suffix=" %"
                            :show-buttons="true" :step="5" class="w-full" input-class="text-right" />
                    </template>
                </Column>

                <!-- 담당부서 -->
                <Column field="deptNm" header="담당부서" style="min-width: 8rem" />

                <!-- 데이터 없음 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        결재완료된 항목이 없습니다.
                    </div>
                </template>
            </StyledDataTable>

            <!-- 저장 버튼 -->
            <div class="flex justify-end mt-4">
                <Button
label="저장" severity="primary" icon="pi pi-save" :loading="saving"
                    :disabled="targetItems.length === 0" @click="onSave" />
            </div>
        </div>

        <!-- 비목별 편성 결과 테이블 (계층 구조: 자본예산/일반관리비 → 비목그룹 → 세부비목) -->
        <div
v-if="summaryData"
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">비목별 편성 결과</h2>
                <span class="text-sm text-zinc-500">(기준 : {{ budgetUnit }})</span>
            </div>

            <StyledDataTable :value="summaryRows" data-key="id" :row-class="summaryRowClass">

                <!-- 2단 헤더 그룹: 비목(3컬럼) + 요청금액(3컬럼) + 편성금액(3컬럼) + 편성률 -->
                <ColumnGroup type="header">
                    <Row>
                        <Column header="비목" :colspan="3" :rowspan="2" />
                        <Column header="요청금액" :colspan="3" />
                        <Column header="편성금액" :colspan="3" />
                        <Column header="편성률(%)" :rowspan="2" style="width: 7rem" />
                    </Row>
                    <Row>
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
                        <span v-if="data.bigNm" class="font-bold text-blue-900 dark:text-blue-300">{{ data.bigNm
                        }}</span>
                    </template>
                    <template #footer/>
                </Column>

                <!-- 중분류 비목 (자본예산 세부비목 · 일반관리비 서브그룹명 · 합계) -->
                <Column field="midNm">
                    <template #body="{ data }">
                        <span
v-if="data.midNm" :class="{
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
                        <span
v-if="data.dtlNm" :class="{
                            'font-bold': data.rowType === 'subtotal',
                        }">{{ data.dtlNm }}</span>
                    </template>
                    <template #footer/>
                </Column>

                <!-- 전년 요청금액 -->
                <Column>
                    <template #body="{ data }">
                        <span
v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block text-zinc-500">{{ fmt(data.prevRequestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold text-zinc-500">{{
                            fmt(prevSummaryData?.totals.requestAmount) }}</span>
                    </template>
                </Column>

                <!-- 당해 요청금액 -->
                <Column>
                    <template #body="{ data }">
                        <span
v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block">{{ fmt(data.requestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(summaryData!.totals.requestAmount) }}</span>
                    </template>
                </Column>

                <!-- 요청금액 증감율 -->
                <Column>
                    <template #body="{ data }">
                        <span
v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block" :class="{
                                'text-red-600': data.requestAmount - data.prevRequestAmount > 0,
                                'text-blue-600': data.requestAmount - data.prevRequestAmount < 0
                            }">{{ calcChangeRate(data.requestAmount, data.prevRequestAmount) }}</span>
                    </template>
                    <template #footer>
                        <span
class="text-right block font-bold" :class="{
                            'text-red-600': (summaryData!.totals.requestAmount - (prevSummaryData?.totals.requestAmount || 0)) > 0,
                            'text-blue-600': (summaryData!.totals.requestAmount - (prevSummaryData?.totals.requestAmount || 0)) < 0
                        }">{{ calcChangeRate(summaryData!.totals.requestAmount, prevSummaryData?.totals.requestAmount
                            || 0) }}</span>
                    </template>
                </Column>

                <!-- 전년 편성금액 -->
                <Column>
                    <template #body="{ data }">
                        <span
v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block text-zinc-500">{{ fmt(data.prevDupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold text-zinc-500">{{ fmt(prevSummaryData?.totals.dupAmount)
                        }}</span>
                    </template>
                </Column>

                <!-- 당해 편성금액 -->
                <Column>
                    <template #body="{ data }">
                        <span
v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block">{{ fmt(data.dupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span class="text-right block font-bold">{{ fmt(summaryData!.totals.dupAmount) }}</span>
                    </template>
                </Column>

                <!-- 편성금액 증감율 -->
                <Column>
                    <template #body="{ data }">
                        <span
v-if="data.rowType === 'data' || data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block" :class="{
                                'text-red-600': data.dupAmount - data.prevDupAmount > 0,
                                'text-blue-600': data.dupAmount - data.prevDupAmount < 0
                            }">{{ calcChangeRate(data.dupAmount, data.prevDupAmount) }}</span>
                    </template>
                    <template #footer>
                        <span
class="text-right block font-bold" :class="{
                            'text-red-600': (summaryData!.totals.dupAmount - (prevSummaryData?.totals.dupAmount || 0)) > 0,
                            'text-blue-600': (summaryData!.totals.dupAmount - (prevSummaryData?.totals.dupAmount || 0)) < 0
                        }">{{ calcChangeRate(summaryData!.totals.dupAmount, prevSummaryData?.totals.dupAmount || 0)
                        }}</span>
                    </template>
                </Column>

                <!-- 편성률 -->
                <Column>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'data'" class="text-right block">{{ data.dupRt != null ?
                            `${data.dupRt}%` : '-' }}</span>
                        <span
v-else-if="data.rowType === 'subtotal' || data.rowType === 'total'"
                            class="text-right block">-</span>
                    </template>
                    <template #footer>
                        <span class="text-right block">-</span>
                    </template>
                </Column>
            </StyledDataTable>
        </div>

        <!-- 사업별 편성 결과 테이블 (비목별 편성률 동적 컬럼) -->
        <div
v-if="projectSummaryData && projectSummaryData.data.length > 0"
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">사업별 편성 결과</h2>
                <span class="text-sm text-zinc-500">(기준 : {{ budgetUnit }})</span>
            </div>

            <StyledDataTable
:value="projectSummaryData.data" striped-rows data-key="orcPkVl" scrollable
                scroll-height="flex">

                <!-- 2단 헤더: 고정 컬럼 + 비목별 동적 컬럼 + 합계 -->
                <ColumnGroup type="header">
                    <Row>
                        <Column header="구분" :rowspan="2" style="width: 5rem" />
                        <Column header="사업명/계약명" :rowspan="2" style="min-width: 14rem" />
                        <Column
v-for="cat in projectSummaryData.categories" :key="cat.ioePrefix" :header="cat.cdNm"
                            :colspan="2" />
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
                        <Tag
:value="data.orcTb === 'BPROJM' ? '사업' : '비용'" :class="data.orcTb === 'BPROJM'
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
                        <span class="text-right block font-bold">{{ fmt(projectSummaryData!.totals.requestAmount)
                        }}</span>
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
.kdb-it-table .summary-row-subtotal>td {
    background-color: rgb(244 244 245) !important;
}

.dark .kdb-it-table .summary-row-subtotal>td {
    background-color: rgb(39 39 42 / 0.3) !important;
}

.kdb-it-table .summary-row-total>td {
    background-color: rgb(228 228 231) !important;
}

.dark .kdb-it-table .summary-row-total>td {
    background-color: rgb(39 39 42) !important;
}

/*
 * 대분류 비목(bigNm) 셀 병합 — CSS로 시각적 rowspan 구현
 * bigNm-merge-start: 병합 시작 행 (하단 경계선 제거)
 * bigNm-merge-cont:  병합 연속 행 (상/하단 경계선 제거)
 * 마지막 행(total)은 하단 경계선 유지
 */
/* 병합 시작 행: 첫 번째 셀 하단 경계 제거 */
.kdb-it-table .bigNm-merge-start>td:first-child {
    border-bottom-color: transparent !important;
}

/* 병합 연속 행: 첫 번째 셀 상/하단 경계 제거 + 배경색 통일 */
.kdb-it-table .bigNm-merge-cont>td:first-child {
    border-top-color: transparent !important;
    border-bottom-color: transparent !important;
    background-color: white !important;
}

.dark .kdb-it-table .bigNm-merge-cont>td:first-child {
    background-color: rgb(24 24 27) !important;
}

/* 병합 연속 행 중 소계 행: 첫 셀 배경색 유지 (소계 색상 무시) */
.kdb-it-table .bigNm-merge-cont.summary-row-subtotal>td:first-child {
    background-color: white !important;
}

.dark .kdb-it-table .bigNm-merge-cont.summary-row-subtotal>td:first-child {
    background-color: rgb(24 24 27) !important;
}

/* 병합 연속 행 중 합계 행: 하단 경계 복원 (그룹 끝) + 첫 셀 배경색 유지 */
.kdb-it-table .bigNm-merge-cont.summary-row-total>td:first-child {
    border-bottom-color: var(--p-datatable-body-cell-border-color, rgb(228 228 231)) !important;
    background-color: white !important;
}

.dark .kdb-it-table .bigNm-merge-cont.summary-row-total>td:first-child {
    background-color: rgb(24 24 27) !important;
}

/*
 * 중분류 비목(midNm) 셀 병합 — 2번째 컬럼 (td:nth-child(2))
 * midNm-merge-start: 병합 시작 행 (하단 경계선 제거)
 * midNm-merge-cont:  병합 연속 행 (상/하단 경계선 제거)
 */
.kdb-it-table .midNm-merge-start>td:nth-child(2) {
    border-bottom-color: transparent !important;
}

.kdb-it-table .midNm-merge-cont>td:nth-child(2) {
    border-top-color: transparent !important;
    border-bottom-color: transparent !important;
    background-color: white !important;
}

.dark .kdb-it-table .midNm-merge-cont>td:nth-child(2) {
    background-color: rgb(24 24 27) !important;
}

/* 소계 행: 하단 경계 복원 (그룹 끝) + 배경색 유지 */
.kdb-it-table .midNm-merge-cont.summary-row-subtotal>td:nth-child(2) {
    border-bottom-color: var(--p-datatable-body-cell-border-color, rgb(228 228 231)) !important;
    background-color: white !important;
}

.dark .kdb-it-table .midNm-merge-cont.summary-row-subtotal>td:nth-child(2) {
    background-color: rgb(24 24 27) !important;
}

/*
 * 자본예산 개별 비목 — midNm(2번째)과 dtlNm(3번째) 가로 병합
 * 2번째 셀의 오른쪽 경계, 3번째 셀의 왼쪽 경계를 제거하여 하나로 보이게 합니다.
 */
.kdb-it-table .capItem-colspan>td:nth-child(2) {
    border-right-color: transparent !important;
}

.kdb-it-table .capItem-colspan>td:nth-child(3) {
    border-left-color: transparent !important;
}

</style>
