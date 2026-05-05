/**
 * [server/plugins/color-scheme.ts] Nitro render:html 훅으로 color-scheme 메타 주입
 *
 * Unhead의 meta 중복 제거 로직을 우회하여 SSR HTML에 직접 주입합니다.
 * 쿠키 값에 따라 <meta name="color-scheme"> 태그를 <head> 최상단에 삽입합니다.
 *
 * - theme-dark=true  → content="dark"
 * - theme-dark=false → content="light"  (브라우저 시스템 다크모드 무시)
 * - 쿠키 없음        → content="light" (시스템 다크모드 초기 깜빡임 방지)
 */
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('render:html', (html, { event }) => {
        const cookie = (event.node.req.headers.cookie as string) || '';
        const match = cookie.match(/(?:^|;\s*)theme-dark=([^;]*)/);
        const raw = match ? decodeURIComponent(match[1]) : null;

        const colorScheme = raw === 'true' ? 'dark' : 'light';
        const meta = `<meta name="color-scheme" content="${colorScheme}">`;

        // <head> 배열의 맨 앞에 삽입 — charset/viewport 직후, 인라인 스크립트보다 앞
        if (Array.isArray(html.head)) {
            html.head.unshift(meta);
        }
    });
});
