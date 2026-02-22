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
 * 로그인 성공 시 서버가 반환하는 JWT 토큰 및 사용자 기본 정보입니다.
 * 응답받은 토큰은 stores/auth.ts에서 상태 및 localStorage에 저장됩니다.
 *
 * [토큰 전략]
 *  - accessToken  : 단기 유효 토큰, 모든 API 요청의 Authorization 헤더에 포함
 *  - refreshToken : 장기 유효 토큰, accessToken 만료 시 갱신 요청에 사용
 */
export interface LoginResponse {
    accessToken: string;  // JWT 액세스 토큰 (단기, API 인증용)
    refreshToken: string; // JWT 리프레시 토큰 (장기, 토큰 갱신용)
    eno: string;          // 로그인한 사용자의 사원번호
    empNm: string;        // 로그인한 사용자의 사원명 (화면 표시용)
}

/**
 * [User] 인증된 사용자 정보 인터페이스
 * 로그인 후 Pinia 스토어(stores/auth.ts)의 user 상태로 저장되며,
 * localStorage에도 직렬화(JSON)되어 세션 복원에 사용됩니다.
 *
 * 최소한의 필드만 포함하여 인증 목적으로만 사용합니다.
 * 조직도 등 상세 사용자 정보가 필요한 경우 useOrganization의 OrgUser를 사용하세요.
 */
export interface User {
    eno: string;   // 사원번호 (고유 식별자)
    empNm: string; // 사원명 (상단 네비게이션 등 UI 표시용)
}
