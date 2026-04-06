<!--
================================================================================
[components/review/ReviewMessenger.vue] 우측 메신저 대화창
================================================================================
Design Ref: §5.4 Messenger 영역
- 코멘트 시간순 목록 표시
- 인라인 코멘트 클릭 시 본문 해당 위치 스크롤
- 메신저에서 직접 코멘트(텍스트+첨부) 입력
================================================================================
-->
<script setup lang="ts">
import { useReviewStore } from '~/stores/review';
import type { ReviewComment, CommentAttachment, ReviewerTeam } from '~/types/review';

const emit = defineEmits<{
  /** 인라인 코멘트 클릭 → 본문 스크롤 요청 */
  (e: 'scroll-to-comment', commentId: string): void;
  /** 전반 코멘트 등록 */
  (e: 'add-general-comment', payload: {
    text: string;
    attachments: CommentAttachment[];
  }): void;
}>();

const store = useReviewStore();

/** 메시지 입력 텍스트 */
const messageText = ref('');
/** 첨부파일 */
const attachments = ref<CommentAttachment[]>([]);
/** 파일 input 참조 */
const fileInputRef = ref<HTMLInputElement | null>(null);
/** 메시지 목록 컨테이너 참조 (자동 스크롤용) */
const messageListRef = ref<HTMLElement | null>(null);

/** 메시지 전송 */
const handleSend = () => {
  if (!messageText.value.trim()) return;

  emit('add-general-comment', {
    text: messageText.value.trim(),
    attachments: [...attachments.value],
  });

  messageText.value = '';
  attachments.value = [];

  // 스크롤 하단으로
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
};

/** 첨부파일 추가 */
const handleFileAdd = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;

  Array.from(input.files).forEach(file => {
    if (file.size > 10 * 1024 * 1024) return; // 10MB 제한
    attachments.value.push({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  });
  input.value = '';
};

/** 첨부파일 제거 */
const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1);
};

/** 파일 크기 포맷 */
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/** 시각 포맷 (HH:mm) */
const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

/** 날짜 포맷 (MM/DD) */
const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** 코멘트 클릭 핸들러 */
const handleCommentClick = (comment: ReviewComment) => {
  if (comment.type === 'inline' && comment.markId) {
    emit('scroll-to-comment', comment.markId);
  }
  store.setActiveComment(comment.id);
};

/** 팀별 색상 */
const teamColor = (team: ReviewerTeam): string => {
  const colors: Record<string, string> = {
    '개발/운영팀': 'info',
    '계약팀': 'warn',
    '기획팀': 'success',
    'PMO팀': 'danger',
  };
  return colors[team] ?? 'secondary';
};

/** 새 코멘트 추가 시 자동 스크롤 */
watch(() => store.sortedComments.length, () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
});

/** Enter 키 전송 (Shift+Enter는 줄바꿈) */
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};
</script>

<template>
  <div class="flex flex-col h-full border-l border-surface-200 bg-surface-50">
    <!-- 메시지 목록 -->
    <div ref="messageListRef" class="flex-1 overflow-y-auto p-3 space-y-3">
      <div v-if="store.sortedComments.length === 0" class="text-center text-surface-400 text-sm py-8">
        아직 코멘트가 없습니다.
      </div>

      <div
        v-for="comment in store.sortedComments"
        :key="comment.id"
        class="p-3 bg-white rounded-lg border border-surface-100 hover:border-primary/30 cursor-pointer transition-colors"
        :class="{ 'ring-1 ring-primary': store.activeCommentId === comment.id }"
        @click="handleCommentClick(comment)"
      >
        <!-- 헤더: 작성자 + 팀 + 시각 -->
        <div class="flex items-center gap-2 mb-1.5">
          <Tag :value="comment.authorTeam" :severity="teamColor(comment.authorTeam)" class="text-[10px]" />
          <span class="text-sm font-medium text-surface-800">{{ comment.authorName }}</span>
          <span class="text-xs text-surface-400 ml-auto">
            {{ formatDate(comment.createdAt) }} {{ formatTime(comment.createdAt) }}
          </span>
        </div>

        <!-- 인용문 (인라인 코멘트) -->
        <div
          v-if="comment.type === 'inline' && comment.quotedText"
          class="mb-1.5 px-2 py-1 bg-yellow-50 rounded text-xs text-yellow-800 italic border-l-2 border-yellow-400 truncate"
        >
          "{{ comment.quotedText }}"
        </div>

        <!-- 코멘트 내용 -->
        <p class="text-sm text-surface-700 whitespace-pre-wrap">{{ comment.text }}</p>

        <!-- 첨부파일 -->
        <div v-if="comment.attachments.length > 0" class="mt-1.5 space-y-0.5">
          <div
            v-for="att in comment.attachments"
            :key="att.id"
            class="flex items-center gap-1.5 text-xs text-surface-500"
          >
            <i class="pi pi-paperclip" />
            <span>{{ att.fileName }}</span>
          </div>
        </div>

        <!-- 해결됨 표시 -->
        <div v-if="comment.resolved" class="mt-1.5 text-xs text-green-600 flex items-center gap-1">
          <i class="pi pi-check-circle" />
          해결됨
        </div>
      </div>
    </div>

    <!-- 메시지 입력 영역 -->
    <div class="border-t border-surface-200 bg-white p-3">
      <!-- 첨부파일 표시 -->
      <div v-if="attachments.length > 0" class="mb-2 space-y-1">
        <div
          v-for="(att, idx) in attachments"
          :key="att.id"
          class="flex items-center justify-between px-2 py-1 bg-surface-50 rounded text-xs"
        >
          <span class="truncate">{{ att.fileName }} ({{ formatSize(att.fileSize) }})</span>
          <button class="text-surface-400 hover:text-red-500" @click="removeAttachment(idx)">
            <i class="pi pi-times text-xs" />
          </button>
        </div>
      </div>

      <!-- 입력 + 버튼 -->
      <div class="flex items-end gap-2">
        <div class="flex-1">
          <Textarea
            v-model="messageText"
            :rows="15"
            placeholder="메시지를 입력하세요..."
            class="w-full text-sm"
            style="min-height: 400px; resize: none;"
            @keydown="handleKeydown"
          />
        </div>
        <div class="flex flex-col gap-1">
          <input
            ref="fileInputRef"
            type="file"
            multiple
            class="hidden"
            accept="image/*,.pdf,.hwp,.hwpx,.xlsx,.xls,.docx,.doc"
            @change="handleFileAdd"
          />
          <Button
            icon="pi pi-paperclip"
            text
            rounded
            size="small"
            v-tooltip.top="'첨부'"
            @click="fileInputRef?.click()"
          />
          <Button
            icon="pi pi-send"
            rounded
            size="small"
            :disabled="!messageText.trim()"
            @click="handleSend"
          />
        </div>
      </div>
    </div>
  </div>
</template>
