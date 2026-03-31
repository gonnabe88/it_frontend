/**
 * ============================================================================
 * [composables/useAdminApi.ts] 관리자 API 공통 Composable
 * ============================================================================
 * 관리자 전용 API(/api/admin/**)에 대한 요청 함수를 제공합니다.
 *
 * [API 유틸 사용 규칙]
 *  - GET (조회): useApiFetch<T> — 반응형 데이터, refresh() 지원
 *  - POST/PUT/DELETE (변경): $apiFetch — 일회성 호출
 *
 * [Design Ref: §3.5 — composables/useAdminApi.ts]
 * ============================================================================
 */

// ============================================================================
// 공통코드 타입 정의
// ============================================================================

export interface AdminCodeRequest {
    cdId: string;
    cdNm?: string;
    cdva?: string;
    cdDes?: string;
    cttTp?: string;
    cttTpDes?: string;
    sttDt?: string;
    endDt?: string;
    cdSqn?: number;
}

export interface AdminCodeResponse {
    cdId: string;
    cdNm: string;
    cdva: string;
    cdDes: string;
    cttTp: string;
    cttTpDes: string;
    sttDt: string;
    endDt: string;
    cdSqn: number;
    fstEnrDtm: string;
    fstEnrUsid: string;
    fstEnrUsNm: string;   // ENO → 이름 변환
    lstChgDtm: string;
    lstChgUsid: string;
    lstChgUsNm: string;   // ENO → 이름 변환
}

// ============================================================================
// Composable 정의
// ============================================================================

export const useAdminApi = () => {
    const { $apiFetch } = useNuxtApp();
    // runtimeConfig에서 백엔드 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const BASE = `${config.public.apiBase}/api/admin`;

    // ==========================================================================
    // 공통코드 (TAAABB_CCODEM)
    // ==========================================================================

    /**
     * 공통코드 목록 조회 (반응형)
     * 컴포넌트 마운트 시 자동 호출, refresh()로 수동 갱신 가능
     */
    const fetchCodes = () =>
        useApiFetch<AdminCodeResponse[]>(`${BASE}/codes`);

    /**
     * 공통코드 추가
     * @param body 공통코드 생성 요청
     */
    const createCode = (body: AdminCodeRequest) =>
        $apiFetch(`${BASE}/codes`, { method: 'POST', body });

    /**
     * 공통코드 수정 (인라인 편집 즉시 저장)
     * @param cdId 코드ID
     * @param body 공통코드 수정 요청
     */
    const updateCode = (cdId: string, body: AdminCodeRequest) =>
        $apiFetch(`${BASE}/codes/${cdId}`, { method: 'PUT', body });

    /**
     * 공통코드 삭제 (Soft Delete)
     * @param cdId 코드ID
     */
    const deleteCode = (cdId: string) =>
        $apiFetch(`${BASE}/codes/${cdId}`, { method: 'DELETE' });

    // ==========================================================================
    // 자격등급, 사용자, 조직, 역할 — Session 2 구현 예정
    // ==========================================================================

    // ==========================================================================
    // 로그인이력, JWT토큰, 첨부파일, 대시보드 — Session 3 구현 예정
    // ==========================================================================

    return {
        // 공통코드
        fetchCodes,
        createCode,
        updateCode,
        deleteCode,
    };
};
