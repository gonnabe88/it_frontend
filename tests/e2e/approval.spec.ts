/**
 * ============================================================================
 * [tests/e2e/approval.spec.ts] 전자결재 목록 E2E 테스트
 * ============================================================================
 */
import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mockApi';

const mockApprovals = [
    { apfMngNo: 'APF-2026-001', apfNm: '결재문서 테스트 A', apfSts: '결재중'   },
    { apfMngNo: 'APF-2026-002', apfNm: '결재문서 테스트 B', apfSts: '결재완료' },
];

test.describe('전자결재 목록', () => {
    test.beforeEach(async ({ page }) => {
        // 브라우저 로그 및 네트워크 요청 로깅 (디버깅용)
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        page.on('request', req => console.log(`[Request] ${req.method()} ${req.url()}`));

        // 전역 storageState를 사용하므로 API Mock만 설정 (/api/applications 경로 사용)
        await mockApi(page, '/api/applications', mockApprovals);
    });

    test('전자결재 목록을 표시한다', async ({ page }) => {
        await page.goto('/approval');

        // 로그인 유지 확인 (리다이렉트 여부)
        await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });

        // 데이터 렌더링 대기 (Auto-waiting 활용)
        await expect(page.getByText('결재문서 테스트 A')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('결재문서 테스트 B')).toBeVisible();
    });

    test('결재 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/approval');
        await expect(page).not.toHaveURL(/\/login/);

        await expect(page.getByText('결재중')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('결재완료')).toBeVisible();
    });
});
