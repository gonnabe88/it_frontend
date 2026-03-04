<!--
================================================================================
[error.vue] 전역 에러 핸들러 페이지
================================================================================
Nuxt 4의 에러 바운더리로, 라우팅/API/런타임에서 처리되지 않은 오류를
사용자 친화적으로 표시합니다.

[처리 오류 유형]
  - 401 Unauthorized : 인증 필요 안내 (useApiFetch에서도 처리하나 fallback)
  - 403 Forbidden    : 권한 없음 안내
  - 404 Not Found    : 페이지/리소스 없음 안내
  - 500+             : 서버 오류 안내
  - 기타             : 예기치 않은 오류 안내

[버튼 동작]
  - 이전 페이지: clearError() 후 history.back()
  - 홈으로: clearError({ redirect: '/' })

[참고]
  - 개발 환경에서만 상세 오류 메시지(error.message) 표시
================================================================================
-->
<script setup lang="ts">
import { useError, clearError } from '#app';

/** 현재 발생한 Nuxt 에러 객체 */
const error = useError();
/** 개발 환경 여부 (상세 오류 메시지 노출 조건) */
const isDev = import.meta.dev;

/** HTTP 상태 코드별 사용자 친화 메시지 매핑 */
const STATUS_MESSAGES: Record<number, string> = {
    401: '인증이 필요합니다. 다시 로그인해주세요.',
    403: '해당 페이지에 접근 권한이 없습니다.',
    404: '요청하신 페이지를 찾을 수 없습니다.',
    500: '서버에서 오류가 발생했습니다.',
    503: '서버가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.',
};

/** 현재 오류에 해당하는 메시지 (매핑 없으면 기본 메시지 사용) */
const errorMessage = computed(
    () => STATUS_MESSAGES[error.value?.statusCode as number] || '예기치 않은 오류가 발생했습니다.'
);

/**
 * 이전 페이지로 이동
 * clearError()로 에러 상태를 초기화한 후 브라우저 history를 뒤로 이동합니다.
 */
const handleGoBack = () => {
    clearError();
    history.back();
};

/**
 * 홈으로 이동
 * clearError()와 동시에 루트 경로('/')로 리다이렉트합니다.
 */
const handleGoHome = () => {
    clearError({ redirect: '/' });
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div class="text-center space-y-6 max-w-lg w-full">

            <!-- 상태 코드 대형 표시 -->
            <div class="text-8xl font-extrabold text-zinc-200 dark:text-zinc-800 select-none">
                {{ error?.statusCode || 'ERR' }}
            </div>

            <!-- 아이콘 + 오류 제목 -->
            <div class="flex flex-col items-center gap-3">
                <div class="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <i class="pi pi-exclamation-circle text-3xl text-red-500"></i>
                </div>
                <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {{ errorMessage }}
                </h1>
            </div>

            <!-- 개발 환경 전용: 상세 오류 메시지 표시 -->
            <div v-if="isDev && error?.message"
                class="text-left text-sm text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 break-all">
                <span class="text-xs font-sans font-semibold text-zinc-400 dark:text-zinc-500 block mb-1">
                    [개발 환경 상세 정보]
                </span>
                {{ error.message }}
            </div>

            <!-- 액션 버튼 -->
            <div class="flex justify-center gap-3">
                <Button label="이전 페이지" severity="secondary" icon="pi pi-arrow-left" @click="handleGoBack" />
                <Button label="홈으로" icon="pi pi-home" @click="handleGoHome" />
            </div>
        </div>
    </div>
</template>
