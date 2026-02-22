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
    layout: false, // 기본 레이아웃 비활성화 (전체 화면 로그인 UI)
    middleware: []  // 전역 인증 미들웨어 제외 (로그인 페이지는 인증 불필요)
});

/* 인증 composable에서 login 액션 가져오기 */
const { login } = useAuth();
const router = useRouter();

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

        // 로그인 성공 → 홈(/)으로 이동 (index.vue에서 /info로 리다이렉트)
        router.push('/');
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
        class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div class="w-full max-w-md">

            <!-- 로그인 카드 -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">

                <!-- 로고 및 시스템명 -->
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded mb-4">
                        <img alt="megamenu-demo" :src="logo" class="w-32 h-auto dark:invert animate-float" />
                    </div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">IT Portal</h1>
                    <p class="text-gray-600 dark:text-gray-400">정보화사업 관리 시스템</p>
                </div>

                <!-- 로그인 폼 영역 -->
                <div class="space-y-6">

                    <!-- 사원번호 입력 -->
                    <div>
                        <label for="eno" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            사원번호
                        </label>
                        <InputText id="eno" v-model="eno" placeholder="사원번호를 입력하세요" class="w-full" :disabled="loading"
                            @keypress="handleKeyPress" />
                    </div>

                    <!-- 비밀번호 입력 (toggleMask: 비밀번호 표시/숨김 토글) -->
                    <div>
                        <label for="password" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            비밀번호
                        </label>
                        <Password id="password" v-model="password" placeholder="비밀번호를 입력하세요" :feedback="false"
                            toggleMask class="w-full" :inputClass="'w-full'" :disabled="loading"
                            @keypress="handleKeyPress" />
                    </div>

                    <!-- 에러 메시지 (로그인 실패 시 표시) -->
                    <div v-if="errorMessage"
                        class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p class="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <i class="pi pi-exclamation-circle"></i>
                            {{ errorMessage }}
                        </p>
                    </div>

                    <!-- 로그인 버튼 (loading 중 스피너 표시) -->
                    <Button label="로그인" icon="pi pi-sign-in" class="w-full" :loading="loading" @click="handleLogin" />
                </div>

                <!-- 안내 문구 -->
                <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    <p>문의사항은 IT 담당자에게 연락해주세요.</p>
                </div>
            </div>

            <!-- 저작권 푸터 -->
            <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>&copy; 2024 IT Portal. All rights reserved.</p>
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
