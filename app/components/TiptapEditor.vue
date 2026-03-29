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

// ── 드래그 & 드롭 상태 ──
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
        Placeholder.configure({ placeholder: props.placeholder || '내용을 입력하세요...' }),
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
        // 리사이즈 드래그 중이 아닐 때만 저장된 표 너비를 복원합니다.
        // Tiptap의 updateColumns()는 매 트랜잭션마다 colwidth 합산으로 table.style.width를 재계산하며,
        // 일부 셀의 colwidth가 없으면(fixedWidth=false) width를 비워 CSS width:100%가 됩니다.
        // 드래그 중에는 Tiptap이 실시간으로 너비를 조정하므로 덮어쓰지 않아야 합니다.
        if (!_isResizingTable) {
            nextTick(applyTableWidths);
        }
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
    { value: null,     label: '없음', title: '테두리 없음' },
    { value: 'solid',  label: '─',   title: '실선' },
    { value: 'dashed', label: '╌',   title: '점선' },
    { value: 'double', label: '═',   title: '이중선' },
] as const;

/** 현재 셀의 테두리 스타일 */
const currentCellBorderStyle = computed<string | null>(() => {
    if (!editor.value?.isActive('table')) return null;
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.borderStyle || headerAttrs.borderStyle || null;
});

/** 셀 테두리 스타일 적용 */
const applyCellBorderStyle = (style: string | null) => {
    editor.value?.chain().focus().setCellAttribute('borderStyle', style).run();
};

// ── 테이블 레이아웃 (FR-06-4) ──

/** 현재 테이블 레이아웃 ('fixed' | 'auto') */
const currentTableLayout = computed<string>(() => {
    if (!editor.value?.isActive('table')) return 'fixed';
    return editor.value.getAttributes('table').tableLayout ?? 'fixed';
});

/** 테이블 레이아웃 토글 (fixed ↔ auto) */
const toggleTableLayout = () => {
    const next = currentTableLayout.value === 'fixed' ? 'auto' : 'fixed';
    editor.value?.chain().focus().updateAttributes('table', { tableLayout: next }).run();
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
 * 저장된 CustomTable.width 속성을 DOM의 table.style.width에 직접 적용합니다.
 */
const applyTableWidths = () => {
    if (_isResizingTable) return;
    if (!editor.value || editor.value.isDestroyed) return;
    const view = editor.value.view;

    view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return;
        if (!node.attrs.width) return;

        try {
            const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
            if (!wrapperEl) return;

            const tableEl = (wrapperEl.tagName === 'TABLE'
                ? wrapperEl
                : wrapperEl.querySelector('table')) as HTMLTableElement | null;
            if (!tableEl) return;

            if (tableEl.style.width !== node.attrs.width) {
                tableEl.style.width = node.attrs.width;
            }
        } catch { /* pos 매핑 실패 시 무시 */ }
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
};

/** 팔레트 팝오버 바깥 클릭 시 닫기 */
const _onClickOutsidePalette = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.tf-color-btn') && !target.closest('.tiptap-table-float')) {
        cellBgPaletteVisible.value = false;
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
</script>

<template>
    <div
        class="tiptap-editor-container relative border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900">

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
        <TiptapToolbar
            v-if="!readonly && editor"
            :editor="editor"
            :imageUploadFn="props.imageUploadFn"
            :fileUploadFn="props.fileUploadFn"
            :attachmentList="props.attachmentList"
        />

        <!-- ── 에디터 본문 ── -->
        <EditorContent v-if="editor" :editor="editor" class="tiptap-content" />

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
            <div v-if="tableFloatVisible && editor && !props.readonly" class="tiptap-table-float"
                :style="{ top: tableFloatY + 'px', left: tableFloatX + 'px' }">

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
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addRowAfter().run())"
                        title="아래 행 추가">
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
                            <rect x="1.8" y="7.8" width="10.4" height="4.4" rx="0.5"
                                fill="currentColor" opacity="0.3" stroke="none" />
                        </svg>
                    </button>
                    <!-- 셀 분리: 분리된 새 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button class="tf-btn"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().splitCell().run())" title="셀 분리">
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
                        @mousedown.prevent="cellBgPaletteVisible = !cellBgPaletteVisible"
                        title="셀 배경색">
                        <i class="pi pi-palette"></i>
                        <span class="tf-color-dot"
                            :style="{ backgroundColor: currentCellBg ?? 'transparent', border: currentCellBg ? 'none' : '1px dashed #aaa' }">
                        </span>
                    </button>
                    <!-- 팔레트 팝오버 -->
                    <div v-if="cellBgPaletteVisible"
                        class="tiptap-table-float"
                        style="position: absolute; top: calc(100% + 4px); left: 0; width: 130px; padding: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; z-index: 100;"
                        @mousedown.prevent>
                        <button v-for="color in TABLE_CELL_PALETTE" :key="color"
                            class="tf-palette-swatch"
                            :style="{ backgroundColor: color }"
                            :title="color"
                            @mousedown.prevent="applyCellBgColor(color)" />
                        <!-- 배경 없음(지우개) -->
                        <button class="tf-palette-swatch tf-palette-clear"
                            title="배경 없음"
                            @mousedown.prevent="applyCellBgColor(null)">
                            <i class="pi pi-times" style="font-size: 9px;"></i>
                        </button>
                    </div>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-2: 테두리 스타일 (없음/실선/점선/이중선) -->
                <div class="tf-group">
                    <button v-for="bs in BORDER_STYLES" :key="String(bs.value)"
                        class="tf-btn"
                        :class="{ 'tf-btn-active': currentCellBorderStyle === bs.value }"
                        :title="bs.title"
                        @mousedown.prevent="applyCellBorderStyle(bs.value)">
                        <span style="font-size: 11px; font-weight: 600; line-height: 1;">{{ bs.label }}</span>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-4: 레이아웃 토글 (반응형 / 고정형) -->
                <div class="tf-group">
                    <button class="tf-btn"
                        :class="{ 'tf-btn-active': currentTableLayout === 'auto' }"
                        :title="currentTableLayout === 'fixed' ? '반응형으로 전환 (auto)' : '고정형으로 전환 (fixed)'"
                        @mousedown.prevent="toggleTableLayout">
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                            <!-- 표 외곽 -->
                            <rect x="1" y="2" width="12" height="10" rx="1" />
                            <!-- 가변 열 표시: 세로선 2개가 균등하지 않음 -->
                            <line x1="5" y1="2" x2="5" y2="12" />
                            <line x1="9" y1="2" x2="9" y2="12" />
                            <!-- 반응형 화살표 힌트 -->
                            <polyline points="2.5,7 4,5.5 4,8.5" v-if="currentTableLayout === 'fixed'" />
                            <polyline points="11.5,7 10,5.5 10,8.5" v-if="currentTableLayout === 'fixed'" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-5: 셀 최소 높이 -->
                <div class="tf-group" style="align-items: center;">
                    <input
                        type="number"
                        class="tf-height-input"
                        :value="currentCellMinHeight || ''"
                        min="0"
                        max="500"
                        step="10"
                        placeholder="높이"
                        title="셀 최소 높이 (px)"
                        @mousedown.prevent
                        @change="(e) => applyCellMinHeight(Number((e.target as HTMLInputElement).value))"
                    />
                    <span style="font-size: 10px; color: #888; margin-left: 1px;">px</span>
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
            <div
                v-if="attachSuggest.active && attachSuggest.items.length"
                class="tiptap-attach-suggest"
                :style="{
                    top: (attachSuggest.rect?.bottom ?? 0) + 4 + 'px',
                    left: (attachSuggest.rect?.left ?? 0) + 'px',
                }"
                @mousedown.prevent
            >
                <div
                    v-for="(item, idx) in attachSuggest.items"
                    :key="item.flMngNo"
                    class="attach-suggest-item"
                    :class="{ 'attach-suggest-item--active': idx === attachSuggest.selectedIndex }"
                    @mousedown.prevent="attachSuggest.command?.(item)"
                >
                    <i class="pi pi-paperclip text-indigo-400" style="font-size: 11px;" />
                    <span class="truncate">{{ item.flNm }}</span>
                </div>
            </div>
        </Transition>
    </Teleport>

</template>

<style scoped>
/* tbar-btn, tf-btn-active, tbar-divider, tbar-select 스타일은 TiptapToolbar.vue로 이동됨 */

/* ── 에디터 본문 영역 ── */
:deep(.tiptap-content .ProseMirror) {
    outline: none;
    min-height: 400px;
    padding: 1.25rem 1.5rem;
    line-height: 1.75;
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

/* 제목 스타일 */
:deep(.tiptap-content .ProseMirror h1) {
    @apply text-3xl font-bold mt-6 mb-3 text-zinc-900 dark:text-zinc-100;
}

:deep(.tiptap-content .ProseMirror h2) {
    @apply text-2xl font-bold mt-5 mb-2 text-zinc-900 dark:text-zinc-100;
}

:deep(.tiptap-content .ProseMirror h3) {
    @apply text-xl font-bold mt-4 mb-2 text-zinc-800 dark:text-zinc-200;
}

:deep(.tiptap-content .ProseMirror h4) {
    @apply text-lg font-semibold mt-3 mb-1 text-zinc-800 dark:text-zinc-200;
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

/* 표 수평 스크롤 래퍼 (.tableWrapper는 Tiptap Table 확장이 자동 생성) */
:deep(.tiptap-content .ProseMirror .tableWrapper) {
    overflow-x: auto;
    margin: 1.25rem 0;
}

/* border-collapse: separate + border-spacing: 0 조합으로
   table 요소에 border-radius + overflow: hidden 적용 가능.
   (border-collapse: collapse는 table의 border-radius를 무시함) */
:deep(.tiptap-content .ProseMirror table) {
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    border: 1px solid rgba(55, 53, 47, 0.12);
    border-radius: 6px;
    overflow: hidden;
}

/* td · th 공통: 외곽은 table border가 담당하므로 우측·하단만 */
:deep(.tiptap-content .ProseMirror td),
:deep(.tiptap-content .ProseMirror th) {
    border-right: 1px solid rgba(55, 53, 47, 0.1);
    border-bottom: 1px solid rgba(55, 53, 47, 0.1);
    padding: 7px 12px;
    vertical-align: top;
    position: relative;
    min-width: 80px;
    word-break: break-word;
}

/* 마지막 열: 우측 border 제거 (table 외곽이 담당) */
:deep(.tiptap-content .ProseMirror td:last-child),
:deep(.tiptap-content .ProseMirror th:last-child) {
    border-right: none;
}

/* 마지막 행: 하단 border 제거 (table 외곽이 담당) */
:deep(.tiptap-content .ProseMirror tr:last-child td),
:deep(.tiptap-content .ProseMirror tr:last-child th) {
    border-bottom: none;
}

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

/* FR-06-2: 테두리 스타일 — data-border-style 어트리뷰트 기반 CSS */
:deep(.tiptap-content .ProseMirror td[data-border-style="solid"]),
:deep(.tiptap-content .ProseMirror th[data-border-style="solid"]) {
    border-style: solid !important;
}
:deep(.tiptap-content .ProseMirror td[data-border-style="dashed"]),
:deep(.tiptap-content .ProseMirror th[data-border-style="dashed"]) {
    border-style: dashed !important;
}
:deep(.tiptap-content .ProseMirror td[data-border-style="double"]),
:deep(.tiptap-content .ProseMirror th[data-border-style="double"]) {
    border-style: double !important;
    border-width: 3px !important;
}

/* 다크모드 — 표 외곽선 */
.dark :deep(.tiptap-content .ProseMirror table) {
    border-color: rgba(255, 255, 255, 0.1);
}

/* 다크모드 — 셀 구분선 */
.dark :deep(.tiptap-content .ProseMirror td),
.dark :deep(.tiptap-content .ProseMirror th) {
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
</style>
