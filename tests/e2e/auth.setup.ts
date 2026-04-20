import { test as setup } from '@playwright/test';

/**
 * ============================================================================
 * [tests/e2e/auth.setup.ts] 수동 로그인 세션 캡처 설정
 * ============================================================================
 */

// 세션 저장 파일 경로 (프로젝트 루트 기준)
const authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
    // 수동 로그인 대기를 위해 전역 60초 타임아웃을 6분으로 덮어씁니다.
    setup.setTimeout(360000);

    // 1. 로그인 페이지로 이동
    await page.goto('/login');

    // 2. 사용자에게 안내 (콘솔 및 브라우저 제목 수정)
    console.log('------------------------------------------------------------');
    console.log('⚠️  E2E 테스트를 위해 로그인이 필요합니다.');
    console.log('1. 열린 브라우저에서 사원번호와 비밀번호를 입력해 주세요.');
    console.log('2. 로그인이 완료되면 자동으로 세션이 저장되고 창이 닫힙니다.');
    console.log('------------------------------------------------------------');

    await page.evaluate(() => {
        document.title = '🔴 로그인해 주세요 - E2E 테스트 대기 중';
    });

    // 3. 로그인이 완료될 때까지 대기
    // 메인 페이지(/)나 프로젝트 목록(/info/projects) 등으로 이동하는 것을 감지합니다.
    // 여기서는 관례적으로 '/login'이 포함되지 않은 URL로 이동하면 성공으로 간주합니다.
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 300000 }); // 최대 5분 대기

    // 4. 세션 정보(쿠키 + localStorage) 저장
    await page.context().storageState({ path: authFile });
    
    console.log('✅ 세션 저장 완료:', authFile);
});
