/**
 * ============================================================================
 * [composables/useCurrencyRates.ts] 환율 정보 조회 및 원화 환산 composable
 * ============================================================================
 * 공통코드 API에서 통화별 환율 데이터를 조회하고,
 * 외화 금액을 원화(KRW)로 환산하는 유틸리티 함수를 제공합니다.
 *
 * [사용처]
 *  - pages/info/projects/[id].vue : 소요자원 외화 금액 원화 환산 합계
 *  - pages/info/projects/form.vue : 소요자원 입력 시 환율 선택 및 총 예산 자동 계산
 *
 * [API 엔드포인트]
 *  - GET /api/ccodem/type/CUR → 통화 코드 및 환율 목록 반환
 *    (cdNm: 통화코드, cdva: 원화 환산 환율)
 *
 * [캐싱 전략]
 *  - useApiFetch의 key: 'currency-rates'로 앱 전체에서 캐시하여 중복 호출 방지
 *
 * [반환값]
 *  - exchangeRates : Record<string, number> (통화코드 → 원화 환율 매핑, KRW=1 기본 포함)
 *  - isLoaded      : 데이터 로딩 완료 여부
 *  - fetchRates    : 환율 데이터 수동 새로고침 함수
 *  - convertToKRW  : 외화 금액 → 원화 환산 함수
 * ============================================================================
 */
import { computed } from '#imports';

/**
 * 환율 조회 및 원화 환산 composable
 * @returns exchangeRates, isLoaded, fetchRates, convertToKRW
 */
export const useCurrencyRates = () => {
    // runtimeConfig에서 API 베이스 URL 조회 (.env의 NUXT_PUBLIC_API_BASE 참조)
    const config = useRuntimeConfig();
    const apiBaseUrl = config.public.apiBase ? `${config.public.apiBase}/api/ccodem/type/CUR` : '/api/ccodem/type/CUR';

    /**
     * useApiFetch를 사용하여 환율 정보를 호출합니다.
     * key: 'currency-rates'를 통해 앱 전체에서 결과를 캐시하여 중복 호출을 방지합니다.
     */
    const { data, pending, error, refresh } = useApiFetch<any[]>(apiBaseUrl, {
        key: 'currency-rates',
    });

    /**
     * API 응답 데이터를 { 통화코드: 환율 } 형태로 가공합니다.
     * KRW는 기본값 1로 항상 포함됩니다.
     *
     * [API 응답 예시]
     *  [{ cdNm: 'USD', cdva: '1350' }, { cdNm: 'EUR', cdva: '1480' }]
     *  → { KRW: 1, USD: 1350, EUR: 1480 }
     */
    const exchangeRates = computed<Record<string, number>>(() => {
        const rates: Record<string, number> = { KRW: 1 };
        if (data.value && Array.isArray(data.value)) {
            data.value.forEach(item => {
                if (item.cdNm && item.cdva) {
                    rates[item.cdNm] = Number(item.cdva);
                }
            });
        }
        return rates;
    });

    /** 환율 데이터 로딩 완료 여부 (pending/error 모두 false일 때 true) */
    const isLoaded = computed(() => !pending.value && !error.value);

    /**
     * 금액을 지정된 통화에서 원화(KRW)로 환산합니다.
     * exchangeRates에 해당 통화가 없으면 환율 1(원화 그대로)로 처리합니다.
     *
     * @param amount - 환산할 금액
     * @param currency - 통화 코드 ('KRW', 'USD', 'EUR', 'JPY', 'CNY' 등)
     * @returns 원화로 환산된 금액 (반올림 정수)
     *
     * @example
     * convertToKRW(1000, 'USD') // → 1,350,000 (USD 환율이 1350인 경우)
     * convertToKRW(5000, 'KRW') // → 5,000 (원화는 환율 1)
     */
    const convertToKRW = (amount: number, currency: string = 'KRW'): number => {
        const rate = exchangeRates.value[currency] || 1;
        return Math.round(amount * rate);
    };

    return {
        exchangeRates,   // 통화별 환율 매핑 (computed)
        isLoaded,        // 로딩 완료 여부 (computed)
        fetchRates: refresh, // 환율 데이터 수동 새로고침 (호환성을 위해 refresh → fetchRates 별칭)
        convertToKRW     // 외화 → 원화 환산 함수
    };
};
