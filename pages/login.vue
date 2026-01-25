<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '~/composables/useAuth';

definePageMeta({
    layout: false, // 로그인 페이지는 레이아웃 없이
    middleware: []
});

const { login } = useAuth();
const router = useRouter();

const eno = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

const handleLogin = async () => {
    if (!eno.value || !password.value) {
        errorMessage.value = '사원번호와 비밀번호를 입력해주세요.';
        return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
        await login({
            eno: eno.value,
            password: password.value
        });

        // 로그인 성공 시 메인 페이지로 이동
        router.push('/');
    } catch (error: any) {
        console.error('Login error:', error);
        errorMessage.value = error.data?.message || '로그인에 실패했습니다. 사원번호와 비밀번호를 확인해주세요.';
    } finally {
        loading.value = false;
    }
};

// Enter 키로 로그인
const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        handleLogin();
    }
};
</script>

<template>
    <div
        class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div class="w-full max-w-md">
            <!-- 로그인 카드 -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
                <!-- 로고 및 타이틀 -->
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                        <i class="pi pi-building text-3xl text-white"></i>
                    </div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">IT Portal</h1>
                    <p class="text-gray-600 dark:text-gray-400">정보화사업 관리 시스템</p>
                </div>

                <!-- 로그인 폼 -->
                <div class="space-y-6">
                    <!-- 사원번호 입력 -->
                    <div>
                        <label for="eno" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            사원번호
                        </label>
                        <InputText id="eno" v-model="eno" placeholder="사원번호를 입력하세요" class="w-full" :disabled="loading"
                            @keypress="handleKeyPress" />
                    </div>

                    <!-- 비밀번호 입력 -->
                    <div>
                        <label for="password" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            비밀번호
                        </label>
                        <Password id="password" v-model="password" placeholder="비밀번호를 입력하세요" :feedback="false"
                            toggleMask class="w-full" :inputClass="'w-full'" :disabled="loading"
                            @keypress="handleKeyPress" />
                    </div>

                    <!-- 에러 메시지 -->
                    <div v-if="errorMessage"
                        class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p class="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <i class="pi pi-exclamation-circle"></i>
                            {{ errorMessage }}
                        </p>
                    </div>

                    <!-- 로그인 버튼 -->
                    <Button label="로그인" icon="pi pi-sign-in" class="w-full" :loading="loading" @click="handleLogin" />
                </div>

                <!-- 추가 정보 -->
                <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    <p>문의사항은 IT 담당자에게 연락해주세요.</p>
                </div>
            </div>

            <!-- 푸터 -->
            <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>&copy; 2024 IT Portal. All rights reserved.</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Password 컴포넌트 스타일 조정 */
:deep(.p-password) {
    width: 100%;
}

:deep(.p-password input) {
    width: 100%;
}
</style>
