/**
 * ============================================================================
 * [useExcalidrawDialog] Excalidraw 다이어그램 편집 다이얼로그 상태 관리
 * ============================================================================
 * 모듈 레벨 싱글톤 reactive 상태로 TiptapEditor와 ExcalidrawNodeView 간
 * 통신을 담당합니다.
 *
 * [흐름]
 *  1. ExcalidrawNodeView "편집" 클릭 → open() 호출 (updateAttributes 콜백 전달)
 *  2. TiptapEditor Dialog 표시 (isOpen = true)
 *  3. 사용자 편집 완료 후 저장 → confirm() 호출
 *  4. 콜백으로 nodeView의 updateAttributes 실행 → 노드 속성 갱신
 *  5. Dialog 닫힘
 * ============================================================================
 */

/** 저장 시 전달되는 다이어그램 데이터 */
interface ExcalidrawSaveData {
    /** SVG 문자열 (에디터 내 인라인 미리보기용) */
    svgContent: string;
    /** Excalidraw 장면 JSON 문자열 (인메모리 편집용, HTML에는 직렬화되지 않음) */
    sceneData: string | null;
    /** 업로드된 scene 파일의 flMngNo */
    attachmentId: string | null;
}

/**
 * 모듈 레벨 싱글톤 상태
 * 여러 컴포넌트에서 동일한 상태를 공유합니다.
 */
const _state = reactive({
    /** 다이얼로그 표시 여부 */
    isOpen: false,
    /** 편집 시 초기 장면 데이터 JSON 문자열 (신규 삽입 시 null) */
    initialSceneData: null as string | null,
    /** 저장 확인 시 호출할 콜백 */
    onSave: null as ((data: ExcalidrawSaveData) => void) | null
});

/**
 * Excalidraw 다이얼로그 상태 및 제어 함수 반환
 */
export const useExcalidrawDialog = () => {
    /**
     * 다이얼로그 열기
     * @param initialSceneData - 기존 장면 데이터 JSON (신규 삽입 시 null)
     * @param onSave - 저장 완료 시 호출할 콜백
     */
    const open = (
        initialSceneData: string | null,
        onSave: (data: ExcalidrawSaveData) => void
    ) => {
        _state.initialSceneData = initialSceneData;
        _state.onSave = onSave;
        _state.isOpen = true;
    };

    /** 다이얼로그 닫기 (취소) */
    const close = () => {
        _state.isOpen = false;
        _state.initialSceneData = null;
        _state.onSave = null;
    };

    /**
     * 저장 확인 (콜백 실행 후 다이얼로그 닫기)
     * @param data - 저장할 SVG + 장면 데이터
     */
    const confirm = (data: ExcalidrawSaveData) => {
        _state.onSave?.(data);
        close();
    };

    return {
        /** 다이얼로그 열림 여부 (읽기 전용) */
        isOpen: computed(() => _state.isOpen),
        /** 초기 장면 데이터 (읽기 전용) */
        initialSceneData: computed(() => _state.initialSceneData),
        open,
        close,
        confirm
    };
};
