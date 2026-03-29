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
  Image             : 이미지 삽입 (URL + 파일 업로드)
  Table             : 표 (행/열 추가·삭제, 병합)
  TaskList/TaskItem : 체크리스트
  CharacterCount    : 글자 수 통계
  Placeholder       : 빈 에디터 힌트
  FontFamily        : 폰트 패밀리
  Subscript         : 아래첨자
  Superscript       : 위첨자

[Excalidraw 연동]
  - 툴바 "다이어그램" 버튼 → Excalidraw 편집 다이얼로그 열기
  - 완성된 그림은 SVG로 직렬화하여 에디터 내 커스텀 노드로 삽입
  - 기존 다이어그램 노드 hover 시 "편집" 버튼으로 재편집 가능
================================================================================
-->
<script setup lang="ts">
import { useEditor, EditorContent, VueNodeViewRenderer } from '@tiptap/vue-3';
import { Node as TiptapNode } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import ResizableImageNodeViewComponent from './ResizableImageNodeView.vue';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import ExcalidrawNodeViewComponent from './ExcalidrawNodeView.vue';

// ── ResizableImage 커스텀 확장 ──
// @tiptap/extension-image를 확장하여 너비(width), 정렬(align) 속성 및 NodeView를 추가합니다.
const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /**
             * 이미지 너비 (px 단위 숫자)
             * null이면 원본 크기(max-width: 100%) 유지
             */
            width: {
                default: null,
                parseHTML: (el) => {
                    const w = el.getAttribute('width') ?? el.style.width;
                    if (!w) return null;
                    const num = Number.parseInt(w);
                    return Number.isNaN(num) ? null : num;
                },
                renderHTML: (attrs) => {
                    if (!attrs.width) return {};
                    return { width: String(attrs.width), style: `width: ${attrs.width}px; max-width: 100%;` };
                }
            },
            /**
             * 이미지 정렬
             * 'left' | 'center' | 'right'
             */
            align: {
                default: 'left',
                parseHTML: (el) => (el.getAttribute('data-align') as 'left' | 'center' | 'right') ?? 'left',
                renderHTML: (attrs) => ({ 'data-align': attrs.align ?? 'left' })
            }
        };
    },
    addNodeView() {
        // as any: Vue 컴포넌트 props 타입이 NodeViewProps와 완전히 일치하지 않아 발생하는 TS 오류 억제
        return VueNodeViewRenderer(ResizableImageNodeViewComponent as any);
    }
}).configure({ inline: false, allowBase64: true });

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
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'update:toc': [toc: Array<{ id: string; level: number; text: string }>];
}>();

// ── Excalidraw 다이얼로그 ──
const { isOpen: isExcalidrawOpen, initialSceneData, open: openExcalidraw, close: closeExcalidraw, confirm: confirmExcalidraw } = useExcalidrawDialog();
const excalidrawWrapperRef = ref<any>(null);

// ── Excalidraw 파싱 유틸리티 ──
/** HTML 요소에서 Excalidraw 데이터를 추출하는 함수 */
const extractExcalidrawAttrs = (el: HTMLElement | null, img: HTMLImageElement | null) => {
    let sceneData: string | null = null;
    let svgContent = '';

    // 1. data-scene 속성에서 추출 시도 (가장 빠르고 정상적인 경우)
    const rawDataScene = el?.getAttribute('data-scene');
    if (rawDataScene) {
        try {
            sceneData = decodeURIComponent(atob(rawDataScene));
        } catch {
            sceneData = rawDataScene; // 레거시 비인코딩 데이터
        }
    }

    // 2. img src에서 SVG 및 주석 추출
    if (img?.src?.startsWith('data:image/svg+xml')) {
        try {
            // URL 디코딩하여 원본 SVG 문자열 확보
            svgContent = decodeURIComponent(img.src.replace('data:image/svg+xml;charset=utf-8,', ''));

            // data-scene 속성이 유실된 경우 (백엔드 sanitization 등), SVG 내부 주석에서 추출 시도
            if (!sceneData) {
                const match = svgContent.match(/<!-- excalidraw-scene-data:(.*?) -->/);
                if (match && match[1]) {
                    try {
                        sceneData = decodeURIComponent(atob(match[1]));
                    } catch {
                        sceneData = match[1];
                    }
                }
            }
        } catch { /* 파싱 실패 시 무시 */ }
    }

    // 디버그 (문제 해결 후 제거)
    console.log('[ExcalidrawExt extract] rawDataScene:', rawDataScene?.substring(0, 50), 'sceneData from SVG:', !!sceneData);

    return { sceneData, svgContent };
};

// ── Excalidraw Tiptap 커스텀 노드 확장 ──
const ExcalidrawExtension = TiptapNode.create({
    name: 'excalidraw',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            /** 에디터 내 미리보기용 SVG 문자열 */
            svgContent: { default: '' },
            /** 재편집을 위한 Excalidraw 장면 JSON 문자열 */
            sceneData: { default: null }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure[data-type="excalidraw"]',
                getAttrs: (element) => {
                    const el = element as HTMLElement;
                    const img = el.querySelector('img');
                    return extractExcalidrawAttrs(el, img);
                }
            },
            {
                // 백엔드 sanitizer에 의해 <figure>가 잘리고 <img>만 남은 경우 대비
                tag: 'img[src^="data:image/svg+xml"]',
                getAttrs: (element) => {
                    const img = element as HTMLImageElement;
                    const attrs = extractExcalidrawAttrs(null, img);
                    // excalidraw-scene-data 주석이 확인된 경우에만 excalidraw 노드로 인식
                    if (attrs.sceneData) return attrs;
                    return false;
                }
            }
        ];
    },

    renderHTML({ node }) {
        // sceneData를 Base64로 인코딩
        const encodedScene = node.attrs.sceneData
            ? btoa(encodeURIComponent(node.attrs.sceneData))
            : '';

        // SVG 문자열 끝에 주석 형태로 sceneData 삽입 (백엔드 sanitization 우회)
        let finalSvgContent = node.attrs.svgContent || '';
        if (encodedScene && finalSvgContent.includes('</svg>')) {
            finalSvgContent = finalSvgContent.replace('</svg>', `<!-- excalidraw-scene-data:${encodedScene} --></svg>`);
        }

        return [
            'figure',
            {
                'data-type': 'excalidraw',
                // 호환성 및 프론트에서 빠른 로드를 위해 data-scene 속성도 유지
                'data-scene': encodedScene,
                style: 'margin: 1rem 0;'
            },
            [
                'img',
                {
                    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvgContent)}`,
                    style: 'max-width: 100%; display: block;',
                    alt: 'Excalidraw 다이어그램'
                }
            ]
        ];
    },

    addNodeView() {
        // as any: Vue 컴포넌트 props 타입이 NodeViewProps와 완전히 일치하지 않아 발생하는 TS 오류 억제
        return VueNodeViewRenderer(ExcalidrawNodeViewComponent as any);
    }
});

// ── Custom TableCell / TableHeader 확장 ──
// 기본 TableCell·TableHeader에 셀 배경색(backgroundColor) 속성을 추가합니다.
// setCellAttribute('backgroundColor', color) 명령으로 적용합니다.
// ── CustomTable: 표 전체 너비 속성 영구 저장 ──
// Tiptap의 TableView는 colwidth에서 table.style.width를 동적으로 계산하지만,
// editor.getHTML()은 이 DOM 스타일을 직렬화하지 않아 저장 후 복원 시 너비가 사라집니다.
// width 속성을 ProseMirror 스키마에 추가하여 <table style="width:Xpx"> 형태로 저장합니다.
const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                // parseHTML: 저장된 HTML의 table 요소 style.width를 읽어 복원
                parseHTML: (element) => element.style.width || null,
                // renderHTML: 직렬화 시 style 속성으로 출력 (CSS width: 100%보다 우선)
                renderHTML: (attributes) => {
                    if (!attributes.width) return {};
                    return { style: `width: ${attributes.width}` };
                }
            }
        };
    }
});

const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /**
             * 셀 배경색 (CSS color 문자열)
             * renderHTML: style 속성으로 직렬화되어 HTML에 저장됩니다.
             */
            backgroundColor: {
                default: null,
                parseHTML: (element) => element.style.backgroundColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                }
            }
        };
    }
});

const CustomTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /** 헤더 셀 배경색 */
            backgroundColor: {
                default: null,
                parseHTML: (element) => element.style.backgroundColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                }
            }
        };
    }
});

// ── Custom Heading Extension ──
// 기본 Heading 확장에 고유 id 생성 및 렌더링 기능 추가
import Heading from '@tiptap/extension-heading';

const CustomHeading = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            id: {
                default: null,
                parseHTML: element => element.getAttribute('id'),
                renderHTML: attributes => {
                    if (!attributes.id) {
                        return {
                            id: `heading-${Math.random().toString(36).substr(2, 9)}`,
                            style: 'scroll-margin-top: 100px;'
                        };
                    }
                    return {
                        id: attributes.id,
                        style: 'scroll-margin-top: 100px;'
                    };
                },
            },
        };
    },
});

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

// ── Tiptap 에디터 초기화 ──
const editor = useEditor({
    extensions: [
        StarterKit.configure({
            // Heading은 CustomHeading으로 대체하므로 기본 확장에서는 비활성화
            heading: false,
        }),
        CustomHeading,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
        Subscript,
        Superscript,
        ExcalidrawExtension
    ],
    // setContent 전에 <colgroup> 너비를 셀 colwidth 속성으로 변환 (브라우저 환경에서만 실행)
    content: process.client ? injectColwidthsFromColgroup(props.modelValue || '') : (props.modelValue || ''),
    editable: !props.readonly,
    onCreate: ({ editor }) => {
        // 초기 로드 시 한 번 TOC 추출
        extractTOC(editor);
        // 편집 모드에서만 colwidth 정규화 실행 (조회 모드에서는 저장된 값을 그대로 사용)
        nextTick(() => {
            if (!props.readonly) normalizeColwidths();
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

// ── 링크 다이얼로그 ──
const linkDialogVisible = ref(false);
const linkUrl = ref('');
const linkOpenInNewTab = ref(true);

/** 링크 다이얼로그 열기 (선택된 텍스트에 기존 링크 URL 미리 채움) */
const openLinkDialog = () => {
    const existing = editor.value?.getAttributes('link');
    linkUrl.value = existing?.href || '';
    linkOpenInNewTab.value = existing?.target === '_blank';
    linkDialogVisible.value = true;
};

/** 링크 적용 (URL이 없으면 링크 제거) */
const applyLink = () => {
    if (!editor.value) return;
    if (linkUrl.value) {
        editor.value.chain().focus().setLink({
            href: linkUrl.value,
            target: linkOpenInNewTab.value ? '_blank' : null
        }).run();
    } else {
        editor.value.chain().focus().unsetLink().run();
    }
    linkDialogVisible.value = false;
};

// ── 이미지 다이얼로그 ──
const imageDialogVisible = ref(false);
const imageUrl = ref('');
const imageAlt = ref('');
const imageFileInput = ref<HTMLInputElement | null>(null);
const imageTab = ref<'url' | 'file'>('url');
/** 이미지 업로드 진행 중 여부 (API 업로드 시 로딩 표시용) */
const isUploadingImage = ref(false);

/** 이미지 다이얼로그 열기 */
const openImageDialog = () => {
    imageUrl.value = '';
    imageAlt.value = '';
    imageTab.value = 'url';
    imageDialogVisible.value = true;
};

/** URL로 이미지 삽입 */
const applyImageUrl = () => {
    if (!editor.value || !imageUrl.value) return;
    editor.value.chain().focus().setImage({ src: imageUrl.value, alt: imageAlt.value }).run();
    imageDialogVisible.value = false;
};

/**
 * 파일 업로드로 이미지 삽입
 * imageUploadFn prop이 제공된 경우 API 업로드를 수행하고,
 * 그렇지 않은 경우 base64로 변환하여 에디터에 직접 삽입합니다.
 */
const handleImageFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (props.imageUploadFn) {
        // API 업로드 모드: imageUploadFn으로 서버에 업로드 후 URL 삽입
        isUploadingImage.value = true;
        try {
            const src = await props.imageUploadFn(file);
            editor.value?.chain().focus().setImage({ src, alt: file.name }).run();
            imageDialogVisible.value = false;
        } catch (e) {
            console.error('[TiptapEditor] 이미지 업로드 실패:', e);
            // 업로드 실패 시 에러는 부모 컴포넌트의 imageUploadFn에서 처리
        } finally {
            isUploadingImage.value = false;
            // 동일 파일 재선택을 위해 input 초기화
            input.value = '';
        }
    } else {
        // 기본 모드: base64 변환하여 문서에 직접 포함
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            editor.value?.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
            imageDialogVisible.value = false;
        };
        reader.readAsDataURL(file);
    }
};

// ── 색상 팔레트 ──
/** 글자색 팔레트 표시 여부 */
const colorPaletteVisible = ref(false);
/** 배경색(형광펜) 팔레트 표시 여부 */
const highlightPaletteVisible = ref(false);

/**
 * 프리셋 색상 팔레트 (8열 × 6행 = 48색)
 * 열: 흑백/회색, 빨강, 주황, 노랑/녹색, 청록/파랑, 남색/보라, 분홍
 * 행: 짙은색 → 옅은색 순
 */
const COLOR_PALETTE: string[][] = [
    // 흑백 / 회색 계열
    ['#000000', '#1F2937', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#FFFFFF'],
    // 빨강 / 주황 계열
    ['#7F1D1D', '#B91C1C', '#EF4444', '#F97316', '#FB923C', '#FCA5A5', '#FED7AA', '#FFF7ED'],
    // 노랑 / 노란녹색 계열
    ['#78350F', '#B45309', '#D97706', '#EAB308', '#FCD34D', '#FDE68A', '#FEF08A', '#FEFCE8'],
    // 녹색 / 청록 계열
    ['#14532D', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7'],
    // 파랑 / 남색 계열
    ['#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
    // 보라 / 분홍 계열
    ['#4C1D95', '#6D28D9', '#8B5CF6', '#A855F7', '#EC4899', '#F472B6', '#F9A8D4', '#FCE7F3'],
];

/** 현재 커서 위치의 글자 색상 (버튼 미리보기용) */
const currentTextColor = computed(() =>
    editor.value?.getAttributes('textStyle')?.color || '#000000'
);

/** 현재 커서 위치의 배경 하이라이트 색상 (버튼 미리보기용) */
const currentHighlightColor = computed(() =>
    editor.value?.getAttributes('highlight')?.color || '#FDE047'
);

/** 글자 색상 적용 */
const applyTextColor = (color: string) => {
    editor.value?.chain().focus().setColor(color).run();
    colorPaletteVisible.value = false;
};

/** 글자 색상 제거 */
const removeTextColor = () => {
    editor.value?.chain().focus().unsetColor().run();
    colorPaletteVisible.value = false;
};

/** 배경(형광펜) 색상 적용 */
const applyHighlightColor = (color: string) => {
    editor.value?.chain().focus().setHighlight({ color }).run();
    highlightPaletteVisible.value = false;
};

/** 배경(형광펜) 색상 제거 */
const removeHighlightColor = () => {
    editor.value?.chain().focus().unsetHighlight().run();
    highlightPaletteVisible.value = false;
};

// ── 폰트 패밀리 ──
const fontOptions = [
    { label: '기본 폰트', value: '' },
    { label: '나눔고딕', value: "'NanumGothic', sans-serif" },
    { label: '맑은 고딕', value: "'Malgun Gothic', sans-serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Courier New', value: "'Courier New', monospace" }
];
const selectedFont = ref('');

const applyFontFamily = (font: string) => {
    if (!font) {
        editor.value?.chain().focus().unsetFontFamily().run();
    } else {
        editor.value?.chain().focus().setFontFamily(font).run();
    }
    selectedFont.value = font;
};

// ── 표 조작 ──
/**
 * 3x3 표 삽입 (헤더 행 포함)
 * 삽입 후 모든 셀에 균등 colwidth를 설정합니다.
 * colwidth가 전 셀에 있어야 fixedWidth=true가 되어 table.style.width가 저장됩니다.
 */
const insertTable = () => {
    const COLS = 3;
    /** 최초 삽입 테이블 고정 폭 (px) */
    const TABLE_WIDTH = 450;
    const colWidth = Math.floor(TABLE_WIDTH / COLS); // 150px per col
    editor.value?.chain().focus().insertTable({ rows: 3, cols: COLS, withHeaderRow: true }).run();

    // 삽입 직후 DOM이 반영된 뒤 colwidth 초기화
    nextTick(() => {
        if (!editor.value) return;
        const view = editor.value.view;

        const { selection } = view.state;
        const $anchor = selection.$anchor;
        const tr = view.state.tr;
        let patched = false;

        // 현재 커서 위치에서 상위 table 노드 탐색
        for (let depth = $anchor.depth; depth >= 0; depth--) {
            const node = $anchor.node(depth);
            if (node.type.name !== 'table') continue;

            const tableStart = $anchor.start(depth);
            // table 내 모든 셀에 colwidth 초기화
            node.descendants((cell, pos) => {
                if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') return;
                if (cell.attrs.colwidth) return; // 이미 설정된 경우 스킵
                tr.setNodeMarkup(tableStart + pos, null, {
                    ...cell.attrs,
                    colwidth: [colWidth]
                });
                patched = true;
            });
            break;
        }
        if (patched) {
            view.dispatch(tr.setMeta('addToHistory', false));
        }
    });
};

// ── 셀 서식 ──
/** 셀 배경색 color input 참조 */
const cellBgInputRef = ref<HTMLInputElement | null>(null);

/**
 * 현재 커서가 위치한 셀의 배경색을 반환합니다.
 * color input의 초기값 표시에 사용합니다.
 */
const currentCellBg = computed<string>(() => {
    if (!editor.value?.isActive('table')) return '#ffffff';
    const attrs = editor.value.getAttributes('tableCell');
    const headerAttrs = editor.value.getAttributes('tableHeader');
    return attrs.backgroundColor || headerAttrs.backgroundColor || '#ffffff';
});

/**
 * 셀 배경색 적용 핸들러
 * tableCell과 tableHeader 모두에 setCellAttribute로 적용합니다.
 */
const handleCellBgChange = (event: Event) => {
    const color = (event.target as HTMLInputElement).value;
    editor.value?.chain().focus().setCellAttribute('backgroundColor', color).run();
};

/**
 * 셀 배경색 제거
 * null을 설정하면 renderHTML에서 style 속성을 생략합니다.
 */
const clearCellBg = () => {
    editor.value?.chain().focus().setCellAttribute('backgroundColor', null).run();
};

/**
 * 저장된 CustomTable.width 속성을 DOM의 table.style.width에 직접 적용합니다.
 *
 * TableView.updateColumns()는 모든 셀의 colwidth 합산으로 table.style.width를 설정하지만,
 * 일부 셀에 colwidth가 없으면 width를 비워(fixedWidth=false) CSS width:100%가 적용됩니다.
 * 또한 readonly 전환 / setContent 등으로 NodeView가 재렌더링될 때마다 이 계산이 반복됩니다.
 *
 * 이 함수는 트랜잭션 처리 완료 후(nextTick) 노드 속성에 저장된 width를
 * DOM에 강제 적용하여 CSS width:100%보다 우선시킵니다.
 */
/**
 * 컬럼 리사이즈 중 여부 플래그
 * column-resize-handle mousedown 시 true, mouseup 시 false.
 * applyTableWidths는 리사이즈 중엔 실행하지 않아야 Tiptap의
 * 실시간 리사이즈 피드백(table.style.width 동적 변경)과 충돌하지 않습니다.
 */
let _isResizingTable = false;

const applyTableWidths = () => {
    // 리사이즈 드래그 중에는 Tiptap이 table.style.width를 실시간으로 조정하므로
    // 저장된 width로 복원하면 표가 튀는 현상이 발생합니다.
    if (_isResizingTable) return;
    if (!editor.value || editor.value.isDestroyed) return;
    const view = editor.value.view;

    view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return;
        if (!node.attrs.width) return;

        try {
            // nodeDOM(pos)는 TableView의 dom 요소 (div.tableWrapper)를 반환
            const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
            if (!wrapperEl) return;

            const tableEl = (wrapperEl.tagName === 'TABLE'
                ? wrapperEl
                : wrapperEl.querySelector('table')) as HTMLTableElement | null;
            if (!tableEl) return;

            // updateColumns()가 비운 경우에도 저장된 너비로 복원
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

/**
 * 현재 커서가 속한 <table> DOM 요소를 반환합니다.
 */
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
 * 플로팅 툴바 위치 갱신
 * table 요소의 getBoundingClientRect()로 fixed 좌표를 계산합니다.
 * 표 상단에 공간이 있으면 위쪽, 없으면 표 상단에 오버레이합니다.
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
    // 위에 충분한 공간이 있으면 표 위에, 없으면 표 상단에 살짝 오버레이
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
 *
 * TableView의 updateColumns()는 모든 셀에 colwidth가 있을 때만
 * table.style.width를 설정(fixedWidth=true)합니다.
 * 이 값을 ProseMirror 스키마에 저장해야 editor.getHTML()이 width를 직렬화합니다.
 */
const syncTableWidths = () => {
    if (!editor.value || editor.value.isDestroyed) return;
    const view = editor.value.view;

    let changed = false;
    const tr = view.state.tr;

    // 문서의 모든 table 노드를 순회하여 DOM 너비 캡처
    view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return;

        try {
            // nodeDOM(pos)는 TableView의 dom 요소 (div.tableWrapper)를 반환
            const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
            if (!wrapperEl) return;

            // tableWrapper 안의 실제 <table> 요소
            const tableEl = (wrapperEl.tagName === 'TABLE'
                ? wrapperEl
                : wrapperEl.querySelector('table')) as HTMLTableElement | null;
            if (!tableEl) return;

            // table.style.width는 fixedWidth=true일 때만 Tiptap이 설정 (예: "500px")
            const domWidth = tableEl.style.width;
            if (!domWidth) return;

            // 변경이 있을 때만 트랜잭션 추가
            if (node.attrs.width !== domWidth) {
                tr.setNodeMarkup(pos, null, { ...node.attrs, width: domWidth });
                changed = true;
            }
        } catch {
            // pos → DOM 매핑 실패 시 무시
        }
    });

    if (changed) {
        // addToHistory: false → Undo 스택에 포함하지 않음 (리사이즈 undo와 분리)
        view.dispatch(tr.setMeta('addToHistory', false));
    }
};

/**
 * HTML 문자열 내 <table>의 <colgroup><col style="width:Xpx"> 값을
 * 각 셀의 colwidth 속성으로 주입합니다.
 *
 * [필요 이유]
 * Tiptap은 setContent() 후 updateColumns()를 즉시 실행하여
 * <col style="width:Xpx"> → <col style="min-width:25px"> 로 덮어씁니다.
 * 따라서 setContent 전에 colgroup 너비를 셀 colwidth 속성으로 변환해야
 * ProseMirror 노드에 너비 정보가 보존됩니다.
 * 이미 colwidth 속성이 있는 셀은 건드리지 않습니다.
 */
function injectColwidthsFromColgroup(html: string): string {
    // colgroup이 없으면 변환 불필요
    if (!html || !html.includes('<colgroup>')) return html;
    // 브라우저 DOMParser로 HTML 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('table').forEach((table) => {
        const cols = table.querySelectorAll('colgroup col');
        if (!cols.length) return;
        // <col style="width:Xpx"> 에서 너비 배열 추출
        const colWidths: number[] = [];
        cols.forEach((col) => {
            const w = Number.parseInt((col as HTMLElement).style.width, 10);
            colWidths.push(w > 0 ? w : 0);
        });
        // 유효한 너비가 하나도 없으면 건너뜀
        if (colWidths.every(w => w === 0)) return;
        // 모든 행의 셀에 colwidth 주입 (이미 있으면 유지)
        table.querySelectorAll('tr').forEach((row) => {
            let colIdx = 0;
            row.querySelectorAll('th, td').forEach((cell) => {
                const colspan = Number.parseInt((cell as HTMLElement).getAttribute('colspan') || '1', 10);
                if (!cell.hasAttribute('colwidth')) {
                    const widths: number[] = [];
                    for (let c = 0; c < colspan; c++) {
                        widths.push(colWidths[colIdx + c] || 0);
                    }
                    if (widths.some(w => w > 0)) {
                        cell.setAttribute('colwidth', widths.join(','));
                    }
                }
                colIdx += colspan;
            });
        });
    });
    return doc.body.innerHTML;
}

/**
 * 모든 표 셀에 colwidth를 보장하여 Tiptap이 고정폭(fixedWidth=true) 모드로 동작하게 합니다.
 *
 * [동작 원리]
 * Tiptap의 updateColumns()는 모든 셀에 colwidth가 있을 때만(fixedWidth=true)
 * table.style.width를 명시적 px 값으로 설정합니다.
 * colwidth가 없는 셀이 하나라도 있으면 fixedWidth=false → table.style.width를 비워
 * CSS의 width:100%가 적용되어 표가 컨테이너를 꽉 채우는 '반응형'처럼 보입니다.
 *
 * [호출 시점]
 * - 컬럼 추가·삭제, 행 추가, 셀 분리 등 구조 변경 직후 (신규 셀은 colwidth 없음)
 * - injectColwidthsFromColgroup 전처리로 처리되지 못한 레거시 셀 보완용
 */
const normalizeColwidths = () => {
    if (!editor.value || editor.value.isDestroyed) return;
    const view = editor.value.view;
    const tr = view.state.tr;
    let patched = false;

    view.state.doc.descendants((tableNode, tablePos) => {
        if (tableNode.type.name !== 'table') return;

        try {
            // ── 1. 첫 번째 행 기준으로 총 컬럼 수 산정 ──
            // Node.forEach는 return false를 지원하지 않으므로 플래그로 첫 행만 처리합니다.
            let totalCols = 0;
            let firstRowParsed = false;
            tableNode.forEach((row: any) => {
                if (!firstRowParsed && row.type.name === 'tableRow') {
                    firstRowParsed = true;
                    row.forEach((cell: any) => { totalCols += (cell.attrs.colspan || 1); });
                }
            });
            if (totalCols === 0) return;

            // ── 2. 컬럼별 참조 너비 구축 (colwidth가 모두 있는 첫 번째 행 사용) ──
            // 행 추가·열 추가 후 새 셀에만 colwidth가 없는 상황에서
            // 기존 열의 너비를 그대로 물려받아야 합니다.
            // 예) col0=150, col1=200, col2=293인 표에 행을 추가하면
            //     새 셀도 150, 200, 293을 부여해야 합니다.
            const referenceColWidths: number[] = new Array(totalCols).fill(0);
            let referenceFound = false;
            tableNode.forEach((row: any) => {
                if (referenceFound || row.type.name !== 'tableRow') return;
                const widths: number[] = [];
                let allValid = true;
                row.forEach((cell: any) => {
                    const cw = Array.isArray(cell.attrs.colwidth) && (cell.attrs.colwidth[0] ?? 0) > 0
                        ? cell.attrs.colwidth[0] as number : 0;
                    widths.push(cw);
                    if (cw <= 0) allValid = false;
                });
                if (allValid && widths.length === totalCols) {
                    widths.forEach((w, i) => { referenceColWidths[i] = w; });
                    referenceFound = true;
                }
            });

            // ── 3. 참조 행이 없으면 colgroup DOM → 균등 폴백 순서로 시도 ──
            // HTML 저장 시 colwidth는 셀 속성 대신 <colgroup><col style="width:Xpx"> 로만
            // 직렬화되는 경우가 있으므로, DOM의 <col> 요소에서 너비를 우선 읽습니다.
            // colgroup에서도 읽을 수 없는 경우(최초 삽입된 빈 표 등)에만 균등 폴백합니다.
            let fallbackColWidth = 0;
            if (!referenceFound) {
                const wrapperEl = view.nodeDOM(tablePos) as HTMLElement | null;
                const tableEl = (wrapperEl?.tagName === 'TABLE'
                    ? wrapperEl
                    : wrapperEl?.querySelector('table')) as HTMLTableElement | null;

                // 3-a. <colgroup> <col style="width:Xpx"> 에서 너비 읽기
                const colEls = tableEl?.querySelectorAll('colgroup col');
                if (colEls && colEls.length === totalCols) {
                    const colgroupWidths: number[] = [];
                    let allValid = true;
                    colEls.forEach((col) => {
                        const px = Number.parseInt((col as HTMLElement).style.width, 10);
                        if (px > 0) { colgroupWidths.push(px); }
                        else { allValid = false; }
                    });
                    if (allValid && colgroupWidths.length === totalCols) {
                        // colgroup 너비를 참조 너비로 사용 (균등 폴백 없이 원래 너비 유지)
                        colgroupWidths.forEach((w, i) => { referenceColWidths[i] = w; });
                        referenceFound = true;
                    }
                }

                // 3-b. colgroup에서도 읽지 못한 경우에만 균등 폴백
                if (!referenceFound) {
                    const tableWidth = tableEl?.offsetWidth || (view.dom as HTMLElement).offsetWidth || 600;
                    fallbackColWidth = Math.floor(tableWidth / totalCols);
                }
            }

            // ── 4. colwidth 없는 셀에만 컬럼별 너비 부여 ──
            // tableNode.forEach(row, rowOffset) + row.forEach(cell, cellOffset) 로
            // 절대 위치를 계산합니다: tablePos + 1(표 토큰) + rowOffset + 1(행 토큰) + cellOffset
            let tablePatched = false;
            tableNode.forEach((row: any, rowOffset: number) => {
                if (row.type.name !== 'tableRow') return;
                let colIdx = 0;
                row.forEach((cell: any, cellOffset: number) => {
                    if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') return;
                    const hasColwidth = Array.isArray(cell.attrs.colwidth)
                        && cell.attrs.colwidth.length > 0
                        && cell.attrs.colwidth.some((w: number) => w > 0);
                    if (!hasColwidth) {
                        const colspan = cell.attrs.colspan || 1;
                        // colspan > 1인 셀은 해당 범위의 참조 너비를 합산합니다.
                        const colWidths: number[] = [];
                        for (let c = 0; c < colspan; c++) {
                            colWidths.push(referenceFound
                                ? (referenceColWidths[colIdx + c] || fallbackColWidth)
                                : fallbackColWidth);
                        }
                        const absPos = tablePos + 1 + rowOffset + 1 + cellOffset;
                        tr.setNodeMarkup(absPos, null, { ...cell.attrs, colwidth: colWidths });
                        tablePatched = true;
                        patched = true;
                    }
                    colIdx += (cell.attrs.colspan || 1);
                });
            });

            // 새로 colwidth를 채운 표의 저장된 너비(node.attrs.width)를 초기화합니다.
            // updateColumns()가 새 colwidth 합산을 기준으로 너비를 재계산하도록 합니다.
            if (tablePatched && tableNode.attrs.width) {
                tr.setNodeMarkup(tablePos, null, { ...tableNode.attrs, width: null });
            }
        } catch { /* DOM 접근 실패 시 무시 */ }
    });

    if (patched) {
        view.dispatch(tr.setMeta('addToHistory', false));
    }
};

/**
 * 표 구조 변경 커맨드를 실행하고 즉시 colwidth를 정규화합니다.
 * 컬럼 추가, 행 추가, 셀 분리 등으로 생긴 새 셀에는 colwidth가 없어
 * fixedWidth=false → 반응형 동작이 되므로 nextTick에서 정규화합니다.
 */
const tableOp = (fn: () => void) => {
    fn();
    nextTick(normalizeColwidths);
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

onMounted(() => {
    _scrollEl = document.querySelector('main');
    _scrollEl?.addEventListener('scroll', updateTableFloat, { passive: true });
    // 리사이즈 시작/종료 감지 (capture로 Tiptap보다 먼저 실행)
    window.addEventListener('mousedown', _onTableResizeStart, true);
    // 리사이즈 종료: false 먼저(capture), syncTableWidths 이후(bubble)
    window.addEventListener('mouseup', _onTableResizeEnd, true);
    window.addEventListener('mouseup', syncTableWidths);
});

onUnmounted(() => {
    _scrollEl?.removeEventListener('scroll', updateTableFloat);
    window.removeEventListener('mousedown', _onTableResizeStart, true);
    window.removeEventListener('mouseup', _onTableResizeEnd, true);
    window.removeEventListener('mouseup', syncTableWidths);
});

// ── Excalidraw 다이어그램 삽입 ──
/** 신규 다이어그램 삽입 (빈 캔버스로 다이얼로그 열기) */
const insertExcalidraw = () => {
    openExcalidraw(null, (data) => {
        editor.value?.chain().focus().insertContent({
            type: 'excalidraw',
            attrs: {
                svgContent: data.svgContent,
                sceneData: data.sceneData
            }
        }).run();
    });
};

/** Excalidraw 다이얼로그에서 저장 버튼 클릭 */
const handleExcalidrawSave = async () => {
    const data = await excalidrawWrapperRef.value?.exportData();
    if (data) {
        confirmExcalidraw(data);
    }
};

/** 초기 장면 데이터 파싱 (ExcalidrawWrapper에 전달용) */
const parsedExcalidrawInitialData = computed(() => {
    return initialSceneData.value || null;
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

        <!-- ── 툴바 ── -->
        <div v-if="!readonly && editor"
            class="tiptap-toolbar border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2 flex flex-wrap gap-1">

            <!-- 제목 (Heading) -->
            <div class="toolbar-group flex gap-0.5">
                <button v-for="level in [1, 2, 3, 4]" :key="level" class="tbar-btn font-bold text-xs"
                    :class="{ 'tbar-btn-active': editor.isActive('heading', { level }) }"
                    @click="editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()"
                    :title="`제목 ${level}`">
                    H{{ level }}
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 텍스트 서식 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('bold') }"
                    @click="editor.chain().focus().toggleBold().run()" title="굵게 (Ctrl+B)">
                    <strong>B</strong>
                </button>
                <button class="tbar-btn italic" :class="{ 'tbar-btn-active': editor.isActive('italic') }"
                    @click="editor.chain().focus().toggleItalic().run()" title="기울임 (Ctrl+I)">
                    I
                </button>
                <button class="tbar-btn underline" :class="{ 'tbar-btn-active': editor.isActive('underline') }"
                    @click="editor.chain().focus().toggleUnderline().run()" title="밑줄 (Ctrl+U)">
                    U
                </button>
                <button class="tbar-btn line-through" :class="{ 'tbar-btn-active': editor.isActive('strike') }"
                    @click="editor.chain().focus().toggleStrike().run()" title="취소선">
                    S
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 위첨자/아래첨자 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn text-xs" :class="{ 'tbar-btn-active': editor.isActive('subscript') }"
                    @click="editor.chain().focus().toggleSubscript().run()" title="아래첨자">
                    X<sub>2</sub>
                </button>
                <button class="tbar-btn text-xs" :class="{ 'tbar-btn-active': editor.isActive('superscript') }"
                    @click="editor.chain().focus().toggleSuperscript().run()" title="위첨자">
                    X<sup>2</sup>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 글자/배경 색상 -->
            <div class="toolbar-group flex gap-0.5 items-center">
                <!-- 글자 색상 팔레트 -->
                <div class="relative">
                    <button class="tbar-btn flex flex-col items-center justify-center gap-0 min-w-[28px]"
                        title="글자 색상"
                        @click.stop="colorPaletteVisible = !colorPaletteVisible; highlightPaletteVisible = false">
                        <span class="text-[11px] font-bold leading-tight">A</span>
                        <span class="w-4 h-[3px] rounded-sm"
                            :style="{ backgroundColor: currentTextColor }"></span>
                    </button>
                    <!-- 글자색 팔레트 패널 -->
                    <div v-if="colorPaletteVisible"
                        class="absolute top-full left-0 z-50 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-2"
                        style="width: 190px;">
                        <button
                            class="w-full text-left text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 mb-1"
                            @click="removeTextColor">
                            <i class="pi pi-times text-[10px] mr-1"></i>색상 제거
                        </button>
                        <div class="grid gap-[2px]" style="grid-template-columns: repeat(8, 1fr);">
                            <template v-for="(row, ri) in COLOR_PALETTE" :key="ri">
                                <button v-for="color in row" :key="color"
                                    class="rounded-sm hover:scale-110 transition-transform border border-transparent hover:border-zinc-400 dark:hover:border-zinc-300"
                                    style="width: 20px; height: 20px;"
                                    :style="{ backgroundColor: color }"
                                    :title="color"
                                    @click="applyTextColor(color)" />
                            </template>
                        </div>
                    </div>
                </div>

                <!-- 배경(형광펜) 색상 팔레트 -->
                <div class="relative">
                    <button class="tbar-btn flex flex-col items-center justify-center gap-0 min-w-[28px]"
                        title="배경 색상"
                        :class="{ 'tbar-btn-active': editor.isActive('highlight') }"
                        @click.stop="highlightPaletteVisible = !highlightPaletteVisible; colorPaletteVisible = false">
                        <i class="pi pi-pen-to-square text-[11px] leading-tight"></i>
                        <span class="w-4 h-[3px] rounded-sm"
                            :style="{ backgroundColor: currentHighlightColor }"></span>
                    </button>
                    <!-- 배경색 팔레트 패널 -->
                    <div v-if="highlightPaletteVisible"
                        class="absolute top-full left-0 z-50 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-2"
                        style="width: 190px;">
                        <button
                            class="w-full text-left text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 mb-1"
                            @click="removeHighlightColor">
                            <i class="pi pi-times text-[10px] mr-1"></i>색상 제거
                        </button>
                        <div class="grid gap-[2px]" style="grid-template-columns: repeat(8, 1fr);">
                            <template v-for="(row, ri) in COLOR_PALETTE" :key="ri">
                                <button v-for="color in row" :key="color"
                                    class="rounded-sm hover:scale-110 transition-transform border border-transparent hover:border-zinc-400 dark:hover:border-zinc-300"
                                    style="width: 20px; height: 20px;"
                                    :style="{ backgroundColor: color }"
                                    :title="color"
                                    @click="applyHighlightColor(color)" />
                            </template>
                        </div>
                    </div>
                </div>

                <!-- 팔레트 외부 클릭 시 닫기 -->
                <Teleport to="body">
                    <div v-if="colorPaletteVisible || highlightPaletteVisible"
                        class="fixed inset-0 z-40"
                        @click="colorPaletteVisible = false; highlightPaletteVisible = false" />
                </Teleport>

                <!-- 모든 서식 지우기 -->
                <button class="tbar-btn" @click="editor.chain().focus().unsetAllMarks().clearNodes().run()"
                    title="서식 지우기">
                    <i class="pi pi-eraser text-xs"></i>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 텍스트 정렬 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive({ textAlign: 'left' }) }"
                    @click="editor.chain().focus().setTextAlign('left').run()" title="왼쪽 정렬">
                    <i class="pi pi-align-left text-xs"></i>
                </button>
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive({ textAlign: 'center' }) }"
                    @click="editor.chain().focus().setTextAlign('center').run()" title="가운데 정렬">
                    <i class="pi pi-align-center text-xs"></i>
                </button>
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive({ textAlign: 'right' }) }"
                    @click="editor.chain().focus().setTextAlign('right').run()" title="오른쪽 정렬">
                    <i class="pi pi-align-right text-xs"></i>
                </button>
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive({ textAlign: 'justify' }) }"
                    @click="editor.chain().focus().setTextAlign('justify').run()" title="양쪽 정렬">
                    <i class="pi pi-align-justify text-xs"></i>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 목록 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('bulletList') }"
                    @click="editor.chain().focus().toggleBulletList().run()" title="글머리 기호">
                    <i class="pi pi-list text-xs"></i>
                </button>
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('orderedList') }"
                    @click="editor.chain().focus().toggleOrderedList().run()" title="번호 목록">
                    <span class="text-xs font-bold">1.</span>
                </button>
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('taskList') }"
                    @click="editor.chain().focus().toggleTaskList().run()" title="체크리스트">
                    <i class="pi pi-check-square text-xs"></i>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 인용/코드 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('blockquote') }"
                    @click="editor.chain().focus().toggleBlockquote().run()" title="인용문">
                    <i class="pi pi-comment text-xs"></i>
                </button>
                <button class="tbar-btn font-mono text-xs" :class="{ 'tbar-btn-active': editor.isActive('code') }"
                    @click="editor.chain().focus().toggleCode().run()" title="인라인 코드">
                    &lt;/&gt;
                </button>
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('codeBlock') }"
                    @click="editor.chain().focus().toggleCodeBlock().run()" title="코드 블록">
                    <i class="pi pi-code text-xs"></i>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 삽입 -->
            <div class="toolbar-group flex gap-0.5">
                <!-- 링크 -->
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('link') }" @click="openLinkDialog"
                    title="링크 삽입">
                    <i class="pi pi-link text-xs"></i>
                </button>
                <!-- 링크 제거 -->
                <button v-if="editor.isActive('link')" class="tbar-btn"
                    @click="editor.chain().focus().unsetLink().run()" title="링크 제거">
                    <i class="pi pi-times text-xs"></i>
                </button>
                <!-- 이미지 -->
                <button class="tbar-btn" @click="openImageDialog" title="이미지 삽입">
                    <i class="pi pi-image text-xs"></i>
                </button>
                <!-- 표 -->
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('table') }" @click="insertTable"
                    title="표 삽입 (3×3)">
                    <i class="pi pi-table text-xs"></i>
                </button>
                <!-- 구분선 -->
                <button class="tbar-btn" @click="editor.chain().focus().setHorizontalRule().run()" title="구분선">
                    <span class="text-xs">—</span>
                </button>
            </div>

            <!-- 표 안에서는 표 관련 버튼 미표시 (플로팅 툴바로 대체) -->

            <div class="tbar-divider" />

            <!-- 폰트 패밀리 -->
            <select class="tbar-select" :value="selectedFont"
                @change="applyFontFamily(($event.target as HTMLSelectElement).value)" title="폰트 선택">
                <option v-for="f in fontOptions" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>

            <div class="tbar-divider" />

            <!-- 실행 취소 / 다시 실행 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()"
                    title="실행 취소 (Ctrl+Z)">
                    <i class="pi pi-undo text-xs"></i>
                </button>
                <button class="tbar-btn" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()"
                    title="다시 실행 (Ctrl+Y)">
                    <i class="pi pi-refresh text-xs"></i>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- Excalidraw 다이어그램 삽입 버튼 -->
            <button
                class="tbar-btn bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700 flex items-center gap-1.5 px-2"
                @click="insertExcalidraw" title="Excalidraw 다이어그램 삽입">
                <i class="pi pi-palette text-xs"></i>
                <span class="text-xs">다이어그램</span>
            </button>
        </div>

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

                <!-- 셀 배경색 -->
                <div class="tf-group">
                    <button class="tf-btn tf-color-btn" @mousedown.prevent="cellBgInputRef?.click()" title="셀 배경색">
                        <i class="pi pi-palette"></i>
                        <span class="tf-color-dot" :style="{ backgroundColor: currentCellBg }"></span>
                        <input ref="cellBgInputRef" type="color" :value="currentCellBg" class="tf-color-input"
                            @input="handleCellBgChange" />
                    </button>
                    <button class="tf-btn" @mousedown.prevent="clearCellBg" title="셀 배경색 제거">
                        <i class="pi pi-eraser"></i>
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

    <!-- ── 링크 삽입 다이얼로그 ── -->
    <Dialog v-model:visible="linkDialogVisible" modal header="링크 삽입" :style="{ width: '420px' }">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">URL</label>
                <InputText v-model="linkUrl" placeholder="https://example.com" @keydown.enter="applyLink" />
            </div>
            <div class="flex items-center gap-2">
                <Checkbox v-model="linkOpenInNewTab" :binary="true" inputId="linkNewTab" />
                <label for="linkNewTab" class="text-sm text-zinc-600 dark:text-zinc-400">새 탭에서 열기</label>
            </div>
        </div>
        <template #footer>
            <Button label="취소" severity="secondary" @click="linkDialogVisible = false" />
            <Button label="적용" icon="pi pi-check" @click="applyLink" />
        </template>
    </Dialog>

    <!-- ── 이미지 삽입 다이얼로그 ── -->
    <Dialog v-model:visible="imageDialogVisible" modal header="이미지 삽입" :style="{ width: '480px' }">
        <div class="flex flex-col gap-4">
            <!-- URL 탭 / 파일 탭 -->
            <div class="flex border-b border-zinc-200 dark:border-zinc-700">
                <button class="px-4 py-2 text-sm font-medium transition-colors"
                    :class="imageTab === 'url' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700'"
                    @click="imageTab = 'url'">URL</button>
                <button class="px-4 py-2 text-sm font-medium transition-colors"
                    :class="imageTab === 'file' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700'"
                    @click="imageTab = 'file'">파일 업로드</button>
            </div>

            <!-- URL 입력 -->
            <template v-if="imageTab === 'url'">
                <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">이미지 URL</label>
                    <InputText v-model="imageUrl" placeholder="https://example.com/image.png"
                        @keydown.enter="applyImageUrl" />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">대체 텍스트 (선택)</label>
                    <InputText v-model="imageAlt" placeholder="이미지 설명" />
                </div>
            </template>

            <!-- 파일 업로드 -->
            <template v-else>
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">이미지 파일 선택</label>

                    <!-- 업로드 진행 중 표시 -->
                    <div v-if="isUploadingImage"
                        class="flex items-center gap-2 text-sm text-zinc-500 py-4 justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <i class="pi pi-spin pi-spinner text-indigo-500"></i>
                        <span>이미지 업로드 중...</span>
                    </div>

                    <!-- 파일 선택 input -->
                    <input v-else ref="imageFileInput" type="file" accept="image/*"
                        class="block w-full text-sm text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                        @change="handleImageFileChange" />

                    <p class="text-xs text-zinc-400">
                        PNG, JPG, GIF, SVG 지원.
                        {{ props.imageUploadFn ? '파일은 서버에 업로드되며 URL로 참조됩니다.' : '파일은 base64로 변환되어 문서에 포함됩니다.' }}
                    </p>
                </div>
            </template>
        </div>
        <template #footer>
            <Button label="취소" severity="secondary" @click="imageDialogVisible = false" />
            <Button v-if="imageTab === 'url'" label="삽입" icon="pi pi-image" @click="applyImageUrl"
                :disabled="!imageUrl" />
        </template>
    </Dialog>

    <!-- ── Excalidraw 편집 다이얼로그 ── -->
    <!-- computed는 읽기전용이므로 v-model 대신 :visible + @update:visible 조합 사용 -->
    <Dialog :visible="isExcalidrawOpen" @update:visible="(val) => { if (!val) closeExcalidraw(); }" modal
        header="다이어그램 편집" :style="{ width: '92vw', maxWidth: '1400px' }"
        :contentStyle="{ padding: '0', height: 'calc(90vh - 120px)', display: 'flex', flexDirection: 'column' }"
        @hide="closeExcalidraw">
        <!-- ClientOnly에 class를 주면 실제 DOM 요소 없어 높이 상속이 안 되므로 div로 감쌈 -->
        <div class="flex-1 min-h-0 h-full">
            <ClientOnly>
                <ExcalidrawWrapper v-if="isExcalidrawOpen" ref="excalidrawWrapperRef"
                    :initialSceneData="parsedExcalidrawInitialData" class="block h-full" />
                <template #fallback>
                    <div class="flex items-center justify-center h-full text-zinc-400">
                        <div class="text-center">
                            <i class="pi pi-spin pi-spinner text-3xl mb-3 block"></i>
                            <span>Excalidraw 로딩 중...</span>
                        </div>
                    </div>
                </template>
            </ClientOnly>
        </div>
        <template #footer>
            <Button label="취소" severity="secondary" icon="pi pi-times" @click="closeExcalidraw" />
            <Button label="다이어그램 저장" icon="pi pi-check" @click="handleExcalidrawSave" />
        </template>
    </Dialog>
</template>

<style scoped>
/* ── 툴바 버튼 기본 스타일 ── */
.tbar-btn {
    @apply px-2 py-1.5 rounded text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed min-w-[28px] text-center;
}

.tbar-btn-active {
    @apply bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300;
}

.tbar-divider {
    @apply w-px bg-zinc-200 dark:bg-zinc-700 self-stretch mx-1;
}

.tbar-select {
    @apply text-sm text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 outline-none;
}

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

/* 체크리스트 */
:deep(.tiptap-content .ProseMirror ul[data-type="taskList"]) {
    list-style: none;
    padding-left: 0.5rem;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li) {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

:deep(.tiptap-content .ProseMirror ul[data-type="taskList"] li > label) {
    margin-top: 0.1rem;
    user-select: none;
    flex-shrink: 0;
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

/* color input — 투명하게 절대 위치 처리하여 버튼 클릭으로 트리거 */
.tf-color-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    border: none;
    padding: 0;
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
