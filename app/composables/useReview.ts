// Design Ref: §4.1 — Composable API Interface (useReview)
// 비즈니스 로직을 래핑하여 컴포넌트에서 간편하게 사용
import { useReviewStore } from '~/stores/review';
import type { ReviewComment, ReviewerTeam } from '~/types/review';

export const useReview = () => {
  const store = useReviewStore();
  const toast = useToast();

  /** 세션 로드 */
  const loadSession = (docMngNo: string, docTitle: string, initialContent: string) => {
    store.loadSession(docMngNo, docTitle, initialContent);
  };

  /** 검토요청 (새 버전 생성) */
  const submitForReview = () => {
    store.submitForReview();
    toast.add({
      severity: 'success',
      summary: '검토요청 완료',
      detail: `v${store.session?.currentVersion} 버전이 등록되었습니다.`,
      life: 3000,
    });
  };

  /** 인라인 코멘트 추가 */
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

  /** 전반 코멘트 추가 */
  const addGeneralComment = (params: {
    text: string;
    authorEno: string;
    authorName: string;
    authorTeam: ReviewerTeam;
    attachments?: ReviewComment['attachments'];
  }) => {
    return store.addComment({
      type: 'general',
      text: params.text,
      authorEno: params.authorEno,
      authorName: params.authorName,
      authorTeam: params.authorTeam,
      attachments: params.attachments ?? [],
      resolved: false,
    });
  };

  /** 코멘트 해결 처리 */
  const resolveComment = (commentId: string) => {
    store.resolveComment(commentId);
  };

  /** 검토완료 처리 */
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

  /** 본문 내용 업데이트 */
  const updateContent = (content: string) => {
    store.updateContent(content);
  };

  /** 버전 선택 */
  const viewVersion = (version: string | null) => {
    store.viewVersion(version);
  };

  /** 활성 코멘트 설정 */
  const setActiveComment = (commentId: string | null) => {
    store.setActiveComment(commentId);
  };

  return {
    // 상태 (반응형)
    store,

    // 액션
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
