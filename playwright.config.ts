import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    // CI 환경에서는 2번 재시도, 로컬에서는 재시도 없음
    retries: process.env.CI ? 2 : 0,
    // 브라우저 1개만 사용 (로컬 환경 속도 최적화)
    workers: 1,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        // 실패 시 스크린샷 자동 저장
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ],
    // 테스트 전 dev 서버 자동 실행
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        // 이미 실행 중인 서버 재사용 (로컬 환경 속도 최적화)
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000
    }
});
