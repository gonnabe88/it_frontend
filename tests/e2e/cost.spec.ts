/**
 * ============================================================================
 * [tests/e2e/cost.spec.ts] 전산업무비 목록 E2E 테스트
 * ============================================================================
 */
import { test, expect } from '@playwright/test';
import { setLoggedIn, mockApi } from './helpers/mockApi';

const mockCosts = [
    { costId: 1, costNm: '전산임차료 테스트', costSts: '예산 작성', year: 2025 },
    { costId: 2, costNm: '전산제비 테스트',   costSts: '사업 추진', year: 2025 },
];

test.describe('전산업무비 목록', () => {
    test.beforeEach(async ({ page }) => {
        // 전역 storageState를 사용하므로 API Mock만 설정합니다.
        await mockApi(page, '/api/costs', mockCosts);
    });

    test('전산업무비 목록을 표시한다', async ({ page }) => {
        const responsePromise = page.waitForResponse(res => res.url().includes('/api/costs') && res.status() === 200);
        await page.goto('/info/cost');
        await responsePromise;

        await expect(page.getByText('전산임차료 테스트')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('전산제비 테스트')).toBeVisible();
    });

    test('전산업무비 상태 태그가 표시된다', async ({ page }) => {
        const responsePromise = page.waitForResponse(res => res.url().includes('/api/costs') && res.status() === 200);
        await page.goto('/info/cost');
        await responsePromise;

        await expect(page.getByText('예산 작성')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('사업 추진')).toBeVisible();
    });
});
