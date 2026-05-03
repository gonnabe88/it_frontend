<!--
================================================================================
[components/TiptapEditor.vue] 통합 리치 텍스트 에디터 (Tiptap + Excalidraw)
================================================================================
Tiptap 기반의 완전한 기능을 갖춘 리치 텍스트 에디터 컴포넌트입니다.

[적용된 Tiptap 확장 (무료)]
  StarterKit        : Bold, Italic, Strike, Code, CodeBlock, Heading(H1-H6),
                      BulletList, OrderedList, Blockquote, HardBreak,
                      HorizontalRule, History (Undo/Redo) 포함
  Underline         : 밑줄
  TextStyle         : 텍스트 스타일 기반 (Color, FontFamily 의존)
  Color             : 글자 색상
  Highlight         : 형광펜 (다중 색상)
  TextAlign         : 텍스트 정렬 (좌/중/우/양쪽)
  Link              : 하이퍼링크
  Image             : 이미지 삽입 (URL + 파일 업로드) — ResizableImage로 대체
  Table             : 표 (행/열 추가·삭제, 병합) — CustomTable로 대체
  TaskList/TaskItem : 체크리스트
  CharacterCount    : 글자 수 통계
  Placeholder       : 빈 에디터 힌트
  FontFamily        : 폰트 패밀리
  Subscript         : 아래첨자
  Superscript       : 위첨자

[커스텀 확장 (extensions/tiptap-extensions.ts)]
  ResizableImage     : 크기/정렬 조정 가능한 이미지
  ExcalidrawExtension: 다이어그램 커스텀 노드
  CustomTable        : 너비 저장 지원 표
  CustomTableCell    : 배경색·정렬 지원 셀
  CustomTableHeader  : 배경색·정렬 지원 헤더 셀
  CustomHeading      : id·scroll-margin 지원 제목

[컴포넌트 구조 (Design Ref: §2 Clean Architecture)]
  TiptapEditor.vue  : 에디터 코어 (확장 등록, 이벤트, 표 플로팅 툴바)
  TiptapToolbar.vue : 툴바 UI 및 다이얼로그 (링크·이미지·Excalidraw)
================================================================================
-->
<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { TableRow } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
// Design Ref: §11 module-3 — CodeBlockLowlight (FR-03): syntax highlighting
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';

// Design Ref: §2 — 커스텀 확장은 extensions/tiptap-extensions.ts에서 중앙 관리
import {
    ResizableImage,
    ExcalidrawExtension,
    CustomTable,
    CustomTableCell,
    CustomTableHeader,
    CustomHeading,
    FontSize,
    AttachmentExtension,
    createAttachmentSuggestion,
    InlineMathExtension,
    BlockMathExtension,
    normalizeColwidths,
    injectColwidthsFromColgroup
} from './extensions/tiptap-extensions';
import type { AttachmentItem } from './extensions/tiptap-extensions';
import type { AnyExtension } from '@tiptap/core';
import TiptapToolbar from './TiptapToolbar.vue';

/** lowlight 인스턴스: 일반적으로 사용하는 언어 번들 포함 */
const lowlight = createLowlight(common);

// ── Props ──
const props = defineProps<{
    /** 에디터 HTML 내용 (v-model) */
    modelValue: string;
    /** 빈 에디터 힌트 텍스트 */
    placeholder?: string;
    /** 읽기 전용 모드 */
    readonly?: boolean;
    /**
     * 이미지 파일 업로드 핸들러 (선택)
     * 제공 시: 파일을 API로 업로드하고 반환된 URL을 에디터에 삽입합니다.
     * 미제공 시: 기본 동작(base64 변환)으로 폴백됩니다.
     * @param file - 업로드할 이미지 파일
     * @returns 에디터에 삽입할 이미지 URL (예: /api/files/{id}/preview)
     */
    imageUploadFn?: (file: File) => Promise<string>;
    /**
     * 첨부파일 업로드 핸들러 (FR-05-1)
     * TiptapToolbar의 "파일 첨부" 버튼 클릭 시 호출됩니다.
     */
    fileUploadFn?: (file: File) => Promise<{ flMngNo: string; flNm: string; flSz: number }>;
    /**
     * 현재 문서의 첨부파일 목록 (FR-05-3 자동완성용)
     * '![' 입력 시 이 목록을 기반으로 Suggestion 팝업을 표시합니다.
     */
    attachmentList?: AttachmentItem[];
    /**
     * 첨부파일 삭제 핸들러 (FR-05-4)
     * 관리 다이얼로그에서 파일 삭제 버튼 클릭 시 호출됩니다.
     */
    fileDeleteFn?: (fileId: string) => Promise<void>;
    /**
     * 추가 Tiptap Extension 목록 (사전협의 CommentMark 등)
     * 기본 extensions 배열 뒤에 추가됩니다.
     */
    additionalExtensions?: AnyExtension[];
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'update:toc': [toc: Array<{ id: string; level: number; text: string }>];
}>();

// TOC 추출 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractTOC = (editorInstance: any) => {
    const toc: Array<{ id: string; level: number; text: string }> = [];
    const transaction = editorInstance.state.tr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editorInstance.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'heading') {
            let id = node.attrs.id;
            // id가 없는 노드인 경우 새로 생성하여 할당
            if (!id) {
                id = `heading-${Math.random().toString(36).substr(2, 9)}`;
                transaction.setNodeMarkup(pos, undefined, { ...node.attrs, id });
            }
            toc.push({
                id,
                level: node.attrs.level,
                text: node.textContent,
            });
        }
    });

    // 트랜잭션이 변경되었다면 적용 (id 속성 주입)
    if (transaction.steps.length > 0) {
        editorInstance.view.dispatch(transaction);
    }

    emit('update:toc', toc);
};



const {
    isDragOver,
    handleDOMEvents: imageHandleDOMEvents,
    handlePaste: handleImagePaste,
    handleDrop: handleImageDrop,
} = useTiptapImageInsertion({ imageUploadFn: () => props.imageUploadFn });

// ── 첨부파일 Suggestion 팝업 상태 (FR-05-3) ──
/**
 * AttachmentSuggestion의 팝업 상태를 Vue로 제어합니다.
 * createAttachmentSuggestion()이 이 객체를 closure로 캡처하여 mutation 합니다.
 * Design Ref: §2.2 — AttachmentSuggestion render 흐름
 */
const attachSuggest = reactive({
    active: false,
    items: [] as AttachmentItem[],
    rect: null as DOMRect | null,
    selectedIndex: 0,
    command: null as ((item: AttachmentItem) => void) | null,
});

// ── Tiptap 에디터 초기화 ──
const editor = useEditor({
    extensions: [
        StarterKit.configure({
            // Heading은 CustomHeading으로 대체
            heading: false,
            // codeBlock은 CodeBlockLowlight로 대체 (FR-03)
            codeBlock: false,
        }),
        CustomHeading,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        // Design Ref: §2.3 — TableCell/TableHeader 정렬 저장 지원 (FR-01)
        TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
        Link.configure({ openOnClick: false, autolink: true }),
        ResizableImage, // 크기/정렬 조정 가능한 커스텀 이미지 확장
        CustomTable.configure({ resizable: true }),
        TableRow,
        CustomTableCell,   // 셀 배경색 지원 확장
        CustomTableHeader, // 헤더 셀 배경색 지원 확장
        TaskList,
        TaskItem.configure({ nested: true }),
        CharacterCount,
        Placeholder.configure({ placeholder: props.placeholder }),
        FontFamily,
        // Design Ref: §11 module-3 — FontSize 커스텀 마크 (FR-04)
        FontSize,
        Subscript,
        Superscript,
        // Design Ref: §11 module-3 — CodeBlockLowlight syntax highlighting (FR-03)
        CodeBlockLowlight.configure({ lowlight }),
        ExcalidrawExtension,
        // Design Ref: §2.2, §5 — 인라인 첨부파일 노드 + '![' Suggestion 자동완성 (FR-05)
        AttachmentExtension.configure({
            suggestion: createAttachmentSuggestion(attachSuggest),
        }),
        // Design Ref: §FR-07 — LaTeX 수식 노드 (인라인/블록)
        // mathlive <math-field> Web Component는 onMounted에서 동적 임포트됩니다.
        InlineMathExtension,
        BlockMathExtension,
        // 외부에서 주입된 추가 Extension (예: CommentMark)
        ...(props.additionalExtensions ?? []),
    ],
    // setContent 전에 <colgroup> 너비를 셀 colwidth 속성으로 변환 (브라우저 환경에서만 실행)
    content: import.meta.client ? injectColwidthsFromColgroup(props.modelValue || '') : (props.modelValue || ''),
    editable: !props.readonly,
    onCreate: ({ editor }) => {
        // 초기 로드 시 한 번 TOC 추출
        extractTOC(editor);
        // 편집 모드에서만 colwidth 정규화 실행 (조회 모드에서는 저장된 값을 그대로 사용)
        nextTick(() => {
            // normalizeColwidths는 tiptap-extensions.ts에서 import, editor 인스턴스를 직접 전달
            if (!props.readonly && editor) normalizeColwidths(editor);
            applyTableWidths();
        });
    },
    onUpdate: ({ editor }) => {
        // 내용 변경 시 부모에 HTML 및 TOC 전달
        emit('update:modelValue', editor.getHTML());

        // TOC 모델 추출
        extractTOC(editor);
    },
    onTransaction: () => {
        // 매 트랜잭션마다 표 너비를 즉시 복원합니다.
        // nextTick을 사용하지 않는 이유: 드래그 중 연속 트랜잭션에서 TipTap의 updateColumns()가
        // 매번 픽셀값을 덮어쓰므로, 마이크로태스크가 아닌 동기 호출로 즉각 반영해야 합니다.
        // - 반응형(auto): _isResizingTable 무관, 항상 100% 재적용 (applyTableWidths 내부에서 처리)
        // - 고정형(fixed): applyTableWidths 내부에서 _isResizingTable 중에는 건너뜁니다.
        applyTableWidths();
    },
    onSelectionUpdate: () => {
        // 선택 영역 변경 시 표 플로팅 툴바 위치 갱신
        nextTick(updateTableFloat);
    },
    editorProps: {
        handleDOMEvents: imageHandleDOMEvents,
        handlePaste: handleImagePaste,
        handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved)
    }
});

// 외부에서 modelValue 변경 시 에디터 동기화
// normalizeColwidths는 여기서 호출하지 않습니다.
// → 콘텐츠 로드/복원 시 사용자가 드래그로 설정한 colwidth를 덮어쓰는 것을 방지합니다.
// normalizeColwidths는 onCreate(초기 마운트, 편집 모드)와 tableOp(구조 변경)에서만 호출됩니다.
watch(() => props.modelValue, (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
        // setContent 전에 <colgroup> 너비를 셀 colwidth 속성으로 변환하여
        // Tiptap의 updateColumns()가 덮어쓰기 전에 너비 정보를 보존합니다.
        const processed = import.meta.client ? injectColwidthsFromColgroup(val || '') : (val || '');
        editor.value.commands.setContent(processed, { emitUpdate: false });
        // 저장된 테이블 너비 복원
        nextTick(applyTableWidths);
    }
});

// readonly 변경 시 에디터 편집 가능 여부 갱신
// setEditable()은 NodeView를 재렌더링하므로 저장된 너비 복원이 필요합니다.
// normalizeColwidths는 호출하지 않습니다 — 모드 전환 시 colwidth를 강제 조정하지 않습니다.
watch(() => props.readonly, (val) => {
    editor.value?.setEditable(!val);
    nextTick(applyTableWidths);
});

/**
 * attachmentList prop 변경 시 editor.storage에 동기화합니다.
 * Suggestion의 items 함수가 editor.storage.attachment.attachmentList를 참조합니다.
 * Design Ref: §2.2 — AttachmentExtension.addStorage()
 */
watch(() => props.attachmentList, (list) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = editor.value?.storage as Record<string, any> | undefined;
    if (storage?.attachment) {
        storage.attachment.attachmentList = list ?? [];
    }
}, { immediate: true });

const {
    TABLE_CELL_PALETTE,
    BORDER_STYLES,
    BORDER_WIDTHS,
    BORDER_DIRECTIONS,
    cellBgPaletteVisible,
    currentCellBg,
    applyCellBgColor,
    borderPaletteVisible,
    pendingBorderStyle,
    pendingBorderWidth,
    pendingBorderColor,
    currentCellBorderColor,
    applyCellBorderStyle,
    applyCellBorderWidth,
    applyCellBorderColor,
    applySideBorder,
    setTableFullWidth,
    currentTableAlign,
    setTableAlign,
    currentCellTextAlign,
    setCellTextAlign,
    currentCellVerticalAlign,
    setCellVerticalAlign,
    applyTableWidths,
    tableFloatVisible,
    tableFloatX,
    tableFloatY,
    updateTableFloat,
    tableOp,
} = useTiptapTableTools(editor, normalizeColwidths);

// ── 글자 수 통계 ──
const charCount = computed(() => editor.value?.storage.characterCount.characters() ?? 0);
const wordCount = computed(() => editor.value?.storage.characterCount.words() ?? 0);

// 에디터 정리
onBeforeUnmount(() => {
    editor.value?.destroy();
});

/** 외부에서 에디터 인스턴스에 접근할 수 있도록 노출 */
defineExpose({ editor });
</script>

<template>
    <div
        class="tiptap-editor-container relative border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 flex flex-col h-full">

        <!-- 이미지 드래그 오버 시 표시되는 오버레이 -->
        <Transition name="drag-fade">
            <div
v-if="isDragOver"
                class="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-400/10 border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-xl z-30 flex items-center justify-center pointer-events-none">
                <div
                    class="bg-white dark:bg-zinc-800 rounded-xl px-5 py-3 shadow-xl flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                    <i class="pi pi-image text-lg"/>
                    이미지를 여기에 놓으세요
                </div>
            </div>
        </Transition>

        <!-- ── 툴바 (TiptapToolbar.vue로 분리 — Design Ref: §2 Clean Architecture) ── -->
        <TiptapToolbar
v-if="!readonly && editor" :editor="editor" :image-upload-fn="props.imageUploadFn"
            :file-upload-fn="props.fileUploadFn" :file-delete-fn="props.fileDeleteFn" :attachment-list="props.attachmentList" />

        <!-- ── 에디터 본문 (부모 높이 전체 점유) ── -->
        <EditorContent v-if="editor" :editor="editor" class="tiptap-content flex-1 overflow-y-auto custom-scrollbar" />

        <!-- SSR 중 placeholder -->
        <div v-else class="p-4 text-zinc-400 dark:text-zinc-600 min-h-[200px] flex items-start">
            <span>{{ props.placeholder || '내용을 입력하세요...' }}</span>
        </div>

        <!-- ── 상태 바 ── -->
        <div
v-if="editor"
            class="tiptap-statusbar border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-1.5 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{{ charCount.toLocaleString() }}자 · {{ wordCount.toLocaleString() }}단어</span>
            <span v-if="readonly" class="text-amber-600 dark:text-amber-400">읽기 전용</span>
        </div>
    </div>

    <TiptapTableFloatingToolbar
        v-if="editor"
        v-model:cell-bg-palette-visible="cellBgPaletteVisible"
        v-model:border-palette-visible="borderPaletteVisible"
        v-model:pending-border-style="pendingBorderStyle"
        v-model:pending-border-width="pendingBorderWidth"
        v-model:pending-border-color="pendingBorderColor"
        :editor="editor"
        :readonly="props.readonly"
        :table-float-visible="tableFloatVisible"
        :table-float-x="tableFloatX"
        :table-float-y="tableFloatY"
        :table-cell-palette="TABLE_CELL_PALETTE"
        :border-styles="BORDER_STYLES"
        :border-widths="BORDER_WIDTHS"
        :border-directions="BORDER_DIRECTIONS"
        :current-cell-bg="currentCellBg"
        :current-cell-border-color="currentCellBorderColor"
        :current-table-align="currentTableAlign"
        :current-cell-text-align="currentCellTextAlign"
        :table-op="tableOp"
        :apply-cell-bg-color="applyCellBgColor"
        :apply-cell-border-style="applyCellBorderStyle"
        :apply-cell-border-width="applyCellBorderWidth"
        :apply-cell-border-color="applyCellBorderColor"
        :apply-side-border="applySideBorder"
        :set-table-align="setTableAlign"
        :set-cell-text-align="setCellTextAlign"
        :current-cell-vertical-align="currentCellVerticalAlign"
        :set-cell-vertical-align="setCellVerticalAlign"
        :set-table-full-width="setTableFullWidth"
    />

    <!-- ── 첨부파일 Suggestion 팝업 (FR-05-3, FR-05-4) ── -->
    <!-- 에디터 포커스를 유지하기 위해 mousedown.prevent 적용 -->
    <Teleport to="body">
        <Transition name="table-float">
            <div
v-if="attachSuggest.active && attachSuggest.items.length" class="tiptap-attach-suggest" :style="{
                top: (attachSuggest.rect?.bottom ?? 0) + 4 + 'px',
                left: (attachSuggest.rect?.left ?? 0) + 'px',
            }" @mousedown.prevent>
                <div
v-for="(item, idx) in attachSuggest.items" :key="item.flMngNo" class="attach-suggest-item"
                    :class="{ 'attach-suggest-item--active': idx === attachSuggest.selectedIndex }"
                    @mousedown.prevent="attachSuggest.command?.(item)">
                    <i class="pi pi-paperclip text-indigo-400" style="font-size: 11px;" />
                    <span class="truncate">{{ item.flNm }}</span>
                </div>
            </div>
        </Transition>
    </Teleport>



</template>

<style lang="postcss" scoped>
/* tbar-btn, tf-btn-active, tbar-divider, tbar-select 스타일은 TiptapToolbar.vue로 이동됨 */

/* ── 에디터 본문 영역 ── */
:deep(.tiptap-content .ProseMirror) {
    outline: none;
    min-height: 100%; /* 부모 높이를 꽉 채움 */
    padding: 1.5rem 2rem;
    line-height: 1.8;
    color: #1c1c1e;
}

/* 다크모드 */
.dark :deep(.tiptap-content .ProseMirror) {
    color: #e4e4e7;
}

/* 형광펜(mark) — 모서리 둥근 스타일 */
:deep(.tiptap-content .ProseMirror mark) {
    border-radius: 3px;
    padding: 0 2px;
}

/* ── 제목 스타일 (계층형 문서 구조 — 전체 화면 공통) ──
   h1 — 장(章): 네이비 배경 블록
   h2 — 절(節): 좌측 인디고 바 + 연배경
   h3 — 항(項): 좌측 얇은 바 + 파란 텍스트
   h4 — 목(目): ▶ 기호 마커 + 들여쓰기 */
:deep(.tiptap-content .ProseMirror h1) {
    font-size: 1.375rem;
    font-weight: 800;
    background-color: #1e3a5f;
    color: #ffffff;
    padding: 0.55rem 1rem;
    border-radius: 4px;
    margin-top: 2rem;
    margin-bottom: 1rem;
    letter-spacing: -0.01em;
}

:deep(.tiptap-content .ProseMirror h2) {
    font-size: 1.15rem;
    font-weight: 700;
    color: #1e3a6e;
    border-left: 5px solid #1d4ed8;
    background-color: #eff6ff;
    padding: 0.45rem 0.75rem;
    border-radius: 0 4px 4px 0;
    margin-top: 1.75rem;
    margin-bottom: 0.6rem;
}

:deep(.tiptap-content .ProseMirror h3) {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1d4ed8;
    border-left: 3px solid #3b82f6;
    padding: 0.2rem 0.6rem;
    margin-top: 1.25rem;
    margin-bottom: 0.4rem;
    background: none;
}

:deep(.tiptap-content .ProseMirror h4) {
    font-size: 0.975rem;
    font-weight: 600;
    color: #374151;
    padding-left: 1.1rem;
    margin-top: 0.9rem;
    margin-bottom: 0.3rem;
    position: relative;
    background: none;
}

:deep(.tiptap-content .ProseMirror h4::before) {
    content: '▶';
    position: absolute;
    left: 0;
    top: 0.25rem;
    font-size: 0.5rem;
    color: #6366f1;
    line-height: 1;
}

/* 다크모드 제목 */
.dark :deep(.tiptap-content .ProseMirror h1) {
    background-color: #1e3a5f;
    color: #e2e8f0;
}

.dark :deep(.tiptap-content .ProseMirror h2) {
    background-color: #1e2d4a;
    border-left-color: #3b82f6;
    color: #93c5fd;
}

.dark :deep(.tiptap-content .ProseMirror h3) {
    color: #60a5fa;
    border-left-color: #3b82f6;
}

.dark :deep(.tiptap-content .ProseMirror h4) {
    color: #d1d5db;
}

.dark :deep(.tiptap-content .ProseMirror h4::before) {
    color: #818cf8;
}

/* 단락 */
:deep(.tiptap-content .ProseMirror p) {
    @apply mb-2;
}

/* 링크 */
:deep(.tiptap-content .ProseMirror a) {
    @apply text-indigo-600 dark:text-indigo-400 underline cursor-pointer;
}

/* 인라인 코드 */
:deep(.tiptap-content .ProseMirror :not(pre) > code) {
    @apply bg-zinc-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 rounded px-1 py-0.5 text-sm font-mono;
}

/* 코드 블록 */
:deep(.tiptap-content .ProseMirror pre) {
    @apply bg-zinc-900 text-zinc-100 rounded-xl p-4 my-3 overflow-x-auto;
}

:deep(.tiptap-content .ProseMirror pre code) {
    @apply bg-transparent text-inherit text-sm font-mono p-0;
}

/* 인용문 */
:deep(.tiptap-content .ProseMirror blockquote) {
    @apply border-l-4 border-indigo-400 dark:border-indigo-600 pl-4 my-3 text-zinc-600 dark:text-zinc-400 italic bg-indigo-50/50 dark:bg-indigo-900/10 py-1 rounded-r-lg;
}

/* 목록 */
:deep(.tiptap-content .ProseMirror ul) {
    @apply list-disc pl-6 my-2;
}

:deep(.tiptap-content .ProseMirror ol) {
    @apply list-decimal pl-6 my-2;
}

:deep(.tiptap-content .ProseMirror li) {
    @apply mb-1;
}

/* 체크리스트 (FR-02: list-style 덮어쓰기 방지용 !important) */
:deep(.tiptap-content .ProseMirror ul[data-type="taskList"]) {
    list-style: none !important;
    padding-left: 0.5rem;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li) {
    display: flex !important;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    /* 불릿/숫자 기호 완전 제거 */
    list-style: none !important;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li::before) {
    /* guide-doc 등 외부 CSS의 list 기호 삽입 방지 */
    content: none !important;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li > label) {
    margin-top: 0.1rem;
    user-select: none;
    flex-shrink: 0;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]) {
    cursor: pointer;
    width: 1rem;
    height: 1rem;
    accent-color: #6366f1;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li > div) {
    flex: 1;
}

/* 구분선 */
:deep(.tiptap-content .ProseMirror hr) {
    @apply border-none border-t-2 border-zinc-200 dark:border-zinc-700 my-4;
}

/* 이미지: ResizableImageNodeView에서 스타일링하므로 기본 스타일만 유지 */
:deep(.tiptap-content .ProseMirror img) {
    @apply max-w-full rounded-lg shadow-sm;
}

/* ResizableImage NodeViewWrapper 여백 */
:deep(.tiptap-content .ProseMirror [data-node-view-wrapper]) {
    margin: 0.5rem 0;
}

/* ── Notion-like 표 스타일 ── */

/* 표 수평 스크롤 래퍼 (.tableWrapper는 Tiptap Table 확장이 자동 생성)
   border-collapse: separate + border-radius 조합의 한계를 극복하기 위해
   래퍼에 테두리와 곡률을 적용합니다. */
:deep(.tiptap-content .ProseMirror .tableWrapper) {
    position: relative;
    overflow: hidden;
    overflow-x: auto;
    margin: 1.25rem 0;
    /* 테두리 대신 padding을 주어 내부 테이블의 border가 잘림 없이 표시되게 함 */
    padding: 1px;
}

/* table: border-collapse: collapse를 적용하여 셀 간 테두리 병합 및 커스텀 테두리 허용 */
:deep(.tiptap-content .ProseMirror table) {
    border-collapse: collapse;
    table-layout: fixed;
    /* 기본값 */
    width: auto;
    min-width: 100px;
    max-width: 100%;
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    border: none;
    /* 외곽선은Wrapper가 담당 */
}

/* [FR-06-4] 표 레이아웃 스타일 명시적 제어 (반응형 제거됨) */

/* [FR-06-6] 테이블 위치 정렬 (데이터 속성 기반 강제 적용) */
:deep(.tiptap-content .ProseMirror table[data-align="left"]) {
    margin-left: 0 !important;
    margin-right: auto !important;
}

:deep(.tiptap-content .ProseMirror table[data-align="center"]) {
    margin-left: auto !important;
    margin-right: auto !important;
}

:deep(.tiptap-content .ProseMirror table[data-align="right"]) {
    margin-left: auto !important;
    margin-right: 0 !important;
}

/* 반응형 모드 관련 CSS 제거됨 */

/* td · th 공통: 인라인 스타일이 없는 경우 기본 테두리 적용 */
:deep(.tiptap-content .ProseMirror td),
:deep(.tiptap-content .ProseMirror th) {
    border: 1px solid rgba(55, 53, 47, 0.1);
    padding: 7px 12px;
    vertical-align: top;
    position: relative;
    min-width: 80px;
    word-break: break-word;
}

/* 마지막 열/행 테두리 제거 로직 삭제 (collapse 모드 도입으로 불필요 및 사이드 이펙트 방지) */

/* th — 헤더 셀 */
:deep(.tiptap-content .ProseMirror th) {
    background-color: rgb(247, 246, 243);
    font-weight: 600;
    font-size: 0.8rem;
    text-align: left;
    letter-spacing: 0.02em;
    color: rgb(55, 53, 47);
    text-transform: none;
}

/* 행 hover: td만 아주 살짝 어둡게 */
:deep(.tiptap-content .ProseMirror tr:hover > td:not([style*="background-color"])) {
    background-color: rgba(55, 53, 47, 0.025);
}

/* (데이터 속성 기반 테두리 스타일 CSS는 이제 인라인 style로 대체되므로 삭제 가능하지만 하위 호환성을 위해 유지할 수 있음. 
   여기서는 인라인 스타일이 우선순위를 갖도록 !important 규칙 확인) */

/* 다크모드 — 표 래퍼 설정 */
:global(.dark) :deep(.tiptap-content .ProseMirror .tableWrapper) {
    border-color: rgba(255, 255, 255, 0.1);
}

/* 다크모드 — 셀 구분선 */
:global(.dark) :deep(.tiptap-content .ProseMirror td),
:global(.dark) :deep(.tiptap-content .ProseMirror th) {
    border-color: rgba(255, 255, 255, 0.08);
}

/* 다크모드 — 헤더 셀 */
.dark :deep(.tiptap-content .ProseMirror th) {
    background-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.75);
}

/* 다크모드 — 행 hover */
.dark :deep(.tiptap-content .ProseMirror tr:hover > td:not([style*="background-color"])) {
    background-color: rgba(255, 255, 255, 0.03);
}

/* 선택된 셀 하이라이트 (병합 선택 시 표시되는 오버레이) */
:deep(.tiptap-content .ProseMirror .selectedCell::after) {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(99, 102, 241, 0.08);
    pointer-events: none;
    z-index: 2;
}

/* 컬럼 리사이즈 핸들: 평소엔 얇고 hover 시 선명하게 */
:deep(.tiptap-content .ProseMirror .column-resize-handle) {
    position: absolute;
    right: -1px;
    top: 0;
    bottom: 0;
    width: 3px;
    background: rgba(99, 102, 241, 0.4);
    cursor: col-resize;
    z-index: 20;
    transition: background 0.15s ease;
}

:deep(.tiptap-content .ProseMirror .column-resize-handle:hover) {
    background: rgba(99, 102, 241, 0.85);
}

/* placeholder: 에디터가 비어 있을 때 첫 번째 직계 자식에만 표시
   (표 뒤 빈 단락 등 모든 is-empty 노드에 나타나는 문제 방지) */
:deep(.tiptap-content .ProseMirror > .is-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #a1a1aa;
    pointer-events: none;
    height: 0;
}

/* 선택된 노드 강조 */
:deep(.tiptap-content .ProseMirror-selectednode) {
    @apply outline-2 outline-indigo-500 outline-offset-1;
}

/* 드래그 오버레이 페이드 트랜지션 */
.drag-fade-enter-active,
.drag-fade-leave-active {
    transition: opacity 0.15s ease;
}

.drag-fade-enter-from,
.drag-fade-leave-to {
    opacity: 0;
}

/* FR-05-3: 첨부파일 Suggestion 팝업 */
.tiptap-attach-suggest {
    position: fixed;
    z-index: 9999;
    min-width: 200px;
    max-width: 320px;
    max-height: 220px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid rgba(55, 53, 47, 0.15);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 4px;
}

:global(.dark) .tiptap-attach-suggest {
    background: #1e1e1e;
    border-color: rgba(255, 255, 255, 0.1);
}

.attach-suggest-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 5px;
    font-size: 12px;
    cursor: pointer;
    color: #374151;
    transition: background 0.1s;
    overflow: hidden;
}

:global(.dark) .attach-suggest-item {
    color: #d1d5db;
}

.attach-suggest-item--active,
.attach-suggest-item:hover {
    background: rgba(99, 102, 241, 0.1);
    color: #4f46e5;
}

:global(.dark) .attach-suggest-item--active,
:global(.dark) .attach-suggest-item:hover {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
}

/* 플로팅 툴바 페이드 트랜지션 */
.table-float-enter-active,
.table-float-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.table-float-enter-from,
.table-float-leave-to {
    opacity: 0;
    transform: translateY(4px);
}

/* ── 테두리 설정 팝업 전용 스타일 ── */
.border-settings-popover {
    box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(55, 53, 47, 0.16);
}

.popover-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-left: 2px;
}

:global(.dark) .popover-label {
    color: #9ca3af;
}

.tf-border-indicator {
    position: absolute;
    bottom: 4px;
    left: 7px;
    right: 7px;
    height: 2.5px;
    border-radius: 1px;
    opacity: 0.8;
}

.tf-border-main-btn {
    position: relative;
    padding-bottom: 9px !important;
    /* 인디케이터 공간 확보 */
}

/* ── 행 높이 리사이즈 핸들 스타일 (FR-06-5 개선) ── */
:deep(.tiptap-content .ProseMirror .row-resize-handle) {
    position: absolute;
    bottom: -3px;
    left: 0;
    right: 0;
    height: 6px;
    background: transparent;
    cursor: row-resize;
    z-index: 20;
    transition: background 0.2s ease;
}

/* 셀에 마우스 호버 시 핸들 강조 */
:deep(.tiptap-content .ProseMirror td:hover .row-resize-handle),
:deep(.tiptap-content .ProseMirror th:hover .row-resize-handle) {
    background: rgba(99, 102, 241, 0.2);
}

/* 핸들 자체에 마우스 호버 시 더 짙게 표시 */
:deep(.tiptap-content .ProseMirror .row-resize-handle:hover) {
    background: rgba(99, 102, 241, 0.5) !important;
}

/* ── 행 높이 리사이징 가이드 라인 (너비 조절과 동일한 느낌) ── */
:deep(.tiptap-content .ProseMirror .row-resize-line) {
    position: absolute;
    height: 2px;
    background-color: #6366f1;
    /* Indigo 500 */
    z-index: 100;
    pointer-events: none;
    opacity: 0.8;
}

/* 리사이징 중 전역 커서 고정용 클래스 */
:global(body.is-resizing-row) {
    cursor: row-resize !important;
}

/* 다크모드 대응 */
:global(.dark) :deep(.tiptap-content .ProseMirror .row-resize-handle:hover) {
    background: rgba(129, 140, 248, 0.6) !important;
}

/* ── 읽기 전용 모드(편집 불가)인 경우 테이블 조작 비활성화 (FR-06-5) ── */
:deep(.tiptap-content .ProseMirror[contenteditable="false"] .row-resize-handle) {
    display: none !important;
    pointer-events: none !important;
}

:deep(.tiptap-content .ProseMirror[contenteditable="false"] table) {
    user-select: none;
    -webkit-user-select: none;
}

:deep(.tiptap-content .ProseMirror[contenteditable="false"] .selectedCell:after) {
    display: none !important;
    /* Tiptap 기본 셀 선택 오버레이 숨김 */
}
</style>
