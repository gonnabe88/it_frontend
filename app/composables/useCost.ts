/**
 * ============================================================================
 * [useCost] IT 관리비(전산업무비) 관리 Composable
 * ============================================================================
 * IT 관리비 항목에 대한 CRUD API 호출을 담당하는 composable입니다.
 * Spring Boot 백엔드의 /api/cost 엔드포인트와 통신합니다.
 *
 * [제공 기능]
 *  - fetchCosts     : 전체 IT 관리비 목록 조회
 *  - fetchCost      : 단일 IT 관리비 상세 조회
 *  - fetchCostsBulk : 복수 IT 관리비 일괄 조회 (관리번호 배열로 요청)
 *  - createCost     : 새 IT 관리비 항목 생성
 *  - updateCost     : 기존 IT 관리비 항목 수정
 *  - deleteCost     : IT 관리비 항목 삭제
 *
 * [API 패턴]
 *  - 조회(GET): useApiFetch 사용 (자동 인증 + 반응형 watch)
 *  - 변경(POST/PUT/DELETE): $apiFetch 사용 (plugins/auth.ts 제공)
 * ============================================================================
 */

/**
 * [ItCost] IT 관리비(전산업무비) 항목 인터페이스
 * 서버 API의 응답 및 요청 데이터 구조를 정의합니다.
 */
export interface ItCost {
    itMngcNo?: string;      // 전산업무비 관리번호 (PK, 서버에서 채번)
    itMngcSno?: number;     // 전산업무비 일련번호 (버전 관리용)
    lstYn?: string;         // 최종여부 (Y: 최신 데이터 / N: 이력 데이터)
    ioeNm: string;          // 비목명 (지출 항목의 분류명)
    cttNm: string;          // 계약명 (계약서상 명칭)
    cttTp: string;          // 계약구분 (유지보수, 라이선스, 서비스 등)
    cttOpp: string;         // 계약상대처 (벤더/공급사명)
    itMngcBg: number;       // 전산업무비 예산 금액
    dfrCle: string;         // 지급주기 (월별, 분기별, 연간 등)
    fstDfrDt: string | Date;// 지급예정월 / 최초지급일자
    cur: string;            // 통화 (KRW, USD, EUR 등)
    xcr?: number;           // 환율 (외화 계약 시 사용, optional)
    xcrBseDt?: string;      // 환율기준일자 (환율 적용 기준 날짜, optional)
    infPrtYn: string;       // 정보보호여부 (Y: 정보보호 관련 항목 / N: 일반)
    indRsn: string;         // 증감사유 (전년 대비 예산 증감 사유)
    pulCgpr: string;        // 추진담당자 (해당 계약의 IT 담당자)
    delYn?: string;         // 삭제여부 (Y: 삭제됨 / N: 유효, optional)
}

/**
 * IT 관리비 관리 Composable 함수
 *
 * @returns IT 관리비 관련 API 함수 객체
 */
export const useCost = () => {
    // runtimeConfig에서 API 베이스 URL 조회 (nuxt.config.ts 및 .env 참조)
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/cost`;

    // POST/PUT/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * IT 관리비 전체 목록 조회
     * useApiFetch를 사용하여 자동 인증 및 토큰 갱신이 적용됩니다.
     *
     * @returns useApiFetch 반환값 ({ data: ItCost[], pending, error, refresh })
     *
     * @example
     * const { data: costs, pending } = fetchCosts();
     */
    const fetchCosts = () => {
        return useApiFetch<ItCost[]>(API_BASE_URL);
    };

    /**
     * 특정 IT 관리비 항목 상세 조회
     *
     * @param id - 조회할 전산업무비 관리번호 (itMngcNo)
     * @returns useApiFetch 반환값 ({ data: ItCost, pending, error, refresh })
     *
     * @example
     * const { data: cost } = fetchCost('COST-2026-001');
     */
    const fetchCost = (id: string) => {
        return useApiFetch<ItCost>(`${API_BASE_URL}/${id}`);
    };

    /**
     * 복수 IT 관리비 항목 일괄 조회
     * 여러 관리번호를 POST 방식으로 한 번에 조회합니다.
     * (GET 방식의 쿼리스트링 길이 제한을 우회하기 위해 POST 사용)
     *
     * @param itMngcNos - 조회할 전산업무비 관리번호 배열
     * @returns ItCost 배열
     *
     * @example
     * const costs = await fetchCostsBulk(['COST-001', 'COST-002', 'COST-003']);
     */
    const fetchCostsBulk = async (itMngcNos: string[]) => {
        return await $apiFetch<ItCost[]>(`${API_BASE_URL}/bulk-get`, {
            method: 'POST',
            body: {
                itMngcNos
            }
        });
    };

    /**
     * 새 IT 관리비 항목 생성
     *
     * @param payload - 생성할 IT 관리비 데이터 (ItCost 형식)
     * @returns 서버 처리 결과 (생성된 ItCost 객체)
     *
     * @example
     * await createCost({
     *   ioeNm: '소프트웨어 유지보수', cttNm: 'Oracle DB 유지보수',
     *   cttTp: '유지보수', cttOpp: 'Oracle Korea',
     *   itMngcBg: 50000000, dfrCle: '연간',
     *   fstDfrDt: '2026-01-01', cur: 'KRW',
     *   infPrtYn: 'N', indRsn: '전년 동일', pulCgpr: '홍길동'
     * });
     */
    const createCost = async (payload: ItCost) => {
        return await $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    /**
     * 기존 IT 관리비 항목 수정
     *
     * @param id      - 수정할 전산업무비 관리번호 (itMngcNo)
     * @param payload - 수정할 데이터 (ItCost 형식)
     * @returns 서버 처리 결과 (수정된 ItCost 객체)
     *
     * @example
     * await updateCost('COST-2026-001', { ...existingCost, itMngcBg: 55000000 });
     */
    const updateCost = async (id: string, payload: ItCost) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    /**
     * IT 관리비 항목 삭제
     * 서버에서는 실제 삭제 대신 delYn='Y' 처리(소프트 삭제)할 수 있습니다.
     *
     * @param id - 삭제할 전산업무비 관리번호 (itMngcNo)
     * @returns 서버 처리 결과
     *
     * @example
     * await deleteCost('COST-2026-001');
     */
    const deleteCost = async (id: string) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'DELETE'
        });
    };

    return {
        fetchCosts,
        fetchCost,
        fetchCostsBulk,
        createCost,
        updateCost,
        deleteCost
    };
};
