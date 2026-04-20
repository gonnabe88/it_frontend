<!--
================================================================================
[components/AttachmentNodeView.vue] 첨부파일 인라인 NodeView (FR-05)
================================================================================
Tiptap attachment 커스텀 노드의 Vue 렌더러입니다.

[동작]
  - 편집 모드: 클릭 → 노드 선택, 좌측 그립으로 드래그 이동, 우측 핸들로 크기 조절
  - 조회 모드: 클릭 → 파일 다운로드
  - 더블클릭: 모드 무관 파일 다운로드

Design Ref: §5 — AttachmentNodeView.vue 설계
================================================================================
-->
<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';

const props = defineProps(nodeViewProps);

/** 파일 크기를 사람이 읽기 쉬운 형식으로 변환 */
const formatFileSize = (bytes: number | null): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** 파일 확장자 추출 및 파일명 처리 */
const fileName = computed(() => props.node.attrs.fileName || '첨부파일');
const extension = computed(() => {
    const parts = fileName.value.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() : '';
});

const fileNameOnly = computed(() => {
    const name = fileName.value;
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
});

/** 파일 확장자별 아이콘 매핑 */
const fileIcon = computed(() => {
    const ext = extension.value;
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'pi-image';
    if (ext === 'pdf') return 'pi-file-pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'pi-file-excel';
    if (['doc', 'docx', 'hwp', 'hwpx'].includes(ext)) return 'pi-file-word';
    if (['ppt', 'pptx'].includes(ext)) return 'pi-file-powerpoint';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'pi-file-archive';
    if (['txt', 'log'].includes(ext)) return 'pi-file-edit';
    return 'pi-file';
});

/** 파일 다운로드 실행 */
const doDownload = () => {
    const fileId = props.node.attrs.fileId;
    if (!fileId) return;
    const config = useRuntimeConfig();
    window.open(`${config.public.apiBase}/api/files/${fileId}/download`, '_blank');
};

/** 클릭 핸들러: 편집 모드에서는 아무것도 하지 않고, 조회 모드에서만 다운로드 */
const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!props.editor?.isEditable) {
        doDownload();
    }
};

/** 더블클릭 핸들러: 모드 무관 파일 다운로드 */
const onDblClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    doDownload();
};

/* ── 리사이징 (Resizing) 로직 ── */
const isResizing = ref(false);
const currentWidth = ref<number | null>(null);

/** 리사이즈 시작 */
const onResizeStart = (event: MouseEvent) => {
    if (!props.editor?.isEditable) return;
    event.preventDefault();
    event.stopPropagation();

    isResizing.value = true;

    // 현재 노드의 실제 렌더링 너비를 기준으로 시작
    const wrapperEl = (event.target as HTMLElement).closest('.attachment-node');
    const startWidth = wrapperEl ? wrapperEl.getBoundingClientRect().width : 300;
    const startX = event.clientX;

    const onMove = (moveEvent: MouseEvent) => {
        const diff = moveEvent.clientX - startX;
        const newWidth = Math.max(160, Math.round(startWidth + diff));
        currentWidth.value = newWidth;
        // 실시간으로 Tiptap 속성 업데이트 (에디터 데이터에 즉시 반영)
        props.updateAttributes({ width: newWidth });
    };

    const onUp = () => {
        isResizing.value = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
};

/** 동적 컨테이너 스타일 계산 */
const containerStyle = computed(() => {
    const { width, align } = props.node.attrs;
    const style: Record<string, string> = {
        height: '48px',
        minHeight: '48px',
        lineHeight: '48px',
        verticalAlign: 'middle',
    };

    // 너비 적용: Tiptap 속성에 저장된 값 또는 리사이징 중의 값
    const w = currentWidth.value ?? width;
    if (w) style.width = `${w}px`;

    // 정렬 로직
    if (align === 'center') {
        style.display = 'flex';
        style.justifyContent = 'center';
        style.float = 'none';
        style.margin = '16px auto';
    } else if (align === 'left') {
        style.display = 'inline-block';
        style.float = 'left';
        style.margin = '4px 20px 12px 0';
    } else {
        // default: right
        style.display = 'inline-block';
        style.float = 'right';
        style.margin = '4px 0 12px 20px';
    }

    return style;
});
</script>

<template>
    <NodeViewWrapper
        as="span"
        class="attachment-node"
        :class="{ 'is-selected': selected, 'is-resizing': isResizing }"
        :style="containerStyle"
        contenteditable="false"
    >
        <!-- 정렬 제어 툴바 (선택 시 노드 상단에 표시) -->
        <div v-if="editor?.isEditable && selected" class="alignment-toolbar">
            <button 
                class="align-btn" 
                :class="{ active: node.attrs.align === 'left' }" 
                title="왼쪽 정렬"
                @click.stop="updateAttributes({ align: 'left' })"
            >
                <i class="pi pi-align-left" />
            </button>
            <button 
                class="align-btn" 
                :class="{ active: node.attrs.align === 'center' }" 
                title="가운데 정렬"
                @click.stop="updateAttributes({ align: 'center' })"
            >
                <i class="pi pi-align-center" />
            </button>
            <button 
                class="align-btn" 
                :class="{ active: node.attrs.align === 'right' || !node.attrs.align }" 
                title="오른쪽 정렬"
                @click.stop="updateAttributes({ align: 'right' })"
            >
                <i class="pi pi-align-right" />
            </button>
        </div>

        <!-- 편집 모드: 좌측 드래그 핸들 -->
        <span
            v-if="editor?.isEditable"
            class="drag-handle"
            data-drag-handle
            title="드래그하여 이동"
        >
            <i class="pi pi-bars" />
        </span>

        <!-- 메인 콘텐츠 영역 -->
        <span
            class="attachment-content"
            :class="editor?.isEditable ? 'editable-mode' : 'view-mode'"
            @click="onClick"
            @dblclick="onDblClick"
        >
            <!-- 한글 아이콘 -->
            <template v-if="['hwp', 'hwpx'].includes(extension)">
                <img src="/assets/hwp.ico" width="24" height="24" class="object-contain" alt="HWP" >
            </template>
            <i v-else :class="['pi', fileIcon]" style="font-size: 24px;" />

            <span class="file-name">{{ fileNameOnly }}</span>

            <span v-if="node.attrs.fileSize" class="file-size">
                ({{ formatFileSize(node.attrs.fileSize) }})
            </span>

            <!-- 삭제 버튼 -->
            <button
                v-if="editor?.isEditable"
                class="delete-btn"
                title="첨부파일 제거"
                @click.stop.prevent="deleteNode()"
            >
                <i class="pi pi-times" />
            </button>
        </span>

        <!-- 편집 모드: 우측 리사이즈 핸들 -->
        <span
v-if="editor?.isEditable" class="resize-handle" title="드래그하여 크기 조절"
            @mousedown.stop.prevent="onResizeStart">
            <i class="pi pi-ellipsis-v" />
        </span>
    </NodeViewWrapper>
</template>

<style scoped>
/* ── 컨테이너 ── */
.attachment-node {
    user-select: none;
    position: relative;
    display: inline-flex !important;
    align-items: center;
    gap: 0;
    transition: transform 0.2s;
}

/* 정렬 툴바 (플로팅) */
.alignment-toolbar {
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    background: #1e1b4b; /* dark indigo */
    padding: 4px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 50;
    animation: fadeInDown 0.2s ease-out;
}

@keyframes fadeInDown {
    from { opacity: 0; transform: translate(-50%, 5px); }
    to { opacity: 1; transform: translate(-50%, 0); }
}

.align-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: none !important;
    background: transparent;
    color: #a5b4fc;
    cursor: pointer;
    transition: all 0.15s;
}
.align-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}
.align-btn.active {
    background: #6366f1; /* indigo-500 */
    color: white;
}

/* 편집 모드: 선택 시 강조 테두리 */
.attachment-node.is-selected {
    outline: 2px solid #6366f1;
    outline-offset: 4px;
    border-radius: 4px;
}

/* 리사이징 중 전체 커서 오버라이드 */
.attachment-node.is-resizing,
.attachment-node.is-resizing * {
    cursor: col-resize !important;
}

/* ── 좌측 드래그 핸들 ── */
.drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 48px;
    cursor: grab;
    color: white;
    background: #4338ca;
    /* indigo-700 좀 더 어두운 톤 */
    border-radius: 12px 0 0 12px;
    opacity: 0.7;
    transition: opacity 0.15s, background 0.15s;
    font-size: 12px;
    flex-shrink: 0;
}

.drag-handle:hover {
    opacity: 1;
    background: #3730a3;
}

.drag-handle:active {
    cursor: grabbing;
}

/* ── 메인 콘텐츠 ── */
.attachment-content {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 0 24px;
    height: 48px;
    font-size: 16px;
    font-weight: 700;
    color: white;
    background: #4338ca;
    /* indigo-700 */
    select-events: none;
    user-select: none;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    transition: background 0.15s;
}

/* 편집 모드: 드래그 핸들이 없는 경우의 모서리 처리 */
.attachment-content.view-mode {
    border-radius: 0 12px 12px 0;
    cursor: pointer;
    /* 좌측도 둥글게 (드래그 핸들 없으므로) */
    border-top-left-radius: 12px;
    border-bottom-left-radius: 0;
    /* 최종: rounded-tr-xl rounded-bl-xl (기존 디자인 유지) */
    border-radius: 0 12px 0 12px;
}

.attachment-content.view-mode:hover {
    background: #3730a3;
}

.attachment-content.editable-mode {
    cursor: default;
    /* 왼쪽 끝은 드래그 핸들이 이미 둥글게 처리하므로 직각 */
    border-radius: 0;
}

/* ── 파일명 ── */
.file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    border: none !important;
}

/* ── 파일 크기 ── */
.file-size {
    opacity: 0.7;
    font-size: 13px;
    flex-shrink: 0;
    border: none !important;
}

/* ── 삭제 버튼 ── */
.delete-btn {
    margin-left: 8px;
    opacity: 0.6;
    display: inline-flex;
    align-items: center;
    background: none;
    border: none !important;
    color: white;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    flex-shrink: 0;
    transition: opacity 0.15s;
}

.delete-btn:hover {
    opacity: 1;
}

/* ── 우측 리사이즈 핸들 ── */
.resize-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 48px;
    cursor: col-resize;
    color: white;
    background: #4338ca;
    border-radius: 0 12px 12px 0;
    opacity: 0.5;
    transition: opacity 0.15s, background 0.15s;
    font-size: 10px;
    flex-shrink: 0;
}

.resize-handle:hover {
    opacity: 1;
    background: #3730a3;
}

/* ── 에디터 내부 레이아웃 보정 ── */
:deep(.attachment-node) {
    height: 48px !important;
    min-height: 48px !important;
    line-height: normal !important;
}
</style>
