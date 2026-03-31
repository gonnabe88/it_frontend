/**
 * ============================================================================
 * [tests/e2e/projects.spec.ts] 정보화사업 프로젝트 목록 E2E 테스트
 * ============================================================================
 * 정보화사업 프로젝트 목록 조회 시나리오를 검증합니다.
 */
import { test, expect } from '@playwright/test';
import { setLoggedIn, mockApi } from './helpers/mockApi';

// Mock 프로젝트 데이터
const mockProjects = [
    { prjId: 1, prjNm: '테스트 정보화사업 A', prjSts: '사업 추진', year: 2025 },
    { prjId: 2, prjNm: '테스트 정보화사업 B', prjSts: '완료',     year: 2025 },
];

test.describe('정보화사업 프로젝트 목록', () => {
    test.beforeEach(async ({ page }) => {
        // 전역 storageState를 사용하므로 API Mock만 설정합니다.
        await mockApi(page, '/api/projects', mockProjects);
    });

    test('프로젝트 목록을 표시한다', async ({ page }) => {
        await page.goto('/info/projects');

        // 목록 데이터가 렌더링될 때까지 대기
        await expect(page.getByText('테스트 정보화사업 A')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('테스트 정보화사업 B')).toBeVisible();
    });

    test('프로젝트 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/info/projects');

        await expect(page.getByText('사업 추진')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('완료')).toBeVisible();
    });
});
