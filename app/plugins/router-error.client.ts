/**
 * ============================================================================
 * [plugins/router-error.client.ts] SPA 네비게이션 에러 핸들러
 * ============================================================================
 * Vue Router의 onError 훅을 사용하여 클라이언트 사이드 네비게이션 중
 * 발생하는 모든 에러를 사용자에게 명확히 표시합니다.
 *
 * [처리하는 오류 유형]
 *   1. SyntaxError: 존재하지 않는 named export를 import한 경우
 *      (예: utils/common.ts에 없는 함수를 컴포넌트가 import할 때)
 *   2. ChunkLoadError: 네트워크 불안정으로 JS 청크 다운로드 실패 시
 *   3. 기타 동적 import 실패
 *
 * [왜 필요한가]
 *   Nuxt의 error.vue는 페이지 렌더링 에러를 처리하지만,
 *   SPA 네비게이션(NuxtLink 클릭) 중 발생하는 모듈 로드 에러는
 *   router.onError()로만 포착할 수 있습니다.
 *   이 훅이 없으면 링크를 클릭해도 아무 반응이 없어 사용자가 원인을 알 수 없습니다.
 *
 * [동작 방식]
 *   - 모든 환경: Toast로 이동 실패를 즉시 알림
 *   - 개발 환경: 추가로 Nuxt 에러 페이지(error.vue)에 상세 정보 표시
 * ============================================================================
 */
export default defineNuxtPlugin(() => {
    const router = useRouter()
    const toast = useToast()

    /**
     * Vue Router 전역 에러 핸들러
     *
     * router.push() 또는 NuxtLink 클릭으로 시작된 네비게이션이
     * 컴포넌트 로드 단계에서 실패하면 이 핸들러가 호출됩니다.
     *
     * @param error - 발생한 에러 객체 (SyntaxError, ChunkLoadError 등)
     * @param to    - 이동하려던 라우트 (실패한 목적지)
     */
    router.onError((error, to) => {
        // 에러 유형 분류: 청크/모듈 로드 실패인지 여부 확인
        const isChunkError =
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('Importing a module script failed') ||
            error.message?.includes('does not provide an export named')

        const targetPath = to?.path ?? '(알 수 없는 경로)'

        if (isChunkError) {
            // 모듈 로드 실패: 빌드 오류 또는 네트워크 문제
            toast.add({
                severity: 'error',
                summary: '페이지 로드 실패',
                detail: `'${targetPath}' 페이지의 스크립트를 불러오지 못했습니다. 개발자 콘솔을 확인해주세요.`,
                life: 8000,
            })
        } else {
            // 기타 네비게이션 에러
            toast.add({
                severity: 'error',
                summary: '페이지 이동 실패',
                detail: `'${targetPath}'(으)로 이동하는 중 오류가 발생했습니다.`,
                life: 6000,
            })
        }

        // 개발 환경에서는 Nuxt error.vue 페이지로 에러 상세 정보 노출
        // 운영 환경에서는 현재 페이지를 유지하여 사용자 작업 흐름 보호
        if (import.meta.dev) {
            showError(error)
        }
    })
})
