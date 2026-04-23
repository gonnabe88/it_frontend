<!--
================================================================================
[components/review/ReviewEditor.vue] 사전협의 에디터 래퍼
================================================================================
Design Ref: §5.3, §Tiptap Extension 설계
- 공통 TiptapEditor를 readonly로 사용하고 CommentMark Extension만 추가 주입
- HeadingGuard: H2/H3 삭제 방지 (ProseMirror Plugin으로 동적 등록)
- 우클릭 ContextMenu 처리 (ProseMirror Plugin으로 동적 등록)
- CSS는 TiptapEditor 자체 CSS가 적용되므로 별도 복제 불필요
================================================================================
-->
<script setup lang="ts">
import { Mark, mergeAttributes, type AnyExtension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/vue-3';

import { useReviewStore } from '~/stores/review';

const store = useReviewStore();

const emit = defineEmits<{
  /** 인라인 코멘트 요청 (텍스트 선택 후 우클릭) */
  (e: 'request-inline-comment', payload: { markId: string; quotedText: string; position: { x: number; y: number } }): void;
  /** 전반 코멘트 요청 (선택 없이 우클릭) */
  (e: 'request-general-comment', payload: { position: { x: number; y: number } }): void;
  /** 코멘트 마크 클릭 또는 에디터 내용 변경 */
  (e: 'comment-mark-click' | 'update', value: string): void;
}>();

const props = defineProps<{
  /** 에디터 읽기전용 여부 */
  readonly?: boolean;
}>();

/* ── CommentMark Extension — 인라인 코멘트 하이라이트 ── */
const CommentMark = Mark.create({
  name: 'commentMark',

  addAttributes() {
    return {
      // data-comment-id ↔ commentId 양방향 매핑 (DB 재로드 시 마크 복원)
      commentId: {
        default: null,
        parseHTML: el => (el as HTMLElement).getAttribute('data-comment-id'),
        renderHTML: attrs => ({ 'data-comment-id': attrs.commentId }),
      },
      // data-resolved ↔ resolved 양방향 매핑 (해결 상태 복원)
      resolved: {
        default: false,
        parseHTML: el => (el as HTMLElement).getAttribute('data-resolved') === 'true',
        renderHTML: attrs => ({
          'data-resolved': String(attrs.resolved === true || attrs.resolved === 'true'),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const resolved = HTMLAttributes['data-resolved'] === 'true';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: resolved ? 'review-comment-resolved' : 'review-comment-highlight',
        style: resolved
          ? 'background-color: #e5e7eb; cursor: pointer;'
          : 'background-color: #fef08a; cursor: pointer;',
      }),
      0,
    ];
  },
});

/** 추가 Extension 목록 — TiptapEditor에 주입 */
const additionalExtensions: AnyExtension[] = [CommentMark];

/* ── TiptapEditor 참조 ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tiptapEditorRef = ref<any>(null);

/** 내부 에디터 인스턴스 접근 헬퍼 */
const getEditor = (): Editor | undefined => {
  const editorRef = tiptapEditorRef.value?.editor;
  // useEditor()가 ShallowRef를 반환하므로 .value로 접근
  return editorRef?.value ?? editorRef;
};

/* ── HeadingGuard 플러그인 — H2/H3 삭제 및 내용 수정 방지 ── */
const headingGuardPlugin = new Plugin({
  key: new PluginKey('headingGuard'),
  filterTransaction(transaction, state) {
    if (!transaction.docChanged) return true;

    let blocked = false;
    const oldDoc = state.doc;

    oldDoc.descendants((node, pos) => {
      if (node.type.name === 'heading' && (node.attrs.level === 2 || node.attrs.level === 3)) {
        const mappedPos = transaction.mapping.mapResult(pos);
        if (mappedPos.deleted) {
          blocked = true;
          return false;
        }
        const newNode = transaction.doc.nodeAt(mappedPos.pos);
        if (newNode && newNode.type.name === 'heading') {
          if (newNode.textContent !== node.textContent) {
            blocked = true;
            return false;
          }
        }
      }
    });

    return !blocked;
  },
});

/** 우클릭/클릭 이벤트 처리 플러그인 */
const reviewEventsPlugin = new Plugin({
  key: new PluginKey('reviewEvents'),
  props: {
    handleDOMEvents: {
      /** 코멘트 마크 위에 마우스를 올리면 해당 코멘트 팝오버 표시 */
      mouseover(_view, event) {
        const target = event.target as HTMLElement;
        const commentEl = target.closest('[data-comment-id]') as HTMLElement | null;
        if (commentEl) {
          const commentId = commentEl.dataset.commentId;
          if (commentId && commentId !== 'null') {
            emit('comment-mark-click', commentId);
          }
        }
        return false;
      },
      contextmenu(view, event) {
        event.preventDefault();
        const { state } = view;
        const { from, to, empty } = state.selection;

        if (!empty) {
          const quotedText = state.doc.textBetween(from, to, ' ');
          const markId = `mark-${Date.now()}`;
          emit('request-inline-comment', {
            markId,
            quotedText,
            position: { x: event.clientX, y: event.clientY },
          });
        } else {
          emit('request-general-comment', {
            position: { x: event.clientX, y: event.clientY },
          });
        }
        return true;
      },
      click(_view, event) {
        const target = event.target as HTMLElement;
        const commentEl = target.closest('[data-comment-id]') as HTMLElement | null;
        if (commentEl) {
          const commentId = commentEl.dataset.commentId;
          if (commentId) {
            emit('comment-mark-click', commentId);
          }
        }
        return false;
      },
    },
  },
});

/** TiptapEditor가 마운트되면 HeadingGuard + 이벤트 플러그인 등록 */
const pluginsRegistered = ref(false);
watch(
  () => getEditor(),
  (ed) => {
    if (ed && !pluginsRegistered.value) {
      ed.registerPlugin(headingGuardPlugin);
      ed.registerPlugin(reviewEventsPlugin);
      pluginsRegistered.value = true;
    }
  },
  { immediate: true, flush: 'post' },
);

/**
 * TiptapEditor가 :model-value 변경을 { emitUpdate: false }로 처리하므로
 * 여기서 별도의 setContent 호출은 불필요합니다.
 * (중복 호출 시 emitUpdate가 발생하여 draftContent를 덮어쓰는 버그 원인)
 */

/** v-model 변경 → 부모에 전달 */
const handleUpdate = (html: string) => {
  emit('update', html);
};

/* ── 외부에서 사용할 메서드 ── */

/** 선택된 텍스트에 코멘트 마크 적용 */
const applyCommentMark = (markId: string) => {
  const ed = getEditor();
  if (!ed) return;
  const { from, to } = ed.state.selection;
  if (from === to) return;

  ed.chain()
    .focus()
    .setMark('commentMark', { commentId: markId, resolved: false })
    .run();
};

/** 코멘트 해결 시 마크 스타일 업데이트 */
const resolveCommentMark = (commentId: string) => {
  const ed = getEditor();
  if (!ed) return;
  const { doc, tr } = ed.state;

  doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === 'commentMark' && mark.attrs.commentId === commentId) {
        tr.removeMark(pos, pos + node.nodeSize, mark.type);
        tr.addMark(
          pos,
          pos + node.nodeSize,
          mark.type.create({ commentId, resolved: true }),
        );
      }
    });
  });

  ed.view.dispatch(tr);
};

/** 특정 코멘트 마크 위치로 스크롤 */
const scrollToComment = (commentId: string) => {
  const el = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-primary');
    setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
  }
};

defineExpose({
  applyCommentMark,
  resolveCommentMark,
  scrollToComment,
  editor: computed(() => getEditor()),
});
</script>

<template>
  <div class="review-editor h-full">
    <ClientOnly>
      <TiptapEditor
        ref="tiptapEditorRef"
        :model-value="store.currentContent || ''"
        :readonly="props.readonly"
        :additional-extensions="additionalExtensions"
        @update:model-value="handleUpdate"
      />
      <template #fallback>
        <div class="p-8 text-center text-zinc-400">
          <i class="pi pi-spin pi-spinner text-2xl mb-2 block" />
          에디터 로딩 중...
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style>
/* ── 인라인 코멘트 하이라이트 (사전협의 전용) ── */
.review-editor .review-comment-highlight {
  background-color: #fef08a !important;
  cursor: pointer;
  border-bottom: 2px solid #eab308;
  transition: background-color 0.2s;
}

.review-editor .review-comment-highlight:hover {
  background-color: #fde047 !important;
}

.review-editor .review-comment-resolved {
  background-color: #e5e7eb !important;
  cursor: pointer;
  text-decoration: line-through;
  opacity: 0.7;
}
</style>
