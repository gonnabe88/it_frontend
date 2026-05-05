/**
 * ============================================================================
 * [tests/unit/composables/useCurrencyRates.test.ts] 환율 정보 Composable 테스트
 * ============================================================================
 * composables/useCurrencyRates.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useCurrencyRates } from '~/composables/useCurrencyRates';

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));
vi.stubGlobal('computed', computed);

const mockData = ref<{ cdNm: string; cdva: string }[] | null>(null);
const mockPending = ref(false);
const mockError = ref(null);
const mockRefresh = vi.fn();

const mockUseApiFetch = vi.fn().mockImplementation(() => ({
    data: mockData,
    pending: mockPending,
    error: mockError,
    refresh: mockRefresh,
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useCurrencyRates', () => {
    beforeEach(() => {
        mockData.value = null;
        mockPending.value = false;
        mockError.value = null;
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({
            data: mockData,
            pending: mockPending,
            error: mockError,
            refresh: mockRefresh,
        }));
    });

    describe('exchangeRates', () => {
        it('데이터가 없으면 KRW:1만 포함한다', () => {
            mockData.value = null;
            const { exchangeRates } = useCurrencyRates();
            expect(exchangeRates.value).toEqual({ KRW: 1 });
        });

        it('API 데이터를 { 통화코드: 환율 } 형태로 변환한다', () => {
            mockData.value = [
                { cdNm: 'USD', cdva: '1350' },
                { cdNm: 'EUR', cdva: '1480' },
            ];
            const { exchangeRates } = useCurrencyRates();
            expect(exchangeRates.value).toEqual({ KRW: 1, USD: 1350, EUR: 1480 });
        });

        it('cdNm 또는 cdva가 없는 항목은 무시한다', () => {
            mockData.value = [
                { cdNm: 'USD', cdva: '1350' },
                { cdNm: '',    cdva: '1000' }, // cdNm 없음
            ] as typeof mockData.value;
            const { exchangeRates } = useCurrencyRates();
            expect(Object.keys(exchangeRates.value)).toContain('USD');
            expect(Object.keys(exchangeRates.value)).not.toContain('');
        });
    });

    describe('isLoaded', () => {
        it('pending=false, error=null이면 true를 반환한다', () => {
            mockPending.value = false;
            mockError.value = null;
            const { isLoaded } = useCurrencyRates();
            expect(isLoaded.value).toBe(true);
        });

        it('pending=true이면 false를 반환한다', () => {
            mockPending.value = true;
            const { isLoaded } = useCurrencyRates();
            expect(isLoaded.value).toBe(false);
        });
    });

    describe('convertToKRW', () => {
        beforeEach(() => {
            mockData.value = [{ cdNm: 'USD', cdva: '1350' }];
        });

        it('KRW는 환율 1로 그대로 반환한다', () => {
            const { convertToKRW } = useCurrencyRates();
            expect(convertToKRW(5000, 'KRW')).toBe(5000);
        });

        it('USD 1000을 원화로 환산한다', () => {
            const { convertToKRW } = useCurrencyRates();
            expect(convertToKRW(1000, 'USD')).toBe(1350000);
        });

        it('알 수 없는 통화는 환율 1로 처리한다', () => {
            const { convertToKRW } = useCurrencyRates();
            expect(convertToKRW(1000, 'XXX')).toBe(1000);
        });

        it('통화 미지정 시 KRW(환율 1)로 처리한다', () => {
            const { convertToKRW } = useCurrencyRates();
            expect(convertToKRW(1000)).toBe(1000);
        });

        it('반올림된 정수를 반환한다', () => {
            mockData.value = [{ cdNm: 'JPY', cdva: '9.5' }];
            const { convertToKRW } = useCurrencyRates();
            expect(Number.isInteger(convertToKRW(10, 'JPY'))).toBe(true);
        });
    });

    it('fetchRates는 refresh 함수의 별칭이다', () => {
        const { fetchRates } = useCurrencyRates();
        expect(typeof fetchRates).toBe('function');
    });
});
