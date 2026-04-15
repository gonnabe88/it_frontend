/**
 * ============================================================================
 * [useBudgetPeriod] 예산 신청 기간 검증 Composable
 * ============================================================================
 * 공통코드(BG-RQS-STA/END)에서 예산 신청 가능 기간을 조회하고,
 * 현재 일자가 기간 내인지 판단하는 반응형 상태를 제공합니다.
 *
 * [Design Ref: §7 — REQ-6 예산 신청 기간 제한]
 *
 * [사용처]
 *  - pages/budget/index.vue: 기간 외 안내 팝업 + 카드 비활성화
 *  - middleware/budget-period.ts: form 페이지 직접 접근 차단
 * ============================================================================
 */

/** 예산 신청 기간 응답 타입 */
interface BudgetPeriodResponse {
    startDate: string;
    endDate: string;
}

export function useBudgetPeriod() {
    const config = useRuntimeConfig();

    /* 공통코드에서 예산 신청 기간 조회 */
    const { data: periodData } = useApiFetch<BudgetPeriodResponse>(
        `${config.public.apiBase}/api/ccodem/budget-period`
    );

    /* 현재 기간 내인지 판단 */
    const isWithinPeriod = computed(() => {
        if (!periodData.value) return true; // 데이터 로딩 중에는 허용
        const now = new Date().toISOString().slice(0, 10);
        return now >= periodData.value.startDate && now <= periodData.value.endDate;
    });

    /* 기간 정보 */
    const periodInfo = computed(() => periodData.value);

    return { isWithinPeriod, periodInfo };
}
