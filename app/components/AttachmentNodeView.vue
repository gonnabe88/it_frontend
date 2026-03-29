<!--
================================================================================
[components/AttachmentNodeView.vue] 첨부파일 인라인 NodeView (FR-05)
================================================================================
Tiptap attachment 커스텀 노드의 Vue 렌더러입니다.
라인 오른쪽 끝에 인디고 배경 박스(우측 상단·좌측 하단 라운드)로 표시됩니다.

[동작]
  - 클릭: 다운로드 (/api/files/{fileId}/download 새 탭 열기)
  - 편집 모드: X 버튼으로 노드 삭제
  - 조회 모드: 삭제 버튼 없음

Design Ref: §5 — AttachmentNodeView.vue 설계
================================================================================
-->
<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';

// nodeViewProps: Tiptap NodeView 표준 prop 인터페이스 (node, editor, deleteNode 등)
const props = defineProps(nodeViewProps);

/** 파일 크기를 사람이 읽기 쉬운 형식으로 변환 (예: 1.2 MB) */
const formatFileSize = (bytes: number | null): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * 파일 다운로드
 * Design Ref: §5.2 — /api/files/{flMngNo}/download 엔드포인트로 이동
 */
const handleDownload = () => {
    const fileId = props.node.attrs.fileId;
    if (!fileId) return;
    const config = useRuntimeConfig();
    window.open(`${config.public.apiBase}/api/files/${fileId}/download`, '_blank');
};
</script>

<template>
    <!--
        Design Ref: §5.1 — 인라인 span, contenteditable=false
        NodeViewWrapper: atom 노드이므로 as="span"으로 인라인 렌더링
    -->
    <NodeViewWrapper as="span" class="attachment-node" contenteditable="false">
        <span
            class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-white
                   cursor-pointer select-none rounded-tr-md rounded-bl-md
                   bg-indigo-700 hover:bg-indigo-800 transition-colors"
            @click="handleDownload"
        >
            <i class="pi pi-paperclip" style="font-size: 10px;" />
            <!-- 파일명: 최대 120px에서 말줄임 -->
            <span class="max-w-[120px] truncate">{{ node.attrs.fileName }}</span>
            <!-- 파일 크기 (있는 경우) -->
            <span v-if="node.attrs.fileSize" class="opacity-70 text-[10px]">
                ({{ formatFileSize(node.attrs.fileSize) }})
            </span>
            <!-- 편집 모드에서만 삭제(X) 버튼 표시 -->
            <button
                v-if="editor?.isEditable"
                class="ml-1 opacity-60 hover:opacity-100 leading-none flex items-center"
                title="첨부파일 제거"
                @click.stop="deleteNode()"
            >
                <i class="pi pi-times" style="font-size: 9px;" />
            </button>
        </span>
    </NodeViewWrapper>
</template>
