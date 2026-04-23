<!--
================================================================================
[pages/info/documents/[id]/review.vue] 사전협의 전용 페이지
================================================================================
Design Ref: §5.1 Screen Layout
- ReviewToolbar (상단) + ReviewEditor (좌측) + ReviewMessenger (우측)
- 우클릭 시 ReviewCommentPopover로 코멘트 등록
- 모든 상태는 Pinia store(useReviewStore)에서 관리
================================================================================
-->
<script setup lang="ts">
import { useReview } from '~/composables/useReview';
import { useDocuments } from '~/composables/useDocuments';
import type { ReviewerTeam, CommentAttachment } from '~/types/review';

const route = useRoute();
/** 문서 관리번호 (라우트 파라미터 변경 시 반응형 갱신) */
const docMngNo = computed(() => route.params.id as string);

const title = '사전협의';
definePageMeta({ title });

const { fetchDocument } = useDocuments();
const {
  store,
  loadSession,
  submitForReview,
  addInlineComment,
  addGeneralComment,
  resolveComment,
  completeReview,
  updateContent,
  viewVersion,
  setActiveComment,
} = useReview();

/* ── 문서 데이터 로드 ── */
const { data: docData, pending: loadPending } = await fetchDocument(docMngNo.value);

/** 라우트 파라미터 변경 시 문서 + 세션 다시 로드 */
watch(docMngNo, async (newId) => {
  const { data } = await fetchDocument(newId);
  const doc = data.value;
  if (doc) {
    await loadSession(newId, doc.reqNm || '요구사항 정의서', doc.reqCone || '', doc.docVrs ?? 0);
  }
});

/** 최초 문서 로드 완료 시 세션 초기화 */
watch(docData, async (doc) => {
  if (doc) {
    await loadSession(docMngNo.value, doc.reqNm || '요구사항 정의서', doc.reqCone || '', doc.docVrs ?? 0);
  }
}, { immediate: true });

/* ── ReviewEditor 참조 ── */
const editorRef = ref<InstanceType<typeof import('~/components/review/ReviewEditor.vue').default> | null>(null);

/* ── 코멘트 팝오버 상태 ── */
const popover = ref({
  visible: false,
  position: { x: 0, y: 0 },
  type: 'inline' as 'inline' | 'general',
  markId: undefined as string | undefined,
  quotedText: undefined as string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingComment: null as any,
});

/** 모의 현재 사용자 (Phase 1: 고정값) */
const currentUser = {
  eno: 'R003',
  empNm: '이철수',
  team: '기획팀' as ReviewerTeam,
};

/* ── 이벤트 핸들러 ── */

/** 인라인 코멘트 요청 (에디터에서 텍스트 선택 후 우클릭) */
const handleRequestInlineComment = (payload: { markId: string; quotedText: string; position: { x: number; y: number } }) => {
  popover.value = {
    visible: true,
    position: payload.position,
    type: 'inline',
    markId: payload.markId,
    quotedText: payload.quotedText,
    existingComment: null,
  };
};

/** 전반 코멘트 요청 (선택 없이 우클릭) */
const handleRequestGeneralComment = (payload: { position: { x: number; y: number } }) => {
  popover.value = {
    visible: true,
    position: payload.position,
    type: 'general',
    markId: undefined,
    quotedText: undefined,
    existingComment: null,
  };
};

/** 코멘트 마크 클릭 (기존 코멘트 보기) */
const handleCommentMarkClick = (commentId: string) => {
  const comment = store.session?.comments.find(c => c.markId === commentId || c.id === commentId);
  if (!comment) return;

  setActiveComment(comment.id);

  // 팝오버로 기존 코멘트 표시
  const el = document.querySelector(`[data-comment-id="${comment.markId ?? comment.id}"]`);
  const rect = el?.getBoundingClientRect();

  popover.value = {
    visible: true,
    position: rect
      ? { x: rect.right + 8, y: rect.top }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    type: comment.type,
    markId: comment.markId,
    quotedText: comment.quotedText,
    existingComment: comment,
  };
};

/** 코멘트 팝오버 등록 */
const handleCommentSubmit = async (payload: {
  type: 'inline' | 'general';
  text: string;
  markId?: string;
  quotedText?: string;
  attachments: CommentAttachment[];
}) => {
  if (payload.type === 'inline' && payload.markId) {
    // 인라인 코멘트: 에디터에 마크 적용 후 코멘트 추가
    editorRef.value?.applyCommentMark(payload.markId);

    await addInlineComment({
      text: payload.text,
      markId: payload.markId,
      quotedText: payload.quotedText ?? '',
      authorEno: currentUser.eno,
      authorName: currentUser.empNm,
      authorTeam: currentUser.team,
      attachments: payload.attachments,
    });
  } else {
    // 전반 코멘트
    await addGeneralComment({
      text: payload.text,
      authorEno: currentUser.eno,
      authorName: currentUser.empNm,
      authorTeam: currentUser.team,
      attachments: payload.attachments,
    });
  }
};

/** 코멘트 해결 */
const handleResolve = async (commentId: string) => {
  await resolveComment(commentId);
  editorRef.value?.resolveCommentMark(commentId);
  popover.value.visible = false;
};

/** 메신저에서 전반 코멘트 등록 */
const handleMessengerComment = async (payload: { text: string; attachments: CommentAttachment[] }) => {
  await addGeneralComment({
    text: payload.text,
    authorEno: currentUser.eno,
    authorName: currentUser.empNm,
    authorTeam: currentUser.team,
    attachments: payload.attachments,
  });
};

/** 메신저에서 코멘트 클릭 → 본문 스크롤 */
const handleScrollToComment = (markId: string) => {
  editorRef.value?.scrollToComment(markId);
};

/** 버전 변경 */
const handleVersionChange = (version: string) => {
  viewVersion(version);
};

/** 에디터 내용 변경 */
const handleEditorUpdate = (content: string) => {
  updateContent(content);
};

/** 검토요청 */
const handleSubmitForReview = () => {
  submitForReview();
};

/** 검토완료 */
const handleCompleteReview = (reviewerEno: string) => {
  completeReview(reviewerEno);
};
</script>

<template>
  <div class="flex flex-col h-full bg-surface-50">
    <!-- 로딩 -->
    <div v-if="loadPending" class="flex items-center justify-center h-full">
      <ProgressSpinner class="w-12 h-12" />
    </div>

    <template v-else>
      <!-- 상단 툴바 -->
      <ReviewToolbar
        @submit-for-review="handleSubmitForReview"
        @complete-review="handleCompleteReview"
        @version-change="handleVersionChange"
      />

      <!-- 메인 콘텐츠: 에디터 + 메신저 -->
      <div class="flex flex-1 min-h-0 overflow-hidden">
        <!-- 좌측: 에디터 영역 -->
        <div class="flex-1 overflow-hidden flex flex-col p-4">
          <ReviewEditor
            ref="editorRef"
            :readonly="store.isViewingHistory"
            @request-inline-comment="handleRequestInlineComment"
            @request-general-comment="handleRequestGeneralComment"
            @comment-mark-click="handleCommentMarkClick"
            @update="handleEditorUpdate"
          />
        </div>

        <!-- 우측: 메신저 (폭 360px) -->
        <div class="w-[360px] flex flex-col border-l border-surface-200">
          <ReviewMessenger
            @scroll-to-comment="handleScrollToComment"
            @add-general-comment="handleMessengerComment"
          />
        </div>
      </div>

    </template>

    <!-- 코멘트 팝오버 -->
    <ReviewCommentPopover
      :visible="popover.visible"
      :position="popover.position"
      :type="popover.type"
      :mark-id="popover.markId"
      :quoted-text="popover.quotedText"
      :existing-comment="popover.existingComment"
      @close="popover.visible = false"
      @submit="handleCommentSubmit"
      @resolve="handleResolve"
    />

  </div>
</template>
