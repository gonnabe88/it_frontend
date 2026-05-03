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
import { isRef, ref, unref, type Ref } from 'vue';

// ============================================================================
// 공통코드 타입 정의 (TAAABB_CCODEM)
// ============================================================================

/** 공통코드 생성/수정 요청 DTO */
export interface AdminCodeRequest {
    cdId: string;        // 코드ID (PK)
    cdNm?: string;       // 코드명
    cdva?: string;       // 코드값
    cdDes?: string;      // 코드설명
    cttTp?: string;      // 코드값구분 (카테고리, 예: 'PRJ_TP')
    cttTpDes?: string;   // 코드값구분설명
    sttDt?: string;      // 적용시작일 (YYYY-MM-DD)
    endDt?: string;      // 적용종료일 (YYYY-MM-DD)
    cdSqn?: number;      // 코드정렬순번
}

/** 공통코드 조회 응답 DTO */
export interface AdminCodeResponse {
    cdId: string;        // 코드ID (PK)
    cdNm: string;        // 코드명
    cdva: string;        // 코드값
    cdDes: string;       // 코드설명
    cttTp: string;       // 코드값구분
    cttTpDes: string;    // 코드값구분설명
    sttDt: string;       // 적용시작일
    endDt: string;       // 적용종료일
    cdSqn: number;       // 코드정렬순번
    fstEnrDtm: string;   // 최초등록일시
    fstEnrUsid: string;  // 최초등록자 사번
    fstEnrUsNm: string;  // 최초등록자명
    lstChgDtm: string;   // 최종변경일시
    lstChgUsid: string;  // 최종변경자 사번
    lstChgUsNm: string;  // 최종변경자명
}

// ============================================================================
// 자격등급 타입 정의 (TAAABB_CAUTHI)
// ============================================================================

/** 자격등급 생성/수정 요청 DTO */
export interface AdminAuthGradeRequest {
    athId: string;       // 자격등급ID (PK, 예: ITPAD001)
    qlfGrNm?: string;    // 자격등급명 (예: 시스템관리자)
    qlfGrMat?: string;   // 자격등급설명
    useYn?: string;      // 사용여부 (Y/N)
}

/** 자격등급 조회 응답 DTO */
export interface AdminAuthGradeResponse {
    athId: string;       // 자격등급ID (PK)
    qlfGrNm: string;     // 자격등급명
    qlfGrMat: string;    // 자격등급설명
    useYn: string;       // 사용여부
    fstEnrDtm: string;   // 최초등록일시
    fstEnrUsid: string;  // 최초등록자 사번
    fstEnrUsNm: string;  // 최초등록자명
    lstChgDtm: string;   // 최종변경일시
    lstChgUsid: string;  // 최종변경자 사번
    lstChgUsNm: string;  // 최종변경자명
}

// ============================================================================
// 역할 타입 정의 (TAAABB_CROLEI)
// ============================================================================

/** 역할(사용자-자격등급 매핑) 생성/수정 요청 DTO */
export interface AdminRoleRequest {
    athId: string;       // 자격등급ID (복합PK)
    eno: string;         // 사원번호 (복합PK)
    useYn?: string;      // 사용여부 (Y/N)
}

/** 역할 조회 응답 DTO */
export interface AdminRoleResponse {
    athId: string;       // 자격등급ID (복합PK)
    eno: string;         // 사원번호 (복합PK)
    usrNm: string;       // 사원명
    useYn: string;       // 사용여부
    fstEnrDtm: string;   // 최초등록일시
    fstEnrUsid: string;  // 최초등록자 사번
    fstEnrUsNm: string;  // 최초등록자명
    lstChgDtm: string;   // 최종변경일시
    lstChgUsid: string;  // 최종변경자 사번
    lstChgUsNm: string;  // 최종변경자명
}

// ============================================================================
// 사용자 타입 정의 (TAAABB_CUSERI)
// ============================================================================

/** 사용자 생성/수정 요청 DTO */
export interface AdminUserRequest {
    eno: string;             // 사원번호 (PK)
    usrNm?: string;          // 사원명
    ptCNm?: string;          // 직위명 (예: 대리, 과장)
    temC?: string;           // 소속 팀코드
    temNm?: string;          // 소속 팀명 (직접 수정 시)
    bbrC?: string;           // 소속 부서코드
    etrMilAddrNm?: string;   // 사내 이메일 주소
    inleNo?: string;         // 내선번호
    cpnTpn?: string;         // 휴대폰번호
    password?: string;       // 비밀번호 (생성/변경 시에만 사용)
}

/** 사용자 조회 응답 DTO */
export interface AdminUserResponse {
    eno: string;             // 사원번호 (PK)
    usrNm: string;           // 사원명
    ptCNm: string;           // 직위명
    temC: string;            // 소속 팀코드
    temNm: string;           // 소속 팀명
    bbrC: string;            // 소속 부서코드
    bbrNm: string;           // 소속 부서명
    etrMilAddrNm: string;    // 사내 이메일
    inleNo: string;          // 내선번호
    cpnTpn: string;          // 휴대폰번호
    fstEnrDtm: string;       // 최초등록일시
    lstChgDtm: string;       // 최종변경일시
}

// ============================================================================
// 조직 타입 정의 (TAAABB_CORGNI)
// ============================================================================

/** 조직 생성/수정 요청 DTO */
export interface AdminOrgRequest {
    prlmOgzCCone: string;       // 부서코드 (PK)
    bbrNm?: string;              // 부서명
    bbrWrenNm?: string;          // 부서영문명
    itmSqnSno?: string;          // 정렬순번
    prlmHrkOgzCCone?: string;    // 상위부서코드 (최상위인 경우 null)
}

/** 조직 조회 응답 DTO */
export interface AdminOrgResponse {
    prlmOgzCCone: string;       // 부서코드 (PK)
    bbrNm: string;               // 부서명
    bbrWrenNm: string;           // 부서영문명
    itmSqnSno: string;           // 정렬순번
    prlmHrkOgzCCone: string;     // 상위부서코드
    fstEnrDtm: string;           // 최초등록일시
    fstEnrUsid: string;          // 최초등록자 사번
    fstEnrUsNm: string;          // 최초등록자명
    lstChgDtm: string;           // 최종변경일시
    lstChgUsid: string;          // 최종변경자 사번
    lstChgUsNm: string;          // 최종변경자명
}

// ============================================================================
// 로그인 이력 타입 정의 (TAAABB_CLOGNH)
// ============================================================================

/** 로그인 이력 조회 응답 DTO */
export interface AdminLoginHistoryResponse {
    eno: string;         // 사원번호
    usrNm: string;       // 사원명
    lgnDtm: string;      // 로그인 일시
    lgnTp: string;       // 로그인 유형 (성공/실패)
    ipAddr: string;      // 접속 IP 주소
    flurRsn: string;     // 실패 사유 (성공 시 빈 문자열)
    ustAgt: string;      // User-Agent (브라우저/OS 정보)
    fstEnrDtm: string;   // 최초등록일시
}

// ============================================================================
// JWT 토큰 타입 정의 (TAAABB_CRTOKM)
// ============================================================================

/** 활성 JWT 토큰 조회 응답 DTO */
export interface AdminTokenResponse {
    eno: string;         // 사원번호
    usrNm: string;       // 사원명
    endDtm: string;      // 토큰 만료일시
    tokMasked: string;   // 마스킹된 토큰 (앞 8자리만 노출)
    fstEnrDtm: string;   // 토큰 발급일시
}

// ============================================================================
// 첨부파일 타입 정의 (TAAABB_CFILEM)
// ============================================================================

/** 첨부파일 관리 조회 응답 DTO */
export interface AdminFileResponse {
    flMngNo: string;     // 파일관리번호 (PK)
    orcFlNm: string;     // 원본 파일명
    flDtt: string;       // 파일구분 ('첨부파일' | '이미지')
    orcDtt: string;      // 원본구분 (연결된 도메인 종류)
    fstEnrDtm: string;   // 최초등록일시
    fstEnrUsid: string;  // 최초등록자 사번
    fstEnrUsNm: string;  // 최초등록자명
}

// ============================================================================
// 대시보드 통계 타입 정의
// ============================================================================

/** 일별 로그인 통계 응답 DTO (차트 데이터용) */
export interface AdminLoginStatResponse {
    date: string;   // 집계 날짜 (YYYY-MM-DD)
    count: number;  // 해당 일자 로그인 횟수
}

// ============================================================================
// 상세 로그 타입 정의 (TAAABB_*L)
// ============================================================================

/** 상세 로그 테이블 메타 응답 */
export interface AdminLogTableResponse {
    key: string;        // 화면/URL에서 사용하는 로그 키
    title: string;      // 화면 표시명
    tableName: string;  // 물리 테이블명
    entityName: string; // 백엔드 엔티티명
}

/** 상세 로그 컬럼 메타 응답 */
export interface AdminLogColumnResponse {
    field: string;      // camelCase 필드명
    columnName: string; // DB 컬럼명
    header: string;     // 화면 헤더
    userField: boolean; // 사용자 사번 컬럼 여부
    primary: boolean;   // 로그 번호 컬럼 여부
}

/** 상세 로그 목록 응답 */
export interface AdminLogPageResponse {
    table: AdminLogTableResponse;
    columns: AdminLogColumnResponse[];
    content: Record<string, unknown>[];
    userNames: Record<string, string>;
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

/** 상세 로그 단건 응답 */
export interface AdminLogDetailResponse {
    table: AdminLogTableResponse;
    columns: AdminLogColumnResponse[];
    row: Record<string, unknown>;
    userNames: Record<string, string>;
}

// ============================================================================
// 페이지네이션 공통 타입 (Spring Page 응답)
// ============================================================================

/**
 * Spring Data Page 응답 래퍼 타입
 * @template T - 컨텐츠 배열의 아이템 타입
 */
export interface AdminPageResponse<T> {
    content: T[];           // 현재 페이지 데이터 배열
    totalElements: number;  // 전체 레코드 수
    totalPages: number;     // 전체 페이지 수
    number: number;         // 현재 페이지 번호 (0-based)
    size: number;           // 페이지 크기 (한 페이지당 레코드 수)
}

// ============================================================================
// Composable 정의
// ============================================================================

/**
 * 관리자 API Composable 함수
 *
 * @returns 관리자 도메인별 CRUD API 함수 객체
 */
export const useAdminApi = () => {
    const { $apiFetch } = useNuxtApp();
    // runtimeConfig에서 백엔드 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const BASE = `${config.public.apiBase}/api/admin`;

    // ==========================================================================
    // 공통코드 (TAAABB_CCODEM)
    // ==========================================================================

    /** 공통코드 전체 목록 조회 */
    const fetchCodes = () =>
        useApiFetch<AdminCodeResponse[]>(`${BASE}/codes`);

    /** 공통코드 신규 생성 */
    const createCode = (body: AdminCodeRequest) =>
        $apiFetch(`${BASE}/codes`, { method: 'POST', body });

    /** 공통코드 수정 — sttDt는 복합 PK이므로 쿼리 파라미터로 별도 전달 */
    const updateCode = (cdId: string, body: AdminCodeRequest) =>
        $apiFetch(`${BASE}/codes/${cdId}?sttDt=${body.sttDt ?? ''}`, { method: 'PUT', body });

    /** 공통코드 삭제 — sttDt는 복합 PK이므로 쿼리 파라미터로 전달 */
    const deleteCode = (cdId: string, sttDt: string) =>
        $apiFetch(`${BASE}/codes/${cdId}?sttDt=${sttDt}`, { method: 'DELETE' });

    /**
     * 공통코드 일괄 생성/수정 (Upsert)
     * @param codes - 생성 또는 수정할 코드 배열
     * @returns 처리 결과 (생성 건수, 수정 건수)
     */
    const bulkUpsertCodes = (codes: AdminCodeRequest[]) =>
        $apiFetch<{ created: number; updated: number }>(`${BASE}/codes/bulk`, {
            method: 'POST',
            body: { codes }
        });

    // ==========================================================================
    // 자격등급 (TAAABB_CAUTHI)
    // ==========================================================================

    /** 자격등급 전체 목록 조회 */
    const fetchAuthGrades = () =>
        useApiFetch<AdminAuthGradeResponse[]>(`${BASE}/auth-grades`);

    /** 자격등급 신규 생성 */
    const createAuthGrade = (body: AdminAuthGradeRequest) =>
        $apiFetch(`${BASE}/auth-grades`, { method: 'POST', body });

    /** 자격등급 수정 */
    const updateAuthGrade = (athId: string, body: AdminAuthGradeRequest) =>
        $apiFetch(`${BASE}/auth-grades/${athId}`, { method: 'PUT', body });

    /** 자격등급 삭제 */
    const deleteAuthGrade = (athId: string) =>
        $apiFetch(`${BASE}/auth-grades/${athId}`, { method: 'DELETE' });

    // ==========================================================================
    // 역할 (TAAABB_CROLEI)
    // ==========================================================================

    /** 역할(사용자-자격등급 매핑) 전체 목록 조회 */
    const fetchRoles = () =>
        useApiFetch<AdminRoleResponse[]>(`${BASE}/roles`);

    /** 역할 신규 생성 (사용자에게 자격등급 부여) */
    const createRole = (body: AdminRoleRequest) =>
        $apiFetch(`${BASE}/roles`, { method: 'POST', body });

    /** 역할 수정 */
    const updateRole = (athId: string, eno: string, body: AdminRoleRequest) =>
        $apiFetch(`${BASE}/roles/${athId}/${eno}`, { method: 'PUT', body });

    /** 역할 삭제 (사용자의 자격등급 회수) */
    const deleteRole = (athId: string, eno: string) =>
        $apiFetch(`${BASE}/roles/${athId}/${eno}`, { method: 'DELETE' });

    // ==========================================================================
    // 사용자 (TAAABB_CUSERI)
    // ==========================================================================

    /** 사용자 전체 목록 조회 */
    const fetchUsers = () =>
        useApiFetch<AdminUserResponse[]>(`${BASE}/users`);

    /** 사용자 신규 생성 */
    const createUser = (body: AdminUserRequest) =>
        $apiFetch(`${BASE}/users`, { method: 'POST', body });

    /** 사용자 정보 수정 */
    const updateUser = (eno: string, body: AdminUserRequest) =>
        $apiFetch(`${BASE}/users/${eno}`, { method: 'PUT', body });

    /** 사용자 삭제 */
    const deleteUser = (eno: string) =>
        $apiFetch(`${BASE}/users/${eno}`, { method: 'DELETE' });

    // ==========================================================================
    // 조직 (TAAABB_CORGNI)
    // ==========================================================================

    /** 조직(부서) 전체 목록 조회 */
    const fetchOrganizations = () =>
        useApiFetch<AdminOrgResponse[]>(`${BASE}/organizations`);

    /** 조직(부서) 신규 생성 */
    const createOrganization = (body: AdminOrgRequest) =>
        $apiFetch(`${BASE}/organizations`, { method: 'POST', body });

    /** 조직(부서) 수정 */
    const updateOrganization = (orgC: string, body: AdminOrgRequest) =>
        $apiFetch(`${BASE}/organizations/${orgC}`, { method: 'PUT', body });

    /** 조직(부서) 삭제 */
    const deleteOrganization = (orgC: string) =>
        $apiFetch(`${BASE}/organizations/${orgC}`, { method: 'DELETE' });

    // ==========================================================================
    // 로그인이력 (TAAABB_CLOGNH)
    // ==========================================================================

    /**
     * 로그인이력 페이지네이션 조회
     * @param page - 페이지 번호 (0-based, 기본값 0)
     * @param size - 페이지 크기 (기본값 50)
     */
    const fetchLoginHistory = (page = 0, size = 50) =>
        useApiFetch<AdminPageResponse<AdminLoginHistoryResponse>>(`${BASE}/login-history`, {
            query: { page, size },
        });

    // ==========================================================================
    // JWT 토큰 (TAAABB_CRTOKM)
    // ==========================================================================

    /** 활성 JWT 토큰 전체 목록 조회 */
    const fetchTokens = () =>
        useApiFetch<AdminTokenResponse[]>(`${BASE}/tokens`);

    // ==========================================================================
    // 첨부파일 (TAAABB_CFILEM)
    // ==========================================================================

    /** 첨부파일 전체 목록 조회 */
    const fetchFiles = () =>
        useApiFetch<AdminFileResponse[]>(`${BASE}/files`);

    // ==========================================================================
    // 대시보드 통계
    // ==========================================================================

    /** 일별 로그인 통계 조회 (대시보드 차트용) */
    const fetchLoginStats = () =>
        useApiFetch<AdminLoginStatResponse[]>(`${BASE}/dashboard/login-stats`);

    // ==========================================================================
    // 상세 로그 (TAAABB_*L)
    // ==========================================================================

    /** 상세 로그 테이블 목록 조회 */
    const fetchLogTables = () =>
        useApiFetch<AdminLogTableResponse[]>(`${BASE}/logs/tables`);

    /**
     * 상세 로그 목록 조회
     * @param logKey - 로그 테이블 키
     * @param page - 페이지 번호 (0-based)
     * @param size - 페이지 크기
     */
    const fetchLogs = (logKey: string | Ref<string>, page: Ref<number>, size: Ref<number>) =>
        useApiFetch<AdminLogPageResponse>(() => `${BASE}/logs/${unref(logKey)}`, {
            query: { page, size },
            watch: [page, size, isRef(logKey) ? logKey : ref(logKey)]
        });

    /** 상세 로그 단건 조회 */
    const fetchLogDetail = (logKey: string, logSno: string) =>
        $apiFetch<AdminLogDetailResponse>(`${BASE}/logs/${logKey}/${encodeURIComponent(logSno)}`);

    return {
        // 공통코드
        fetchCodes, createCode, updateCode, deleteCode, bulkUpsertCodes,
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
        // 상세 로그
        fetchLogTables, fetchLogs, fetchLogDetail,
    };
};
