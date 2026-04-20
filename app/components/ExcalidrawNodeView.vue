<!--
================================================================================
[components/ExcalidrawNodeView.vue] Excalidraw Tiptap 노드 뷰
================================================================================
Tiptap 에디터 내에서 Excalidraw 다이어그램 노드를 시각적으로 렌더링합니다.

[렌더링 전략]
  - SVG를 v-html(DOMPurify)로 직접 렌더링하면 DOMPurify가 <use> 요소를 제거하여
    이미지 첨부가 있는 SVG의 경우 이미지가 표시되지 않습니다.
  - 대신 SVG를 Blob URL로 변환하여 <img src>로 렌더링합니다.
    <img>로 로드된 SVG는 스크립트가 샌드박스처리되므로 XSS 위험이 없고,
    <use> 요소의 로컬 fragment 참조(#id)도 정상 동작합니다.

[svgContent 부재 시 복원 전략]
  - 백엔드가 HTML 저장 시 <img src="data:image/svg+xml,...">의 data: URI를 제거하므로
    페이지 재로드 시 svgContent가 비어있을 수 있습니다.
  - 이 경우 sceneData(files 포함)로부터 클라이언트 측에서 SVG를 재생성합니다.
================================================================================
-->
<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';

/** Tiptap이 주입하는 노드 뷰 props (node, updateAttributes, deleteNode 등) */
const props = defineProps(nodeViewProps);

/** Excalidraw 다이얼로그 상태 및 제어 */
const { open: openExcalidrawDialog } = useExcalidrawDialog();

/**
 * SVG를 Blob URL로 변환하여 보관
 * <img src="blob:...">로 렌더링하므로 DOMPurify 없이도 안전하게 사용 가능합니다.
 * (SVG를 <img>로 로드하면 스크립트 실행이 샌드박스로 차단됩니다.)
 */
const displaySvgUrl = ref<string | null>(null);

/**
 * SVG 문자열로 Blob URL 생성
 * 기존 URL은 메모리 누수 방지를 위해 해제 후 새로 생성합니다.
 */
const setSvgUrl = (svg: string) => {
    if (displaySvgUrl.value) {
        URL.revokeObjectURL(displaySvgUrl.value);
        displaySvgUrl.value = null;
    }
    if (svg) {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        displaySvgUrl.value = URL.createObjectURL(blob);
    }
};

/**
 * sceneData에서 SVG 재생성
 * 백엔드가 <img src="data:image/svg+xml,..."> 의 src를 보안상 제거한 경우,
 * sceneData(files 포함)로부터 Excalidraw exportToSvg를 호출해 SVG를 복원합니다.
 */
const regenerateSvgFromSceneData = async () => {
    const sceneData = props.node.attrs.sceneData;
    if (!sceneData) return;

    try {
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        const parsed = JSON.parse(sceneData);
        const svgEl = await exportToSvg({
            elements: parsed.elements || [],
            appState: {
                ...(parsed.appState || {}),
                exportWithDarkMode: false,
                exportBackground: true
            },
            // files에 이미지 첨부 데이터 포함
            files: parsed.files || {}
        });
        setSvgUrl(new XMLSerializer().serializeToString(svgEl));
    } catch (e) {
        console.error('[ExcalidrawNodeView] sceneData에서 SVG 재생성 실패:', e);
    }
};

onMounted(() => {
    // svgContent가 있으면 바로 사용, 없으면 sceneData에서 재생성
    if (props.node.attrs.svgContent) {
        setSvgUrl(props.node.attrs.svgContent);
    } else {
        regenerateSvgFromSceneData();
    }
});

// 편집 후 svgContent가 갱신되면 Blob URL도 갱신
watch(() => props.node.attrs.svgContent, (newVal) => {
    if (newVal) setSvgUrl(newVal);
});

onBeforeUnmount(() => {
    // Blob URL 해제
    if (displaySvgUrl.value) {
        URL.revokeObjectURL(displaySvgUrl.value);
        displaySvgUrl.value = null;
    }
});

/**
 * 편집 버튼 클릭 핸들러
 * 현재 노드의 장면 데이터를 초기값으로 다이얼로그를 열고,
 * 저장 시 updateAttributes로 노드 속성을 갱신합니다.
 */
const onEdit = () => {
    openExcalidrawDialog(
        props.node.attrs.sceneData || null,
        (data) => {
            // Tiptap 노드 속성 업데이트 (SVG + 장면 데이터 교체)
            props.updateAttributes({
                svgContent: data.svgContent,
                sceneData: data.sceneData
            });
        }
    );
};

/**
 * 삭제 버튼 클릭 핸들러
 * Tiptap 트랜잭션으로 현재 노드를 에디터에서 제거합니다.
 */
const onDelete = () => {
    props.deleteNode();
};
</script>

<template>
    <!-- NodeViewWrapper: Tiptap 노드 뷰 루트 (드래그 핸들 지원) -->
    <NodeViewWrapper class="excalidraw-node-wrapper my-4" data-drag-handle>
        <!-- 다이어그램 컨테이너 (hover 시 오버레이 표시) -->
        <div
            class="relative group border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 cursor-default select-none">

            <!--
                SVG를 <img>로 렌더링 (Blob URL 방식)
                - v-html + DOMPurify 대신 Blob URL을 사용합니다.
                - DOMPurify가 SVG의 <use> 요소를 제거하여 이미지가 안 보이는 문제를 해결합니다.
                - SVG를 <img>로 로드하면 스크립트 실행이 차단되므로 XSS 위험이 없습니다.
            -->
            <div v-if="displaySvgUrl" class="excalidraw-preview p-3 overflow-auto">
                <img :src="displaySvgUrl" class="max-w-full block h-auto" alt="Excalidraw 다이어그램" >
            </div>

            <!-- SVG 없을 때 placeholder -->
            <div v-else class="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-600">
                <div class="text-center">
                    <i class="pi pi-image text-5xl mb-3 block"/>
                    <span class="text-sm">다이어그램 미리보기 없음</span>
                </div>
            </div>

            <!-- hover 오버레이: 편집 / 삭제 버튼 (에디터가 편집 가능 상태일 때만 표시) -->
            <div
v-if="props.editor.isEditable"
                class="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/20 transition-colors duration-200 flex items-start justify-end p-3 opacity-0 group-hover:opacity-100">
                <div class="flex gap-2 shadow-lg">
                    <!-- 편집 버튼 -->
                    <button
class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center gap-1.5"
                        @click.stop="onEdit">
                        <i class="pi pi-pencil text-xs"/>
                        편집
                    </button>
                    <!-- 삭제 버튼 -->
                    <button
class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors flex items-center gap-1.5"
                        @click.stop="onDelete">
                        <i class="pi pi-trash text-xs"/>
                        삭제
                    </button>
                </div>
            </div>

            <!-- 왼쪽 하단 레이블 -->
            <div
                class="absolute bottom-2 left-3 text-xs text-zinc-400 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Excalidraw 다이어그램
            </div>
        </div>
    </NodeViewWrapper>
</template>
