<!--
================================================================================
[components/review/ReviewCommentPopover.vue] 코멘트 입력/표시 팝오버
================================================================================
Design Ref: §5.4 CommentPopover
- 우클릭 시 코멘트 입력 폼 표시 (텍스트 + 첨부파일)
- 하이라이트 클릭 시 기존 코멘트 내용 표시
================================================================================
-->
<script setup lang="ts">
import type { ReviewComment, CommentAttachment } from '~/types/review';

const props = defineProps<{
  /** 팝오버 표시 여부 */
  visible: boolean;
  /** 팝오버 위치 */
  position: { x: number; y: number };
  /** 코멘트 유형 */
  type: 'inline' | 'general';
  /** 인라인 코멘트 시 마크 ID */
  markId?: string;
  /** 인라인 코멘트 시 선택된 텍스트 */
  quotedText?: string;
  /** 기존 코멘트 보기 모드 시 */
  existingComment?: ReviewComment | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: {
    type: 'inline' | 'general';
    text: string;
    markId?: string;
    quotedText?: string;
    attachments: CommentAttachment[];
  }): void;
  (e: 'resolve', commentId: string): void;
}>();

/** 코멘트 입력 텍스트 */
const commentText = ref('');
/** 첨부파일 목록 */
const attachments = ref<CommentAttachment[]>([]);
/** 첨부파일 input 참조 */
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 팝오버 위치 스타일 */
const popoverStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${Math.min(props.position.x, window.innerWidth - 380)}px`,
  top: `${Math.min(props.position.y, window.innerHeight - 300)}px`,
  zIndex: 9999,
}));

/** 입력 모드 vs 보기 모드 */
const isViewMode = computed(() => !!props.existingComment);

/** 코멘트 등록 */
const handleSubmit = () => {
  if (!commentText.value.trim()) return;

  emit('submit', {
    type: props.type,
    text: commentText.value.trim(),
    markId: props.markId,
    quotedText: props.quotedText,
    attachments: [...attachments.value],
  });

  // 입력 초기화
  commentText.value = '';
  attachments.value = [];
  emit('close');
};

/** 첨부파일 추가 */
const handleFileAdd = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;

  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'image/', 'application/pdf',
    'application/vnd.hancom', // HWP
    'application/vnd.openxmlformats', // XLSX, DOCX
    'application/vnd.ms-excel',
  ];

  Array.from(input.files).forEach(file => {
    // 크기 검증
    if (file.size > maxSize) {
      useToast().add({
        severity: 'warn',
        summary: '파일 크기 초과',
        detail: `${file.name}: 10MB를 초과합니다.`,
        life: 3000,
      });
      return;
    }

    // 타입 검증
    const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
    if (!isAllowed && file.name.match(/\.(hwp|hwpx)$/i)) {
      // HWP 파일은 MIME 타입이 다를 수 있으므로 확장자로 허용
    } else if (!isAllowed) {
      useToast().add({
        severity: 'warn',
        summary: '허용되지 않는 파일',
        detail: `${file.name}: 이미지, PDF, HWP, XLSX, DOCX만 첨부 가능합니다.`,
        life: 3000,
      });
      return;
    }

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

/** 팝오버 닫기 */
const handleClose = () => {
  commentText.value = '';
  attachments.value = [];
  emit('close');
};

/** 외부 클릭 시 닫기 */
const popoverRef = ref<HTMLElement | null>(null);
onMounted(() => {
  const handler = (e: MouseEvent) => {
    if (props.visible && popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
      handleClose();
    }
  };
  // 약간의 딜레이로 우클릭 이벤트와 충돌 방지
  setTimeout(() => document.addEventListener('mousedown', handler), 100);
  onBeforeUnmount(() => document.removeEventListener('mousedown', handler));
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverRef"
      :style="popoverStyle"
      class="w-[360px] bg-white rounded-lg shadow-xl border border-surface-200 overflow-hidden"
    >
      <!-- 헤더 -->
      <div class="flex items-center justify-between px-4 py-2 bg-surface-50 border-b border-surface-200">
        <span class="text-sm font-semibold text-surface-700">
          {{ isViewMode ? '코멘트' : (type === 'inline' ? '코멘트 달기' : '전반 코멘트') }}
        </span>
        <Button icon="pi pi-times" text rounded size="small" @click="handleClose" />
      </div>

      <!-- 인용문 표시 (인라인 코멘트 시) -->
      <div v-if="quotedText" class="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
        <p class="text-xs text-yellow-800 italic truncate">"{{ quotedText }}"</p>
      </div>

      <!-- 보기 모드: 기존 코멘트 표시 -->
      <div v-if="isViewMode && existingComment" class="p-4">
        <div class="flex items-center gap-2 mb-2">
          <Tag :value="existingComment.authorTeam" severity="info" class="text-xs" />
          <span class="text-sm font-medium">{{ existingComment.authorName }}</span>
          <span class="text-xs text-surface-400">
            {{ new Date(existingComment.createdAt).toLocaleString('ko-KR') }}
          </span>
        </div>
        <p class="text-sm text-surface-700 whitespace-pre-wrap">{{ existingComment.text }}</p>

        <!-- 첨부파일 목록 -->
        <div v-if="existingComment.attachments.length > 0" class="mt-2 space-y-1">
          <div
            v-for="att in existingComment.attachments"
            :key="att.id"
            class="flex items-center gap-2 text-xs text-surface-500"
          >
            <i class="pi pi-paperclip" />
            <span>{{ att.fileName }} ({{ formatSize(att.fileSize) }})</span>
          </div>
        </div>

        <!-- 해결 버튼 -->
        <div v-if="!existingComment.resolved" class="mt-3 flex justify-end">
          <Button
            label="해결됨"
            icon="pi pi-check"
            size="small"
            severity="success"
            outlined
            @click="emit('resolve', existingComment.id)"
          />
        </div>
        <div v-else class="mt-2 text-xs text-green-600 flex items-center gap-1">
          <i class="pi pi-check-circle" />
          해결됨
        </div>
      </div>

      <!-- 입력 모드 -->
      <div v-else class="p-4 space-y-3">
        <!-- 코멘트 입력 -->
        <Textarea
          v-model="commentText"
          :rows="3"
          placeholder="코멘트를 입력하세요..."
          class="w-full text-sm"
          auto-resize
        />

        <!-- 첨부파일 목록 -->
        <div v-if="attachments.length > 0" class="space-y-1">
          <div
            v-for="(att, idx) in attachments"
            :key="att.id"
            class="flex items-center justify-between px-2 py-1 bg-surface-50 rounded text-xs"
          >
            <div class="flex items-center gap-1.5 truncate">
              <i class="pi pi-paperclip text-surface-400" />
              <span class="truncate">{{ att.fileName }}</span>
              <span class="text-surface-400">({{ formatSize(att.fileSize) }})</span>
            </div>
            <Button icon="pi pi-times" text rounded size="small" @click="removeAttachment(idx)" />
          </div>
        </div>

        <!-- 하단 버튼 -->
        <div class="flex items-center justify-between">
          <div>
            <input
              ref="fileInputRef"
              type="file"
              multiple
              class="hidden"
              accept="image/*,.pdf,.hwp,.hwpx,.xlsx,.xls,.docx,.doc"
              @change="handleFileAdd"
            >
            <Button
              v-tooltip.top="'첨부파일'"
              icon="pi pi-paperclip"
              text
              rounded
              size="small"
              @click="fileInputRef?.click()"
            />
          </div>
          <div class="flex gap-2">
            <Button label="취소" text size="small" @click="handleClose" />
            <Button
              label="등록"
              icon="pi pi-send"
              size="small"
              :disabled="!commentText.trim()"
              @click="handleSubmit"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
