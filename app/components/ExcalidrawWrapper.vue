<!--
================================================================================
[components/ExcalidrawWrapper.vue] Excalidraw React 컴포넌트 Vue 래퍼
================================================================================
React 기반 Excalidraw 다이어그램 편집기를 Vue 3 / Nuxt 4 환경에서 사용하기
위한 클라이언트 전용 래퍼 컴포넌트입니다.

[동작 방식]
  - onMounted에서 React / ReactDOM / Excalidraw를 동적 임포트 (CSR 전용)
  - ReactDOM.createRoot()로 React 트리를 containerRef DOM에 마운트
  - onBeforeUnmount에서 React 루트 언마운트 (메모리 누수 방지)
  - exportData() 메서드를 expose하여 부모에서 저장 시 호출

[부모 컴포넌트 사용 방법]
  1. <ExcalidrawWrapper ref="wrapperRef" :initialSceneData="sceneJson" />
  2. 저장 버튼 핸들러에서 wrapperRef.value.exportData() 호출
================================================================================
-->
<script setup lang="ts">
/**
 * 편집 시 초기 장면 데이터 (JSON 문자열)
 * 신규 삽입 시 null 또는 undefined
 */
const props = defineProps<{
    initialSceneData?: string | null;
}>();

/** Excalidraw가 마운트될 컨테이너 DOM 참조 */
const containerRef = ref<HTMLDivElement | null>(null);

/** Excalidraw API 인스턴스 (장면 데이터 접근용) */
let excalidrawAPI: any = null;

/** React DOM 루트 (언마운트 정리용) */
let reactRoot: any = null;

/**
 * 현재 다이어그램을 SVG + JSON으로 내보내기
 * 부모 컴포넌트의 저장 핸들러에서 호출합니다.
 *
 * @returns { svgContent, sceneData } 또는 null (API 미준비 시)
 */
const exportData = async (): Promise<{ svgContent: string; sceneData: string } | null> => {
    if (!excalidrawAPI) {
        console.warn('[ExcalidrawWrapper] Excalidraw API가 아직 준비되지 않았습니다.');
        return null;
    }

    try {
        // exportToSvg 동적 임포트
        const { exportToSvg } = await import('@excalidraw/excalidraw');

        // 현재 장면 데이터 수집
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();

        // SVG 요소 생성 (다크 모드 제외, 배경 포함)
        const svgEl = await exportToSvg({
            elements,
            appState: {
                ...appState,
                exportWithDarkMode: false,
                exportBackground: true
            },
            files
        });

        // SVG 요소를 문자열로 직렬화
        const svgContent = new XMLSerializer().serializeToString(svgEl);

        // 장면 데이터 JSON 직렬화
        // collaborators는 Map이라 JSON.stringify 시 빠지므로 명시적으로 제외
        // files는 이미지 첨부 데이터(base64 dataURL)를 포함하므로 반드시 저장해야 합니다.
        const { collaborators: _collaborators, ...safeAppState } = appState;
        const sceneData = JSON.stringify({
            elements,
            appState: safeAppState,
            files
        });

        return { svgContent, sceneData };
    } catch (error) {
        console.error('[ExcalidrawWrapper] 내보내기 실패:', error);
        return null;
    }
};

// 부모 컴포넌트에서 exportData() 접근 허용
defineExpose({ exportData });

onMounted(async () => {
    // SSR 환경에서는 실행하지 않음
    if (typeof window === 'undefined' || !containerRef.value) return;

    try {
        // React 관련 패키지 동적 임포트 (클라이언트 전용)
        const React = (await import('react')).default;
        const { createRoot } = await import('react-dom/client');
        const { Excalidraw } = await import('@excalidraw/excalidraw');

        // 초기 장면 데이터 파싱
        let initialData: any = undefined;
        if (props.initialSceneData) {
            try {
                const parsed = JSON.parse(props.initialSceneData);
                initialData = {
                    elements: parsed.elements || [],
                    appState: {
                        ...(parsed.appState || {}),
                        // collaborators는 Excalidraw 내부에서 Map으로 관리되므로 빈 Map으로 초기화
                        collaborators: new Map()
                    },
                    // 이미지 첨부 파일 데이터 복원 (없으면 빈 객체)
                    files: parsed.files || {}
                };
            } catch {
                console.warn('[ExcalidrawWrapper] 초기 데이터 파싱 실패, 빈 캔버스로 시작합니다.');
            }
        }

        // React DOM 루트 생성 및 Excalidraw 렌더링
        reactRoot = createRoot(containerRef.value);
        reactRoot.render(
            React.createElement(Excalidraw, {
                excalidrawAPI: (api: any) => {
                    excalidrawAPI = api;
                    // Dialog 트랜지션 완료 후 캔버스 좌표 재보정
                    // PrimeVue Dialog의 CSS transform 애니메이션(~300ms) 이후
                    // resize 이벤트를 발생시켜 Excalidraw가 bounding rect를 재측정하게 합니다.
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 350);
                },
                initialData,
                // 자체 저장/내보내기 버튼 숨김 (툴바에서 처리)
                UIOptions: {
                    canvasActions: {
                        export: false,
                        saveAsImage: false
                    }
                }
            })
        );
    } catch (error) {
        console.error('[ExcalidrawWrapper] Excalidraw 초기화 실패:', error);
    }
});

/**
 * initialSceneData prop 변경 감지
 * Dialog에서 ExcalidrawWrapper가 이미 마운트된 상태에서 새로운 장면 데이터로
 * 편집 다이얼로그가 다시 열릴 때, excalidrawAPI를 통해 장면을 갱신합니다.
 */
watch(() => props.initialSceneData, (newSceneData) => {
    if (!excalidrawAPI) return;

    if (!newSceneData) {
        // 신규 다이어그램 삽입: 빈 캔버스로 초기화
        excalidrawAPI.resetScene();
        return;
    }

    try {
        const parsed = JSON.parse(newSceneData);
        // 기존 장면 데이터로 캔버스 복원
        excalidrawAPI.updateScene({
            elements: parsed.elements || [],
            appState: {
                ...(parsed.appState || {}),
                collaborators: new Map()
            }
        });
        // 이미지 첨부 파일 데이터 복원
        // updateScene은 files를 처리하지 않으므로 addFiles로 별도 로드합니다.
        if (parsed.files && Object.keys(parsed.files).length > 0) {
            excalidrawAPI.addFiles(Object.values(parsed.files));
        }
        // 도형이 보이도록 뷰포트를 자동 이동
        setTimeout(() => {
            excalidrawAPI?.scrollToContent();
        }, 100);
    } catch (e) {
        console.error('[ExcalidrawWrapper] 장면 데이터 로드 실패:', e);
    }
});

onBeforeUnmount(() => {
    // React 루트 언마운트로 메모리 누수 방지
    reactRoot?.unmount();
    reactRoot = null;
    excalidrawAPI = null;
});
</script>

<template>
    <!-- Excalidraw React 컴포넌트가 마운트될 컨테이너 -->
    <div ref="containerRef" class="w-full h-full" />
</template>
