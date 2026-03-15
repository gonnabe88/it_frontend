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
import { Node, mergeAttributes } from '@tiptap/core';
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
                    const num = parseInt(w);
                    return isNaN(num) ? null : num;
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
        return VueNodeViewRenderer(ResizableImageNodeViewComponent);
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
const ExcalidrawExtension = Node.create({
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
        return VueNodeViewRenderer(ExcalidrawNodeViewComponent);
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
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        CharacterCount,
        Placeholder.configure({ placeholder: props.placeholder || '내용을 입력하세요...' }),
        FontFamily,
        Subscript,
        Superscript,
        ExcalidrawExtension
    ],
    content: props.modelValue || '',
    editable: !props.readonly,
    onCreate: ({ editor }) => {
        // 초기 로드 시 한 번 TOC 추출
        extractTOC(editor);
    },
    onUpdate: ({ editor }) => {
        // 내용 변경 시 부모에 HTML 및 TOC 전달
        emit('update:modelValue', editor.getHTML());

        // TOC 모델 추출
        extractTOC(editor);
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
watch(() => props.modelValue, (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
        editor.value.commands.setContent(val || '', { emitUpdate: false });
    }
});

// readonly 변경 시 에디터 편집 가능 여부 갱신
watch(() => props.readonly, (val) => {
    editor.value?.setEditable(!val);
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

// ── 색상 picker ──
const colorInputRef = ref<HTMLInputElement | null>(null);
const highlightInputRef = ref<HTMLInputElement | null>(null);

/** 글자 색상 변경 */
const handleColorChange = (event: Event) => {
    editor.value?.chain().focus().setColor((event.target as HTMLInputElement).value).run();
};

/** 형광펜 색상 변경 */
const handleHighlightChange = (event: Event) => {
    editor.value?.chain().focus().setHighlight({ color: (event.target as HTMLInputElement).value }).run();
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
/** 3x3 표 삽입 (헤더 행 포함) */
const insertTable = () => {
    editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
};

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
                <!-- 글자 색상 -->
                <button class="tbar-btn relative overflow-hidden" title="글자 색상" @click="colorInputRef?.click()">
                    <span class="text-xs font-bold">A</span>
                    <input ref="colorInputRef" type="color"
                        class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" @input="handleColorChange" />
                </button>
                <!-- 배경 형광펜 -->
                <button class="tbar-btn relative overflow-hidden" title="형광펜"
                    :class="{ 'tbar-btn-active': editor.isActive('highlight') }" @click="highlightInputRef?.click()">
                    <i class="pi pi-bookmark text-xs"></i>
                    <input ref="highlightInputRef" type="color"
                        class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        @input="handleHighlightChange" />
                </button>
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

            <!-- 표 조작 버튼 (표 안에 커서가 있을 때만 표시) -->
            <template v-if="editor.isActive('table')">
                <div class="tbar-divider" />
                <div class="toolbar-group flex gap-0.5">
                    <button class="tbar-btn text-xs" @click="editor.chain().focus().addRowAfter().run()"
                        title="아래 행 추가">행+</button>
                    <button class="tbar-btn text-xs" @click="editor.chain().focus().deleteRow().run()"
                        title="행 삭제">행-</button>
                    <button class="tbar-btn text-xs" @click="editor.chain().focus().addColumnAfter().run()"
                        title="오른쪽 열 추가">열+</button>
                    <button class="tbar-btn text-xs" @click="editor.chain().focus().deleteColumn().run()"
                        title="열 삭제">열-</button>
                    <button class="tbar-btn text-xs" @click="editor.chain().focus().mergeCells().run()"
                        title="셀 병합">병합</button>
                    <button class="tbar-btn text-xs" @click="editor.chain().focus().splitCell().run()"
                        title="셀 분리">분리</button>
                    <button class="tbar-btn text-xs text-red-500" @click="editor.chain().focus().deleteTable().run()"
                        title="표 삭제">표삭제</button>
                </div>
            </template>

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

/* 표 */
:deep(.tiptap-content .ProseMirror table) {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 1rem 0;
    overflow: hidden;
}

:deep(.tiptap-content .ProseMirror td),
:deep(.tiptap-content .ProseMirror th) {
    @apply border border-zinc-300 dark:border-zinc-600 p-2 align-top;
    position: relative;
    min-width: 80px;
}

:deep(.tiptap-content .ProseMirror th) {
    @apply bg-zinc-100 dark:bg-zinc-800 font-semibold;
}

/* 선택된 셀 하이라이트 */
:deep(.tiptap-content .ProseMirror .selectedCell::after) {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(99, 102, 241, 0.12);
    pointer-events: none;
    z-index: 2;
}

/* 컬럼 리사이즈 핸들 */
:deep(.tiptap-content .ProseMirror .column-resize-handle) {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #6366f1;
    cursor: col-resize;
    z-index: 20;
}

/* placeholder */
:deep(.tiptap-content .ProseMirror .is-empty::before) {
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
</style>
