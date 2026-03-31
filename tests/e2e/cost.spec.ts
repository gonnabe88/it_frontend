/**
 * ============================================================================
 * [tests/e2e/cost.spec.ts] 전산업무비 목록 E2E 테스트
 * ============================================================================
 */
import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mockApi';

const mockCosts = [
    { itMngcNo: 'COST-2026-001', ioeNm: '전산임차료 테스트', itMngcBg: 10000000, apfSts: '예산 작성' },
    { itMngcNo: 'COST-2026-002', ioeNm: '전산제비 테스트',   itMngcBg: 20000000, apfSts: '사업 추진' },
];

test.describe('전산업무비 목록', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        page.on('request', req => console.log(`[Request] ${req.method()} ${req.url()}`));
        
        // '/api/cost' 경로 사용 (단수형)
        await mockApi(page, '/api/cost', mockCosts);
    });

    test('전산업무비 목록을 표시한다', async ({ page }) => {
        await page.goto('/info/cost');
        await expect(page).not.toHaveURL(/\/login/);

        await expect(page.getByText('전산임차료 테스트')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('전산제비 테스트')).toBeVisible();
    });

    test('전산업무비 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/info/cost');
        await expect(page).not.toHaveURL(/\/login/);

        // '예산 작성' 텍스트가 여러 곳에 있을 수 있으므로 테이블 내 요소를 정밀하게 지정
        const table = page.getByRole('table');
        await expect(table.getByText('예산 작성').first()).toBeVisible({ timeout: 15000 });
        await expect(table.getByText('사업 추진').first()).toBeVisible();
    });
});
