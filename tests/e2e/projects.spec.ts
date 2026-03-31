/**
 * ============================================================================
 * [tests/e2e/projects.spec.ts] 정보화사업 프로젝트 목록 E2E 테스트
 * ============================================================================
 */
import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mockApi';

const mockProjects = [
    { prjMngNo: 'PRJ-2026-0001', prjNm: '테스트 정보화사업 A', prjSts: '사업 추진', year: 2026 },
    { prjMngNo: 'PRJ-2026-0002', prjNm: '테스트 정보화사업 B', prjSts: '완료',      year: 2026 },
];

test.describe('정보화사업 프로젝트 목록', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        page.on('request', req => console.log(`[Request] ${req.method()} ${req.url()}`));
        
        await mockApi(page, '/api/projects', mockProjects);
    });

    test('프로젝트 목록을 표시한다', async ({ page }) => {
        await page.goto('/info/projects');
        await expect(page).not.toHaveURL(/\/login/);

        // 목록 데이터가 렌더링될 때까지 대기 (Auto-waiting)
        await expect(page.getByText('테스트 정보화사업 A')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('테스트 정보화사업 B')).toBeVisible();
    });

    test('프로젝트 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/info/projects');
        await expect(page).not.toHaveURL(/\/login/);

        await expect(page.getByText('사업 추진')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('완료')).toBeVisible();
    });
});
