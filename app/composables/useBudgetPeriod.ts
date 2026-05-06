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

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 (UTC 오프셋 보정) */
function getLocalDateString(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function useBudgetPeriod() {
    const config = useRuntimeConfig();

    /* 공통코드에서 예산 신청 기간 조회 */
    const { data: periodData, pending, error } = useApiFetch<BudgetPeriodResponse>(
        `${config.public.apiBase}/api/ccodem/budget-period`
    );

    /* 현재 기간 내인지 판단
     * - pending: 로딩 중에는 일시 허용 (UI 깜빡임 방지)
     * - error: API 오류 시 접근 차단 (코드 미등록·유효기간 만료 포함)
     * - 날짜 비교는 로컬 날짜 기준 (UTC 오프셋 보정)
     */
    const isWithinPeriod = computed(() => {
        if (pending.value) return true;
        if (error.value || !periodData.value) return false;
        const today = getLocalDateString();
        return today >= periodData.value.startDate && today <= periodData.value.endDate;
    });

    /* 기간 정보 */
    const periodInfo = computed(() => periodData.value);

    return { isWithinPeriod, periodInfo, pending, error };
}
