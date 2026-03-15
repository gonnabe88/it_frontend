/**
 * ============================================================================
 * [useDocuments] 요구사항 정의서 API Composable
 * ============================================================================
 * /api/documents 엔드포인트 CRUD 처리를 담당합니다.
 *
 * [API 엔드포인트]
 *  GET    /api/documents         - 전체 목록 조회
 *  GET    /api/documents/{id}    - 단건 조회
 *  POST   /api/documents         - 신규 생성
 *  PUT    /api/documents/{id}    - 수정
 *  DELETE /api/documents/{id}    - 삭제
 * ============================================================================
 */

/** 요구사항 정의서 응답 타입 */
export interface RequirementDocument {
    docMngNo: string;    // 문서 관리번호 (PK)
    reqNm: string;       // 요구사항명
    reqCone: string;     // 요구사항 내용 (Tiptap HTML)
    reqDtt: string;      // 요청일자 (YYYY-MM-DD)
    bzDtt: string;       // 업무일자 (YYYY-MM-DD)
    fsgTlm: string;      // 마감일 (YYYY-MM-DD)
    delYn: string;       // 삭제여부 (Y/N)
    fstEnrDtm: string;   // 최초등록일시
    fstEnrUsid: string;  // 최초등록사용자ID
    lstChgDtm: string;   // 최종변경일시
    lstChgUsid: string;  // 최종변경사용자ID
}

/** 요구사항 정의서 작성/수정 요청 타입 */
export interface RequirementDocumentForm {
    docMngNo?: string;   // 신규 생성 시 포함 가능
    reqNm: string;       // 요구사항명
    reqCone: string;     // 내용 (Tiptap HTML)
    reqDtt: string;      // 요청일자
    bzDtt: string;       // 업무일자
    fsgTlm: string;      // 마감일
}

/**
 * 요구사항 정의서 관리 Composable
 * @returns CRUD API 함수 객체
 */
export const useDocuments = () => {
    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/documents`;

    // POST/PUT/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * 요구사항 정의서 전체 목록 조회
     * @returns 문서 배열 (useApiFetch 반환값)
     */
    const fetchDocuments = () => {
        return useApiFetch<RequirementDocument[]>(API_BASE_URL);
    };

    /**
     * 요구사항 정의서 단건 조회
     * @param docMngNo - 문서 관리번호
     */
    const fetchDocument = (docMngNo: string) => {
        return useApiFetch<RequirementDocument>(`${API_BASE_URL}/${docMngNo}`);
    };

    /**
     * 요구사항 정의서 신규 생성
     * @param body - 생성 데이터 (RequirementDocumentForm)
     */
    const createDocument = async (body: RequirementDocumentForm) => {
        return await $apiFetch<RequirementDocument>(API_BASE_URL, {
            method: 'POST',
            body
        });
    };

    /**
     * 요구사항 정의서 수정
     * @param docMngNo - 문서 관리번호
     * @param body - 수정 데이터
     */
    const updateDocument = async (docMngNo: string, body: Omit<RequirementDocumentForm, 'docMngNo'>) => {
        return await $apiFetch<RequirementDocument>(`${API_BASE_URL}/${docMngNo}`, {
            method: 'PUT',
            body
        });
    };

    /**
     * 요구사항 정의서 삭제
     * @param docMngNo - 문서 관리번호
     */
    const deleteDocument = async (docMngNo: string) => {
        return await $apiFetch(`${API_BASE_URL}/${docMngNo}`, {
            method: 'DELETE'
        });
    };

    return {
        fetchDocuments,
        fetchDocument,
        createDocument,
        updateDocument,
        deleteDocument
    };
};
