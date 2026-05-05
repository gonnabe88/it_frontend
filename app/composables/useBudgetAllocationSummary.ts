/**
 * ============================================================================
 * [composables/useBudgetAllocationSummary.ts] 전산예산 편성 결과 조회 composable
 * ============================================================================
 * /info/plan/form 미리보기의 '전산예산' 카드 전용.
 * 당해/전년 편성 결과를 조회하고 비목 컬럼은 원본(BudgetSummaryResultTable)과
 * 동일한 rowspan/colspan 구조로, 데이터 컬럼은 평면으로 변환합니다.
 *
 * 사용 파일:
 *  - components/plan/PlanBudgetAllocationCard.vue
 * ============================================================================
 */
import { computed, type Ref } from 'vue'
import type { SummaryResponse, SummaryItem } from '~/types/budget-work'

/** 일반관리비 중분류 그룹 표시 순서 */
const EXPENSE_GROUP_ORDER = ['전산임차료', '전산여비', '전산용역비', '전산제비'] as const

/** 비목명/그룹명으로 일반관리비 중분류 그룹 자동 분류 */
function getExpenseGroup(name: string): string {
    if (name.includes('임차')) return '전산임차료'
    if (name.includes('출장') || name.includes('여비')) return '전산여비'
    if (name.includes('용역') || name.includes('원고') || name.includes('강사') || name.includes('심사')) return '전산용역비'
    return '전산제비'
}

/** 조정율 계산: 편성요청 0이면 '-', 그 외 소수점 1자리 + '%' */
function calcAdjustRate(requestAmount: number, dupAmount: number): string {
    if (requestAmount === 0) return '-'
    return (dupAmount / requestAmount * 100).toFixed(1) + '%'
}

/**
 * [BudgetAllocationRow] 전산예산 카드 표시용 행
 * - 비목 컬럼(bigNm/midNm/dtlNm): 원본 BudgetSummaryResultTable과 동일 rowspan/colspan 구조
 * - 데이터 컬럼(requestAmount 등): 병합 없는 평면 구조
 */
export interface BudgetAllocationRow {
    /** 렌더링 key prop용 고유 ID */
    id: string
    /** 행 유형 */
    rowType: 'data' | 'subtotal' | 'total'
    /** 대분류명 (자본예산 / 일반관리비) */
    bigNm: string
    /** 0이면 렌더링 안 함 (위 셀에 병합됨), >0이면 해당 rowspan으로 렌더링 */
    bigNmRowspan: number
    /** 중분류명 */
    midNm: string
    /** 0이면 렌더링 안 함 (위 셀에 병합됨), >0이면 해당 rowspan으로 렌더링 */
    midNmRowspan: number
    /** true이면 midNm이 colspan=2 (자본예산 개별 비목, dtlNm 없음) */
    capItem: boolean
    /** true이면 midNm을 colspan=2로 렌더링하고 dtlNm 셀 생략 (자본예산 합계 행) */
    midNmColspan2: boolean
    /** 세부비목명 (자본예산 개별 비목은 빈 문자열) */
    dtlNm: string
    /** true이면 dtlNm을 colspan=2로 렌더링 (일반관리비 합계 행: midNm 위치가 빈 셀이 됨) */
    dtlNmColspan2: boolean
    /** 편성요청 금액 */
    requestAmount: number
    /** 편성조정 금액 = '26년 편성액(본건) — 동일 소스 */
    dupAmount: number
    /** 조정율 */
    adjustRate: string
    /** '25년 편성액(전년도) */
    prevDupAmount: number
}

/**
 * 전산예산 편성 결과 조회 composable
 *
 * @param plnYy - 계획 대상년도 (YYYY 문자열 ref)
 */
export function useBudgetAllocationSummary(plnYy: Ref<string>) {
    const config = useRuntimeConfig()

    const prevYy = computed(() => {
        const n = Number(plnYy.value)
        return isNaN(n) ? '' : String(n - 1)
    })

    const { data: currData, pending: currPending } = useApiFetch<SummaryResponse>(
        `${config.public.apiBase}/api/budget/work/summary`,
        { query: computed(() => ({ bgYy: plnYy.value })), watch: [plnYy] }
    )

    const { data: prevData, pending: prevPending } = useApiFetch<SummaryResponse>(
        `${config.public.apiBase}/api/budget/work/summary`,
        { query: computed(() => ({ bgYy: prevYy.value })), watch: [plnYy] }
    )

    const prevMap = computed<Record<string, SummaryItem>>(() => {
        const map: Record<string, SummaryItem> = {}
        if (!prevData.value) return map
        for (const item of prevData.value.data) map[item.ioeC] = item
        return map
    })

    /**
     * 행 배열 계산
     * 비목 컬럼은 원본 summaryRows 로직과 동일한 rowspan/colspan 구조
     */
    const rows = computed<BudgetAllocationRow[]>(() => {
        if (!currData.value) return []

        const allItems = currData.value.data
        const result: BudgetAllocationRow[] = []

        const prevDup = (ioeC: string): number => prevMap.value[ioeC]?.dupAmount ?? 0
        const sumAmounts = (items: SummaryItem[]) => ({
            req: items.reduce((s, it) => s + it.requestAmount, 0),
            dup: items.reduce((s, it) => s + it.dupAmount, 0),
            prevDup: items.reduce((s, it) => s + prevDup(it.ioeC), 0),
        })

        // ── 자본예산 그룹 ──
        const capitalItems = allItems.filter(item => item.capital)
        const capRowCount = capitalItems.length + 1 // 개별 비목 + 합계

        capitalItems.forEach((item, idx) => {
            result.push({
                id: `cap-${item.ioeC}`,
                rowType: 'data',
                bigNm: idx === 0 ? '자본예산' : '',
                bigNmRowspan: idx === 0 ? capRowCount : 0,
                midNm: item.ioeCategory,
                midNmRowspan: 1,
                capItem: true,   // midNm이 colspan=2, dtlNm 없음
                midNmColspan2: false,
                dtlNm: '',
                dtlNmColspan2: false,
                requestAmount: item.requestAmount,
                dupAmount: item.dupAmount,
                adjustRate: calcAdjustRate(item.requestAmount, item.dupAmount),
                prevDupAmount: prevDup(item.ioeC),
            })
        })

        const capSum = sumAmounts(capitalItems)
        result.push({
            id: 'cap-total',
            rowType: 'total',
            bigNm: capitalItems.length === 0 ? '자본예산' : '',
            bigNmRowspan: capitalItems.length === 0 ? 1 : 0,
            midNm: '합계',
            midNmRowspan: 1,
            capItem: false,
            midNmColspan2: true,   // midNm '합계'가 dtlNm 컬럼까지 colspan=2로 점유
            dtlNm: '',
            dtlNmColspan2: false,
            requestAmount: capSum.req,
            dupAmount: capSum.dup,
            adjustRate: calcAdjustRate(capSum.req, capSum.dup),
            prevDupAmount: capSum.prevDup,
        })

        // ── 일반관리비 그룹 ──
        const expenseItems = allItems.filter(item => !item.capital)

        const grouped = new Map<string, SummaryItem[]>()
        for (const gn of EXPENSE_GROUP_ORDER) grouped.set(gn, [])
        for (const item of expenseItems) {
            const gn = getExpenseGroup(item.groupName || item.ioeCategory)
            if (!grouped.has(gn)) grouped.set(gn, [])
            grouped.get(gn)!.push(item)
        }

        // 일반관리비 전체 행 수 계산 (bigNm rowspan용)
        let expRowCount = 1 // 합계 행
        for (const gn of EXPENSE_GROUP_ORDER) {
            const items = grouped.get(gn) ?? []
            if (items.length > 0) expRowCount += items.length + 1 // 데이터 + 소계
        }

        let isFirstExpenseRow = true

        for (const gn of EXPENSE_GROUP_ORDER) {
            const items = grouped.get(gn) ?? []
            if (items.length === 0) continue

            const midRowCount = items.length + 1 // 세부비목 + 소계

            items.forEach((item, idx) => {
                result.push({
                    id: `exp-${item.ioeC}`,
                    rowType: 'data',
                    bigNm: isFirstExpenseRow ? '일반관리비' : '',
                    bigNmRowspan: isFirstExpenseRow ? expRowCount : 0,
                    midNm: idx === 0 ? gn : '',
                    midNmRowspan: idx === 0 ? midRowCount : 0,
                    capItem: false,
                    midNmColspan2: false,
                    dtlNm: item.ioeCategory,
                    dtlNmColspan2: false,
                    requestAmount: item.requestAmount,
                    dupAmount: item.dupAmount,
                    adjustRate: calcAdjustRate(item.requestAmount, item.dupAmount),
                    prevDupAmount: prevDup(item.ioeC),
                })
                isFirstExpenseRow = false
            })

            const gSum = sumAmounts(items)
            result.push({
                id: `exp-sub-${gn}`,
                rowType: 'subtotal',
                bigNm: '', bigNmRowspan: 0,
                midNm: '', midNmRowspan: 0,
                capItem: false,
                midNmColspan2: false,
                dtlNm: '소계',
                dtlNmColspan2: false,
                requestAmount: gSum.req,
                dupAmount: gSum.dup,
                adjustRate: calcAdjustRate(gSum.req, gSum.dup),
                prevDupAmount: gSum.prevDup,
            })
        }

        const expSum = sumAmounts(expenseItems)
        result.push({
            id: 'exp-total',
            rowType: 'total',
            bigNm: '', bigNmRowspan: 0,
            midNm: '', midNmRowspan: 0,
            capItem: false,
            midNmColspan2: false,
            dtlNm: '합계',
            dtlNmColspan2: true,  // midNm 위치가 비어있으므로 colspan=2
            requestAmount: expSum.req,
            dupAmount: expSum.dup,
            adjustRate: calcAdjustRate(expSum.req, expSum.dup),
            prevDupAmount: expSum.prevDup,
        })

        return result
    })

    const pending = computed(() => currPending.value || prevPending.value)
    const hasData = computed(() => rows.value.length > 0)

    const yearLabel = computed(() => plnYy.value ? `'${String(plnYy.value).slice(2)}년` : '')
    const prevYearLabel = computed(() => prevYy.value ? `'${String(prevYy.value).slice(2)}년` : '')

    /** 일반관리비 원본 항목 (capital=false) — PlanExpenseCostCard 전용 */
    const expenseItems = computed<SummaryItem[]>(() =>
        currData.value?.data.filter(item => !item.capital) ?? []
    )

    /** 자본예산 원본 항목 (capital=true) — PlanCapitalBudgetCard 전용 */
    const capitalSummaryItems = computed<SummaryItem[]>(() =>
        currData.value?.data.filter(item => item.capital) ?? []
    )

    return { rows, pending, hasData, yearLabel, prevYearLabel, expenseItems, capitalSummaryItems }
}
