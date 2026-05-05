<!--
================================================================================
[pages/login.vue] 로그인 페이지
================================================================================
IT Portal 시스템의 인증 진입점 페이지입니다.
사원번호와 비밀번호를 입력받아 stores/auth.ts의 login() 액션을 호출합니다.

[특이사항]
- layout: false → 기본 레이아웃(사이드바, 헤더) 없이 독립 UI로 렌더링
- middleware: [] → auth.global 미들웨어를 명시적으로 비활성화
  (로그인 페이지 자체는 인증 불필요)
- Enter 키 로그인 지원 (handleKeyPress)
- 로그인 성공 시 홈('/')으로 이동, 실패 시 에러 메시지 표시
================================================================================
-->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '~/composables/useAuth';
import logo from '@/assets/logo.png';

/* 로그인 페이지 메타 설정 */
definePageMeta({
    layout: 'login', // 빈 패스스루 레이아웃 사용 (layout:false 대신 — KeepAlive fragment 버그 방지)
    middleware: []  // 전역 인증 미들웨어 제외 (로그인 페이지는 인증 불필요)
});

/* 인증 composable에서 login 액션 가져오기 */
const { login } = useAuth();
const router = useRouter();
const route = useRoute();

/* ── 다크모드 상태 (AppHeader와 동일한 쿠키 키 공유) ── */
const isDark = useCookie<boolean>('theme-dark', { default: () => false });

/** 테마 DOM 적용 및 쿠키 갱신 */
const applyTheme = () => {
    isDark.value = !isDark.value;
    document.documentElement.classList.toggle('dark', isDark.value);
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light';
};

/** 다크모드 전환 — View Transition API로 부드러운 크로스페이드 */
const toggleTheme = () => {
    if (!document.startViewTransition) {
        applyTheme();
        return;
    }
    document.startViewTransition(() => applyTheme());
};

/*
 * SSO 자동 이동 중 여부입니다.
 *
 * 일반적인 미인증 보호 페이지 진입은 server/middleware/sso-auth-redirect.ts에서
 * Nuxt 렌더링 전에 SSO로 빠집니다. 이 값은 사용자가 /login을 직접 열었거나
 * 서버 미들웨어를 거치지 않는 클라이언트 전환으로 로그인 페이지에 도달했을 때의
 * fallback입니다.
 *
 * true인 동안 로그인 카드를 숨겨 SSO로 이동하기 전 폼이 깜빡 보이지 않게 합니다.
 * SSO 실패(error=sso)로 돌아온 경우에만 false로 바꿔 수동 로그인 폼을 보여줍니다.
 */
const autoRedirecting = ref(true);

/**
 * 로그인 페이지 진입 직후 SSO 또는 수동 로그인 표시 여부를 결정합니다.
 *
 * 동작 방식:
 * - /login?error=sso: SSO 체인이 실패한 fallback 상태이므로 수동 로그인 폼을 표시합니다.
 * - /login?redirect=/원본경로 또는 /login?next=/원본경로: 원본 경로를 next로 넘겨 SSO를 시작합니다.
 * - 쿼리가 없는 /login 직접 접근: SSO 완료 후 루트로 복귀하도록 business.jsp로 이동합니다.
 *
 * 이 로직은 서버 미들웨어의 보조 안전망입니다. 정상적인 보호 페이지 최초 진입에서는
 * 서버 미들웨어가 먼저 302를 반환하므로 이 onMounted까지 오지 않습니다.
 */
onMounted(() => {
    document.documentElement.classList.toggle('dark', isDark.value);
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light';

    // SSO 실패로 돌아온 경우 기본 로그인 폼 표시
    if (route.query.error === 'sso') {
        autoRedirecting.value = false;
        return;
    }

    // SSO로 자동 이동: ?redirect= 또는 ?next= 파라미터를 그대로 전달해 원본 경로 복원
    const config = useRuntimeConfig();
    const redirectPath = (route.query.redirect ?? route.query.next) as string | undefined;
    const searchParams = new URLSearchParams();
    if (redirectPath?.startsWith('/')) {
        searchParams.set('next', redirectPath);
    }
    searchParams.set('origin', window.location.origin);
    window.location.replace(`${config.public.apiBase}/sso/business.jsp?${searchParams.toString()}`);
});

/* ── 폼 입력 상태 ── */
const eno = ref('');           // 사원번호 입력값
const password = ref('');      // 비밀번호 입력값
const loading = ref(false);    // 로그인 API 호출 중 여부 (버튼 로딩 표시)
const errorMessage = ref('');  // 서버 오류 또는 유효성 검사 메시지

/**
 * 로그인 처리 함수
 * 입력값 유효성 검사 후 login() 액션을 호출합니다.
 * 성공 시 홈으로 이동, 실패 시 서버 에러 메시지를 표시합니다.
 */
const handleLogin = async () => {
    // 필수 입력값 검사
    if (!eno.value || !password.value) {
        errorMessage.value = '사원번호와 비밀번호를 입력해주세요.';
        return;
    }

    loading.value = true;
    errorMessage.value = ''; // 이전 에러 메시지 초기화

    try {
        await login({
            eno: eno.value,
            password: password.value
        });

        // 로그인 성공 → ?next= 쿼리 파라미터 우선, 없으면 홈(/)
        // 내부 경로(/)만 허용해 오픈 리다이렉트 공격 방지
        const next = route.query.next as string;
        router.push(next?.startsWith('/') && !next.startsWith('/login') ? next : '/');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Login error:', error);
        // 서버 에러 메시지 우선, 없으면 기본 메시지 표시
        errorMessage.value = error.data?.message || '로그인에 실패했습니다. 사원번호와 비밀번호를 확인해주세요.';
    } finally {
        loading.value = false;
    }
};

/**
 * 키보드 Enter 키 로그인 처리
 * 인풋 필드에서 Enter 입력 시 handleLogin()을 호출합니다.
 *
 * @param event - 키보드 이벤트
 */
const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        handleLogin();
    }
};
</script>

<template>
    <!-- 전체 화면 중앙 정렬 컨테이너 (그라데이션 배경) -->
    <div
        class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 p-4">

        <!-- 다크모드 토글 버튼 (우측 상단 고정) -->
        <button
            class="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-700/60 transition-colors"
            :title="isDark ? '라이트 모드로 전환' : '다크 모드로 전환'"
            @click="toggleTheme">
            <i :class="['pi text-lg', isDark ? 'pi-sun' : 'pi-moon']" />
        </button>
        <div class="w-full max-w-md">

            <!-- 로그인 카드: SSO 자동 리다이렉트 중에는 숨김 -->
            <div v-if="!autoRedirecting" class="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-8">

                <!-- 로고 및 시스템명 -->
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded mb-4">
                        <img alt="megamenu-demo" :src="logo" class="w-32 h-auto dark:invert animate-float" >
                    </div>
                    <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">IT 정보화 포탈</h1>
                    <p class="text-zinc-600 dark:text-zinc-400">정보화 사업·예산·인력</p>
                </div>

                <!-- SSO 리다이렉트 중 -->
                <div v-if="route.query.error !== 'sso'" class="py-4 text-center text-zinc-500 dark:text-zinc-400">
                    <i class="pi pi-spin pi-spinner text-2xl" />
                    <p class="text-sm mt-3">SSO 인증 페이지로 이동 중...</p>
                </div>

                <!-- SSO 실패 시 기본 로그인 폼 -->
                <div v-else class="space-y-6">

                    <!-- SSO 실패 안내 -->
                    <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p class="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <i class="pi pi-exclamation-triangle"/>
                            SSO 인증에 실패했습니다. 기본 로그인을 이용해주세요.
                        </p>
                    </div>

                    <!-- 사원번호 입력 -->
                    <div>
                        <label for="eno" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            행번
                        </label>
                        <InputText
id="eno" v-model="eno" placeholder="사원번호를 입력하세요" class="w-full" :disabled="loading"
                            @keypress="handleKeyPress" />
                    </div>

                    <!-- 비밀번호 입력 (toggleMask: 비밀번호 표시/숨김 토글) -->
                    <div>
                        <label for="password" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            ESSO 비밀번호
                        </label>
                        <Password
v-model="password" input-id="password" placeholder="비밀번호를 입력하세요" :feedback="false"
                            toggle-mask class="w-full" :input-class="'w-full'" :disabled="loading"
                            @keypress="handleKeyPress" />
                    </div>

                    <!-- 에러 메시지 (로그인 실패 시 표시) -->
                    <div
v-if="errorMessage"
                        class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p class="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <i class="pi pi-exclamation-circle"/>
                            {{ errorMessage }}
                        </p>
                    </div>

                    <!-- 로그인 버튼 (loading 중 스피너 표시) -->
                    <Button label="로그인" icon="pi pi-sign-in" class="w-full" :loading="loading" @click="handleLogin" />
                </div>

                <!-- 안내 문구 -->
                <div class="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    <p>문의사항은 IT기획부 IT기획팀에 연락해주세요.</p>
                </div>
            </div>

            <!-- 저작권 푸터 -->
            <div class="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                <p>&copy; 2026 IT기획부. All rights reserved.</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* PrimeVue Password 컴포넌트 너비를 부모에 맞게 조정 */
:deep(.p-password) {
    width: 100%;
}

:deep(.p-password input) {
    width: 100%;
}
</style>
