export interface LoginRequest {
    eno: string; // 사원번호
    password: string; // 비밀번호
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    eno: string;
    empNm: string; // 사원명
}

export interface User {
    eno: string;
    empNm: string;
}
