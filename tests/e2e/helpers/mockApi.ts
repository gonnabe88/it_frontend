/**
 * ============================================================================
 * [tests/e2e/helpers/mockApi.ts] E2E 테스트 공통 API Mock 헬퍼
 * ============================================================================
 * Playwright의 page.route()를 활용하여 API 응답을 Mock합니다.
 * 실제 백엔드 서버 없이 E2E 테스트를 실행할 수 있습니다.
 */
import type { Page } from '@playwright/test';

/**
 * 로그인 API Mock 설정
 * POST /api/auth/login → 200 응답
 *
 * @param page - Playwright Page 객체
 * @param user - Mock 사용자 정보 (기본값: 홍길동)
 */
export async function mockLoginApi(
    page: Page,
    user = { eno: 'E001', empNm: '홍길동' }
) {
    await page.route('**/api/auth/login', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(user)
        });
    });
}

/**
 * 임의 API Mock 설정
 *
 * @param page - Playwright Page 객체
 * @param urlPattern - URL 패턴 (예: '/api/projects', '/api/approvals')
 * @param body - Mock 응답 데이터
 * @param status - HTTP 상태 코드 (기본값: 200)
 */
export async function mockApi<T>(
    page: Page,
    urlPattern: string,
    body: T,
    status = 200
) {
    await page.route(`**${urlPattern}`, route => {
        route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body)
        });
    });
}

/**
 * 로그인 상태 주입 헬퍼
 * localStorage에 user 정보를 직접 세팅하여 로그인 플로우를 생략합니다.
 * 로그인 플로우 테스트가 아닌 기능 테스트에서 사용합니다.
 *
 * @param page - Playwright Page 객체
 * @param user - Mock 사용자 정보 (기본값: 홍길동)
 */
export async function setLoggedIn(
    page: Page,
    user = { eno: 'E001', empNm: '홍길동' }
) {
    await page.addInitScript((u) => {
        localStorage.setItem('user', JSON.stringify(u));
    }, user);
}
