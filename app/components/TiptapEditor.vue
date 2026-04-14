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
import { TableMap, CellSelection } from '@tiptap/pm/tables';
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

/** lowlight 인스턴스: 일반적으로 사용하는 언어 번들 포함 */
const lowlight = createLowlight(common);
import TiptapToolbar from './TiptapToolbar.vue';

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
const extractTOC = (editorInstance: any) => {
    const toc: Array<{ id: string; level: number; text: string }> = [];
    const transaction = editorInstance.state.tr;
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



// ── 테이블 정렬 및 상태 ──
/** 드래그 오버 시각 표시 여부 */
const isDragOver = ref(false);
/**
 * dragenter / dragleave 중첩 카운터
 * 자식 요소 사이를 이동할 때 dragleave가 오발생하는 것을 방지합니다.
 */
let dragCounter = 0;

/**
 * File → base64 DataURL 변환 헬퍼
 * imageUploadFn이 없을 때 드래그&드롭 이미지를 base64로 삽입합니다.
 */
const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

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
    content: process.client ? injectColwidthsFromColgroup(props.modelValue || '') : (props.modelValue || ''),
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
        /**
         * 드래그 진입/이탈 이벤트로 드롭 영역 오버레이 표시를 제어합니다.
         * dragenter/dragleave는 자식 요소 이동 시 중복 발생하므로
         * 카운터로 실제 에디터 영역 이탈 여부를 판단합니다.
         */
        handleDOMEvents: {
            dragenter: (_view, event) => {
                if (event.dataTransfer?.types.includes('Files')) {
                    dragCounter++;
                    isDragOver.value = true;
                }
                return false;
            },
            dragleave: () => {
                dragCounter--;
                if (dragCounter <= 0) {
                    dragCounter = 0;
                    isDragOver.value = false;
                }
                return false;
            },
            drop: () => {
                // handleDrop에서 처리하므로 여기서는 상태만 초기화
                dragCounter = 0;
                isDragOver.value = false;
                return false;
            }
        },
        /**
         * 이미지 파일 드롭 처리
         * - moved=true(에디터 내부 노드 이동)는 Tiptap 기본 동작에 위임
         * - 외부에서 드롭된 이미지 파일만 처리
         * - imageUploadFn prop 제공 시 API 업로드, 미제공 시 base64 변환
         */
        handleDrop: (view, event, _slice, moved) => {
            // 에디터 내부 노드 이동은 기본 동작에 맡김
            if (moved) return false;

            const files = Array.from(event.dataTransfer?.files ?? [])
                .filter(f => f.type.startsWith('image/'));

            if (files.length === 0) return false;

            event.preventDefault();

            // 드롭된 좌표를 ProseMirror 문서 위치(pos)로 변환
            const dropCoords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY
            });
            const insertPos = dropCoords?.pos ?? view.state.doc.content.size;

            // 각 이미지 파일을 순서대로 삽입
            files.forEach(async (file, index) => {
                try {
                    let src: string;
                    if (props.imageUploadFn) {
                        // API 업로드 모드
                        src = await props.imageUploadFn(file);
                    } else {
                        // base64 변환 모드
                        src = await fileToBase64(file);
                    }

                    const { schema } = view.state;
                    const imageNode = schema.nodes.image?.create({
                        src,
                        alt: file.name
                    });
                    if (!imageNode) return;

                    // 여러 파일 드롭 시 순서대로 뒤에 삽입
                    const tr = view.state.tr.insert(insertPos + index, imageNode);
                    view.dispatch(tr);
                } catch (e) {
                    console.error('[TiptapEditor] 드래그&드롭 이미지 처리 실패:', e);
                }
            });

            return true;
        }
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
        const processed = process.client ? injectColwidthsFromColgroup(val || '') : (val || '');
        editor.value.commands.setContent(processed, false);
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
    const storage = editor.value?.storage as Record<string, any> | undefined;
    if (storage?.attachment) {
        storage.attachment.attachmentList = list ?? [];
    }
}, { immediate: true });

// ── 셀 서식 (표 플로팅 툴바에서 사용) ──

/**
 * 16색 팔레트 (FR-06-3: 기존 RGB picker 교체)
 * null 항목은 "배경 없음" 지우개 버튼으로 처리합니다.
 */
const TABLE_CELL_PALETTE = [
    '#ffffff', '#f1f5f9', '#e0e7ff', '#dbeafe', '#dcfce7',
    '#fef9c3', '#ffe4e6', '#f3e8ff', '#ffedd5', '#fce7f3',
    '#1e1b4b', '#1e3a5f', '#14532d', '#7c2d12', '#4a1d96',
    '#334155',
] as const;

/** 배경색 팔레트 팝오버 표시 여부 */
const cellBgPaletteVisible = ref(false);

/** 현재 커서가 위치한 셀의 배경색을 반환합니다. */
const currentCellBg = computed<string | null>(() => {
    if (!editor.value?.isActive('table')) return null;
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.backgroundColor || headerAttrs.backgroundColor || null;
});

/** 셀 배경색 팔레트에서 색상 선택 */
const applyCellBgColor = (color: string | null) => {
    editor.value?.chain().focus().setCellAttribute('backgroundColor', color).run();
    cellBgPaletteVisible.value = false;
};

// ── 테두리 스타일 (FR-06-2) ──

/** 테두리 스타일 옵션 */
const BORDER_STYLES = [
    { value: null, label: '없음', title: '테두리 없음' },
    { value: 'solid', label: '─', title: '실선' },
    { value: 'dashed', label: '╌', title: '점선' },
    { value: 'dotted', label: '⋯', title: '도트' },
    { value: 'double', label: '═', title: '이중선' },
] as const;

/** 테두리 두께 옵션 */
const BORDER_WIDTHS = [
    { value: '1px', label: '1px' },
    { value: '2px', label: '2px' },
    { value: '3px', label: '3px' },
    { value: '4px', label: '4px' },
    { value: '5px', label: '5px' },
] as const;

/** 테두리 설정 팔레트 표시 여부 */
const borderPaletteVisible = ref(false);

/** 현재 셀의 테두리 스타일 */
const currentCellBorderStyle = computed<string | null>(() => {
    if (!editor.value?.isActive('table')) return null;
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.borderStyle || headerAttrs.borderStyle || attrs.borderTopStyle || headerAttrs.borderTopStyle || null;
});

// ── 테두리 방향별 상세 설정 (FR-06-2 개편) ──

/** 사용자가 현재 선택 중인(아직 적용 전인) 테두리 속성 */
const pendingBorderStyle = ref<string | null>('solid');
const pendingBorderWidth = ref<string | null>('1px');
const pendingBorderColor = ref<string | null>('#374151');

/** 셀 테두리 방향 버튼 정의 */
const BORDER_DIRECTIONS = [
    { value: 'all', label: '전체 테두리', icon: 'M1 1h12v12H1z M1 7h12 M7 1v12' },
    { value: 'outer', label: '외곽 테두리', icon: 'M1 1h12v12H1z' },
    { value: 'inner', label: '안쪽 전체', icon: 'M1 7h12 M7 1v12' },
    { value: 'top', label: '위 테두리', icon: 'M1 1h12' },
    { value: 'bottom', label: '아래 테두리', icon: 'M1 13h12' },
    { value: 'left', label: '왼쪽 테두리', icon: 'M1 1v12' },
    { value: 'right', label: '오른쪽 테두리', icon: 'M13 1v12' },
    { value: 'inner-h', label: '안쪽 가로', icon: 'M1 7h12' },
    { value: 'inner-v', label: '안쪽 세로', icon: 'M7 1v12' },
    { value: 'clear', label: '지우기', icon: 'M2 2l10 10 M12 2L2 12' }
] as const;

/** 현재 셀의 테두리 두께 */
const currentCellBorderWidth = computed<string | null>(() => {
    if (!editor.value?.isActive('table')) return null;
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.borderWidth || headerAttrs.borderWidth || null;
});

/** 현재 셀의 테두리 색상 */
const currentCellBorderColor = computed<string | null>(() => {
    if (!editor.value?.isActive('table')) return null;
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.borderColor || headerAttrs.borderColor || null;
});

/** 셀 테두리 스타일 선택 (적용 대기) */
const applyCellBorderStyle = (style: string | null) => {
    pendingBorderStyle.value = style;
};

/** 셀 테두리 두께 선택 (적용 대기) */
const applyCellBorderWidth = (width: string | null) => {
    pendingBorderWidth.value = width;
};

const applyCellBorderColor = (color: string | null) => {
    pendingBorderColor.value = color;
};

/**
 * 특정 셀(node)에 지정된 방향(side)의 테두리를 현재 설정값으로 적용합니다.
 */
const updateCellSideAttributes = (editor: any, pos: number, side: string, isHeader: boolean) => {
    const sides = [];
    if (side === 'all') sides.push('Top', 'Bottom', 'Left', 'Right');
    else if (side === 'top') sides.push('Top');
    else if (side === 'bottom') sides.push('Bottom');
    else if (side === 'left') sides.push('Left');
    else if (side === 'right') sides.push('Right');

    const attrs: any = {};
    const type = isHeader ? 'tableHeader' : 'tableCell';

    sides.forEach(s => {
        attrs[`border${s}Style`] = pendingBorderStyle.value;
        attrs[`border${s}Width`] = pendingBorderWidth.value;
        attrs[`border${s}Color`] = pendingBorderColor.value;
    });

    // 팁탭의 기본 setCellAttribute 대신 직접 tr을 조작하여 여러 속성을 한 번에 저장합니다.
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, null, {
        ...(editor.state.doc.nodeAt(pos)?.attrs || {}),
        ...attrs
    }));
};

/**
 * 테두리 방향 버튼 클릭 시 실행되는 메인 로직
 */
const applySideBorder = (side: string) => {
    if (!editor.value) return;
    const { state, view } = editor.value;
    const { selection } = state;
    const tr = state.tr;
    let modified = false;

    // 1. 셀 선택 방식 판별 (전용 CellSelection 인스턴스 또는 유사 객체인 경우)
    const isCellSelection = typeof (selection as any).forEachCell === 'function';

    if (!isCellSelection) {
        // 단일 셀에 커서만 있는 경우 (NodeSelection 또는 TextSelection)
        let pos = -1;
        state.doc.nodesBetween(selection.from, selection.to, (node, p) => {
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                pos = p;
                return false;
            }
        });

        if (pos !== -1) {
            const node = state.doc.nodeAt(pos);
            if (node) {
                const sides = [];
                // 단일 셀에서는 '전체(all)', '외곽(outer)', '정리(clear)' 모두 4방향에 해당함
                if (['all', 'outer', 'clear'].includes(side)) {
                    sides.push('Top', 'Bottom', 'Left', 'Right');
                } else if (['top', 'bottom', 'left', 'right'].includes(side)) {
                    // 상하좌우 개별 방향
                    sides.push(side.charAt(0).toUpperCase() + side.slice(1));
                }

                if (sides.length > 0) {
                    const attrs: any = {};
                    sides.forEach(s => {
                        attrs[`border${s}Style`] = side === 'clear' ? null : pendingBorderStyle.value;
                        attrs[`border${s}Width`] = side === 'clear' ? null : pendingBorderWidth.value;
                        attrs[`border${s}Color`] = side === 'clear' ? null : pendingBorderColor.value;
                    });
                    tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs });
                    modified = true;
                }
            }
        }
    } else {
        // 2. 복수 셀이 선택된 경우 (CellSelection 계열)
        const sel = selection as any;

        // 테이블 노드와 시작 위치 찾기 ($anchorCell 기준)
        const $anchorCell = state.doc.resolve(sel.$anchorCell.pos);
        let tableNode = null;
        let tableStart = -1;
        for (let d = $anchorCell.depth; d >= 0; d--) {
            const n = $anchorCell.node(d);
            if (n.type.name === 'table') {
                tableNode = n;
                tableStart = $anchorCell.before(d);
                break;
            }
        }

        if (!tableNode) return;

        const map = TableMap.get(tableNode);
        if (!map || !map.map) return;
        const tableContentStart = tableStart + 1;

        // 선택 범위(Bounds) 계산
        const anchorRect = map.findCell(sel.$anchorCell.pos - tableContentStart);
        const headRect = map.findCell(sel.$headCell.pos - tableContentStart);
        const minRow = Math.min(anchorRect.top, headRect.top);
        const maxRow = Math.max(anchorRect.bottom, headRect.bottom) - 1;
        const minCol = Math.min(anchorRect.left, headRect.left);
        const maxCol = Math.max(anchorRect.right, headRect.right) - 1;

        // 업데이트할 셀들의 위치와 속성을 수집 (pos -> attrs)
        const cellUpdates = new Map<number, any>();

        /** 인접 셀 위치 찾기 및 업데이트 목록 추가 함수 */
        const addNeighborUpdate = (nPos: number, nSide: string, isDeleting: boolean) => {
            const nNode = state.doc.nodeAt(nPos);
            if (!nNode) return;
            const nAttrs = cellUpdates.get(nPos) || { ...nNode.attrs };
            nAttrs[`border${nSide}Style`] = isDeleting ? null : pendingBorderStyle.value;
            nAttrs[`border${nSide}Width`] = isDeleting ? null : pendingBorderWidth.value;
            nAttrs[`border${nSide}Color`] = isDeleting ? null : pendingBorderColor.value;
            cellUpdates.set(nPos, nAttrs);
        };

        sel.forEachCell((node: any, pos: number) => {
            if (!map || !map.map) return;
            const pmMap = map.map as number[];
            const pmWidth = map.width as number;
            const pmHeight = map.height as number;
            const rect = map.findCell(pos - tableContentStart);
            if (!rect) return;
            let sidesToUpdate: string[] = [];
            const isDeleting = side === 'clear';

            if (side === 'all') {
                sidesToUpdate = ['Top', 'Bottom', 'Left', 'Right'];
            } else if (isDeleting) {
                sidesToUpdate = ['Top', 'Bottom', 'Left', 'Right'];
            } else {
                // 방향별(outer, inner, top 등) 로직
                if (side === 'outer') {
                    if (rect.top === minRow) sidesToUpdate.push('Top');
                    if (rect.bottom - 1 === maxRow) sidesToUpdate.push('Bottom');
                    if (rect.left === minCol) sidesToUpdate.push('Left');
                    if (rect.right - 1 === maxCol) sidesToUpdate.push('Right');
                } else if (side === 'inner') {
                    if (rect.top > minRow) sidesToUpdate.push('Top');
                    if (rect.bottom - 1 < maxRow) sidesToUpdate.push('Bottom');
                    if (rect.left > minCol) sidesToUpdate.push('Left');
                    if (rect.right - 1 < maxCol) sidesToUpdate.push('Right');
                } else if (side === 'inner-h') {
                    if (rect.top > minRow) sidesToUpdate.push('Top');
                    if (rect.bottom - 1 < maxRow) sidesToUpdate.push('Bottom');
                } else if (side === 'inner-v') {
                    if (rect.left > minCol) sidesToUpdate.push('Left');
                    if (rect.right - 1 < maxCol) sidesToUpdate.push('Right');
                } else if (side === 'top' && rect.top === minRow) {
                    sidesToUpdate.push('Top');
                } else if (side === 'bottom' && rect.bottom - 1 === maxRow) {
                    sidesToUpdate.push('Bottom');
                } else if (side === 'left' && rect.left === minCol) {
                    sidesToUpdate.push('Left');
                } else if (side === 'right' && rect.right - 1 === maxCol) {
                    sidesToUpdate.push('Right');
                }
            }

            if (sidesToUpdate.length > 0) {
                const attrs = cellUpdates.get(pos) || { ...node.attrs };
                sidesToUpdate.forEach(s => {
                    attrs[`border${s}Style`] = isDeleting ? null : pendingBorderStyle.value;
                    attrs[`border${s}Width`] = isDeleting ? null : pendingBorderWidth.value;
                    attrs[`border${s}Color`] = isDeleting ? null : pendingBorderColor.value;

                    // ── 인접 셀 미러링 (Mirroring) ──
                    // pmMap/pmWidth/pmHeight는 상단에서 이미 null 체크를 통과한 값입니다.
                    const _m = pmMap!;
                    const _w = pmWidth!;
                    const _h = pmHeight!;
                    if (s === 'Top' && rect.top > 0 && rect.top === minRow) {
                        for (let c = rect.left; c < rect.right; c++) {
                            const idx = (rect.top - 1) * _w + c;
                            if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Bottom', isDeleting);
                        }
                    } else if (s === 'Bottom' && rect.bottom < _h && rect.bottom - 1 === maxRow) {
                        for (let c = rect.left; c < rect.right; c++) {
                            const idx = rect.bottom * _w + c;
                            if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Top', isDeleting);
                        }
                    } else if (s === 'Left' && rect.left > 0 && rect.left === minCol) {
                        for (let r = rect.top; r < rect.bottom; r++) {
                            const idx = r * _w + (rect.left - 1);
                            if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Right', isDeleting);
                        }
                    } else if (s === 'Right' && rect.right < _w && rect.right - 1 === maxCol) {
                        for (let r = rect.top; r < rect.bottom; r++) {
                            const idx = r * _w + rect.right;
                            if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Left', isDeleting);
                        }
                    }
                });
                cellUpdates.set(pos, attrs);
                modified = true;
            } else if (isDeleting) {
                // Clear 시에는 4방향 모두 지우고 인접 셀도 정리 시도 가능하지만 
                // 안전을 위해 선택된 셀만 지워도 됨. (위에서 all-sides sidesToUpdate로 처리됨)
            }
        });

        // 수집된 모든 업데이트 적용
        cellUpdates.forEach((attrs, pos) => {
            tr.setNodeMarkup(pos, null, attrs);
        });
    }

    if (modified) {
        view.dispatch(tr);
    }
};

/**
 * [FR-06-4] 표 너비에 맞추기 (균등 배분 및 고정폭 고정)
 * 테이블을 현재 에디터 컨테이너 너비(px)에 맞춰 100%로 확장하고, 
 * 모든 열의 너비를 균등하게(Equal distribution) 배분합니다.
 */
const setTableFullWidth = () => {
    if (!editor.value) return;
    const tableEl = getTableElement();
    if (!tableEl) return;

    const containerWidth = tableEl.parentElement?.offsetWidth || 800;
    const { state, view } = editor.value;
    let tablePos = -1;
    const $pos = state.selection.$from;
    for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === 'table') { tablePos = $pos.before(d); break; }
    }
    if (tablePos === -1) return;

    const tableNode = state.doc.nodeAt(tablePos);
    if (!tableNode) return;
    const map = TableMap.get(tableNode);
    const colCount = map.width;

    // 1. 현재 열들의 너비 수집 및 총합 계산
    const currentWidths = new Array(colCount).fill(0);
    const firstRowMap = map.map.slice(0, colCount);
    const seenCells = new Set<number>();

    firstRowMap.forEach((cellPos, colIdx) => {
        if (seenCells.has(cellPos)) return;
        seenCells.add(cellPos);

        const cellNode = tableNode.nodeAt(cellPos);
        if (cellNode) {
            const colspan = (cellNode.attrs.colspan as number) || 1;
            const colwidths = cellNode.attrs.colwidth as number[] | null;

            for (let i = 0; i < colspan; i++) {
                // 저장된 너비가 없으면 기본값(100px) 사용
                const w = (colwidths && colwidths[i]) ? colwidths[i] : 100;
                if (colIdx + i < colCount) {
                    currentWidths[colIdx + i] = w;
                }
            }
        }
    });

    const totalCurrentWidth = currentWidths.reduce((sum, w) => sum + w, 0);
    // 비례 확대를 위한 배율 계산
    const scaleRatio = containerWidth / totalCurrentWidth;
    const newWidths = currentWidths.map(w => Math.floor(w * scaleRatio));

    const tr = state.tr;
    const processedCells = new Set<number>();

    // 2. 모든 셀의 colwidth를 비례 너비로 업데이트
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            const cellPos = map.map[r * map.width + c];
            if (cellPos === undefined || processedCells.has(cellPos)) continue;
            processedCells.add(cellPos);

            const cellNode = tableNode.nodeAt(cellPos);
            if (cellNode) {
                const colspan = (cellNode.attrs.colspan as number) || 1;
                // 해당 셀이 차지하는 컬럼들의 새로운 너비 슬라이스 추출
                const colWidthsSlice = newWidths.slice(c, c + colspan);
                tr.setNodeMarkup(tablePos + 1 + cellPos, null, { ...cellNode.attrs, colwidth: colWidthsSlice });
            }
        }
    }

    // 4. 테이블 전체 너비 모델 속성 제거 (내부 열 너비 합계에 따라 자연스럽게 결정)
    tr.setNodeMarkup(tablePos, null, { ...tableNode.attrs, width: null });

    view.dispatch(tr.setMeta('addToHistory', true));
    nextTick(applyTableWidths);
};

// ── 테이블 전체 정렬 (FR-06-6) ──

/** 현재 테이블의 정렬 상태 ('left' | 'center' | 'right') */
const currentTableAlign = computed<string>(() => {
    if (!editor.value?.isActive('table')) return 'left';
    return editor.value.getAttributes('table').align ?? 'left';
});

/** 테이블 전체 정렬 적용 */
const setTableAlign = (align: 'left' | 'center' | 'right') => {
    editor.value?.chain().focus().updateAttributes('table', { align }).run();
};

// ── 셀 텍스트 정렬 (FR-01-2) ──

/** 현재 선택된 셀의 텍스트 정렬 상태 */
const currentCellTextAlign = computed<string>(() => {
    if (!editor.value?.isActive('table')) return 'left';
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.textAlign || headerAttrs.textAlign || 'left';
});

/** 셀 텍스트 정렬 적용 */
const setCellTextAlign = (align: string) => {
    editor.value?.chain().focus().setTextAlign(align).run();
};

// ── 셀 높이 (FR-06-5) ──

/** 현재 셀의 min-height 값 (숫자 부분만, px 단위) */
const currentCellMinHeight = computed<number>(() => {
    if (!editor.value?.isActive('table')) return 0;
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    const raw = attrs.minHeight || headerAttrs.minHeight || '';
    return raw ? parseInt(raw, 10) : 0;
});

/** 셀 min-height 적용 (0이면 제거) */
const applyCellMinHeight = (px: number) => {
    const val = px > 0 ? `${px}px` : null;
    editor.value?.chain().focus().setCellAttribute('minHeight', val).run();
};

/** 컬럼 리사이즈 중 여부 플래그 */
let _isResizingTable = false;

/**
 * 저장된 CustomTable 속성을 DOM의 table 요소에 직접 적용합니다.
 *
 * ★ 핵심 메커니즘:
 *   Tiptap의 TableView(NodeView)는 addAttributes().renderHTML() 결과를
 *   라이브 DOM에 반영하지 않습니다 (getHTML() 직렬화에만 사용).
 *   따라서 data-table-layout 등 커스텀 속성은 여기서 수동으로 DOM에 동기화해야
 *   CSS 선택자(table[data-table-layout="auto"])가 매치됩니다.
 *
 *   CSS !important 규칙이 매치되면, updateColumns()가 매 트랜잭션마다
 *   설정하는 인라인 픽셀 너비를 브라우저 스타일 엔진이 자동으로 덮어씁니다.
 *   → 타이밍에 의존하지 않는 안정적인 너비 제어.
 */
/**
 * [FR-06] 테이블 너비 및 정렬 스타일 동기화 (단순화된 고정폭 버전)
 */
const applyTableWidths = () => {
    if (!editor.value || editor.value.isDestroyed) return;
    const view = editor.value.view;

    view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return;

        try {
            const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
            if (!wrapperEl) return;

            const tableEl = (wrapperEl.tagName === 'TABLE'
                ? wrapperEl
                : wrapperEl.querySelector('table')) as HTMLTableElement | null;
            if (!tableEl) return;

            // 1. 레이아웃은 항상 fixed로 고정 (반응형 제거)
            tableEl.setAttribute('data-table-layout', 'fixed');
            tableEl.style.tableLayout = 'fixed';

            // 2. data-align 속성 동기화
            const align = node.attrs.align || 'left';
            if (tableEl.getAttribute('data-align') !== align) {
                tableEl.setAttribute('data-align', align);
            }

            // 3. 테이블 전체 너비 동기화
            // 드래그 중에는 간섭하지 않으며, width 속성이 있을 때만 적용합니다.
            if (_isResizingTable) return;

            const targetWidth = node.attrs.width;
            if (targetWidth) {
                if (tableEl.style.width !== targetWidth) {
                    tableEl.style.width = targetWidth;
                }
            } else {
                // width가 null인 경우 스타일을 제거하여 자연스럽게 열 너비를 따르도록 함
                if (tableEl.style.width) {
                    tableEl.style.width = '';
                }
            }
        } catch (e) {
            console.warn('Sync failed:', e);
        }
        return false;
    });
};

// ── 표 플로팅 툴바 위치 관리 ──
/** 플로팅 툴바 표시 여부 */
const tableFloatVisible = ref(false);
/** 플로팅 툴바 fixed X 좌표 (px) */
const tableFloatX = ref(0);
/** 플로팅 툴바 fixed Y 좌표 (px) */
const tableFloatY = ref(0);

/** 현재 커서가 속한 table DOM 요소를 반환합니다. */
const getTableElement = (): HTMLTableElement | null => {
    if (!editor.value) return null;
    const { from } = editor.value.state.selection;
    let node = editor.value.view.domAtPos(from).node as Node;
    let el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
    while (el && el.tagName !== 'TABLE') {
        el = el.parentElement;
    }
    return el as HTMLTableElement | null;
};

/**
 * 플로팅 툴바 위치 갱신 (table 요소 기준 fixed 좌표)
 */
const updateTableFloat = () => {
    if (!editor.value?.isActive('table')) {
        tableFloatVisible.value = false;
        return;
    }
    const tableEl = getTableElement();
    if (!tableEl) {
        tableFloatVisible.value = false;
        return;
    }
    const rect = tableEl.getBoundingClientRect();
    const TOOLBAR_H = 40;
    const top = rect.top >= TOOLBAR_H + 8
        ? rect.top - TOOLBAR_H - 4
        : rect.top + 4;

    tableFloatX.value = rect.left;
    tableFloatY.value = top;
    tableFloatVisible.value = true;
};

// 스크롤 시 위치 재계산 (main 스크롤 컨테이너 기준)
let _scrollEl: Element | null = null;

/**
 * 컬럼 리사이즈 완료(mouseup) 시 각 table의 실제 렌더링 너비를
 * CustomTable의 width 속성으로 동기화합니다.
 */
const syncTableWidths = () => {
    if (!editor.value || editor.value.isDestroyed) return;
    const view = editor.value.view;

    let changed = false;
    const tr = view.state.tr;

    view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return;

        try {
            const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
            if (!wrapperEl) return;

            const tableEl = (wrapperEl.tagName === 'TABLE'
                ? wrapperEl
                : wrapperEl.querySelector('table')) as HTMLTableElement | null;
            if (!tableEl) return;

            const domWidth = tableEl.style.width;
            if (!domWidth) return;

            if (node.attrs.width !== domWidth) {
                tr.setNodeMarkup(pos, null, { ...node.attrs, width: domWidth });
                changed = true;
            }
        } catch { /* pos → DOM 매핑 실패 시 무시 */ }
    });

    if (changed) {
        view.dispatch(tr.setMeta('addToHistory', false));
    }
};

/**
 * 표 구조 변경 커맨드를 실행하고 즉시 colwidth를 정규화합니다.
 */
const tableOp = (fn: () => void) => {
    fn();
    nextTick(() => { if (editor.value) normalizeColwidths(editor.value); });
};

// 리사이즈 핸들 mousedown → _isResizingTable = true (capture 단계로 조기 감지)
const _onTableResizeStart = (e: MouseEvent) => {
    if ((e.target as HTMLElement)?.classList.contains('column-resize-handle')) {
        _isResizingTable = true;
    }
};
// mouseup → 리사이즈 종료, 이후 syncTableWidths가 새 너비를 캡처
const _onTableResizeEnd = () => {
    _isResizingTable = false;
    // 드래그 종료 후 updateColumns()가 픽셀값으로 남겨둔 경우를 즉시 교정
    nextTick(applyTableWidths);
};

/** 팔레트 팝오버 바깥 클릭 시 닫기 */
const _onClickOutsidePalette = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const isFloatingBtn = !!target.closest('.tf-color-btn') || !!target.closest('.tf-border-main-btn');
    const isFloatingPanel = !!target.closest('.tiptap-table-float');

    if (!isFloatingBtn && !isFloatingPanel) {
        cellBgPaletteVisible.value = false;
        // 테두리 상세 설정(borderPaletteVisible)은 Drawer 형식이므로 외부 클릭으로 닫지 않음
    }
};

onMounted(() => {
    _scrollEl = document.querySelector('main');
    _scrollEl?.addEventListener('scroll', updateTableFloat, { passive: true });
    document.addEventListener('mousedown', _onClickOutsidePalette, true);
    window.addEventListener('mousedown', _onTableResizeStart, true);
    window.addEventListener('mouseup', _onTableResizeEnd, true);
    window.addEventListener('mouseup', syncTableWidths);
});

onUnmounted(() => {
    _scrollEl?.removeEventListener('scroll', updateTableFloat);
    window.removeEventListener('mousedown', _onTableResizeStart, true);
    document.removeEventListener('mousedown', _onClickOutsidePalette, true);
    window.removeEventListener('mouseup', _onTableResizeEnd, true);
    window.removeEventListener('mouseup', syncTableWidths);
});

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
            <div v-if="isDragOver"
                class="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-400/10 border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-xl z-30 flex items-center justify-center pointer-events-none">
                <div
                    class="bg-white dark:bg-zinc-800 rounded-xl px-5 py-3 shadow-xl flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                    <i class="pi pi-image text-lg"></i>
                    이미지를 여기에 놓으세요
                </div>
            </div>
        </Transition>

        <!-- ── 툴바 (TiptapToolbar.vue로 분리 — Design Ref: §2 Clean Architecture) ── -->
        <TiptapToolbar v-if="!readonly && editor" :editor="editor" :imageUploadFn="props.imageUploadFn"
            :fileUploadFn="props.fileUploadFn" :fileDeleteFn="props.fileDeleteFn" :attachmentList="props.attachmentList" />

        <!-- ── 에디터 본문 (부모 높이 전체 점유) ── -->
        <EditorContent v-if="editor" :editor="editor" class="tiptap-content flex-1 overflow-y-auto custom-scrollbar" />

        <!-- SSR 중 placeholder -->
        <div v-else class="p-4 text-zinc-400 dark:text-zinc-600 min-h-[200px] flex items-start">
            <span>{{ props.placeholder || '내용을 입력하세요...' }}</span>
        </div>

        <!-- ── 상태 바 ── -->
        <div v-if="editor"
            class="tiptap-statusbar border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-1.5 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{{ charCount.toLocaleString() }}자 · {{ wordCount.toLocaleString() }}단어</span>
            <span v-if="readonly" class="text-amber-600 dark:text-amber-400">읽기 전용</span>
        </div>
    </div>

    <!-- ── 표 플로팅 툴바 (body에 Teleport — overflow-hidden 제약 해제) ── -->
    <!-- @mousedown.prevent: 버튼 클릭 시 에디터 포커스가 해제되지 않도록 기본 동작 방지 -->
    <Teleport to="body">
        <Transition name="table-float">
            <div v-if="tableFloatVisible && editor && !props.readonly && !borderPaletteVisible"
                class="tiptap-table-float" :style="{ top: tableFloatY + 'px', left: tableFloatX + 'px' }">

                <!-- 행 조작: 위 추가 / 아래 추가 / 행 삭제 -->
                <div class="tf-group">
                    <!-- 위에 행 추가: 새 행 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addRowBefore().run())"
                        title="위에 행 추가">
                        <!-- + 기호(위) + 닫힌 행 2개(아래): rect로 4면 막힘 -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="7" y1="1.5" x2="7" y2="5.5" />
                            <line x1="5" y1="3.5" x2="9" y2="3.5" />
                            <rect x="1" y="8" width="12" height="5" />
                        </svg>
                    </button>
                    <!-- 아래 행 추가: 새 행 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addRowAfter().run())" title="아래 행 추가">
                        <!-- 닫힌 행 2개(위) + + 기호(아래): rect로 4면 막힘 -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="1" width="12" height="5" />
                            <line x1="7" y1="8.5" x2="7" y2="12.5" />
                            <line x1="5" y1="10.5" x2="9" y2="10.5" />
                        </svg>
                    </button>
                    <!-- 행 삭제: 기존 셀만 제거, 정규화 불필요 -->
                    <button class="tf-btn tf-danger" @mousedown.prevent="editor?.chain().focus().deleteRow().run()"
                        title="행 삭제">
                        <!-- 닫힌 행 1개(왼쪽) + 원형 배경의 X(오른쪽 중앙 정렬) -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="4.5" width="5" height="5" stroke-width="1.5" />
                            <!-- X 영역 배경 원: rect 우측 영역(x=7~14) 중앙 cx=10.5, rect y 중앙 cy=7 -->
                            <circle cx="10.5" cy="7" r="3" fill="currentColor" opacity="0.15" stroke="none" />
                            <!-- X (중앙 10.5,7 기준 ±2) -->
                            <line x1="8.5" y1="5" x2="12.5" y2="9" stroke-width="1.8" />
                            <line x1="12.5" y1="5" x2="8.5" y2="9" stroke-width="1.8" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 열 조작: 왼쪽 추가 / 오른쪽 추가 / 열 삭제 -->
                <div class="tf-group">
                    <!-- 왼쪽 열 추가: 새 열 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addColumnBefore().run())"
                        title="왼쪽 열 추가">
                        <!-- + 기호(왼쪽) + 닫힌 열 2개(오른쪽): rect로 4면 막힘 -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="1.5" y1="7" x2="5.5" y2="7" />
                            <line x1="3.5" y1="5" x2="3.5" y2="9" />
                            <rect x="8" y="1" width="5" height="12" />
                        </svg>
                    </button>
                    <!-- 오른쪽 열 추가: 새 열 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addColumnAfter().run())"
                        title="오른쪽 열 추가">
                        <!-- 닫힌 열 2개(왼쪽) + + 기호(오른쪽): rect로 4면 막힘 -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="1" width="5" height="12" />
                            <line x1="8.5" y1="7" x2="12.5" y2="7" />
                            <line x1="10.5" y1="5" x2="10.5" y2="9" />
                        </svg>
                    </button>
                    <!-- 열 삭제: 기존 셀만 제거, 정규화 불필요 -->
                    <button class="tf-btn tf-danger" @mousedown.prevent="editor?.chain().focus().deleteColumn().run()"
                        title="열 삭제">
                        <!-- 닫힌 열 1개(위) + 원형 배경의 X(아래 중앙 정렬) -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4.5" y="1" width="5" height="5" stroke-width="1.5" />
                            <!-- X 영역 배경 원: rect 하단 영역(y=7~14) 중앙 cy=10.5, rect x 중앙 cx=7 -->
                            <circle cx="7" cy="10.5" r="3" fill="currentColor" opacity="0.15" stroke="none" />
                            <!-- X (중앙 7,10.5 기준 ±2) -->
                            <line x1="5" y1="8.5" x2="9" y2="12.5" stroke-width="1.8" />
                            <line x1="9" y1="8.5" x2="5" y2="12.5" stroke-width="1.8" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 셀 병합·분리 -->
                <div class="tf-group">
                    <!-- 셀 병합: 병합 후 colwidth 배열 변경 → tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().mergeCells().run())" title="셀 병합">
                        <!--
                            병합 아이콘: 위 행은 2셀, 아래 행은 병합 셀(강조)
                            ┌──┬──┐
                            │  │  │  ← 위 행 (2셀)
                            ├──┴──┤
                            │ 병합│  ← 병합 셀 (fill 강조)
                            └─────┘
                        -->
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
                            <!-- 외곽 테두리 -->
                            <rect x="1" y="1" width="12" height="12" rx="1" />
                            <!-- 가로 구분선 (2분할) -->
                            <line x1="1" y1="7" x2="13" y2="7" />
                            <!-- 위 행 세로 구분선 -->
                            <line x1="7" y1="1" x2="7" y2="7" />
                            <!-- 병합 셀 강조 (아래 행 채우기) -->
                            <rect x="1.8" y="7.8" width="10.4" height="4.4" rx="0.5" fill="currentColor" opacity="0.3"
                                stroke="none" />
                        </svg>
                    </button>
                    <!-- 셀 분리: 분리된 새 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button class="tf-btn" @mousedown.prevent="tableOp(() => editor?.chain().focus().splitCell().run())"
                        title="셀 분리">
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="1" width="12" height="12" rx="1" />
                            <line x1="7" y1="1" x2="7" y2="13" />
                            <polyline points="4.5,5.5 2.5,7 4.5,8.5" />
                            <polyline points="9.5,5.5 11.5,7 9.5,8.5" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 헤더 행·열 -->
                <div class="tf-group">
                    <!-- 헤더 행 토글: tableOp로 정규화 (헤더↔일반 셀 변환 시 colwidth 재확인) -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().toggleHeaderRow().run())"
                        title="헤더 행 토글">
                        <!--
                            헤더 행 아이콘: 상단 행 2셀 강조(fill), 세로 구분선이 헤더를 관통
                            ┌──┬──┐
                            │▒▒│▒▒│  ← 헤더 행 (2개 개별 셀, 강조)
                            ├──┼──┤
                            │  │  │  ← 바디 행
                            └──┴──┘
                        -->
                        <svg width="18" height="18" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.3"
                            stroke-linecap="round" stroke-linejoin="round">
                            <!-- 외곽 테두리 -->
                            <rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" />
                            <!-- 헤더 행 배경 강조 (세로 구분선이 위에 그려져 개별 셀처럼 보임) -->
                            <rect x="1.5" y="1.5" width="11" height="5" fill="currentColor" opacity="0.25"
                                stroke="none" />
                            <!-- 가로 구분선 (헤더/바디 경계) -->
                            <line x1="1" y1="7" x2="13" y2="7" />
                            <!-- 세로 구분선 (헤더 영역 관통 → 개별 셀 분리) -->
                            <line x1="7" y1="1" x2="7" y2="13" />
                        </svg>
                    </button>
                    <!-- 헤더 열 토글: tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().toggleHeaderColumn().run())"
                        title="헤더 열 토글">
                        <!--
                            헤더 열 아이콘: 좌측 열 2셀 강조(fill), 가로 구분선이 헤더를 관통
                            ┌──┬──┐
                            │▒▒│  │
                            ├──┼──┤  ← 가로선이 헤더 열 관통 → 개별 셀
                            │▒▒│  │
                            └──┴──┘
                        -->
                        <svg width="18" height="18" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.3"
                            stroke-linecap="round" stroke-linejoin="round">
                            <!-- 외곽 테두리 -->
                            <rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" />
                            <!-- 헤더 열 배경 강조 (가로 구분선이 위에 그려져 개별 셀처럼 보임) -->
                            <rect x="1.5" y="1.5" width="5" height="11" fill="currentColor" opacity="0.25"
                                stroke="none" />
                            <!-- 세로 구분선 (헤더/바디 경계) -->
                            <line x1="7" y1="1" x2="7" y2="13" />
                            <!-- 가로 구분선 (헤더 열 관통 → 개별 셀 분리) -->
                            <line x1="1" y1="7" x2="13" y2="7" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-3: 셀 배경색 팔레트 (16색) -->
                <div class="tf-group" style="position: relative;">
                    <button class="tf-btn tf-color-btn"
                        @mousedown.prevent="cellBgPaletteVisible = !cellBgPaletteVisible" title="셀 배경색">
                        <i class="pi pi-palette"></i>
                        <span class="tf-color-dot"
                            :style="{ backgroundColor: currentCellBg ?? 'transparent', border: currentCellBg ? 'none' : '1px dashed #aaa' }">
                        </span>
                    </button>
                    <!-- 팔레트 팝오버 -->
                    <div v-if="cellBgPaletteVisible" class="tiptap-table-float"
                        style="position: absolute; top: calc(100% + 4px); left: 0; width: 130px; padding: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; z-index: 100;"
                        @mousedown.prevent>
                        <button v-for="color in TABLE_CELL_PALETTE" :key="color" class="tf-palette-swatch"
                            :style="{ backgroundColor: color }" :title="color"
                            @mousedown.prevent="applyCellBgColor(color)" />
                        <!-- 배경 없음(지우개) -->
                        <button class="tf-palette-swatch tf-palette-clear" title="배경 없음"
                            @mousedown.prevent="applyCellBgColor(null)">
                            <i class="pi pi-times" style="font-size: 9px;"></i>
                        </button>
                    </div>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-2: 테두리 통합 상세 설정 (팝업 지원) -->
                <div class="tf-group" style="position: relative;">
                    <button class="tf-btn tf-border-main-btn" :class="{ 'tf-btn-active': borderPaletteVisible }"
                        title="테두리 상세 설정" @mousedown.prevent="borderPaletteVisible = !borderPaletteVisible">
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.3">
                            <rect x="2" y="2" width="10" height="10" rx="1" />
                            <path d="M2 5h10M5 2v10" opacity="0.4" />
                        </svg>
                        <span class="tf-border-indicator"
                            :style="{ backgroundColor: (borderPaletteVisible ? pendingBorderColor : currentCellBorderColor) || '#888' }" />
                    </button>

                </div>

                <span class="tf-divider" />

                <!-- FR-06-6: 테이블 전체 위치 정렬 -->
                <div class="tf-group">
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentTableAlign === 'left' }" title="테이블 좌측 정렬"
                        @mousedown.prevent="setTableAlign('left')">
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5">
                            <rect x="1" y="2" width="8" height="10" rx="1" />
                            <path d="M10 4h3M10 7h2M10 10h3" opacity="0.4" />
                        </svg>
                    </button>
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentTableAlign === 'center' }"
                        title="테이블 중앙 정렬" @mousedown.prevent="setTableAlign('center')">
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5">
                            <rect x="3" y="2" width="8" height="10" rx="1" />
                            <path d="M1 4h1M12 4h1M1 7h1.5M11.5 7h1.5M1 10h1M12 10h1" opacity="0.4" />
                        </svg>
                    </button>
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentTableAlign === 'right' }" title="테이블 우측 정렬"
                        @mousedown.prevent="setTableAlign('right')">
                        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5">
                            <rect x="5" y="2" width="8" height="10" rx="1" />
                            <path d="M1 4h3M2 7h2M1 10h3" opacity="0.4" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-01-2: 셀 텍스트 정렬 -->
                <div class="tf-group">
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'left' }"
                        title="텍스트 좌측 정렬" @mousedown.prevent="setCellTextAlign('left')">
                        <i class="pi pi-align-left"></i>
                    </button>
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'center' }"
                        title="텍스트 중앙 정렬" @mousedown.prevent="setCellTextAlign('center')">
                        <i class="pi pi-align-center"></i>
                    </button>
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'right' }"
                        title="텍스트 우측 정렬" @mousedown.prevent="setCellTextAlign('right')">
                        <i class="pi pi-align-right"></i>
                    </button>
                    <button class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'justify' }"
                        title="텍스트 양쪽 정렬" @mousedown.prevent="setCellTextAlign('justify')">
                        <i class="pi pi-align-justify"></i>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-4: 너비에 맞추기 (균등 배분 및 고정폭 고정) -->
                <div class="tf-group">
                    <button class="tf-btn" title="에디터 너비에 맞추기 (균등 배분)" @mousedown.prevent="setTableFullWidth">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4 8 1 12 4 16" />
                            <polyline points="20 16 23 12 20 8" />
                            <line x1="1" y1="12" x2="23" y2="12" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 표 삭제 -->
                <button class="tf-btn tf-danger" @mousedown.prevent="editor?.chain().focus().deleteTable().run()"
                    title="표 삭제">
                    <i class="pi pi-trash"></i>
                </button>
            </div>
        </Transition>
    </Teleport>

    <!-- ── 첨부파일 Suggestion 팝업 (FR-05-3, FR-05-4) ── -->
    <!-- 에디터 포커스를 유지하기 위해 mousedown.prevent 적용 -->
    <Teleport to="body">
        <Transition name="table-float">
            <div v-if="attachSuggest.active && attachSuggest.items.length" class="tiptap-attach-suggest" :style="{
                top: (attachSuggest.rect?.bottom ?? 0) + 4 + 'px',
                left: (attachSuggest.rect?.left ?? 0) + 'px',
            }" @mousedown.prevent>
                <div v-for="(item, idx) in attachSuggest.items" :key="item.flMngNo" class="attach-suggest-item"
                    :class="{ 'attach-suggest-item--active': idx === attachSuggest.selectedIndex }"
                    @mousedown.prevent="attachSuggest.command?.(item)">
                    <i class="pi pi-paperclip text-indigo-400" style="font-size: 11px;" />
                    <span class="truncate">{{ item.flNm }}</span>
                </div>
            </div>
        </Transition>
    </Teleport>

    <!-- ── 테두리 상세 설정 Drawer (FR-06-2 개편) ── -->
    <Drawer v-model:visible="borderPaletteVisible" header="테두리 상세 설정" position="right" :modal="false"
        :dismissable="false" class="!w-[340px] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl"
        @mousedown.prevent>
        <div class="flex flex-col gap-8 py-2">

            <!-- 1. 스타일 & 두께 -->
            <div class="flex gap-6">
                <!-- 스타일 종류 -->
                <div class="drawer-section flex-1">
                    <div class="text-md !mb-3">선 스타일</div>
                    <div class="flex flex-col gap-1.5">
                        <button v-for="bs in BORDER_STYLES" :key="String(bs.value)"
                            class="tf-btn !h-9 !justify-start !px-3 shadow-none border border-zinc-100 dark:border-zinc-800"
                            :class="{ 'tf-btn-active !border-indigo-500': pendingBorderStyle === bs.value }"
                            :title="bs.title" @mousedown.prevent="applyCellBorderStyle(bs.value)">
                            <span class="text-xs font-semibold">{{ bs.label }}</span>
                            <span class="ml-auto text-[10px] opacity-40">{{ bs.title }}</span>
                        </button>
                    </div>
                </div>

                <!-- 두께 -->
                <div class="drawer-section flex-1">
                    <div class="text-md !mb-3">두께</div>
                    <div class="flex flex-col gap-1.5">
                        <button v-for="bw in BORDER_WIDTHS" :key="bw.value"
                            class="tf-btn !h-9 !justify-start !px-3 shadow-none border border-zinc-100 dark:border-zinc-800"
                            :class="{ 'tf-btn-active !border-indigo-500': pendingBorderWidth === bw.value }"
                            @mousedown.prevent="applyCellBorderWidth(bw.value)">
                            <span class="text-[11px] font-bold">{{ bw.label }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 2. 색상 -->
            <div class="drawer-section">
                <div class="text-md !mb-3">선 색상</div>
                <div class="grid grid-cols-7 gap-1.5">
                    <button v-for="color in TABLE_CELL_PALETTE" :key="color"
                        class="tf-palette-swatch !w-full !h-7 rounded-sm transition-all"
                        :style="{ backgroundColor: color }"
                        :class="{ 'ring-2 ring-indigo-500 ring-offset-2 scale-90': pendingBorderColor === color }"
                        @mousedown.prevent="applyCellBorderColor(color)" />
                    <button
                        class="tf-palette-swatch tf-palette-clear !w-full !h-7 rounded-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                        @mousedown.prevent="applyCellBorderColor(null)">
                        <i class="pi pi-times" style="font-size: 10px;"></i>
                    </button>
                </div>
            </div>

            <!-- 3. 방향 선택 (Excel 스타일) -->
            <div class="drawer-section">
                <div class="text-md !mb-3">경계면 선택</div>
                <div class="grid grid-cols-4 gap-2">
                    <button v-for="dir in BORDER_DIRECTIONS" :key="dir.value"
                        class="tf-btn !h-14 !w-full flex-col !justify-center !items-center !gap-1 !pt-1.5 !pb-0.5 !px-0 shadow-sm border border-zinc-100 dark:border-zinc-800"
                        :title="dir.label" @mousedown.prevent="applySideBorder(dir.value)">
                        <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                            <!-- 배경 그리드 (지우기가 아닐 때만 표시하여 맥락 제공) -->
                            <path v-if="dir.value !== 'clear'" d="M1 1h12v12H1z M1 7h12 M7 1v12" opacity="0.15"
                                stroke-width="1" />
                            <!-- 실제 방향 아이콘 (강조) -->
                            <path :d="dir.icon" stroke-width="1.8" stroke-linecap="round" />
                        </svg>
                        <span class="text-[9px] font-medium opacity-70">{{ dir.label }}</span>
                    </button>
                </div>
            </div>

            <div class="mt-auto pt-6">
                <Button label="설정 완료" icon="pi pi-check" class="w-full !h-11" severity="secondary"
                    @click="borderPaletteVisible = false" />
            </div>

        </div>
    </Drawer>

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

/* ═══════════════════════════════════════════════════════
   표 플로팅 툴바 (.tiptap-table-float)
   Teleport to="body"로 렌더링되므로 :deep() 불필요
   ═══════════════════════════════════════════════════════ */

/* 플로팅 컨테이너 — position: fixed, body 기준 좌표 */
.tiptap-table-float {
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    background: #ffffff;
    border: 1px solid rgba(55, 53, 47, 0.13);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
    user-select: none;
    white-space: nowrap;
    /* 다크모드: .dark 클래스가 body가 아닌 html에 적용될 수 있어 별도 미디어쿼리로 처리 */
}

/* 다크모드 플로팅 컨테이너 */
:global(.dark) .tiptap-table-float {
    background: #1e1e1e;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* 버튼 그룹 — 버튼들을 수평으로 묶는 컨테이너 */
.tf-group {
    display: flex;
    align-items: center;
    gap: 2px;
}

/* 기본 버튼 스타일 */
.tf-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 4px 7px;
    font-size: 0.73rem;
    font-weight: 500;
    color: #374151;
    background: transparent;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    line-height: 1;
}

.tf-btn:hover {
    background: rgba(55, 53, 47, 0.06);
    color: #111827;
}

/* 활성 버튼 강조 (테두리 스타일, 레이아웃 토글 등) */
.tf-btn.tf-btn-active {
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
}

:global(.dark) .tf-btn.tf-btn-active {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
}

/* 다크모드 버튼 */
:global(.dark) .tf-btn {
    color: #d1d5db;
}

:global(.dark) .tf-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f9fafb;
}

/* 위험(삭제) 버튼 — 빨간 계열 */
.tf-btn.tf-danger {
    color: #ef4444;
}

.tf-btn.tf-danger:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #dc2626;
}

:global(.dark) .tf-btn.tf-danger {
    color: #f87171;
}

:global(.dark) .tf-btn.tf-danger:hover {
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
}

/* 활성(헤더 셀 등) 버튼 — 강조 표시 */
.tf-btn.tf-active {
    color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
}

.tf-btn.tf-active:hover {
    background: rgba(99, 102, 241, 0.18);
}

:global(.dark) .tf-btn.tf-active {
    color: #818cf8;
    background: rgba(129, 140, 248, 0.15);
}

/* 셀 배경색 버튼 — color input을 absolute로 품는 컨테이너 */
.tf-btn.tf-color-btn {
    position: relative;
}

/* 셀 배경색 미리보기 점 */
.tf-color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(55, 53, 47, 0.2);
    background-color: #ffffff;
    flex-shrink: 0;
}

/* FR-06-3: 팔레트 색상 스와치 버튼 */
.tf-palette-swatch {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.tf-palette-swatch:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
}

/* 배경 없음(지우개) 스와치 */
.tf-palette-swatch.tf-palette-clear {
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
}

/* FR-06-5: 셀 높이 입력 */
.tf-height-input {
    width: 44px;
    height: 24px;
    font-size: 11px;
    text-align: center;
    border: 1px solid rgba(55, 53, 47, 0.2);
    border-radius: 4px;
    outline: none;
    background: transparent;
    color: inherit;
    padding: 0 2px;
}

.tf-height-input:focus {
    border-color: rgba(99, 102, 241, 0.6);
}

/* 숫자 스피너 숨김 */
.tf-height-input::-webkit-outer-spin-button,
.tf-height-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* 그룹 구분선 */
.tf-divider {
    display: inline-block;
    width: 1px;
    height: 18px;
    background: rgba(55, 53, 47, 0.13);
    border-radius: 1px;
    flex-shrink: 0;
    margin: 0 2px;
}

:global(.dark) .tf-divider {
    background: rgba(255, 255, 255, 0.1);
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
