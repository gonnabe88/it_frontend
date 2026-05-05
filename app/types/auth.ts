/**
 * ============================================================================
 * [types/auth.ts] 인증 관련 공통 타입 정의
 * ============================================================================
 * 로그인, 토큰 응답, 사용자 정보에 관한 TypeScript 인터페이스를 정의합니다.
 * 이 타입들은 아래 파일에서 공통으로 사용됩니다:
 *  - stores/auth.ts     : Pinia 인증 스토어
 *  - composables/useAuth.ts : 인증 composable (re-export)
 *  - middleware/auth.global.ts
 *
 * ⚠️ 주의: composables/useOrganization.ts의 OrgUser 타입과 구별됩니다.
 *  - 이 파일의 User: { eno, empNm } - 로그인/인증 전용 최소 정보
 *  - OrgUser         : { eno, usrNm, bbrNm, ... } - 조직도 조회용 확장 정보
 *
 * [인증 전략 변경 (httpOnly 쿠키)]
 *  - JWT 토큰은 서버가 Set-Cookie로 httpOnly 쿠키에 저장합니다.
 *  - 프론트엔드에서는 토큰에 직접 접근할 수 없으며, 브라우저가 자동 전송합니다.
 *  - LoginResponse에는 토큰 없이 사용자 정보(eno, empNm)만 포함됩니다.
 * ============================================================================
 */

/**
 * [LoginRequest] 로그인 요청 인터페이스
 * 로그인 폼에서 서버로 전송하는 인증 자격증명입니다.
 * POST /api/auth/login 요청 body로 사용됩니다.
 */
export interface LoginRequest {
    eno: string;      // 사원번호 (사용자 고유 식별자, 로그인 ID로 사용)
    password: string; // 비밀번호 (평문 전송 후 서버에서 암호화 검증)
}

/**
 * [LoginResponse] 로그인 응답 인터페이스
 * 로그인 성공 시 서버가 반환하는 사용자 기본 정보입니다.
 *
 * [httpOnly 쿠키 전환]
 *  - 이전: 응답 body에 accessToken, refreshToken 포함
 *  - 현재: 토큰은 Set-Cookie 헤더로 httpOnly 쿠키에 저장되며,
 *          응답 body에는 사용자 정보만 포함됩니다.
 */
export interface LoginResponse {
    eno: string;      // 로그인한 사용자의 사원번호
    empNm: string;    // 로그인한 사용자의 사원명 (화면 표시용)
    athIds: string[]; // 자격등급 ID 목록 (다중 자격등급 지원)
    bbrC: string;     // 소속 부서코드
    temC: string;     // 소속 팀코드
}

/**
 * 자격등급 ID 상수
 * 백엔드 TAAABB_CAUTHI 테이블의 ATH_ID 값과 일치해야 합니다.
 */
export const ROLE = {
    USER:         'ITPZZ001', // 일반사용자: 소속 부서 조회, 본인 작성 수정
    DEPT_MANAGER: 'ITPZZ002', // 기획통할담당자: 소속 부서 조회/수정/삭제
    ADMIN:        'ITPAD001', // 시스템관리자: 전체 접근, 관리자 메뉴 노출
} as const;

export type AthId = typeof ROLE[keyof typeof ROLE];

/**
 * [User] 인증된 사용자 정보 인터페이스
 * 로그인 후 Pinia 스토어(stores/auth.ts)의 user 상태로 저장되며,
 * useCookie로 직렬화되어 SSR 및 클라이언트 세션 복원에 사용됩니다.
 *
 * 최소한의 필드만 포함하여 인증 목적으로만 사용합니다.
 * 조직도 등 상세 사용자 정보가 필요한 경우 useOrganization의 OrgUser를 사용하세요.
 */
export interface User {
    eno: string;      // 사원번호 (고유 식별자)
    empNm: string;    // 사원명 (상단 네비게이션 등 UI 표시용)
    athIds: string[]; // 자격등급 ID 목록 (다중 자격등급 지원)
    bbrC: string;     // 소속 부서코드 (권한 범위 결정에 사용)
    temC: string;     // 소속 팀코드
}
