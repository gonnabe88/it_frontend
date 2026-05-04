/**
 * [server/middleware/sso-auth-redirect.ts] SSO 진입 서버 미들웨어
 *
 * 브라우저가 보호 페이지를 문서로 직접 요청할 때 Nuxt 페이지 렌더링 전에
 * SSO business.jsp로 리다이렉트합니다.
 *
 * 이 파일은 app/middleware/auth.global.ts보다 먼저 실행되는 Nitro 서버 미들웨어입니다.
 * 최초 진입 URL이 /info/projects/...처럼 보호 페이지이면 Vue 앱이 만들어지기 전
 * 서버 응답 단계에서 302를 반환하므로 /login 페이지 HTML이 잠깐 렌더링되는 현상을
 * 막을 수 있습니다.
 *
 * 정상 흐름:
 * 1. 미인증 사용자가 보호 페이지를 document 요청으로 진입
 * 2. 이 미들웨어가 it-portal-user 쿠키 부재를 확인
 * 3. 백엔드 /sso/business.jsp?next={원본경로} 로 302 응답
 * 4. 백엔드 SSO 완료 후 httpOnly JWT 쿠키와 it-portal-user 쿠키를 발급
 * 5. 원본 경로로 돌아오면 이 미들웨어가 인증 쿠키를 확인하고 Nuxt 렌더링을 허용
 *
 * 주의:
 * - nuxt generate/prerender 단계에서는 브라우저 쿠키가 없으므로 인증 판단을 하면 안 됩니다.
 *   이때 리다이렉트를 반환하면 dist/guide/index.html 자체가 SSO meta refresh 파일로 생성됩니다.
 *   따라서 import.meta.prerender 상태에서는 항상 통과시켜 실제 정적 HTML을 생성합니다.
 */
const PUBLIC_PATH_PREFIXES = [
    '/_nuxt',
    '/favicon',
    '/robots.txt',
    '/manifest',
    '/icon',
];

/**
 * Nuxt 정적 리소스와 일반 파일 요청인지 판별합니다.
 *
 * SSO 리다이렉트는 HTML 문서 진입에만 적용되어야 합니다. JS/CSS 이미지 같은
 * 정적 파일 요청까지 SSO로 보내면 앱 번들이 로드되지 않거나 favicon 요청이
 * 불필요하게 인증 체인을 타게 됩니다.
 *
 * @param path 요청 URL의 pathname
 * @returns 공개 리소스 요청이면 true
 */
const isPublicAssetPath = (path: string): boolean =>
    PUBLIC_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
    || /\.[a-z0-9]+$/i.test(path);

/**
 * 브라우저의 페이지 진입(document navigation) 요청인지 확인합니다.
 *
 * Accept 헤더가 text/html을 포함하거나 Fetch Metadata의 sec-fetch-dest가 document이면
 * 사용자가 주소창/링크/리다이렉트로 페이지에 진입한 것으로 봅니다. API 호출이나
 * 정적 리소스 요청은 여기서 제외되어야 각 기능의 401 처리와 파일 로딩이 정상 동작합니다.
 *
 * @param event Nitro 요청 이벤트
 * @returns HTML 문서 진입 요청이면 true
 */
const isHtmlNavigation = (event: Parameters<typeof getRequestHeader>[0]): boolean => {
    const accept = getRequestHeader(event, 'accept') ?? '';
    const fetchDest = getRequestHeader(event, 'sec-fetch-dest') ?? '';
    return accept.includes('text/html') || fetchDest === 'document';
};

/**
 * SSO 완료 후 되돌아갈 내부 경로를 검증합니다.
 *
 * redirect/next 값은 최종적으로 백엔드 complete 엔드포인트까지 전달됩니다. 외부 URL이나
 * 프로토콜 상대 URL(//example.com)을 허용하면 오픈 리다이렉트가 될 수 있으므로 반드시
 * '/'로 시작하는 같은 사이트 경로만 허용합니다. /login은 다시 SSO 진입을 반복할 수 있어
 * 되돌아갈 경로에서 제외합니다.
 *
 * @param value redirect 또는 next 쿼리 값
 * @returns 안전한 내부 경로이면 원본 값, 아니면 undefined
 */
const getSafeNextPath = (value: string | undefined): string | undefined => {
    if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
        return undefined;
    }
    return value;
};

/**
 * SSO 완료 후 되돌아올 프론트엔드 origin을 포함한 business.jsp URL을 만듭니다.
 *
 * 개발 서버는 http://localhost:3000, generate 산출물을 웹서버로 서빙하는 경우는
 * http://localhost처럼 origin이 달라질 수 있습니다. origin을 백엔드로 함께 넘기면
 * SSO 완료 후 현재 사용자가 진입했던 호스트로 돌아올 수 있습니다.
 *
 * @param event Nitro 요청 이벤트
 * @param nextPath SSO 완료 후 복원할 내부 경로
 * @returns 백엔드 SSO 진입 URL
 */
const createSsoUrl = (event: Parameters<typeof useRuntimeConfig>[0], nextPath: string): string => {
    const config = useRuntimeConfig(event);
    const requestOrigin = getRequestURL(event).origin;
    const searchParams = new URLSearchParams({
        next: nextPath,
        origin: requestOrigin,
    });
    return `${config.public.apiBase}/sso/business.jsp?${searchParams.toString()}`;
};

/**
 * 모든 HTML 문서 요청의 SSO 진입 여부를 결정합니다.
 *
 * 이 핸들러는 값을 반환하지 않으면 다음 Nitro/Nuxt 처리 단계로 요청을 넘깁니다. 조건이
 * 맞는 경우에만 sendRedirect를 반환해서 Nuxt 페이지 렌더링 자체를 막습니다.
 *
 * 주요 예외:
 * - 정적 리소스: 앱 로딩에 필요하므로 통과
 * - it-portal-user 쿠키 존재: 이미 프론트 인증 상태를 복원할 수 있으므로 통과
 * - /login?error=sso: SSO 실패 후 수동 로그인 폼을 보여줘야 하므로 통과
 */
export default defineEventHandler((event) => {
    if (import.meta.prerender) {
        return;
    }

    const url = getRequestURL(event);
    const path = url.pathname;

    if (!isHtmlNavigation(event) || isPublicAssetPath(path)) {
        return;
    }

    if (getCookie(event, 'it-portal-user')) {
        return;
    }

    if (path === '/login' && url.searchParams.get('error') === 'sso') {
        return;
    }

    const redirectPath = path === '/login'
        ? getSafeNextPath(url.searchParams.get('redirect') ?? url.searchParams.get('next') ?? undefined)
        : `${path}${url.search}`;

    if (!redirectPath) {
        return;
    }

    return sendRedirect(event, createSsoUrl(event, redirectPath), 302);
});
