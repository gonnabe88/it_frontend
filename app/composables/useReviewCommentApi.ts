/**
 * ============================================================================
 * [useReviewCommentApi] 사전협의 코멘트 API Composable
 * ============================================================================
 * /api/documents/{docMngNo}/review-comments 엔드포인트를 호출하여
 * 사전협의 코멘트(인라인/전반)를 서버와 동기화합니다.
 *
 * [API 엔드포인트]
 *  GET    /api/documents/{docMngNo}/review-comments?docVrs={n}
 *         - 특정 버전의 코멘트 목록 조회
 *  POST   /api/documents/{docMngNo}/review-comments
 *         - 신규 코멘트 생성 (인라인 or 전반)
 *  PATCH  /api/documents/{docMngNo}/review-comments/{ivgSno}/resolve
 *         - 코멘트 해결 처리 (rslvYn = 'Y')
 *
 * [서버 ↔ 클라이언트 타입 매핑]
 *  서버(ApiComment)는 DB 스키마(BRIVGM)에 맞춘 코드 값을 사용하고,
 *  클라이언트(ReviewComment)는 UI 친화적인 필드 명을 사용합니다.
 *  내부 toReviewComment() 매퍼가 변환을 담당합니다.
 *
 * [사용처]
 *  - stores/review.ts : 세션 로드/코멘트 CRUD 시 서버 연동
 * ============================================================================
 */
import type { ReviewComment } from '~/types/review';

/**
 * 서버 응답 코멘트 타입 (BRIVGM 테이블 스키마 기반)
 * - ivgTp: 'I'(인라인) | 'G'(전반)
 * - rslvYn: 'Y'(해결됨) | 'N'(미해결)
 */
interface ApiComment {
    /** 협의 일련번호 (PK) */
    ivgSno: string;
    /** 문서 관리번호 */
    docMngNo: string;
    /** 문서 버전 */
    docVrs: number;
    /** 협의 유형 (I: 인라인, G: 전반) */
    ivgTp: 'I' | 'G';
    /** 협의 내용 (코멘트 본문) */
    ivgCone: string;
    /** Tiptap Mark 식별자 (인라인 코멘트 전용) */
    markId: string | null;
    /** 인용 원문 텍스트 (인라인 코멘트 전용) */
    qtdCone: string | null;
    /** 해결 여부 (Y/N) */
    rslvYn: 'Y' | 'N';
    /** 작성자 사번 */
    authorEno: string;
    /** 작성자 이름 */
    authorName: string;
    /** 작성 시각 (ISO 8601) */
    createdAt: string;
}

/**
 * 서버 ApiComment → 클라이언트 ReviewComment 매핑 함수
 *
 * @param api - 서버 응답 코멘트
 * @returns UI에서 사용하는 ReviewComment 객체
 */
function toReviewComment(api: ApiComment): ReviewComment {
    return {
        id: api.ivgSno,
        type: api.ivgTp === 'I' ? 'inline' : 'general',
        text: api.ivgCone,
        attachments: [], // TODO: 첨부파일 API 연동 시 서버 응답 매핑 추가
        authorEno: api.authorEno,
        authorName: api.authorName,
        // TODO: 서버 응답에 팀 정보(authorTeam) 추가 시 교체
        authorTeam: '개발/운영팀',
        createdAt: api.createdAt,
        markId: api.markId ?? undefined,
        quotedText: api.qtdCone ?? undefined,
        resolved: api.rslvYn === 'Y',
    };
}

/**
 * 사전협의 코멘트 API Composable
 *
 * @returns 코멘트 조회/생성/해결 비동기 함수 모음
 */
export const useReviewCommentApi = () => {
    // plugins/auth.ts에서 provide된 인증 $apiFetch 사용 (POST/PATCH 변경 요청)
    const { $apiFetch } = useNuxtApp();

    /**
     * 특정 문서 버전의 코멘트 목록 조회
     *
     * @param docMngNo - 문서 관리번호
     * @param docVrs - 문서 버전 번호
     * @returns ReviewComment 배열 (UI 타입으로 변환된 상태)
     */
    const fetchComments = async (
        docMngNo: string,
        docVrs: number,
    ): Promise<ReviewComment[]> => {
        const data = await $apiFetch<ApiComment[]>(
            `/api/documents/${docMngNo}/review-comments`,
            { query: { docVrs } },
        );
        return data.map(toReviewComment);
    };

    /**
     * 신규 코멘트 생성 (인라인 또는 전반)
     *
     * @param docMngNo - 문서 관리번호
     * @param payload - 생성 요청 본문
     * @returns 생성된 ReviewComment (UI 타입)
     */
    const createComment = async (
        docMngNo: string,
        payload: {
            docVrs: number;
            ivgTp: 'I' | 'G';
            ivgCone: string;
            markId?: string;
            qtdCone?: string;
        },
    ): Promise<ReviewComment> => {
        const data = await $apiFetch<ApiComment>(
            `/api/documents/${docMngNo}/review-comments`,
            { method: 'POST', body: payload },
        );
        return toReviewComment(data);
    };

    /**
     * 코멘트 해결 처리 (rslvYn = 'Y')
     *
     * @param docMngNo - 문서 관리번호
     * @param ivgSno - 협의 일련번호
     */
    const resolveComment = async (
        docMngNo: string,
        ivgSno: string,
    ): Promise<void> => {
        await $apiFetch(
            `/api/documents/${docMngNo}/review-comments/${ivgSno}/resolve`,
            { method: 'PATCH' },
        );
    };

    return { fetchComments, createComment, resolveComment };
};
