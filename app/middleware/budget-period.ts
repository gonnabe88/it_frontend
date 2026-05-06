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
 *
 * [사용 방법]
 *  definePageMeta({ middleware: ['budget-period'] })
 *
 * [주의]
 * useBudgetPeriod()는 lazy fetch를 사용하므로 미들웨어 실행 시점에
 * 데이터가 없어 항상 허용 판정이 됨. $fetch로 직접 호출해야 정확한 판단 가능.
 * ============================================================================
 */

interface BudgetPeriodResponse {
    startDate: string;
    endDate: string;
}

function getLocalDateString(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export default defineNuxtRouteMiddleware(async () => {
    /* SSR 환경에서는 체크 생략 (클라이언트에서만 동작) */
    if (import.meta.server) return;

    const config = useRuntimeConfig();

    try {
        const period = await $fetch<BudgetPeriodResponse>(
            `${config.public.apiBase}/api/ccodem/budget-period`,
            { credentials: 'include' }
        );
        const today = getLocalDateString();
        const inPeriod = today >= period.startDate && today <= period.endDate;
        if (!inPeriod) {
            return navigateTo('/budget');
        }
    } catch {
        /* API 오류(코드 미등록 포함) 시 안전하게 차단 */
        return navigateTo('/budget');
    }
});
