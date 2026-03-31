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
    fstEnrUsNm: string;
    lstChgDtm: string;
    lstChgUsid: string;
    lstChgUsNm: string;
}

// ============================================================================
// 자격등급 타입 정의
// ============================================================================

export interface AdminAuthGradeRequest {
    athId: string;
    qlfGrNm?: string;
    qlfGrMat?: string;
    useYn?: string;
}

export interface AdminAuthGradeResponse {
    athId: string;
    qlfGrNm: string;
    qlfGrMat: string;
    useYn: string;
    fstEnrDtm: string;
    fstEnrUsid: string;
    fstEnrUsNm: string;
    lstChgDtm: string;
    lstChgUsid: string;
    lstChgUsNm: string;
}

// ============================================================================
// 역할 타입 정의
// ============================================================================

export interface AdminRoleRequest {
    athId: string;
    eno: string;
    useYn?: string;
}

export interface AdminRoleResponse {
    athId: string;
    eno: string;
    usrNm: string;
    useYn: string;
    fstEnrDtm: string;
    fstEnrUsid: string;
    fstEnrUsNm: string;
    lstChgDtm: string;
    lstChgUsid: string;
    lstChgUsNm: string;
}

// ============================================================================
// 사용자 타입 정의
// ============================================================================

export interface AdminUserRequest {
    eno: string;
    usrNm?: string;
    ptCNm?: string;
    temC?: string;
    bbrC?: string;
    etrMilAddrNm?: string;
    inleNo?: string;
    cpnTpn?: string;
    password?: string;
}

export interface AdminUserResponse {
    eno: string;
    usrNm: string;
    ptCNm: string;
    temC: string;
    temNm: string;
    bbrC: string;
    bbrNm: string;
    etrMilAddrNm: string;
    inleNo: string;
    cpnTpn: string;
    fstEnrDtm: string;
    lstChgDtm: string;
}

// ============================================================================
// 조직 타입 정의
// ============================================================================

export interface AdminOrgRequest {
    prlmOgzCCone: string;
    bbrNm?: string;
    bbrWrenNm?: string;
    itmSqnSno?: string;
    prlmHrkOgzCCone?: string;
}

export interface AdminOrgResponse {
    prlmOgzCCone: string;
    bbrNm: string;
    bbrWrenNm: string;
    itmSqnSno: string;
    prlmHrkOgzCCone: string;
    fstEnrDtm: string;
    fstEnrUsid: string;
    fstEnrUsNm: string;
    lstChgDtm: string;
    lstChgUsid: string;
    lstChgUsNm: string;
}

// ============================================================================
// 로그인 이력 타입 정의
// ============================================================================

export interface AdminLoginHistoryResponse {
    eno: string;
    usrNm: string;
    lgnDtm: string;
    lgnTp: string;
    ipAddr: string;
    flurRsn: string;
    ustAgt: string;
    fstEnrDtm: string;
}

// ============================================================================
// JWT 토큰 타입 정의
// ============================================================================

export interface AdminTokenResponse {
    eno: string;
    usrNm: string;
    endDtm: string;
    tokMasked: string;
    fstEnrDtm: string;
}

// ============================================================================
// 첨부파일 타입 정의
// ============================================================================

export interface AdminFileResponse {
    flMngNo: string;
    orcFlNm: string;
    flDtt: string;
    orcDtt: string;
    fstEnrDtm: string;
    fstEnrUsid: string;
    fstEnrUsNm: string;
}

// ============================================================================
// 대시보드 통계 타입 정의
// ============================================================================

export interface AdminLoginStatResponse {
    date: string;   // YYYY-MM-DD
    count: number;
}

// ============================================================================
// 페이지네이션 공통 타입 (Spring Page 응답)
// ============================================================================

export interface AdminPageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;       // 현재 페이지 (0-based)
    size: number;
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

    const fetchCodes = () =>
        useApiFetch<AdminCodeResponse[]>(`${BASE}/codes`);

    const createCode = (body: AdminCodeRequest) =>
        $apiFetch(`${BASE}/codes`, { method: 'POST', body });

    const updateCode = (cdId: string, body: AdminCodeRequest) =>
        $apiFetch(`${BASE}/codes/${cdId}`, { method: 'PUT', body });

    const deleteCode = (cdId: string) =>
        $apiFetch(`${BASE}/codes/${cdId}`, { method: 'DELETE' });

    // ==========================================================================
    // 자격등급 (TAAABB_CAUTHI) — M3
    // ==========================================================================

    const fetchAuthGrades = () =>
        useApiFetch<AdminAuthGradeResponse[]>(`${BASE}/auth-grades`);

    const createAuthGrade = (body: AdminAuthGradeRequest) =>
        $apiFetch(`${BASE}/auth-grades`, { method: 'POST', body });

    const updateAuthGrade = (athId: string, body: AdminAuthGradeRequest) =>
        $apiFetch(`${BASE}/auth-grades/${athId}`, { method: 'PUT', body });

    const deleteAuthGrade = (athId: string) =>
        $apiFetch(`${BASE}/auth-grades/${athId}`, { method: 'DELETE' });

    // ==========================================================================
    // 역할 (TAAABB_CROLEI) — M4
    // ==========================================================================

    const fetchRoles = () =>
        useApiFetch<AdminRoleResponse[]>(`${BASE}/roles`);

    const createRole = (body: AdminRoleRequest) =>
        $apiFetch(`${BASE}/roles`, { method: 'POST', body });

    const updateRole = (athId: string, eno: string, body: AdminRoleRequest) =>
        $apiFetch(`${BASE}/roles/${athId}/${eno}`, { method: 'PUT', body });

    const deleteRole = (athId: string, eno: string) =>
        $apiFetch(`${BASE}/roles/${athId}/${eno}`, { method: 'DELETE' });

    // ==========================================================================
    // 사용자 (TAAABB_CUSERI) — M5
    // ==========================================================================

    const fetchUsers = () =>
        useApiFetch<AdminUserResponse[]>(`${BASE}/users`);

    const createUser = (body: AdminUserRequest) =>
        $apiFetch(`${BASE}/users`, { method: 'POST', body });

    const updateUser = (eno: string, body: AdminUserRequest) =>
        $apiFetch(`${BASE}/users/${eno}`, { method: 'PUT', body });

    const deleteUser = (eno: string) =>
        $apiFetch(`${BASE}/users/${eno}`, { method: 'DELETE' });

    // ==========================================================================
    // 조직 (TAAABB_CORGNI) — M6
    // ==========================================================================

    const fetchOrganizations = () =>
        useApiFetch<AdminOrgResponse[]>(`${BASE}/organizations`);

    const createOrganization = (body: AdminOrgRequest) =>
        $apiFetch(`${BASE}/organizations`, { method: 'POST', body });

    const updateOrganization = (orgC: string, body: AdminOrgRequest) =>
        $apiFetch(`${BASE}/organizations/${orgC}`, { method: 'PUT', body });

    const deleteOrganization = (orgC: string) =>
        $apiFetch(`${BASE}/organizations/${orgC}`, { method: 'DELETE' });

    // ==========================================================================
    // 로그인이력 (TAAABB_CLOGNH) — M7
    // ==========================================================================

    const fetchLoginHistory = (page = 0, size = 50) =>
        useApiFetch<AdminPageResponse<AdminLoginHistoryResponse>>(`${BASE}/login-history`, {
            query: { page, size },
        });

    // ==========================================================================
    // JWT 토큰 (TAAABB_CRTOKM) — M7
    // ==========================================================================

    const fetchTokens = () =>
        useApiFetch<AdminTokenResponse[]>(`${BASE}/tokens`);

    // ==========================================================================
    // 첨부파일 (TAAABB_CFILEM) — M7
    // ==========================================================================

    const fetchFiles = () =>
        useApiFetch<AdminFileResponse[]>(`${BASE}/files`);

    // ==========================================================================
    // 대시보드 통계 — M8
    // ==========================================================================

    const fetchLoginStats = () =>
        useApiFetch<AdminLoginStatResponse[]>(`${BASE}/dashboard/login-stats`);

    return {
        // 공통코드
        fetchCodes, createCode, updateCode, deleteCode,
        // 자격등급
        fetchAuthGrades, createAuthGrade, updateAuthGrade, deleteAuthGrade,
        // 역할
        fetchRoles, createRole, updateRole, deleteRole,
        // 사용자
        fetchUsers, createUser, updateUser, deleteUser,
        // 조직
        fetchOrganizations, createOrganization, updateOrganization, deleteOrganization,
        // 로그인이력 / JWT토큰 / 첨부파일
        fetchLoginHistory, fetchTokens, fetchFiles,
        // 대시보드
        fetchLoginStats,
    };
};
