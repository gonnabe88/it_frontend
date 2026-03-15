/**
 * ============================================================================
 * [useFiles] 파일 관리 API Composable
 * ============================================================================
 * /api/files 엔드포인트 CRUD 처리를 담당합니다.
 *
 * [API 엔드포인트]
 *  GET    /api/files                  - 파일 목록 조회 (orcDtt + orcPkVl 필터)
 *  GET    /api/files/{flMngNo}        - 파일 단건 조회
 *  POST   /api/files                  - 파일 단건 업로드 (multipart/form-data)
 *  POST   /api/files/bulk             - 파일 다건 일괄 업로드
 *  PUT    /api/files/{flMngNo}        - 파일 메타데이터 수정 (orcPkVl 업데이트용)
 *  DELETE /api/files/{flMngNo}        - 파일 단건 삭제
 *  GET    /api/files/{flMngNo}/preview  - 이미지 미리보기 (inline)
 *  GET    /api/files/{flMngNo}/download - 파일 다운로드 (attachment)
 *
 * [파일 구분 (flDtt)]
 *  - '첨부파일': 기본정보 영역에서 첨부하는 일반 파일
 *  - '이미지'  : Tiptap 에디터 본문에 삽입되는 이미지
 * ============================================================================
 */

/** 파일 응답 타입 */
export interface FileRecord {
    flMngNo: string;     // 파일 관리번호 (PK)
    orcFlNm: string;     // 원본 파일명
    svrFlNm: string;     // 서버 저장 파일명
    flKpnPth: string;    // 파일 보관 경로
    flDtt: '첨부파일' | '이미지'; // 파일 구분
    orcPkVl: string;     // 원본 PK값 (연결된 도메인 레코드 기본키)
    orcDtt: string;      // 원본 구분 (연결된 도메인 종류)
    fstEnrDtm: string;   // 최초 등록 일시
    fstEnrUsid: string;  // 최초 등록 사용자 ID
    // 업로드(POST) 응답 시에만 포함되는 필드 (목록 조회 응답에는 없을 수 있음)
    previewUrl?: string;  // 이미지 미리보기 상대 경로 (예: /api/files/FL_xxx/preview)
    downloadUrl?: string; // 파일 다운로드 상대 경로 (예: /api/files/FL_xxx/download)
}

/** 파일 일괄 업로드 결과 타입 */
export interface BulkUploadResult {
    successList: FileRecord[];
    failList: string[];
}

/**
 * 파일 관리 Composable
 * @returns 파일 CRUD API 함수 및 URL 헬퍼
 */
export const useFiles = () => {
    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/api/files`;

    // POST/PUT/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * 파일 목록 조회
     * orcDtt(원본구분) + orcPkVl(원본PK값) 기준으로 필터링합니다.
     * @param orcDtt - 원본 구분 (예: '요구사항정의서')
     * @param orcPkVl - 원본 PK값 (예: 'DOC_20260315_0001')
     */
    const fetchFiles = (orcDtt: string, orcPkVl: string) => {
        return useApiFetch<FileRecord[]>(API_BASE, {
            query: { orcDtt, orcPkVl }
        });
    };

    /**
     * 파일 단건 업로드 (multipart/form-data)
     * @param file - 업로드할 File 객체
     * @param flDtt - 파일 구분 ('첨부파일' | '이미지')
     * @param orcPkVl - 원본 PK값 (신규 문서 작성 시 빈 문자열 허용)
     * @param orcDtt - 원본 구분
     */
    const uploadFile = async (
        file: File,
        flDtt: '첨부파일' | '이미지',
        orcPkVl: string,
        orcDtt: string
    ): Promise<FileRecord> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('flDtt', flDtt);
        formData.append('orcPkVl', orcPkVl);
        formData.append('orcDtt', orcDtt);

        return await $apiFetch<FileRecord>(API_BASE, {
            method: 'POST',
            body: formData
        });
    };

    /**
     * 파일 다건 일괄 업로드 (multipart/form-data)
     * @param files - 업로드할 File 배열
     * @param flDtt - 파일 구분
     * @param orcPkVl - 원본 PK값
     * @param orcDtt - 원본 구분
     */
    const uploadFilesBulk = async (
        files: File[],
        flDtt: '첨부파일' | '이미지',
        orcPkVl: string,
        orcDtt: string
    ): Promise<BulkUploadResult> => {
        const formData = new FormData();
        // 여러 파일을 'files' 키로 추가 (bulk API 스펙: files 필드명 사용)
        files.forEach(f => formData.append('files', f));
        formData.append('flDtt', flDtt);
        formData.append('orcPkVl', orcPkVl);
        formData.append('orcDtt', orcDtt);

        return await $apiFetch<BulkUploadResult>(`${API_BASE}/bulk`, {
            method: 'POST',
            body: formData
        });
    };

    /**
     * 파일 메타데이터 수정
     * 주로 신규 문서 저장 후 임시 업로드된 이미지의 orcPkVl을 실제 docMngNo로 업데이트할 때 사용합니다.
     * @param flMngNo - 파일 관리번호
     * @param data - 수정할 메타데이터
     */
    const updateFileMeta = async (
        flMngNo: string,
        data: { orcPkVl?: string; orcDtt?: string }
    ): Promise<void> => {
        await $apiFetch(`${API_BASE}/${flMngNo}`, {
            method: 'PUT',
            body: data
        });
    };

    /**
     * 파일 단건 삭제
     * @param flMngNo - 파일 관리번호
     */
    const deleteFile = async (flMngNo: string): Promise<void> => {
        await $apiFetch(`${API_BASE}/${flMngNo}`, {
            method: 'DELETE'
        });
    };

    /**
     * 이미지 미리보기 전체 URL 반환
     * Content-Disposition: inline 설정으로 브라우저에서 직접 렌더링됩니다.
     * Tiptap 에디터 이미지 src로 사용합니다.
     *
     * FileRecord가 전달된 경우 서버 응답의 previewUrl 필드를 우선 사용하고,
     * 없으면 flMngNo로 직접 구성합니다.
     * (브라우저 <img> 태그는 cross-origin 시 쿠키를 전송하지 않을 수 있으므로
     *  반드시 apiBase가 포함된 절대 URL로 반환합니다.)
     *
     * @param fileOrId - FileRecord 객체 또는 파일 관리번호(string)
     */
    const getPreviewUrl = (fileOrId: FileRecord | string): string => {
        if (typeof fileOrId === 'string') {
            return `${API_BASE}/${fileOrId}/preview`;
        }
        // 서버 응답의 previewUrl은 상대 경로이므로 apiBase를 붙여 절대 URL로 변환
        if (fileOrId.previewUrl) {
            return `${config.public.apiBase}${fileOrId.previewUrl}`;
        }
        return `${API_BASE}/${fileOrId.flMngNo}/preview`;
    };

    /**
     * 파일 다운로드 전체 URL 반환
     * Content-Disposition: attachment 설정으로 브라우저에서 자동 다운로드됩니다.
     *
     * @param fileOrId - FileRecord 객체 또는 파일 관리번호(string)
     */
    const getDownloadUrl = (fileOrId: FileRecord | string): string => {
        if (typeof fileOrId === 'string') {
            return `${API_BASE}/${fileOrId}/download`;
        }
        if (fileOrId.downloadUrl) {
            return `${config.public.apiBase}${fileOrId.downloadUrl}`;
        }
        return `${API_BASE}/${fileOrId.flMngNo}/download`;
    };

    return {
        fetchFiles,
        uploadFile,
        uploadFilesBulk,
        updateFileMeta,
        deleteFile,
        getPreviewUrl,
        getDownloadUrl
    };
};
