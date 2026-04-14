/**
 * ============================================================================
 * [tests/e2e/auth.spec.ts] 인증 플로우 E2E 테스트
 * ============================================================================
 * 로그인/로그아웃 사용자 시나리오를 검증합니다.
 * 실제 API 호출은 page.route()로 Mock 처리합니다.
 */
import { test, expect } from '@playwright/test';
import { mockLoginApi } from './helpers/mockApi';

test.describe('인증 플로우', () => {
    test('로그인 성공 시 메인 페이지로 이동한다', async ({ page }) => {
        // 로그인 API Mock 설정
        await mockLoginApi(page);

        await page.goto('/login');

        // 사원번호와 비밀번호 입력
        await page.getByLabel('행번').fill('E001');
        await page.getByLabel('ESSO 비밀번호').fill('password123');

        // 로그인 버튼 클릭 및 응답 대기 (timeout 10초)
        const loginResponse = page.waitForResponse(res => res.url().includes('/api/auth/login') && res.status() === 200);
        await page.getByRole('button', { name: '로그인' }).click();
        await loginResponse;

        // 로그인 후 메인 페이지로 리다이렉트 확인 (login 페이지가 아니어야 함)
        await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('로그인 실패 시 에러 메시지를 표시한다', async ({ page }) => {
        // 로그인 API 실패 Mock
        await page.route('**/api/auth/login*', route => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: '사원번호 또는 비밀번호가 올바르지 않습니다.' })
            });
        });

        await page.goto('/login');
        await page.getByLabel('행번').fill('E001');
        await page.getByLabel('ESSO 비밀번호').fill('wrongpassword');
        const loginFailResponse = page.waitForResponse(res => res.url().includes('/api/auth/login') && res.status() === 401);
        await page.getByRole('button', { name: '로그인' }).click();
        await loginFailResponse;

        // 에러 메시지가 표시되어야 함 (로케이터 중복 방지를 위해 구체적인 텍스트 사용)
        await expect(page.getByText('사원번호 또는 비밀번호가 올바르지 않습니다.')).toBeVisible({ timeout: 5000 });

        // 로그인 페이지에 머물러야 함
        await expect(page).toHaveURL(/\/login/);
    });
});
