import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue()],
    server: {
        deps: {
            // quill은 모듈 로드 시 document에 접근하므로 Node.js native ESM이 아닌
            // Vite 파이프라인을 통해 처리해야 happy-dom 환경이 적용됨
            inline: ['quill'],
        }
    },
    test: {
        // 브라우저 환경 시뮬레이션 (DOM API, localStorage 등 지원)
        environment: 'happy-dom',
        // 각 테스트 실행 후 Mock 상태 초기화
        clearMocks: true,
        // 전역 API 자동 주입 (describe, it, expect 등 import 불필요)
        globals: true,
        // Playwright E2E 테스트 파일은 Vitest에서 제외 (playwright.config.ts에서 별도 실행)
        exclude: ['node_modules', 'tests/e2e/**'],
    },
    resolve: {
        alias: {
            // Nuxt의 ~ / @ alias를 동일하게 적용
            '~': resolve(__dirname, 'app'),
            '@': resolve(__dirname, 'app'),
        }
    }
});
