/**
 * ============================================================================
 * [useDocuments] 요구사항 정의서 API Composable
 * ============================================================================
 * /api/documents 엔드포인트 CRUD 처리를 담당합니다.
 *
 * [API 엔드포인트]
 *  GET    /api/documents                         - 전체 목록 조회
 *  GET    /api/documents/{id}                    - 단건 조회 (최신 버전)
 *  GET    /api/documents/{id}?version=0.01       - 특정 버전 조회
 *  GET    /api/documents/{id}/versions           - 버전 히스토리 조회
 *  POST   /api/documents                         - 신규 생성
 *  POST   /api/documents/{id}/versions           - 새 버전 생성
 *  PUT    /api/documents/{id}                    - 수정
 *  DELETE /api/documents/{id}                    - 전체 버전 삭제
 *  DELETE /api/documents/{id}?version=0.01       - 특정 버전 삭제
 * ============================================================================
 */

/** 요구사항 정의서 응답 타입 */
export interface RequirementDocument {
    docMngNo: string;    // 문서 관리번호 (PK)
    docVrs: number;      // 문서 버전 (예: 0.01, 0.02 ...)
    reqNm: string;       // 요구사항명
    reqCone: string;     // 요구사항 내용 (Tiptap HTML)
    reqDtt: string;      // 요청일자 (YYYY-MM-DD)
    bzDtt: string;       // 업무일자 (YYYY-MM-DD)
    fsgTlm: string;      // 마감일 (YYYY-MM-DD)
    delYn: string;       // 삭제여부 (Y/N)
    fstEnrDtm: string;   // 최초등록일시
    fstEnrUsid: string;  // 최초등록사용자ID
    fstEnrUsNm: string;  // 최초등록사용자명
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

/** 버전 히스토리 요약 타입 (버전 목록 조회용) */
export interface VersionSummary {
    docMngNo: string;    // 문서 관리번호
    docVrs: number;      // 문서 버전
    fstEnrDtm: string;   // 최초등록일시
    lstChgDtm: string;   // 최종변경일시
    delYn: string;       // 삭제여부 (Y/N)
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
     * 요구사항 정의서 단건 조회 (버전 지정 가능)
     * @param docMngNo - 문서 관리번호
     * @param version  - (선택) 조회할 문서 버전. 미지정 시 최신 버전 반환
     */
    const fetchDocument = (docMngNo: string, version?: number | Ref<number | undefined>) => {
        // Ref(ComputedRef 포함)이면 그대로 사용, 정적 값이면 ref로 감쌈
        const versionRef: Ref<number | undefined> = isRef(version) ? version : ref(version);
        // versionRef가 바뀔 때마다 query가 재계산되고 useFetch가 재요청됨
        const query = computed(() => {
            const v = versionRef.value;
            return v !== undefined ? { version: v } : {};
        });
        return useApiFetch<RequirementDocument>(
            `${API_BASE_URL}/${docMngNo}`,
            { query, watch: [versionRef] }
        );
    };

    /**
     * 요구사항 정의서 버전 히스토리 조회
     * @param docMngNo - 문서 관리번호
     * @returns 버전 요약 배열
     */
    const fetchVersionHistory = async (docMngNo: string): Promise<VersionSummary[]> => {
        // $apiFetch($fetch 래퍼)로 일회성 GET 호출 — 다른 imperative 함수와 패턴 통일
        return await $apiFetch<VersionSummary[]>(`${API_BASE_URL}/${docMngNo}/versions`);
    };

    /**
     * 새 버전 생성 (현재 문서를 기반으로 다음 버전을 만든다)
     * @param docMngNo - 문서 관리번호
     * @returns 생성된 버전 정보를 담은 문자열 (서버 응답 본문)
     */
    const createNewVersion = async (docMngNo: string): Promise<string> => {
        return await $apiFetch<string>(`${API_BASE_URL}/${docMngNo}/versions`, {
            method: 'POST'
        });
    };

    /**
     * 요구사항 정의서 신규 생성
     * @param body - 생성 데이터 (RequirementDocumentForm)
     */
    const createDocument = async (body: RequirementDocumentForm): Promise<string> => {
        return await $apiFetch<string>(API_BASE_URL, {
            method: 'POST',
            body
        });
    };

    /**
     * 요구사항 정의서 수정
     * @param docMngNo - 문서 관리번호
     * @param body - 수정 데이터
     */
    const updateDocument = async (docMngNo: string, body: Omit<RequirementDocumentForm, 'docMngNo'>): Promise<string> => {
        return await $apiFetch<string>(`${API_BASE_URL}/${docMngNo}`, {
            method: 'PUT',
            body
        });
    };

    /**
     * 요구사항 정의서 삭제
     * @param docMngNo - 문서 관리번호
     * @param version  - (선택) 삭제할 특정 버전. 미지정 시 해당 문서의 전체 버전 삭제
     */
    const deleteDocument = async (docMngNo: string, version?: number): Promise<void> => {
        // version 파라미터가 존재할 때만 query 객체를 포함시킨다
        const query = version !== undefined ? { version } : undefined;
        await $apiFetch<unknown>(`${API_BASE_URL}/${docMngNo}`, {
            method: 'DELETE',
            ...(query && { query })
        });
    };

    return {
        fetchDocuments,
        fetchDocument,
        fetchVersionHistory,
        createDocument,
        createNewVersion,
        updateDocument,
        deleteDocument
    };
};
