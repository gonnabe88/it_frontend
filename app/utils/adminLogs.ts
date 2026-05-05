/**
 * ============================================================================
 * [utils/adminLogs.ts] 관리자 상세 로그 화면 메타
 * ============================================================================
 * 관리자 사이드바와 상세 로그 화면에서 공통으로 사용하는 로그 테이블 목록입니다.
 * 백엔드 /api/admin/logs/tables 응답과 key를 맞춥니다.
 * ============================================================================
 */

export interface AdminLogMenuItem {
    key: string;
    title: string;
    menuLabel?: string;
    tableName: string;
}

export const ADMIN_LOG_TABLES: AdminLogMenuItem[] = [
    { key: 'basctm', title: '정보화실무협의회 신청 로그', menuLabel: '협의회 신청', tableName: 'TAAABB_BASCTL' },
    { key: 'bbugt', title: '예산 편성 로그', menuLabel: '예산 작업·편성 결과', tableName: 'TAAABB_BBUGTL' },
    { key: 'bchklc', title: '체크리스트 로그', menuLabel: '타당성 자체점검', tableName: 'TAAABB_BCHKLL' },
    { key: 'bcmmtm', title: '협의회 위원 로그', menuLabel: '평가위원', tableName: 'TAAABB_BCMMTL' },
    { key: 'bcostm', title: '전산업무비 로그', menuLabel: '전산업무비', tableName: 'TAAABB_BCOSTL' },
    { key: 'bevalm', title: '평가 로그', menuLabel: '평가의견', tableName: 'TAAABB_BEVALL' },
    { key: 'bgdocm', title: '가이드 문서 로그', menuLabel: '사업 가이드', tableName: 'TAAABB_BGDOCL' },
    { key: 'bitemm', title: '사업 비목 로그', menuLabel: '사업 예산 비목', tableName: 'TAAABB_BITEML' },
    { key: 'bperfm', title: '성과평가 로그', menuLabel: '성과평가', tableName: 'TAAABB_BPERFL' },
    { key: 'bplanm', title: '정보기술부문 계획 로그', menuLabel: '계획 조회·등록', tableName: 'TAAABB_BPLANL' },
    { key: 'bpovwm', title: '관점/배점 로그', menuLabel: '사업개요·평가기준', tableName: 'TAAABB_BPOVWL' },
    { key: 'bpqnam', title: '질의응답 로그', menuLabel: '사전질의응답', tableName: 'TAAABB_BPQNAL' },
    { key: 'bprojm', title: '정보화사업 로그', menuLabel: '사업 목록·상세', tableName: 'TAAABB_BPROJL' },
    { key: 'brdocm', title: '요구사항 문서 로그', menuLabel: '사전협의 문서', tableName: 'TAAABB_BRDOCL' },
    { key: 'brivgm', title: '검토의견 로그', menuLabel: '검토의견', tableName: 'TAAABB_BRIVGL' },
    { key: 'brsltm', title: '심의결과 로그', menuLabel: '협의회 결과서', tableName: 'TAAABB_BRSLTL' },
    { key: 'bschdm', title: '협의회 일정 로그', menuLabel: '협의회 일정', tableName: 'TAAABB_BSCHDL' },
    { key: 'btermm', title: '단말기 상세 로그', menuLabel: '단말기 상세목록', tableName: 'TAAABB_BTERML' },
    { key: 'capplm', title: '전자결재 로그', menuLabel: '전자결재 신청서', tableName: 'TAAABB_CAPPLL' },
    { key: 'ccodem', title: '공통코드 로그', menuLabel: '공통코드 관리', tableName: 'TAAABB_CCODEL' },
];
