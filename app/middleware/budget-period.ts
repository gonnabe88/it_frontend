/**
 * ============================================================================
 * [middleware/budget-period.ts] 예산 신청 기간 접근 제어 미들웨어
 * ============================================================================
 * 예산 관련 form 페이지에 직접 접근할 때 신청 기간 내인지 검증합니다.
 * 기간 외에는 /budget 페이지로 리다이렉트합니다.
 *
 * [Design Ref: §7.3 — 미들웨어 budget-period.ts]
 *
 * [적용 대상 페이지]
 *  - /info/projects/form (정보화사업 신규/수정)
 *  - /info/cost/form (전산업무비 신규/수정)
 *  - /info/cost/terminal/form (금융정보단말기 신규/수정)
 *
 * [사용 방법]
 *  definePageMeta({ middleware: ['budget-period'] })
 * ============================================================================
 */
export default defineNuxtRouteMiddleware(() => {
    /* SSR 환경에서는 체크 생략 (클라이언트에서만 동작) */
    if (import.meta.server) return;

    const { isWithinPeriod } = useBudgetPeriod();

    if (!isWithinPeriod.value) {
        return navigateTo('/budget');
    }
});
