import { computed } from '#imports';

export const useCurrencyRates = () => {
    const config = useRuntimeConfig();
    const apiBaseUrl = config.public.apiBase ? `${config.public.apiBase}/api/ccodem/type/CUR` : '/api/ccodem/type/CUR';

    /**
     * useApiFetch를 사용하여 환율 정보를 호출합니다.
     * key: 'currency-rates'를 통해 앱 전체에서 결과를 캐시하여 중복 호출을 방지합나다.
     */
    const { data, pending, error, refresh } = useApiFetch<any[]>(apiBaseUrl, {
        key: 'currency-rates',
    });

    /**
     * API 응답 데이터를 Record<string, number> 형태로 가공합니다.
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

    const isLoaded = computed(() => !pending.value && !error.value);

    /**
     * 금액을 지정된 통화에서 원화(KRW)로 환산합니다.
     * 
     * @param amount - 환산할 금액
     * @param currency - 통화 코드 ('KRW', 'USD', 'EUR', 'JPY', 'CNY' 등)
     * @returns 원화로 환산된 금액
     */
    const convertToKRW = (amount: number, currency: string = 'KRW'): number => {
        const rate = exchangeRates.value[currency] || 1;
        return Math.round(amount * rate);
    };

    return {
        exchangeRates,
        isLoaded,
        fetchRates: refresh, // 호환성을 위해 refresh 함수를 fetchRates로 반환
        convertToKRW
    };
};
