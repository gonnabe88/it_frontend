<!--
================================================================================
[components/GeminiChat.vue] AI 채팅 플로팅 패널
================================================================================
화면 우측 하단에 고정된 플로팅 채팅 버튼을 제공합니다.
클릭하면 채팅 패널이 열리며, POST /api/gemini/generate 로 요청을 전송합니다.

[크기 자동 계산]
  - [data-chat-anchor] 속성이 있는 우측 사이드바 요소를 기준으로
    가로폭(사이드바 너비)과 세로폭(목차 제목 상단까지)을 자동 계산합니다.
  - 사이드바가 없는 소형 화면에서는 기본 크기(360×520)를 사용합니다.

[직접 크기 조절]
  - 패널 좌상단 핸들을 드래그하여 가로/세로 크기를 직접 조정할 수 있습니다.

[사용법]
  <GeminiChat />

[Props]
  - systemInstruction: AI에게 전달할 시스템 지시문 (기본값: 요구사항 분석 전문가)
================================================================================
-->
<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify';

interface Props {
    /** AI에게 전달할 역할/컨텍스트 지시문 */
    systemInstruction?: string;
    /** 현재 요구사항 정의서 본문 HTML (채팅창에 표시하지 않고 API 요청에만 첨부) */
    documentContent?: string;
    /** 첨부파일/이미지 파일관리번호 목록 (AI가 파일 내용을 참조할 수 있도록 전달) */
    flMngNos?: string[];
}

const props = withDefaults(defineProps<Props>(), {
    systemInstruction: '당신은 IT 프로젝트 요구사항 분석 전문가입니다. 응답은 HTML로 작성해주세요. 사용자가 요구사항 정의서 초안을 작성할 수 있도록 도와주세요. 사용자가 요구사항을 입력하면, 요구사항 정의서의 각 항목에 맞게 내용을 정리하고, 누락된 항목이 있다면 추가할 내용을 제안해주세요. 작성된 요구사항을 함께 보내주면 추가,수정한 부분을 html로 표시해주세요.',
    documentContent: '',
    flMngNos: () => []
});

/** 반영하기 확인 후 AI 응답 내용을 부모에게 전달 */
const emit = defineEmits<{
    applyContent: [content: string];
}>();

const { $apiFetch } = useNuxtApp();

// runtimeConfig에서 API 베이스 URL 조회
const config = useRuntimeConfig();
const GEMINI_URL = `${config.public.apiBase}/api/gemini/generate`;

/** 채팅 패널 열림/닫힘 상태 */
const isOpen = ref(false);

/** 메시지 타입 정의 */
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

/** 채팅 메시지 목록 */
const messages = ref<ChatMessage[]>([]);

/** 입력 중인 메시지 */
const inputText = ref('');

/** AI 응답 대기 중 여부 */
const isLoading = ref(false);

/** 메시지 목록 스크롤 영역 ref */
const messagesEl = ref<HTMLElement | null>(null);

/* ── 미리보기 Dialog ── */
/** 미리보기 다이얼로그 표시 여부 */
const previewVisible = ref(false);
/** 미리보기에 표시할 AI 응답 내용 */
const previewContent = ref('');

/** 미리보기 버튼 클릭 */
const openPreview = (content: string) => {
    previewContent.value = content;
    previewVisible.value = true;
};

/* ── 반영 확인 Dialog ── */
/** 반영 확인 다이얼로그 표시 여부 */
const confirmVisible = ref(false);
/** 반영 대기 중인 AI 응답 내용 */
const pendingApplyContent = ref('');

/** 반영하기 버튼 클릭: 확인 다이얼로그 표시 */
const openConfirm = (content: string) => {
    pendingApplyContent.value = content;
    confirmVisible.value = true;
};

/** 반영 최종 확인: 부모에게 applyContent 이벤트 emit */
const doApply = () => {
    emit('applyContent', pendingApplyContent.value);
    confirmVisible.value = false;
};

/* ── 패널 크기 상태 ── */
/** 패널 가로폭 (px) - data-chat-anchor 기준으로 초기화 */
const panelWidth = ref(360);
/** 패널 세로폭 (px) - 바로가기 목차 제목 상단까지 */
const panelHeight = ref(520);

/** 기본 크기 (사이드바 없는 소형 화면 fallback) */
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 520;

/** 최소/최대 크기 제한 */
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 900;
const MAX_HEIGHT = 1200;

/**
 * [data-chat-anchor] 사이드바를 기준으로 패널 크기 자동 계산
 *
 * - 가로폭: 사이드바 요소의 실제 너비
 * - 세로폭: 뷰포트 하단 기준점(bottom-6)부터 사이드바 내 h3(목차 제목) 상단까지
 */
const calcPanelSize = () => {
    const anchor = document.querySelector<HTMLElement>('[data-chat-anchor]');
    if (!anchor || anchor.offsetWidth === 0) {
        // 사이드바가 hidden 상태이거나 없으면 기본값 유지
        panelWidth.value = DEFAULT_WIDTH;
        panelHeight.value = DEFAULT_HEIGHT;
        return;
    }

    // 가로폭: 사이드바 요소 너비 그대로 사용
    panelWidth.value = Math.max(MIN_WIDTH, anchor.offsetWidth);

    // 세로폭: 뷰포트 하단 - bottom-6(24px) 마진 - h3 top 위치
    const h3 = anchor.querySelector<HTMLElement>('h3');
    if (h3) {
        const h3Rect = h3.getBoundingClientRect();
        // 패널 top = h3Rect.top → height = (viewportHeight - bottom-6) - h3Rect.top
        const bottomOffset = 24; // bottom-6 = 1.5rem = 24px
        const computed = window.innerHeight - bottomOffset - h3Rect.top;
        panelHeight.value = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, computed));
    }
};

/* ── 리사이즈 핸들 드래그 ── */
/** 드래그 중 여부 */
const isResizing = ref(false);

/**
 * 좌상단 리사이즈 핸들 mousedown 이벤트 핸들러
 * 패널이 우하단 고정이므로:
 *  - 커서가 왼쪽으로 이동 → 너비 증가
 *  - 커서가 위로 이동    → 높이 증가
 */
const onResizeMousedown = (e: MouseEvent) => {
    e.preventDefault();
    isResizing.value = true;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panelWidth.value;
    const startH = panelHeight.value;

    const onMouseMove = (e: MouseEvent) => {
        // 왼쪽 핸들이므로 x 감소 = 너비 증가
        const newW = startW + (startX - e.clientX);
        // 위쪽 핸들이므로 y 감소 = 높이 증가
        const newH = startH + (startY - e.clientY);
        panelWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newW));
        panelHeight.value = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newH));
    };

    const onMouseUp = () => {
        isResizing.value = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
};

/** 패널 열기/닫기 토글 */
const toggleChat = () => {
    isOpen.value = !isOpen.value;
    // 처음 열 때 크기 재계산
    if (isOpen.value) {
        nextTick(calcPanelSize);
    }
};

/** 메시지 목록 최하단으로 스크롤 */
const scrollToBottom = async () => {
    await nextTick();
    if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
};

/**
 * 메시지 전송 처리
 *
 * 사용자가 입력한 프롬프트에 현재 요구사항 정의서 본문(documentContent)을
 * 컨텍스트로 첨부하여 API에 전달합니다. 첨부 내용은 채팅창에 표시되지 않습니다.
 */
const sendMessage = async () => {
    const userPrompt = inputText.value.trim();
    if (!userPrompt || isLoading.value) return;

    // 채팅창에는 사용자 입력 메시지만 표시
    messages.value.push({
        role: 'user',
        content: userPrompt,
        timestamp: new Date()
    });
    inputText.value = '';
    await scrollToBottom();

    isLoading.value = true;
    try {
        /**
         * API에 전달하는 프롬프트: 사용자 메시지 + 현재 문서 내용(컨텍스트)
         * documentContent가 있으면 구분선과 함께 첨부합니다.
         */
        const fullPrompt = props.documentContent
            ? `${userPrompt}\n\n---\n\n[현재 요구사항 정의서 내용]\n${props.documentContent}`
            : userPrompt;

        // POST /api/gemini/generate 요청 (백엔드 baseURL 포함)
        const response = await $apiFetch<{ content: string } | string>(GEMINI_URL, {
            method: 'POST',
            body: {
                prompt: fullPrompt,
                systemInstruction: props.systemInstruction,
                flMngNos: props.flMngNos
            }
        });

        // 응답 본문이 문자열이거나 객체일 경우 모두 처리
        const content = typeof response === 'string'
            ? response
            : (response as any)?.content ?? (response as any)?.text ?? JSON.stringify(response);

        messages.value.push({
            role: 'assistant',
            content,
            timestamp: new Date()
        });
    } catch (e: any) {
        // 오류 응답도 메시지로 표시
        messages.value.push({
            role: 'assistant',
            content: `오류가 발생했습니다: ${e?.data?.message || e?.message || '알 수 없는 오류'}`,
            timestamp: new Date()
        });
    } finally {
        isLoading.value = false;
        await scrollToBottom();
    }
};

/**
 * Enter 키 전송 처리 (Shift+Enter는 줄바꿈)
 */
const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
};

/** 시간 포맷 (HH:MM) */
const formatTime = (date: Date) =>
    date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

/* ── 라이프사이클 ── */
onMounted(() => {
    // 초기 크기 계산
    calcPanelSize();
    // 창 크기 변경 시 재계산 (사용자가 직접 조절한 경우는 덮어쓰지 않도록 별도 처리 불필요)
    window.addEventListener('resize', calcPanelSize);
});

onUnmounted(() => {
    window.removeEventListener('resize', calcPanelSize);
});
</script>

<template>
    <!-- 우측 하단 고정 플로팅 영역 -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        <!-- ─── 채팅 패널 ─── -->
        <Transition name="chat-panel">
            <div v-if="isOpen"
                class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden"
                :style="{ width: panelWidth + 'px', height: panelHeight + 'px' }"
                :class="{ 'select-none': isResizing }">

                <!-- 리사이즈 핸들 (좌상단 모서리) -->
                <div class="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group" @mousedown="onResizeMousedown">
                    <!-- 핸들 시각적 표시 (3개 점선) -->
                    <div
                        class="absolute top-1.5 left-1.5 w-2 h-2 flex flex-col gap-0.5 opacity-30 group-hover:opacity-80 transition-opacity">
                        <div class="flex gap-0.5">
                            <span class="w-0.5 h-0.5 rounded-full bg-zinc-400"></span>
                            <span class="w-0.5 h-0.5 rounded-full bg-zinc-400"></span>
                        </div>
                        <div class="flex gap-0.5">
                            <span class="w-0.5 h-0.5 rounded-full bg-zinc-400"></span>
                            <span class="w-0.5 h-0.5 rounded-full bg-zinc-400"></span>
                        </div>
                    </div>
                </div>

                <!-- 패널 헤더 -->
                <div
                    class="flex items-center justify-between px-4 py-3 bg-indigo-600 dark:bg-indigo-700 text-white rounded-t-2xl flex-shrink-0">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-sparkles text-sm"></i>
                        <span class="font-semibold text-sm">AI 요구사항 분석 도우미</span>
                    </div>
                    <button class="p-1 rounded hover:bg-indigo-500 transition-colors" @click="toggleChat"
                        aria-label="채팅 닫기">
                        <i class="pi pi-times text-sm"></i>
                    </button>
                </div>

                <!-- 메시지 목록 -->
                <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

                    <!-- 빈 상태 안내 -->
                    <div v-if="messages.length === 0"
                        class="h-full flex flex-col items-center justify-center text-center text-zinc-400 dark:text-zinc-600 gap-3">
                        <i class="pi pi-comments text-4xl text-indigo-200 dark:text-indigo-900"></i>
                        <div>
                            <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">무엇이든 물어보세요</p>
                            <p class="text-xs text-zinc-400 dark:text-zinc-600 mt-1">요구사항 작성, 분석, 검토 등 도움을 드립니다.</p>
                        </div>
                    </div>

                    <!-- 메시지 버블 -->
                    <template v-for="(msg, idx) in messages" :key="idx">

                        <!-- 사용자 메시지 (우측) -->
                        <div v-if="msg.role === 'user'" class="flex justify-end gap-2">
                            <div class="max-w-[80%]">
                                <div
                                    class="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {{ msg.content }}
                                </div>
                                <p class="text-right text-[11px] text-zinc-400 mt-1 mr-1">{{ formatTime(msg.timestamp)
                                }}</p>
                            </div>
                        </div>

                        <!-- AI 응답 메시지 (좌측) -->
                        <div v-else class="flex justify-start gap-2">
                            <div
                                class="flex-shrink-0 w-7 h-7 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mt-0.5">
                                <i class="pi pi-sparkles text-[11px] text-indigo-600 dark:text-indigo-400"></i>
                            </div>
                            <div class="max-w-[90%] flex flex-col gap-1.5">
                                <!-- 응답 텍스트 버블 -->
                                <div
                                    class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {{ msg.content }}
                                </div>
                                <!-- 미리보기 / 반영하기 버튼 -->
                                <div class="flex gap-1.5 pl-1">
                                    <button
                                        class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                        @click="openPreview(msg.content)">
                                        <i class="pi pi-eye text-[10px]"></i> 미리보기
                                    </button>
                                    <button
                                        class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                                        @click="openConfirm(msg.content)">
                                        <i class="pi pi-check text-[10px]"></i> 반영하기
                                    </button>
                                </div>
                                <p class="text-left text-[11px] text-zinc-400 ml-1">{{ formatTime(msg.timestamp) }}</p>
                            </div>
                        </div>

                    </template>

                    <!-- AI 응답 대기 중 로딩 버블 -->
                    <div v-if="isLoading" class="flex justify-start gap-2">
                        <div
                            class="flex-shrink-0 w-7 h-7 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mt-0.5">
                            <i class="pi pi-sparkles text-[11px] text-indigo-600 dark:text-indigo-400"></i>
                        </div>
                        <div class="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
                            <div class="flex gap-1 items-center h-4">
                                <span class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                                    style="animation-delay: 0ms"></span>
                                <span class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                                    style="animation-delay: 150ms"></span>
                                <span class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                                    style="animation-delay: 300ms"></span>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- 입력 영역 -->
                <div
                    class="flex-shrink-0 px-3 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div class="flex items-end gap-2">
                        <Textarea v-model="inputText" placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)" rows="2"
                            class="flex-1 resize-none text-sm min-h-0" :disabled="isLoading" @keydown="onKeydown" />
                        <Button icon="pi pi-send" rounded :disabled="!inputText.trim() || isLoading"
                            :loading="isLoading" class="flex-shrink-0 mb-0.5" @click="sendMessage" aria-label="전송" />
                    </div>
                </div>

            </div>
        </Transition>

        <!-- ─── 플로팅 토글 버튼 ─── -->
        <button
            class="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            @click="toggleChat" :aria-label="isOpen ? '채팅 닫기' : 'AI 도우미 열기'">
            <i :class="isOpen ? 'pi pi-times text-xl' : 'pi pi-comments text-xl'"></i>
        </button>

    </div>

    <!-- ─── 미리보기 다이얼로그 ─── -->
    <Dialog v-model:visible="previewVisible" header="AI 응답 미리보기" modal
        :style="{ width: '60vw', maxWidth: '900px' }"
        :pt="{ content: { class: 'overflow-y-auto max-h-[60vh]' } }">
        <div class="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed"
            v-html="DOMPurify.sanitize(previewContent)">
        </div>
        <template #footer>
            <Button label="닫기" severity="secondary" @click="previewVisible = false" />
            <Button label="반영하기" icon="pi pi-check"
                @click="() => { previewVisible = false; openConfirm(previewContent); }" />
        </template>
    </Dialog>

    <!-- ─── 반영 확인 다이얼로그 ─── -->
    <Dialog v-model:visible="confirmVisible" header="내용 반영" modal :style="{ width: '400px' }">
        <div class="flex items-start gap-3 py-2">
            <i class="pi pi-exclamation-triangle text-2xl text-amber-500 flex-shrink-0 mt-0.5"></i>
            <div>
                <p class="font-medium text-zinc-800 dark:text-zinc-200">기존 내용을 대체합니다.</p>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">요구사항 정의서 본문이 AI 응답으로 교체됩니다. 계속 하시겠습니까?</p>
            </div>
        </div>
        <template #footer>
            <Button label="취소" severity="secondary" @click="confirmVisible = false" />
            <Button label="반영하기" icon="pi pi-check" severity="danger" @click="doApply" />
        </template>
    </Dialog>
</template>

<style scoped>
/* 채팅 패널 슬라이드 업 트랜지션 */
.chat-panel-enter-active,
.chat-panel-leave-active {
    transition: opacity 0.2s ease, transform 0.25s ease;
}

.chat-panel-enter-from,
.chat-panel-leave-to {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
}
</style>
