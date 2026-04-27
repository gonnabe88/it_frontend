/**
 * [plugins/theme.server.ts] SSR 다크모드 FOUC 방지 플러그인
 *
 * Nuxt SSR 단계에서 쿠키를 읽어 <html class="dark">를 즉시 렌더링합니다.
 * 이를 통해 브라우저가 CSS를 적용하기 전에 이미 올바른 테마가 설정되어
 * 새로고침 시 다크↔라이트 모드 깜빡임(FOUC)이 발생하지 않습니다.
 *
 * [동작 원리]
 *  - 서버 전용 플러그인(.server.ts)이므로 클라이언트에서는 실행되지 않음
 *  - 쿠키 'theme-dark=true'가 있으면 <html class="dark">를 SSR 출력에 포함
 *  - 클라이언트에서는 nuxt.config.ts의 인라인 스크립트가 저장된 쿠키 기준으로 처리
 */
export default defineNuxtPlugin(() => {
    const isDark = useCookie<boolean>('theme-dark');

    // 쿠키 true(다크): class="dark" + color-scheme: dark
    if (isDark.value === true) {
        useServerHead({
            htmlAttrs: { class: 'dark' },
            meta: [{ name: 'color-scheme', content: 'dark' }]
        });
    } else {
        // 쿠키 false(라이트): color-scheme: light → 브라우저 네이티브 다크 모드 차단 (FOUC 방지 핵심)
        // 쿠키 없음(최초 방문): 라이트로 고정하여 시스템 다크모드 초기 깜빡임을 막습니다.
        const colorScheme = 'light';
        useServerHead({
            meta: [{ name: 'color-scheme', content: colorScheme }]
        });
    }
});
