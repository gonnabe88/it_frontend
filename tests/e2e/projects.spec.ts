/**
 * ============================================================================
 * [tests/e2e/projects.spec.ts] 정보화사업 프로젝트 목록 E2E 테스트
 * ============================================================================
 * 정보화사업 목록 화면의 정상 렌더링 및 데이터 표시 여부를 검증합니다.
 * 백엔드 API를 모킹하여 독립적으로 테스트를 수행합니다.
 */
import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mockApi';

/** 테스트용 가상 프로젝트 데이터 */
const mockProjects = [
    { prjMngNo: 'PRJ-2026-0001', prjNm: '테스트 정보화사업 A', prjSts: '사업 추진', year: 2026 },
    { prjMngNo: 'PRJ-2026-0002', prjNm: '테스트 정보화사업 B', prjSts: '완료',      year: 2026 },
];

test.describe('정보화사업 프로젝트 목록', () => {
    /** 각 테스트 실행 전 수행할 초기화 작업 */
    test.beforeEach(async ({ page }) => {
        // 브라우저 콘솔 로그를 터미널에 출력 (디버깅용)
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        // 네트워크 요청 로그 출력
        page.on('request', req => console.log(`[Request] ${req.method()} ${req.url()}`));
        
        // '/api/projects' 호출 시 mockProjects를 반환하도록 모킹
        await mockApi(page, '/api/projects', mockProjects);
    });

    /** 케이스 1: 프로젝트 목록이 테이블에 정상적으로 렌더링되는지 확인 */
    test('프로젝트 목록을 표시한다', async ({ page }) => {
        // 정보화사업 목록 페이지로 이동
        await page.goto('/info/projects');
        // 로그인 페이지로 리다이렉트되지 않았는지 확인
        await expect(page).not.toHaveURL(/\/login/);

        // 모킹된 데이터가 화면에 표시되는지 확인 (최대 15초 대기)
        await expect(page.getByText('테스트 정보화사업 A')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('테스트 정보화사업 B')).toBeVisible();
    });

    /** 케이스 2: 프로젝트 상태 태그(Badge)가 정확한 텍스트로 표시되는지 확인 */
    test('프로젝트 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/info/projects');
        await expect(page).not.toHaveURL(/\/login/);

        // 프로젝트 상태 컬럼의 텍스트 확인
        await expect(page.getByText('사업 추진')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('완료')).toBeVisible();
    });
});

