/**
 * ============================================================================
 * [middleware/admin.ts] 관리자 전용 접근 제어 미들웨어
 * ============================================================================
 * /admin/** 경로에 접근하는 사용자가 시스템관리자(ITPAD001) 역할을 보유하고 있는지
 * 확인합니다. 역할이 없으면 메인 페이지로 리다이렉트합니다.
 *
 * [Design Ref: §3.2 — middleware/admin.ts, §6.2 — 프론트엔드 접근 제어]
 *
 * [사용 방법]
 * 관리자 페이지의 definePageMeta에 middleware: 'admin' 추가:
 *   definePageMeta({ middleware: 'admin', layout: 'admin' })
 * ============================================================================
 */
import { ROLE } from '~/types/auth';
import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(() => {
    // SSR에서는 라우트별 쿠키 상태와 클라이언트 hydration 타이밍이 다를 수 있어 체크를 생략합니다.
    // 클라이언트에서 auth.global.ts가 동일한 ADMIN 체크를 수행합니다.
    if (import.meta.server) return;

    const { user } = useAuth();

    // 비로그인 상태 또는 ITPAD001 역할 미보유 시 메인으로 리다이렉트
    if (!user.value?.athIds?.includes(ROLE.ADMIN)) {
        return navigateTo('/');
    }
});
