/// <reference types="node" />
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    // CI 환경에서는 2번 재시도, 로컬에서는 재시도 없음
    retries: process.env.CI ? 2 : 0,
    // 브라우저 1개만 사용 (로컬 환경 속도 최적화)
    workers: 1,
    timeout: 60 * 1000,
    expect: {
        timeout: 10 * 1000
    },
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3002',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },
    projects: [
        // 1단계: 인증 설정 (수동 로그인)
        // 세션 정보가 담긴 .auth/user.json을 생성합니다.
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
            use: {
                // 수동 로그인은 반드시 창이 보여야 함
                headless: false,
            }
        },
        // 2단계 (A): 일반 기능 테스트 (로그인 상태 유지)
        {
            name: 'chromium',
            testIgnore: /.*auth\.spec\.ts/, // 전체 경로에 대해 auth.spec.ts 제외
            use: { 
                ...devices['Desktop Chrome'],
                // 1단계에서 저장한 세션 재사용
                storageState: '.auth/user.json',
            },
            dependencies: ['setup'],
        },
        // 2단계 (B): 인증 기능 테스트 (로그인 상태 없이 클린한 상태로 시작)
        {
            name: 'auth-tests',
            testMatch: /auth\.spec\.ts/,
            use: { 
                ...devices['Desktop Chrome'],
                storageState: undefined, // 세션 정보 사용 안 함
            },
        }
    ],
    // 테스트 전 dev 서버 자동 실행
    webServer: {
        command: 'npx nuxt dev --port 3002',
        url: 'http://localhost:3002',
        // 이미 실행 중인 서버 재사용 (로컬 환경 속도 최적화)
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        env: {
            NUXT_SSR: 'false'
        }
    }
});
