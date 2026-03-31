/**
 * ============================================================================
 * [tests/e2e/approval.spec.ts] 전자결재 목록 E2E 테스트
 * ============================================================================
 */
import { test, expect } from '@playwright/test';
import { setLoggedIn, mockApi } from './helpers/mockApi';

const mockApprovals = [
    { apfId: 1, apfTitle: '결재문서 테스트 A', apfSts: '결재중'   },
    { apfId: 2, apfTitle: '결재문서 테스트 B', apfSts: '결재완료' },
];

test.describe('전자결재 목록', () => {
    test.beforeEach(async ({ page }) => {
        // 전역 storageState를 사용하므로 setLoggedIn 대신 API Mock만 설정합니다.
        await mockApi(page, '/api/approvals', mockApprovals);
    });

    test('전자결재 목록을 표시한다', async ({ page }) => {
        await page.goto('/approval');

        await expect(page.getByText('결재문서 테스트 A')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('결재문서 테스트 B')).toBeVisible();
    });

    test('결재 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/approval');

        await expect(page.getByText('결재중')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('결재완료')).toBeVisible();
    });
});
