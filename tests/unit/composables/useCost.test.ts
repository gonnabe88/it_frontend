/**
 * ============================================================================
 * [tests/unit/composables/useCost.test.ts] useCost Composable 단위 테스트
 * ============================================================================
 * composables/useCost.ts의 API 호출 패턴을 테스트합니다.
 *
 * [테스트 전략]
 * - useApiFetch(반응형 GET)와 $apiFetch(일회성 POST/PUT/DELETE)를 각각 Mock
 * - useRuntimeConfig, useNuxtApp을 vi.stubGlobal()로 대체
 * - 실제 HTTP 요청 없이 URL·메서드·payload 전달만 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock 설정
// ============================================================================

// useRuntimeConfig Mock: API 베이스 URL 제공
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

// useApiFetch Mock: GET 조회 (반응형 useFetch 래퍼)
const mockUseApiFetch = vi.fn().mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
vi.stubGlobal('useApiFetch', mockUseApiFetch);

// $apiFetch Mock: POST/PUT/DELETE (일회성 인증 fetch)
const mockApiFetch = vi.fn().mockResolvedValue({});

// useNuxtApp Mock: $apiFetch 제공
vi.stubGlobal('useNuxtApp', () => ({
    $apiFetch: mockApiFetch
}));

// ============================================================================
// useCost 인라인 구현 (Nuxt auto-import 없이 테스트)
// composables/useCost.ts와 동일한 로직
// ============================================================================

interface ItCost {
    itMngcNo?: string;
    ioeC: string;
    cttNm: string;
    cttOpp: string;
    itMngcBg: number;
    dfrCle: string;
    fstDfrDt: string;
    cur: string;
    infPrtYn: string;
    indRsn: string;
    cgpr: string;
    biceDpm: string;
    biceTem: string;
    abusC: string;
    itMngcTp: string;
    pulDtt: string;
}

const useCost = () => {
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/cost`;
    const { $apiFetch } = useNuxtApp();

    const fetchCosts = (query?: Record<string, string>) => {
        return useApiFetch<ItCost[]>(API_BASE_URL, query ? { query } : {});
    };

    const fetchCost = (id: string) => {
        return useApiFetch<ItCost>(`${API_BASE_URL}/${id}`);
    };

    const fetchCostsBulk = async (itMngcNos: string[]) => {
        return await $apiFetch<ItCost[]>(`${API_BASE_URL}/bulk-get`, {
            method: 'POST',
            body: { itMngcNos }
        });
    };

    const createCost = async (payload: ItCost) => {
        return await $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    const updateCost = async (id: string, payload: ItCost) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deleteCost = async (id: string) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'DELETE'
        });
    };

    const fetchCostOnce = async (id: string): Promise<ItCost> => {
        return await $apiFetch<ItCost>(`${API_BASE_URL}/${id}`);
    };

    return { fetchCosts, fetchCost, fetchCostOnce, fetchCostsBulk, createCost, updateCost, deleteCost };
};

// ============================================================================
// 테스트용 최소 ItCost 픽스처
// ============================================================================
const makeItCost = (overrides: Partial<ItCost> = {}): ItCost => ({
    ioeC:      'IOE_SEVS',
    cttNm:     '테스트 계약',
    cttOpp:    '(주)테스트벤더',
    itMngcBg:  1000000,
    dfrCle:    '월별',
    fstDfrDt:  '2026-01-01',
    cur:       'KRW',
    infPrtYn:  'N',
    indRsn:    '신규',
    cgpr:      'E001',
    biceDpm:   'D001',
    biceTem:   'T001',
    abusC:     'A001',
    itMngcTp:  'SW',
    pulDtt:    'NEW',
    ...overrides,
});

// ============================================================================
// 테스트
// ============================================================================
describe('useCost', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // fetchCosts — useApiFetch 기반 반응형 조회
    // -------------------------------------------------------------------------
    describe('fetchCosts()', () => {
        it('올바른 URL로 useApiFetch를 호출한다', () => {
            const { fetchCosts } = useCost();
            fetchCosts();

            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost',
                {}
            );
        });

        it('query 파라미터가 있으면 { query } 옵션으로 전달한다', () => {
            const { fetchCosts } = useCost();
            fetchCosts({ apfSts: 'none' });

            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost',
                { query: { apfSts: 'none' } }
            );
        });

        it('query 미전달 시 빈 options 객체로 useApiFetch를 호출한다', () => {
            const { fetchCosts } = useCost();
            fetchCosts();

            const [, options] = mockUseApiFetch.mock.calls[0];
            expect(options).toEqual({});
        });
    });

    // -------------------------------------------------------------------------
    // fetchCost — 단건 상세 조회
    // -------------------------------------------------------------------------
    describe('fetchCost(id)', () => {
        it('동적 ID를 포함한 URL로 useApiFetch를 호출한다', () => {
            const { fetchCost } = useCost();
            fetchCost('COST-2026-001');

            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost/COST-2026-001'
            );
        });

        it('다른 ID로 호출해도 URL에 올바르게 반영된다', () => {
            const { fetchCost } = useCost();
            fetchCost('COST-2026-999');

            const [url] = mockUseApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/cost/COST-2026-999');
        });
    });

    // -------------------------------------------------------------------------
    // fetchCostOnce — 비반응형 단건 조회 ($apiFetch)
    // -------------------------------------------------------------------------
    describe('fetchCostOnce(id)', () => {
        it('$apiFetch로 올바른 URL을 호출한다', async () => {
            mockApiFetch.mockResolvedValueOnce(makeItCost({ itMngcNo: 'COST-2026-001' }));
            const { fetchCostOnce } = useCost();

            await fetchCostOnce('COST-2026-001');

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost/COST-2026-001'
            );
        });

        it('서버 응답 데이터를 그대로 반환한다', async () => {
            const mockData = makeItCost({ itMngcNo: 'COST-2026-001', cttNm: '서버 응답 계약명' });
            mockApiFetch.mockResolvedValueOnce(mockData);
            const { fetchCostOnce } = useCost();

            const result = await fetchCostOnce('COST-2026-001');

            expect(result).toEqual(mockData);
        });
    });

    // -------------------------------------------------------------------------
    // createCost — POST
    // -------------------------------------------------------------------------
    describe('createCost(payload)', () => {
        it('POST 메서드와 payload를 $apiFetch에 전달한다', async () => {
            const payload = makeItCost({ cttNm: '신규 계약' });
            const { createCost } = useCost();

            await createCost(payload);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost',
                expect.objectContaining({
                    method: 'POST',
                    body: payload,
                })
            );
        });

        it('올바른 엔드포인트 URL(기본 경로)로 호출한다', async () => {
            const { createCost } = useCost();
            await createCost(makeItCost());

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/cost');
        });
    });

    // -------------------------------------------------------------------------
    // updateCost — PUT
    // -------------------------------------------------------------------------
    describe('updateCost(id, payload)', () => {
        it('PUT 메서드와 동적 URL, payload를 $apiFetch에 전달한다', async () => {
            const payload = makeItCost({ itMngcNo: 'COST-2026-001', cttNm: '수정된 계약명' });
            const { updateCost } = useCost();

            await updateCost('COST-2026-001', payload);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost/COST-2026-001',
                expect.objectContaining({
                    method: 'PUT',
                    body: payload,
                })
            );
        });

        it('ID가 PUT URL에 올바르게 포함된다', async () => {
            const { updateCost } = useCost();
            await updateCost('COST-2026-777', makeItCost());

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/cost/COST-2026-777');
        });
    });

    // -------------------------------------------------------------------------
    // deleteCost — DELETE
    // -------------------------------------------------------------------------
    describe('deleteCost(id)', () => {
        it('DELETE 메서드와 동적 URL로 $apiFetch를 호출한다', async () => {
            const { deleteCost } = useCost();
            await deleteCost('COST-2026-001');

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost/COST-2026-001',
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('ID가 삭제 URL에 올바르게 반영된다', async () => {
            const { deleteCost } = useCost();
            await deleteCost('COST-2026-555');

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/cost/COST-2026-555');
        });
    });

    // -------------------------------------------------------------------------
    // fetchCostsBulk — 배열 payload POST
    // -------------------------------------------------------------------------
    describe('fetchCostsBulk(ids)', () => {
        it('bulk-get 엔드포인트로 POST 요청하며 관리번호 배열을 body에 담는다', async () => {
            const ids = ['COST-001', 'COST-002', 'COST-003'];
            mockApiFetch.mockResolvedValueOnce([makeItCost(), makeItCost(), makeItCost()]);
            const { fetchCostsBulk } = useCost();

            await fetchCostsBulk(ids);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/cost/bulk-get',
                expect.objectContaining({
                    method: 'POST',
                    body: { itMngcNos: ids },
                })
            );
        });

        it('빈 배열을 전달해도 오류 없이 호출된다', async () => {
            mockApiFetch.mockResolvedValueOnce([]);
            const { fetchCostsBulk } = useCost();

            await fetchCostsBulk([]);

            const [, options] = mockApiFetch.mock.calls[0];
            expect(options.body).toEqual({ itMngcNos: [] });
        });
    });
});
