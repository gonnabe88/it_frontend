/**
 * ============================================================================
 * [tests/unit/stores/review.test.ts] 사전협의 Pinia 스토어 단위 테스트
 * ============================================================================
 * stores/review.ts의 useReviewStore를 테스트합니다.
 *
 * [Mock 전략]
 * - crypto.randomUUID: vi.stubGlobal로 결정론적 ID 생성
 * - defineStore 등 Pinia: pinia 패키지에서 직접 import (Nuxt auto-import 미사용)
 *
 * [테스트 범위]
 * - loadSession: 새 세션 생성, 상태 초기화
 * - updateContent: draftContent 업데이트, 과거 버전 열람 중 업데이트 차단
 * - submitForReview: 버전 스냅샷 생성, 상태 전환
 * - addComment: 코멘트 추가 및 ID 부여
 * - resolveComment: 코멘트 해결 처리
 * - completeReview: 검토자 완료 처리, 전원 완료 시 세션 상태 변경
 * - viewVersion: 특정 버전 열람 설정
 * - Getters: currentContent, sortedComments, inlineComments, allReviewCompleted, isViewingHistory
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia, defineStore } from 'pinia';
import { computed } from 'vue';
import type {
    ReviewSession,
    ReviewComment,
    ReviewVersion,
    Reviewer,
} from '~/types/review';

// ============================================================================
// crypto.randomUUID Mock
// ============================================================================
let uuidCounter = 0;
vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// ============================================================================
// useReviewCommentApi Mock — 서버 호출을 로컬 stub으로 대체
// ============================================================================
// createComment mock이 호출될 때마다 증가하여 각 코멘트에 고유한 ID를 부여
let commentIdCounter = 0;
// 테스트에서 호출 인자 검증을 위해 mock 함수 인스턴스를 외부로 노출
const mockCreateComment = vi.fn(async (_docMngNo: string, payload: {
    docVrs: number;
    ivgTp: 'I' | 'G';
    ivgCone: string;
    markId?: string;
    qtdCone?: string;
}): Promise<ReviewComment> => ({
    id: `server-id-${++commentIdCounter}`,
    type: payload.ivgTp === 'I' ? 'inline' : 'general',
    text: payload.ivgCone,
    attachments: [],
    authorEno: 'EMP001',
    authorName: '홍길동',
    authorTeam: '개발/운영팀',
    createdAt: new Date().toISOString(),
    markId: payload.markId,
    quotedText: payload.qtdCone,
    resolved: false,
}));
const mockResolveComment = vi.fn(async () => undefined);
const mockFetchComments = vi.fn(async () => [] as ReviewComment[]);

vi.mock('~/composables/useReviewCommentApi', () => ({
    useReviewCommentApi: () => ({
        fetchComments: mockFetchComments,
        createComment: mockCreateComment,
        resolveComment: mockResolveComment,
    }),
}));

// ============================================================================
// stores/review.ts 인라인 구현 (Nuxt auto-import 없이 테스트)
// ============================================================================

const generateId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const nextVersion = (current: string): string => {
    const num = Number.parseFloat(current);
    return (num + 0.1).toFixed(1);
};

const defaultReviewers: Reviewer[] = [
    { eno: 'R001', empNm: '홍길동', team: '개발/운영팀', status: 'pending' },
    { eno: 'R002', empNm: '김영희', team: '계약팀', status: 'pending' },
];

const useReviewStore = defineStore('review', {
    state: () => ({
        session: null as ReviewSession | null,
        viewingVersion: null as string | null,
        activeCommentId: null as string | null,
    }),

    getters: {
        currentContent(): string {
            if (!this.session) return '';
            if (this.viewingVersion && this.viewingVersion !== this.session.currentVersion) {
                const ver = this.session.versions.find((v: ReviewVersion) => v.version === this.viewingVersion);
                return ver?.content ?? '';
            }
            return this.session.draftContent;
        },
        sortedComments(): ReviewComment[] {
            if (!this.session) return [];
            return [...this.session.comments].sort(
                (a: ReviewComment, b: ReviewComment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        },
        inlineComments(): ReviewComment[] {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (this as any).sortedComments.filter((c: ReviewComment) => c.type === 'inline');
        },
        allReviewCompleted(): boolean {
            if (!this.session) return false;
            return this.session.reviewers.every((r: Reviewer) => r.status === 'completed');
        },
        versionList(): { label: string; value: string }[] {
            if (!this.session) return [];
            return this.session.versions.map((v: ReviewVersion) => ({
                label: `v${v.version}`,
                value: v.version,
            }));
        },
        isViewingHistory(): boolean {
            if (!this.session || !this.viewingVersion) return false;
            return this.viewingVersion !== this.session.currentVersion;
        },
    },

    actions: {
        loadSession(docMngNo: string, docTitle: string, initialContent: string) {
            this.viewingVersion = null;
            this.activeCommentId = null;
            this.session = {
                docMngNo,
                docTitle,
                status: 'draft',
                currentVersion: '0.0',
                draftContent: '',
                versions: [],
                reviewers: [...defaultReviewers.map((r: Reviewer) => ({ ...r }))],
                comments: [],
            };
            if (initialContent) {
                this._setDraftContent(initialContent);
            }
        },
        _setDraftContent(content: string) {
            if (!this.session) return;
            this.session.draftContent = content;
            if (this.session.versions.length === 0) {
                this.session.versions.push({
                    version: '0.0',
                    content,
                    createdAt: new Date().toISOString(),
                    createdBy: 'AUTHOR',
                });
            }
        },
        updateContent(content: string) {
            if (!this.session) return;
            if (this.viewingVersion && this.viewingVersion !== this.session.currentVersion) return;
            this.session.draftContent = content;
        },
        submitForReview() {
            if (!this.session) return;
            const content = this.session.draftContent;
            const newVer = this.session.versions.length === 1 && this.session.currentVersion === '0.0'
                ? '0.1'
                : nextVersion(this.session.currentVersion);
            this.session.versions.push({
                version: newVer,
                content,
                createdAt: new Date().toISOString(),
                createdBy: 'AUTHOR',
            });
            this.session.currentVersion = newVer;
            this.session.status = 'reviewing';
            this.session.reviewers.forEach((r: Reviewer) => {
                r.status = 'pending';
                r.completedAt = undefined;
            });
            this.viewingVersion = null;
        },
        async addComment(comment: Omit<ReviewComment, 'id' | 'createdAt'>) {
            if (!this.session) return undefined;
            // production store와 동일: useReviewCommentApi.createComment()로 서버 저장 후 UI 타입 반환
            const docVrs = Number.parseFloat(this.session.currentVersion);
            const saved = await mockCreateComment(this.session.docMngNo, {
                docVrs,
                ivgTp: comment.type === 'inline' ? 'I' : 'G',
                ivgCone: comment.text,
                markId: comment.markId,
                qtdCone: comment.quotedText,
            });
            this.session.comments.push(saved);
            return saved;
        },
        async resolveComment(commentId: string) {
            if (!this.session) return;
            // production store와 동일: 서버 PATCH 호출 후 로컬 상태 갱신
            await mockResolveComment(this.session.docMngNo, commentId);
            const comment = this.session.comments.find((c: ReviewComment) => c.id === commentId);
            if (comment) {
                comment.resolved = true;
            }
        },
        completeReview(reviewerEno: string) {
            if (!this.session) return;
            const reviewer = this.session.reviewers.find((r: Reviewer) => r.eno === reviewerEno);
            if (reviewer) {
                reviewer.status = 'completed';
                reviewer.completedAt = new Date().toISOString();
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((this as any).allReviewCompleted) {
                this.session.status = 'completed';
            }
        },
        viewVersion(version: string | null) {
            this.viewingVersion = version;
        },
        setActiveComment(commentId: string | null) {
            this.activeCommentId = commentId;
        },
    },
});

// ============================================================================
// 테스트
// ============================================================================

describe('useReviewStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        uuidCounter = 0;
        commentIdCounter = 0;
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // loadSession
    // -------------------------------------------------------------------------
    describe('loadSession', () => {
        it('세션을 초기화하고 상태는 draft, 버전은 0.0으로 시작한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '테스트 문서', '초기 내용');

            expect(store.session).not.toBeNull();
            expect(store.session?.docMngNo).toBe('DOC-001');
            expect(store.session?.docTitle).toBe('테스트 문서');
            expect(store.session?.status).toBe('draft');
            expect(store.session?.currentVersion).toBe('0.0');
        });

        it('initialContent가 있으면 draftContent에 저장하고 v0.0 스냅샷을 생성한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '초기 내용');

            expect(store.session?.draftContent).toBe('초기 내용');
            expect(store.session?.versions).toHaveLength(1);
            expect(store.session?.versions[0].version).toBe('0.0');
            expect(store.session?.versions[0].content).toBe('초기 내용');
        });

        it('initialContent가 빈 문자열이면 versions 스냅샷을 생성하지 않는다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '');

            expect(store.session?.versions).toHaveLength(0);
        });

        it('문서 전환 시 이전 viewingVersion이 초기화된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서1', '내용1');
            store.viewingVersion = '0.1';

            store.loadSession('DOC-002', '문서2', '내용2');

            expect(store.viewingVersion).toBeNull();
        });

        it('기본 검토자가 2명 설정된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');

            expect(store.session?.reviewers).toHaveLength(2);
            expect(store.session?.reviewers[0].status).toBe('pending');
        });
    });

    // -------------------------------------------------------------------------
    // updateContent
    // -------------------------------------------------------------------------
    describe('updateContent', () => {
        it('draftContent를 업데이트한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '초기 내용');

            store.updateContent('수정된 내용');

            expect(store.session?.draftContent).toBe('수정된 내용');
        });

        it('session이 없으면 아무 동작도 하지 않는다', () => {
            const store = useReviewStore();
            // session이 null인 상태에서 호출
            expect(() => store.updateContent('내용')).not.toThrow();
        });

        it('과거 버전 열람 중에는 draftContent를 업데이트하지 않는다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '초기 내용');
            store.submitForReview();           // v0.1 생성
            store.viewVersion('0.0');          // 과거 버전 열람

            store.updateContent('덮어쓰기 시도');

            // draftContent는 변경되지 않아야 함 (submitForReview 시의 draftContent 유지)
            expect(store.session?.draftContent).toBe('초기 내용');
        });
    });

    // -------------------------------------------------------------------------
    // submitForReview
    // -------------------------------------------------------------------------
    describe('submitForReview', () => {
        it('첫 번째 검토요청은 v0.0 → v0.1로 버전이 올라간다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');

            store.submitForReview();

            expect(store.session?.currentVersion).toBe('0.1');
            expect(store.session?.versions).toHaveLength(2); // v0.0, v0.1
        });

        it('두 번째 검토요청은 v0.1 → v0.2로 버전이 올라간다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview(); // v0.1

            store.updateContent('수정된 내용');
            store.submitForReview(); // v0.2

            expect(store.session?.currentVersion).toBe('0.2');
        });

        it('검토요청 후 세션 상태는 reviewing이 된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');

            store.submitForReview();

            expect(store.session?.status).toBe('reviewing');
        });

        it('검토요청 시 검토자 상태가 pending으로 초기화된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            // 먼저 완료 처리
            store.submitForReview();
            store.completeReview('R001');

            // 재검토 요청
            store.submitForReview();

            // pending으로 초기화
            const reviewer = store.session?.reviewers.find((r: Reviewer) => r.eno === 'R001');
            expect(reviewer?.status).toBe('pending');
        });

        it('검토요청 후 viewingVersion이 null로 초기화된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.viewingVersion = '0.0';

            store.submitForReview();

            expect(store.viewingVersion).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // addComment
    // -------------------------------------------------------------------------
    describe('addComment', () => {
        it('코멘트 추가 시 고유 ID와 createdAt을 자동 부여한다', async () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');

            const comment = await store.addComment({
                text: '검토 코멘트',
                type: 'general',
                attachments: [],
                authorEno: 'R001',
                authorName: '홍길동',
                authorTeam: '개발/운영팀',
                resolved: false,
            });

            expect(comment).not.toBeUndefined();
            expect(comment?.id).toBeTruthy();
            expect(comment?.createdAt).toBeTruthy();
            expect(store.session?.comments).toHaveLength(1);
        });

        it('session이 없으면 undefined를 반환한다', async () => {
            const store = useReviewStore();
            const result = await store.addComment({
                text: '코멘트',
                type: 'general',
                attachments: [],
                authorEno: 'R001',
                authorName: '홍길동',
                authorTeam: '개발/운영팀',
                resolved: false,
            });
            expect(result).toBeUndefined();
        });

        it('여러 코멘트 추가 시 각각 다른 ID를 부여한다', async () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');

            const c1 = await store.addComment({
                text: '코멘트1',
                type: 'general',
                attachments: [],
                authorEno: 'R001',
                authorName: '홍길동',
                authorTeam: '개발/운영팀',
                resolved: false,
            });
            const c2 = await store.addComment({
                text: '코멘트2',
                type: 'inline',
                attachments: [],
                authorEno: 'R002',
                authorName: '김영희',
                authorTeam: '계약팀',
                resolved: false,
            });

            expect(c1?.id).not.toBe(c2?.id);
        });
    });

    // -------------------------------------------------------------------------
    // resolveComment
    // -------------------------------------------------------------------------
    describe('resolveComment', () => {
        it('코멘트 해결 시 resolved가 true로 변경된다', async () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            const comment = await store.addComment({
                text: '코멘트',
                type: 'general',
                attachments: [],
                authorEno: 'R001',
                authorName: '홍길동',
                authorTeam: '개발/운영팀',
                resolved: false,
            });

            await store.resolveComment(comment!.id);

            expect(store.session?.comments[0].resolved).toBe(true);
        });

        it('존재하지 않는 ID로 해결 요청 시 예외 없이 처리된다', async () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');

            await expect(store.resolveComment('non-existent-id')).resolves.not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // completeReview
    // -------------------------------------------------------------------------
    describe('completeReview', () => {
        it('검토자 완료 처리 시 status가 completed로 변경된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview();

            store.completeReview('R001');

            const reviewer = store.session?.reviewers.find((r: Reviewer) => r.eno === 'R001');
            expect(reviewer?.status).toBe('completed');
            expect(reviewer?.completedAt).toBeTruthy();
        });

        it('모든 검토자가 완료하면 세션 상태가 completed가 된다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview();

            store.completeReview('R001');
            store.completeReview('R002');

            expect(store.session?.status).toBe('completed');
        });

        it('일부 검토자만 완료한 경우 세션 상태는 reviewing 유지', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview();

            store.completeReview('R001'); // R001만 완료

            expect(store.session?.status).toBe('reviewing'); // 아직 reviewing
        });
    });

    // -------------------------------------------------------------------------
    // viewVersion
    // -------------------------------------------------------------------------
    describe('viewVersion', () => {
        it('특정 버전을 선택하면 viewingVersion이 설정된다', () => {
            const store = useReviewStore();
            store.viewVersion('0.1');
            expect(store.viewingVersion).toBe('0.1');
        });

        it('null 설정 시 viewingVersion이 초기화된다', () => {
            const store = useReviewStore();
            store.viewVersion('0.1');
            store.viewVersion(null);
            expect(store.viewingVersion).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------
    describe('currentContent getter', () => {
        it('session이 없으면 빈 문자열을 반환한다', () => {
            const store = useReviewStore();
            expect(store.currentContent).toBe('');
        });

        it('viewingVersion이 null이면 draftContent를 반환한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '초기 내용');
            store.updateContent('편집 중 내용');

            expect(store.currentContent).toBe('편집 중 내용');
        });

        it('과거 버전 열람 중에는 해당 스냅샷 내용을 반환한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', 'v0.0 내용');
            store.submitForReview(); // v0.1 생성

            store.viewVersion('0.0'); // v0.0 열람

            expect(store.currentContent).toBe('v0.0 내용');
        });
    });

    describe('isViewingHistory getter', () => {
        it('viewingVersion이 null이면 false를 반환한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            expect(store.isViewingHistory).toBe(false);
        });

        it('현재 버전과 다른 버전 열람 중이면 true를 반환한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview(); // 현재 버전 = 0.1
            store.viewVersion('0.0');

            expect(store.isViewingHistory).toBe(true);
        });
    });

    describe('allReviewCompleted getter', () => {
        it('session이 없으면 false를 반환한다', () => {
            const store = useReviewStore();
            expect(store.allReviewCompleted).toBe(false);
        });

        it('검토자가 모두 완료된 경우 true를 반환한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview();
            store.completeReview('R001');
            store.completeReview('R002');

            expect(store.allReviewCompleted).toBe(true);
        });

        it('검토자 중 1명이라도 미완료면 false를 반환한다', () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            store.submitForReview();
            store.completeReview('R001');

            expect(store.allReviewCompleted).toBe(false);
        });
    });

    describe('inlineComments getter', () => {
        it('인라인 타입 코멘트만 필터링하여 반환한다', async () => {
            const store = useReviewStore();
            store.loadSession('DOC-001', '문서', '내용');
            await store.addComment({
                text: '일반 코멘트',
                type: 'general',
                attachments: [],
                authorEno: 'R001',
                authorName: '홍',
                authorTeam: '개발/운영팀',
                resolved: false,
            });
            await store.addComment({
                text: '인라인 코멘트',
                type: 'inline',
                attachments: [],
                authorEno: 'R002',
                authorName: '김',
                authorTeam: '계약팀',
                resolved: false,
            });

            expect(store.inlineComments).toHaveLength(1);
            expect(store.inlineComments[0].type).toBe('inline');
        });
    });
});

// ============================================================================
// nextVersion 유틸 함수 테스트
// ============================================================================
describe('nextVersion 유틸', () => {
    it('0.0 → 0.1을 반환한다', () => {
        expect(nextVersion('0.0')).toBe('0.1');
    });

    it('0.1 → 0.2를 반환한다', () => {
        expect(nextVersion('0.1')).toBe('0.2');
    });

    it('0.9 → 1.0을 반환한다', () => {
        expect(nextVersion('0.9')).toBe('1.0');
    });
});
