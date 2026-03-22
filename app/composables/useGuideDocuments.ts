/**
 * ============================================================================
 * [useGuideDocuments] 가이드 문서 API Composable
 * ============================================================================
 * /api/guide-documents 엔드포인트 CRUD 처리를 담당합니다.
 *
 * [API 엔드포인트]
 *  GET    /api/guide-documents         - 전체 목록 조회
 *  GET    /api/guide-documents/{id}    - 단건 조회
 *  POST   /api/guide-documents         - 신규 생성
 *  PUT    /api/guide-documents/{id}    - 수정
 *  DELETE /api/guide-documents/{id}    - 삭제
 *
 * [파일 연동]
 *  orcDtt: '가이드문서'
 *  orcPkVl: docMngNo (예: GDOC-2026-0001)
 * ============================================================================
 */

/** 가이드 문서 응답 타입 */
export interface GuideDocument {
    docMngNo: string;    // 문서 관리번호 (PK, 예: GDOC-2026-0001)
    docNm: string;       // 문서명 (정보화사업 단계명과 매핑)
    docCone: string;     // 문서 내용 (Tiptap HTML)
    delYn: string;       // 삭제여부 (Y/N)
    fstEnrDtm: string;   // 최초 등록 일시
    fstEnrUsid: string;  // 최초 등록 사용자 ID
    lstChgDtm: string;   // 최종 변경 일시
    lstChgUsid: string;  // 최종 변경 사용자 ID
}

/** 가이드 문서 작성/수정 요청 타입 */
export interface GuideDocumentForm {
    docMngNo?: string;   // 신규 생성 시 자동 채번 (미입력 시 서버에서 생성)
    docNm: string;       // 문서명
    docCone: string;     // 내용 (Tiptap HTML)
}

/**
 * 가이드 문서 관리 Composable
 * @returns CRUD API 함수 객체
 */
export const useGuideDocuments = () => {
    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/guide-documents`;

    // POST/PUT/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * 가이드 문서 전체 목록 조회
     * @returns 문서 배열 (useApiFetch 반환값)
     */
    const fetchGuideDocuments = () => {
        return useApiFetch<GuideDocument[]>(API_BASE_URL);
    };

    /**
     * 가이드 문서 단건 조회
     * @param docMngNo - 문서 관리번호
     */
    const fetchGuideDocument = (docMngNo: string) => {
        return useApiFetch<GuideDocument>(`${API_BASE_URL}/${docMngNo}`);
    };

    /**
     * 가이드 문서 신규 생성
     * @param body - 생성 데이터 (GuideDocumentForm)
     * @returns 생성된 문서 관리번호 문자열 (예: 'GDOC-2026-0001')
     */
    const createGuideDocument = async (body: GuideDocumentForm): Promise<string> => {
        // $apiFetch 자체를 any로 캐스팅: Nuxt 라우트 타입 추론 시 스택 깊이 초과 오류 방지
        // URL as any로는 오버로드 평가를 막지 못하므로 함수 자체를 캐스팅합니다.
        return await ($apiFetch as any)(API_BASE_URL, {
            method: 'POST',
            body
        }) as string;
    };

    /**
     * 가이드 문서 수정
     * @param docMngNo - 문서 관리번호
     * @param body - 수정 데이터
     * @returns 수정된 문서 관리번호 문자열
     */
    const updateGuideDocument = async (docMngNo: string, body: Omit<GuideDocumentForm, 'docMngNo'>): Promise<string> => {
        // $apiFetch 자체를 any로 캐스팅: Nuxt 라우트 타입 스택 깊이 초과 오류 방지
        return await ($apiFetch as any)(`${API_BASE_URL}/${docMngNo}`, {
            method: 'PUT',
            body
        }) as string;
    };

    /**
     * 가이드 문서 삭제
     * @param docMngNo - 문서 관리번호
     */
    const deleteGuideDocument = async (docMngNo: string): Promise<void> => {
        // $apiFetch 자체를 any로 캐스팅: Nuxt 라우트 타입 스택 깊이 초과 오류 방지
        return await ($apiFetch as any)(`${API_BASE_URL}/${docMngNo}`, {
            method: 'DELETE'
        });
    };

    return {
        fetchGuideDocuments,
        fetchGuideDocument,
        createGuideDocument,
        updateGuideDocument,
        deleteGuideDocument
    };
};
