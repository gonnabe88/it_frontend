<!--
================================================================================
[components/TiptapToolbar.vue] TiptapEditor 전용 툴바 컴포넌트
================================================================================
TiptapEditor.vue로부터 분리된 툴바 UI 컴포넌트입니다.
텍스트 서식·정렬·목록·삽입 등 모든 툴바 버튼과 다이얼로그를 포함합니다.

Design Ref: §4 — TiptapToolbar 분리 (module-2 리팩토링)

[포함 내용]
  - 상단 툴바: 제목/서식/색상/정렬/목록/삽입 버튼
  - 링크 삽입 다이얼로그
  - 이미지 삽입 다이얼로그
  - Excalidraw 다이어그램 삽입 다이얼로그

[포함하지 않는 내용 → TiptapEditor.vue에 유지]
  - 표 플로팅 툴바 (normalizeColwidths와 강하게 결합됨)
  - 상태바 (글자수/단어수)
================================================================================
-->
<script setup lang="ts">
import type { Editor } from '@tiptap/core';

const props = defineProps<{
    /** Tiptap 에디터 인스턴스 */
    editor: Editor | null;
    /**
     * 이미지 파일 업로드 핸들러 (선택)
     * 제공 시: 파일을 API로 업로드하고 반환된 URL을 에디터에 삽입합니다.
     */
    imageUploadFn?: (file: File) => Promise<string>;
}>();

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
    ['#000000', '#1F2937', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#FFFFFF'],
    ['#7F1D1D', '#B91C1C', '#EF4444', '#F97316', '#FB923C', '#FCA5A5', '#FED7AA', '#FFF7ED'],
    ['#78350F', '#B45309', '#D97706', '#EAB308', '#FCD34D', '#FDE68A', '#FEF08A', '#FEFCE8'],
    ['#14532D', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7'],
    ['#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
    ['#4C1D95', '#6D28D9', '#8B5CF6', '#A855F7', '#EC4899', '#F472B6', '#F9A8D4', '#FCE7F3'],
];

/** 현재 커서 위치의 글자 색상 (버튼 미리보기용) */
const currentTextColor = computed(() =>
    props.editor?.getAttributes('textStyle')?.color || '#000000'
);

/** 현재 커서 위치의 배경 하이라이트 색상 (버튼 미리보기용) */
const currentHighlightColor = computed(() =>
    props.editor?.getAttributes('highlight')?.color || '#FDE047'
);

/** 글자 색상 적용 */
const applyTextColor = (color: string) => {
    props.editor?.chain().focus().setColor(color).run();
    colorPaletteVisible.value = false;
};

/** 글자 색상 제거 */
const removeTextColor = () => {
    props.editor?.chain().focus().unsetColor().run();
    colorPaletteVisible.value = false;
};

/** 배경(형광펜) 색상 적용 */
const applyHighlightColor = (color: string) => {
    props.editor?.chain().focus().setHighlight({ color }).run();
    highlightPaletteVisible.value = false;
};

/** 배경(형광펜) 색상 제거 */
const removeHighlightColor = () => {
    props.editor?.chain().focus().unsetHighlight().run();
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
        props.editor?.chain().focus().unsetFontFamily().run();
    } else {
        props.editor?.chain().focus().setFontFamily(font).run();
    }
    selectedFont.value = font;
};

// ── 글자 크기 (FR-04) ──
const fontSizeOptions = [
    { label: '기본', value: '' },
    { label: '8px', value: '8px' },
    { label: '10px', value: '10px' },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '28px', value: '28px' },
    { label: '32px', value: '32px' },
];
const selectedFontSize = ref('');

/** 글자 크기 적용 (빈 값이면 fontSize 마크 제거) */
const applyFontSize = (size: string) => {
    if (!size) {
        props.editor?.chain().focus().unsetFontSize().run();
    } else {
        props.editor?.chain().focus().setFontSize(size).run();
    }
    selectedFontSize.value = size;
};

// ── 표 삽입 ──
/**
 * 3×3 표 삽입 (헤더 행 포함)
 * 삽입 후 모든 셀에 균등 colwidth를 설정합니다.
 * (표 플로팅 툴바의 구조 변경은 TiptapEditor.vue의 tableOp에서 처리)
 */
const insertTable = () => {
    const COLS = 3;
    const TABLE_WIDTH = 450;
    const colWidth = Math.floor(TABLE_WIDTH / COLS);
    props.editor?.chain().focus().insertTable({ rows: 3, cols: COLS, withHeaderRow: true }).run();

    nextTick(() => {
        if (!props.editor) return;
        const view = props.editor.view;

        const { selection } = view.state;
        const $anchor = selection.$anchor;
        const tr = view.state.tr;
        let patched = false;

        for (let depth = $anchor.depth; depth >= 0; depth--) {
            const node = $anchor.node(depth);
            if (node.type.name !== 'table') continue;

            const tableStart = $anchor.start(depth);
            node.descendants((cell: any, pos: number) => {
                if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') return;
                if (cell.attrs.colwidth) return;
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

// ── 링크 다이얼로그 ──
const linkDialogVisible = ref(false);
const linkUrl = ref('');
const linkOpenInNewTab = ref(true);

/** 링크 다이얼로그 열기 (선택된 텍스트에 기존 링크 URL 미리 채움) */
const openLinkDialog = () => {
    const existing = props.editor?.getAttributes('link');
    linkUrl.value = existing?.href || '';
    linkOpenInNewTab.value = existing?.target === '_blank';
    linkDialogVisible.value = true;
};

/** 링크 적용 (URL이 없으면 링크 제거) */
const applyLink = () => {
    if (!props.editor) return;
    if (linkUrl.value) {
        props.editor.chain().focus().setLink({
            href: linkUrl.value,
            target: linkOpenInNewTab.value ? '_blank' : null
        }).run();
    } else {
        props.editor.chain().focus().unsetLink().run();
    }
    linkDialogVisible.value = false;
};

// ── 이미지 다이얼로그 ──
const imageDialogVisible = ref(false);
const imageUrl = ref('');
const imageAlt = ref('');
const imageFileInput = ref<HTMLInputElement | null>(null);
const imageTab = ref<'url' | 'file'>('url');
/** 이미지 업로드 진행 중 여부 */
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
    if (!props.editor || !imageUrl.value) return;
    props.editor.chain().focus().setImage({ src: imageUrl.value, alt: imageAlt.value }).run();
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
        isUploadingImage.value = true;
        try {
            const src = await props.imageUploadFn(file);
            props.editor?.chain().focus().setImage({ src, alt: file.name }).run();
            imageDialogVisible.value = false;
        } catch (e) {
            console.error('[TiptapToolbar] 이미지 업로드 실패:', e);
        } finally {
            isUploadingImage.value = false;
            input.value = '';
        }
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            props.editor?.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
            imageDialogVisible.value = false;
        };
        reader.readAsDataURL(file);
    }
};

// ── Excalidraw 다이어그램 삽입 ──
const { isOpen: isExcalidrawOpen, initialSceneData, open: openExcalidraw, close: closeExcalidraw, confirm: confirmExcalidraw } = useExcalidrawDialog();
const excalidrawWrapperRef = ref<any>(null);

/** 신규 다이어그램 삽입 (빈 캔버스로 다이얼로그 열기) */
const insertExcalidraw = () => {
    openExcalidraw(null, (data) => {
        props.editor?.chain().focus().insertContent({
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
</script>

<template>
    <template v-if="editor">
        <!-- ── 상단 툴바 ── -->
        <div
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
                        <span class="w-4 h-[3px] rounded-sm" :style="{ backgroundColor: currentTextColor }"></span>
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
                                    style="width: 20px; height: 20px;" :style="{ backgroundColor: color }"
                                    :title="color" @click="applyTextColor(color)" />
                            </template>
                        </div>
                    </div>
                </div>

                <!-- 배경(형광펜) 색상 팔레트 -->
                <div class="relative">
                    <button class="tbar-btn flex flex-col items-center justify-center gap-0 min-w-[28px]"
                        title="배경 색상" :class="{ 'tbar-btn-active': editor.isActive('highlight') }"
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
                                    style="width: 20px; height: 20px;" :style="{ backgroundColor: color }"
                                    :title="color" @click="applyHighlightColor(color)" />
                            </template>
                        </div>
                    </div>
                </div>

                <!-- 팔레트 외부 클릭 시 닫기 -->
                <Teleport to="body">
                    <div v-if="colorPaletteVisible || highlightPaletteVisible" class="fixed inset-0 z-40"
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
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('link') }"
                    @click="openLinkDialog" title="링크 삽입">
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
                <!-- 표 삽입 (플로팅 툴바로 행/열 조작) -->
                <button class="tbar-btn" :class="{ 'tbar-btn-active': editor.isActive('table') }"
                    @click="insertTable" title="표 삽입">
                    <i class="pi pi-table text-xs"></i>
                </button>
                <!-- 구분선 -->
                <button class="tbar-btn" @click="editor.chain().focus().setHorizontalRule().run()" title="구분선">
                    <span class="text-xs">—</span>
                </button>
            </div>

            <div class="tbar-divider" />

            <!-- 폰트 패밀리 -->
            <select class="tbar-select" :value="selectedFont"
                @change="applyFontFamily(($event.target as HTMLSelectElement).value)" title="폰트 선택">
                <option v-for="f in fontOptions" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>

            <!-- 글자 크기 (FR-04) -->
            <select class="tbar-select" :value="selectedFontSize"
                @change="applyFontSize(($event.target as HTMLSelectElement).value)" title="글자 크기">
                <option v-for="s in fontSizeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>

            <div class="tbar-divider" />

            <!-- 실행 취소 / 다시 실행 -->
            <div class="toolbar-group flex gap-0.5">
                <button class="tbar-btn" @click="editor.chain().focus().undo().run()"
                    :disabled="!editor.can().undo()" title="실행 취소 (Ctrl+Z)">
                    <i class="pi pi-undo text-xs"></i>
                </button>
                <button class="tbar-btn" @click="editor.chain().focus().redo().run()"
                    :disabled="!editor.can().redo()" title="다시 실행 (Ctrl+Y)">
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
                <div class="flex border-b border-zinc-200 dark:border-zinc-700">
                    <button class="px-4 py-2 text-sm font-medium transition-colors"
                        :class="imageTab === 'url' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700'"
                        @click="imageTab = 'url'">URL</button>
                    <button class="px-4 py-2 text-sm font-medium transition-colors"
                        :class="imageTab === 'file' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700'"
                        @click="imageTab = 'file'">파일 업로드</button>
                </div>

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

                <template v-else>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">이미지 파일 선택</label>
                        <div v-if="isUploadingImage"
                            class="flex items-center gap-2 text-sm text-zinc-500 py-4 justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                            <i class="pi pi-spin pi-spinner text-indigo-500"></i>
                            <span>이미지 업로드 중...</span>
                        </div>
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
        <Dialog :visible="isExcalidrawOpen" @update:visible="(val) => { if (!val) closeExcalidraw(); }" modal
            header="다이어그램 편집" :style="{ width: '92vw', maxWidth: '1400px' }"
            :contentStyle="{ padding: '0', height: 'calc(90vh - 120px)', display: 'flex', flexDirection: 'column' }"
            @hide="closeExcalidraw">
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
</style>
