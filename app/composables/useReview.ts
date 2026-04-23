/**
 * ============================================================================
 * [useReview] 사전협의(문서 검토) Composable
 * ============================================================================
 * Pinia 리뷰 스토어(stores/review.ts)를 래핑하여 컴포넌트에서 편리하게
 * 사전협의 기능을 사용할 수 있도록 하는 composable입니다.
 *
 * [제공 기능]
 *  - loadSession       : 검토 세션 초기화 (문서 진입 시)
 *  - submitForReview   : 검토요청 (새 버전 스냅샷 생성)
 *  - addInlineComment  : 인라인 코멘트 추가 (Tiptap Mark 기반)
 *  - addGeneralComment : 전반 코멘트 추가
 *  - resolveComment    : 코멘트 해결 처리
 *  - completeReview    : 검토자 검토완료 처리
 *  - updateContent     : 본문 내용 업데이트
 *  - viewVersion       : 특정 버전 열람
 *  - setActiveComment  : 활성 코멘트 설정 (팝오버 표시용)
 *
 * [사용처]
 *  - pages/info/documents/[id]/review.vue : 사전협의 검토 화면
 *  - components/review/* : 검토 관련 컴포넌트
 *
 * TODO: 현재 세션 상태가 메모리 전용(새로고침 시 초기화)이므로, 서버 API 연동 시
 *       loadSession에서 서버 데이터를 조회하도록 개선 필요
 * ============================================================================
 */
import { useReviewStore } from '~/stores/review';
import type { ReviewComment, ReviewerTeam } from '~/types/review';

/**
 * 사전협의 검토 Composable 함수
 *
 * @returns 리뷰 스토어 및 검토 관련 액션 함수 객체
 */
export const useReview = () => {
  const store = useReviewStore();
  /** 사용자 친화적 알림 메시지 표시용 Toast 서비스 */
  const toast = useToast();

  /**
   * 검토 세션 초기화
   * 문서 상세 화면 진입 시 호출하여 새 세션을 생성합니다.
   *
   * @param docMngNo - 문서 관리번호
   * @param docTitle - 문서 제목
   * @param initialContent - 초기 본문 HTML 내용
   */
  const loadSession = (docMngNo: string, docTitle: string, initialContent: string) => {
    store.loadSession(docMngNo, docTitle, initialContent);
  };

  /**
   * 검토요청 (새 버전 생성)
   * 현재 편집 중인 draftContent를 불변 스냅샷으로 저장하고,
   * 검토자들에게 알림 Toast를 표시합니다.
   */
  const submitForReview = () => {
    store.submitForReview();
    toast.add({
      severity: 'success',
      summary: '검토요청 완료',
      detail: `v${store.session?.currentVersion} 버전이 등록되었습니다.`,
      life: 3000,
    });
  };

  /**
   * 인라인 코멘트 추가
   * Tiptap 에디터에서 텍스트를 드래그하여 선택한 영역에 코멘트를 추가합니다.
   * markId로 에디터 내 Mark와 연동됩니다.
   *
   * @param params - 코멘트 정보 (내용, Mark ID, 인용 텍스트, 작성자 정보 등)
   * @returns 생성된 ReviewComment 객체
   */
  const addInlineComment = (params: {
    text: string;
    markId: string;
    quotedText: string;
    authorEno: string;
    authorName: string;
    authorTeam: ReviewerTeam;
    attachments?: ReviewComment['attachments'];
  }) => {
    return store.addComment({
      type: 'inline',
      text: params.text,
      markId: params.markId,
      quotedText: params.quotedText,
      authorEno: params.authorEno,
      authorName: params.authorName,
      authorTeam: params.authorTeam,
      attachments: params.attachments ?? [],
      resolved: false,
    });
  };

  /**
   * 전반 코멘트 추가
   * 특정 텍스트 영역이 아닌 문서 전체에 대한 의견을 추가합니다.
   *
   * @param params - 코멘트 정보 (내용, 작성자 정보 등)
   * @returns 생성된 ReviewComment 객체
   */
  const addGeneralComment = async (params: {
    text: string;
    authorEno: string;
    authorName: string;
    authorTeam: ReviewerTeam;
    attachments?: ReviewComment['attachments'];
  }) => {
    return await store.addComment({
      type: 'general',
      text: params.text,
      authorEno: params.authorEno,
      authorName: params.authorName,
      authorTeam: params.authorTeam,
      attachments: params.attachments ?? [],
      resolved: false,
    });
  };

  /**
   * 코멘트 해결 처리
   * 작성자가 코멘트를 반영했음을 표시합니다. resolved=true로 변경됩니다.
   *
   * @param commentId - 해결할 코멘트 UUID
   */
  const resolveComment = async (commentId: string) => {
    await store.resolveComment(commentId);
  };

  /**
   * 검토완료 처리
   * 검토자가 자신의 검토를 완료했음을 표시합니다.
   * 전원 완료 시 세션 상태가 'completed'로 전이됩니다.
   *
   * @param reviewerEno - 검토 완료한 검토자 사번
   */
  const completeReview = (reviewerEno: string) => {
    store.completeReview(reviewerEno);
    const reviewer = store.session?.reviewers.find(r => r.eno === reviewerEno);
    toast.add({
      severity: 'success',
      summary: '검토완료',
      detail: `${reviewer?.empNm ?? ''} (${reviewer?.team ?? ''}) 검토가 완료되었습니다.`,
      life: 3000,
    });
  };

  /**
   * 본문 내용 업데이트
   * Tiptap 에디터의 내용 변경 시 호출하여 draftContent를 갱신합니다.
   * 이전 버전 열람 중에는 draftContent를 변경하지 않습니다.
   *
   * @param content - 변경된 본문 HTML 문자열
   */
  const updateContent = (content: string) => {
    store.updateContent(content);
  };

  /**
   * 특정 버전 열람
   * null을 전달하면 현재(최신) 버전으로 복귀합니다.
   *
   * @param version - 열람할 버전 번호 (예: '0.1') 또는 null
   */
  const viewVersion = (version: string | null) => {
    store.viewVersion(version);
  };

  /**
   * 활성 코멘트 설정
   * 에디터에서 하이라이트된 Mark 클릭 시 해당 코멘트 팝오버를 표시합니다.
   *
   * @param commentId - 활성화할 코멘트 UUID 또는 null (해제)
   */
  const setActiveComment = (commentId: string | null) => {
    store.setActiveComment(commentId);
  };

  return {
    /** Pinia 리뷰 스토어 인스턴스 (반응형 상태 접근용) */
    store,

    // 검토 액션 함수
    loadSession,
    submitForReview,
    addInlineComment,
    addGeneralComment,
    resolveComment,
    completeReview,
    updateContent,
    viewVersion,
    setActiveComment,
  };
};
