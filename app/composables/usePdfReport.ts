/**
 * ============================================================================
 * [usePdfReport] PDF 보고서 생성 Composable
 * ============================================================================
 * pdfmake 라이브러리를 사용하여 예산편성 신청서를 PDF로 생성합니다.
 * 한글 출력을 위해 NanumGothic 폰트를 동적으로 로드하여 적용합니다.
 *
 * [생성되는 PDF 구조]
 *  - 1페이지: 총괄표 (합계 통계 + 사업/계약별 예산 목록)
 *  - 정보화사업 섹션 (1건 이상인 경우): 사업별 상세 테이블
 *  - 전산업무비 섹션 (1건 이상인 경우): 계약별 상세 테이블
 *  - 각 섹션은 페이지 나누기(pageBreak)로 구분
 *  - 페이지 푸터: 현재 페이지 / 전체 페이지 수
 *
 * [폰트 전략]
 *  - 모듈 수준 캐시(cachedVfs, cachedFonts)로 폰트 중복 로딩 방지
 *  - NanumGothic Regular / Bold / ExtraBold 를 base64로 변환 후 pdfmake VFS에 등록
 *  - 폰트 로드 실패 시 기본 Roboto 폰트로 폴백 처리
 *
 * [주의사항]
 *  - 클라이언트 사이드 전용 (window.btoa 사용)
 *  - pdfmake는 싱글턴으로 동작하므로 VFS/Fonts 설정을 매 호출 시 동기화
 * ============================================================================
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts'; // Roboto 기본 폰트 포함
import type { ProjectDetail } from '~/composables/useProjects';
import type { ItCost } from '~/composables/useCost';
import nanumGothic from '@/assets/fonts/NanumGothic-Regular.ttf?url';
import nanumGothicBold from '@/assets/fonts/NanumGothic-Bold.ttf?url';
import nanumGothicExtraBold from '@/assets/fonts/NanumGothic-ExtraBold.ttf?url';

/**
 * 모듈 수준 폰트 캐시
 * composable이 여러 번 호출되어도 폰트를 중복 로드하지 않도록 합니다.
 * HMR(Hot Module Replacement) 시에는 모듈이 재실행되어 캐시가 초기화됩니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedVfs: any = null;   // pdfmake VFS(Virtual File System): 폰트 파일 base64 저장소
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedFonts: any = null; // pdfmake 폰트 설정 객체 (fontName → 파일 매핑)

/**
 * pdfmake 기본값(Roboto VFS + 폰트 설정) 초기화
 * 최초 1회만 실행되며, 이후에는 캐시를 재사용합니다.
 */
const initDefaults = () => {
    // 이미 초기화된 경우 스킵
    if (cachedVfs && cachedFonts) return;

    // pdfmake/vfs_fonts에서 Roboto VFS를 가져옴 (패키지 버전별 구조 차이 대응)
    // 0.2.x: pdfFonts.pdfMake.vfs / pdfFonts.vfs, 0.3.x: pdfFonts 자체가 폰트 파일 객체
    // @ts-expect-error pdfmake/vfs_fonts 패키지 버전별 구조 차이로 인한 타입 오류 억제
    const defaultVfs = (pdfFonts?.pdfMake?.vfs) || (pdfFonts?.vfs) || pdfFonts;

    cachedVfs = { ...defaultVfs };

    // Roboto 폰트 기본 설정 (pdfmake 기본 폰트)
    cachedFonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        }
    };
};

/**
 * [ApprovalLine] 결재선 정보 인터페이스
 * PDF 보고서 헤더의 결재 테이블에 표시되는 결재자 정보입니다.
 */
export interface ApprovalLine {
    drafter:  { name: string; rank: string; date: string; id: string }; // 기안자
    teamLead: { name: string; rank: string; date: string; id: string }; // 팀장
    deptHead: { name: string; rank: string; date: string; id: string }; // 부서장
}

/**
 * PDF 보고서 생성 Composable 함수
 *
 * @returns PDF 생성 관련 함수 객체
 *   - generateReport: 프로젝트/전산업무비 배열과 결재선을 받아 PDF Blob URL을 반환
 */
export const usePdfReport = () => {

    // 기본값(Roboto VFS + 폰트) 초기화 보장
    initDefaults();

    /**
     * 한글 폰트(NanumGothic) 로드 및 pdfmake VFS 등록
     * 이미 캐시된 경우 즉시 반환합니다.
     *
     * [폰트 등록 전략]
     *  - NanumGothic Regular  → normal, italics (이탤릭 폴백)
     *  - NanumGothic Bold     → bold
     *  - NanumGothic ExtraBold→ bolditalics (특수 사용 시 접근 가능)
     *  - NanumGothicExtraBold → 별도 폰트 패밀리로 등록 (명시적 사용 지원)
     *
     * @returns 로드 성공 시 'NanumGothic', 실패 시 'Roboto' (폴백)
     */
    const loadKoreanFont = async () => {
        const fontName = 'NanumGothic';
        const vfsKeyRegular   = 'NanumGothic-Regular.ttf';
        const vfsKeyBold      = 'NanumGothic-Bold.ttf';
        const vfsKeyExtraBold = 'NanumGothic-ExtraBold.ttf';

        // 캐시 히트: 이미 로드된 폰트가 있으면 재사용
        if (cachedVfs[vfsKeyRegular] && cachedVfs[vfsKeyBold] && cachedFonts[fontName]) {
            return fontName;
        }

        try {
            // 세 가지 폰트 파일을 병렬로 fetch
            const [regRes, boldRes, extraRes] = await Promise.all([
                fetch(nanumGothic),
                fetch(nanumGothicBold),
                fetch(nanumGothicExtraBold)
            ]);

            // 각 폰트 파일 로드 성공 여부 검증
            if (!regRes.ok)   throw new Error(`Failed to load Regular: ${regRes.statusText}`);
            if (!boldRes.ok)  throw new Error(`Failed to load Bold: ${boldRes.statusText}`);
            if (!extraRes.ok) throw new Error(`Failed to load ExtraBold: ${extraRes.statusText}`);

            // ArrayBuffer로 변환 (base64 인코딩 준비)
            const [regBuf, boldBuf, extraBuf] = await Promise.all([
                regRes.arrayBuffer(),
                boldRes.arrayBuffer(),
                extraRes.arrayBuffer()
            ]);

            /**
             * ArrayBuffer → base64 문자열 변환
             * pdfmake VFS는 폰트 파일을 base64 문자열로 저장합니다.
             *
             * @param buffer - 변환할 ArrayBuffer
             * @returns base64 인코딩된 문자열
             */
            const toBase64 = (buffer: ArrayBuffer) => {
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]!);
                }
                return window.btoa(binary);
            };

            // VFS 캐시에 base64 폰트 데이터 저장
            cachedVfs[vfsKeyRegular]   = toBase64(regBuf);
            cachedVfs[vfsKeyBold]      = toBase64(boldBuf);
            cachedVfs[vfsKeyExtraBold] = toBase64(extraBuf);

            // NanumGothic 폰트 패밀리 설정
            // bolditalics 슬롯에 ExtraBold를 매핑하여 bold+italics 스타일 조합으로 접근 가능
            cachedFonts[fontName] = {
                normal:      vfsKeyRegular,   // 기본 굵기
                bold:        vfsKeyBold,       // 볼드
                italics:     vfsKeyRegular,    // 이탤릭 폴백 (별도 이탤릭체 없음)
                bolditalics: vfsKeyExtraBold   // ExtraBold (bold+italics 조합으로 접근)
            };

            // NanumGothicExtraBold를 별도 폰트 패밀리로도 등록 (명시적 사용 가능)
            cachedFonts['NanumGothicExtraBold'] = {
                normal:      vfsKeyExtraBold,
                bold:        vfsKeyExtraBold,
                italics:     vfsKeyExtraBold,
                bolditalics: vfsKeyExtraBold
            };

            return fontName;
        } catch (e) {
            // 폰트 로드 실패 시 기본 Roboto로 폴백
            console.error('Korean font loading failed, falling back to Roboto', e);
            return 'Roboto';
        }
    };

    /**
     * 예산편성 신청서 PDF 생성
     *
     * [PDF 레이아웃 구성]
     *  1. 첫 페이지: 총괄표 (합계 통계 + 사업/계약별 예산 목록)
     *  2. 정보화사업 섹션 (1건 이상): 사업별 상세 정보 테이블
     *  3. 전산업무비 섹션 (1건 이상): 계약별 상세 정보 테이블
     *  4. 페이지 푸터: 페이지 번호
     *
     * @param projects     - PDF에 포함할 정보화사업 상세 정보 배열
     * @param approvalLine - 결재선 정보 (기안자, 팀장, 부서장)
     * @param costs        - PDF에 포함할 전산업무비 배열 (선택, 기본값 빈 배열)
     * @returns PDF Blob URL (window.URL.createObjectURL 결과)
     * @throws PDF 생성 중 오류 발생 시 에러를 throw
     */
    const generateReport = async (
        projects: ProjectDetail[],
        approvalLine: ApprovalLine,
        costs: ItCost[] = []
    ) => {
        try {
            // 방어 로직: 파라미터가 undefined/null로 넘어올 경우 빈 배열 보장
            projects = projects || [];
            costs = costs || [];

            // 한글 폰트 로드 (캐시 활용)
            const font = await loadKoreanFont();

            // 로컬 캐시 참조 (VFS와 폰트 설정이 항상 쌍을 이루도록 보장)
            const currentVfs   = cachedVfs;
            const currentFonts = cachedFonts;

            // PDF 디자인 색상 상수 (Blue/Indigo 테마)
            const colors = {
                primary:    '#1e3a8a', // 다크 블루 (텍스트/헤더)
                accent:     '#2563eb', // 블루 600 (정보화사업 타이틀 배경)
                accentCost: '#059669', // 에메랄드 600 (전산업무비 타이틀 배경)
                accentOrd:  '#d97706', // 앰버 600 (경상사업 타이틀 배경)
                headerBg:   '#eff6ff', // 블루 50 (테이블 헤더 배경)
                headerBgCost: '#ecfdf5', // 에메랄드 50 (전산업무비 헤더 배경)
                headerBgOrd: '#fffbeb', // 앰버 50 (경상사업 헤더 배경)
                border:     '#bfdbfe', // 블루 200 (테이블 경계선)
                borderCost: '#a7f3d0', // 에메랄드 200 (전산업무비 경계선)
                borderOrd:  '#fde68a', // 앰버 200 (경상사업 경계선)
                textGray:   '#4b5563'  // 그레이 600 (보조 텍스트)
            };

            // pdfmake 문서 정의 객체 초기화
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const docDefinition: any = {
                content: [], // 실제 내용 배열 (이후 push로 추가)
                defaultStyle: {
                    font:     font,
                    fontSize: 10,
                    color:    '#1f2937' // 기본 텍스트 색상 (그레이 800)
                },
                // 스타일 정의
                styles: {
                    header: {
                        fontSize:  22,
                        bold:      true,
                        alignment: 'left',
                        margin:    [0, 0, 0, 5],
                        font:      'NanumGothic',
                        color:     colors.primary
                    },
                    label: {
                        bold:      true,
                        fillColor: colors.headerBg,
                        color:     colors.primary,
                        alignment: 'center',
                        valign:    'middle'
                    },
                    labelCost: {
                        bold:      true,
                        fillColor: colors.headerBgCost,
                        color:     '#065f46', // 에메랄드 900
                        alignment: 'center',
                        valign:    'middle'
                    },
                    labelOrd: {
                        bold:      true,
                        fillColor: colors.headerBgOrd,
                        color:     '#92400e', // 앰버 900
                        alignment: 'center',
                        valign:    'middle'
                    },
                    tableText:   { margin: [2, 2, 2, 2] },
                    titleBox:    { margin: [0, 10, 0, 10] },
                    approvalBox: { margin: [0, 0, 0, 20] }
                },
                pageMargins: [40, 40, 40, 40], // 상하좌우 여백 (포인트 단위)
                // 페이지 푸터: "현재페이지 / 전체페이지" 형식
                footer: function(currentPage: number, pageCount: number) {
                    return {
                        text:      currentPage.toString() + ' / ' + pageCount,
                        alignment: 'center',
                        fontSize:  9,
                        color:     colors.textGray,
                        margin:    [0, 10, 0, 0]
                    };
                }
            };

            // ====================================================================
            // 공통 헬퍼: null/undefined → 빈 문자열 변환
            // ====================================================================

            /**
             * null/undefined 값을 빈 문자열로 변환하는 헬퍼
             * @param val - 변환할 값
             * @returns 문자열 또는 빈 문자열
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cellVal = (val: any) => val ? String(val) : '';

            /**
             * HTML 문자열을 pdfmake에서 사용 가능한 일반 텍스트로 변환
             * pdfmake는 HTML을 직접 렌더링하지 않으므로 태그를 제거하고
             * 블록 요소는 개행(\n)으로 치환합니다.
             *
             * @param html - 변환할 HTML 문자열
             * @returns 태그가 제거된 일반 텍스트
             */
            const htmlToText = (html: string) => {
                if(!html) return '';
                let text = html;
                // 블록 레벨 태그 닫기를 개행으로 변환 (p, div, h1-h6, li, tr)
                text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
                // <br> 태그를 개행으로 변환
                text = text.replace(/<br\s*\/?>/gi, '\n');
                // 남은 모든 HTML 태그 제거
                text = text.replace(/<[^>]+>/g, '');
                // HTML 엔티티 복원 (기본 5개)
                text = text.replace(/&nbsp;/g, ' ');
                text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                return text.trim();
            };

            // ====================================================================
            // 공통 헬퍼: 결재선 테이블 빌더
            // ====================================================================

            /**
             * 날짜 문자열을 날짜(YYYY-MM-DD)와 시간(HH:mm:ss) 두 파트로 분리합니다.
             * ISO 형식(예: "2026-04-11T09:30:00.000Z")에서 T 구분자로 직접 슬라이싱합니다.
             * T 이후 밀리초(.000)와 Z는 제거하고 순수 HH:mm:ss만 추출합니다.
             *
             * @param dateStr - ISO 날짜 문자열 또는 빈 문자열
             * @returns { datePart: "YYYY-MM-DD", timePart: "HH:mm:ss" }
             */
            const splitDateTime = (dateStr: string): { datePart: string; timePart: string } => {
                if (!dateStr) return { datePart: '', timePart: '' };
                const tIdx = dateStr.indexOf('T');
                if (tIdx === -1) return { datePart: dateStr, timePart: '' };
                // "2026-04-11" — T 앞부분
                const datePart = dateStr.slice(0, tIdx);
                // "09:30:00.000Z" → "09:30:00" — 밀리초와 Z 제거
                const timePart = dateStr.slice(tIdx + 1, tIdx + 9);
                return { datePart, timePart };
            };

            /**
             * 날짜 셀 생성 (YYYY-MM-DD\nHH:mm:ss 2줄 표시)
             * pdfmake text 배열 + \n 방식으로 개행을 보장합니다.
             * 날짜가 없으면 빈 문자열 셀을 반환합니다.
             */
            const buildDateCell = (dateStr: string) => {
                const { datePart, timePart } = splitDateTime(dateStr);
                if (!datePart) return { text: '', fontSize: 8 };
                return {
                    text: [
                        { text: datePart, fontSize: 8, color: colors.textGray },
                        { text: timePart ? `\n${timePart}` : '', fontSize: 7, color: colors.textGray }
                    ],
                    alignment: 'center'
                };
            };

            /**
             * 결재선 테이블 생성 (기안자 / 팀장 / 부서장)
             * 각 열에 직위, 이름, 결재일자(YYYY-MM-DD / HH:mm:ss 2줄)를 표시합니다.
             * 결재자가 미지정된 경우 회색 텍스트로 표시합니다.
             */
            const buildApprovalTable = () => ({
                table: {
                    widths: [60, 60, 60],
                    body: [
                        // 헤더 행: 역할 구분
                        [
                            { text: '기안자', style: 'label' },
                            { text: '팀장',   style: 'label' },
                            { text: '부서장', style: 'label' }
                        ],
                        // 이름 + 직위 행
                        [
                            {
                                stack: [
                                    { text: approvalLine.drafter.name,  alignment: 'center', margin: [0, 0, 0, 2] },
                                    { text: approvalLine.drafter.rank,  fontSize: 8, alignment: 'center', color: colors.textGray }
                                ],
                                height: 50
                            },
                            {
                                stack: [
                                    // 결재자 미지정 시 '결재자'로 표시하고 회색 처리
                                    { text: approvalLine.teamLead.name || '결재자', alignment: 'center', margin: [0, 0, 0, 2], color: approvalLine.teamLead.name ? 'black' : 'gray' },
                                    { text: approvalLine.teamLead.rank || '(미지정)', fontSize: 8, alignment: 'center', color: colors.textGray }
                                ],
                                height: 50
                            },
                            {
                                stack: [
                                    { text: approvalLine.deptHead.name || '결재자', alignment: 'center', margin: [0, 0, 0, 2], color: approvalLine.deptHead.name ? 'black' : 'gray' },
                                    { text: approvalLine.deptHead.rank || '(미지정)', fontSize: 8, alignment: 'center', color: colors.textGray }
                                ],
                                height: 50
                            }
                        ],
                        // 결재일자 행 (YYYY-MM-DD / HH:mm:ss 2줄)
                        [
                            buildDateCell(approvalLine.drafter.date),
                            buildDateCell(approvalLine.teamLead.date),
                            buildDateCell(approvalLine.deptHead.date)
                        ]
                    ]
                },
                layout: {
                    hLineWidth: (_i:number) => 1,
                    vLineWidth: (_i:number) => 1,
                    hLineColor: colors.border,
                    vLineColor: colors.border,
                    // 이름 행(index 1)의 세로 패딩을 늘려 가운데 정렬 효과
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    paddingTop:    (_i:number, _node:any) => _i === 1 ? 12 : 4,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    paddingBottom: (_i:number, _node:any) => _i === 1 ? 12 : 4
                }
            });

            /**
             * 헤더 섹션 생성 (2단 컬럼: 왼쪽 문서 제목/번호 + 오른쪽 결재선 테이블)
             */
            const buildHeaderSection = () => ({
                columns: [
                    {
                        width: '*',
                        stack: [
                            { text: '예산편성 신청', style: 'header' },
                            { text: '문서번호: (자동생성)', color: colors.textGray, fontSize: 9 },
                            { text: '보존연한: 5년',       color: colors.textGray, fontSize: 9 }
                        ]
                    },
                    {
                        width: 'auto',
                        stack: [buildApprovalTable()]
                    }
                ],
                margin: [0, 0, 0, 20]
            });

            // ====================================================================
            // 공통 레이아웃 설정 (테이블 경계선/패딩)
            // ====================================================================

            const tableLayout = {
                hLineWidth:  (_i: number) => 1,
                vLineWidth:  (_i: number) => 1,
                hLineColor:  (_i: number) => colors.border,
                vLineColor:  (_i: number) => colors.border,
                paddingTop:    (_i: number) => 8,
                paddingBottom: (_i: number) => 8,
                paddingLeft:   (_i: number) => 6,
                paddingRight:  (_i: number) => 6
            };

            const tableLayoutCost = {
                hLineWidth:  (_i: number) => 1,
                vLineWidth:  (_i: number) => 1,
                hLineColor:  (_i: number) => colors.borderCost,
                vLineColor:  (_i: number) => colors.borderCost,
                paddingTop:    (_i: number) => 8,
                paddingBottom: (_i: number) => 8,
                paddingLeft:   (_i: number) => 6,
                paddingRight:  (_i: number) => 6
            };

            // ====================================================================
            // 예산 합계 계산 (정보화사업 / 경상사업 / 전산업무비 3구분)
            // ====================================================================

            /** 정보화사업(일반) / 경상사업 분리 */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const regularProjects  = projects.filter(p => (p as any).ornYn !== 'Y');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ordinaryProjects = projects.filter(p => (p as any).ornYn === 'Y');

            /** 정보화사업(일반) 합계 */
            const regTotalBg  = regularProjects.reduce((s, p) => s + (p.prjBg   || 0), 0);
            const regAssetBg  = regularProjects.reduce((s, p) => s + (p.assetBg || 0), 0);
            const regCostBg   = regularProjects.reduce((s, p) => s + (p.costBg  || 0), 0);

            /** 경상사업 합계 */
            const ordTotalBg  = ordinaryProjects.reduce((s, p) => s + (p.prjBg   || 0), 0);
            const ordAssetBg  = ordinaryProjects.reduce((s, p) => s + (p.assetBg || 0), 0);
            const ordCostBg   = ordinaryProjects.reduce((s, p) => s + (p.costBg  || 0), 0);

            /** 전산업무비 합계 */
            const costTotalBg  = costs.reduce((s, c) => s + (c.itMngcBg || 0), 0);
            const costAssetBg  = costs.reduce((s, c) => s + (c.assetBg  || 0), 0);
            const costCostBg   = costs.reduce((s, c) => s + ((c.itMngcBg || 0) - (c.assetBg || 0)), 0);

            /** 전체 합계 */
            const totalCount   = regularProjects.length + ordinaryProjects.length + costs.length;
            const grandTotalBg = regTotalBg + ordTotalBg + costTotalBg;
            const grandAssetBg = regAssetBg + ordAssetBg + costAssetBg;
            const grandCostBg  = regCostBg  + ordCostBg  + costCostBg;

            /** 금액 포맷 헬퍼 (원 단위 천 단위 구분자) */
            const fmtAmt = (n: number) => n.toLocaleString() + ' 원';

            // ====================================================================
            // 0. 총괄표 페이지 (첫 번째 페이지)
            // ====================================================================

            // 헤더 (제목 + 결재선)
            docDefinition.content.push(buildHeaderSection());

            // 총괄표 타이틀 바
            docDefinition.content.push({
                table: {
                    widths: ['*'],
                    body: [[{
                        text:      '예산편성 신청 총괄표',
                        fontSize:  14,
                        bold:      true,
                        color:     'white',
                        fillColor: colors.primary,
                        border:    [false, false, false, false],
                        margin:    [10, 5, 10, 5]
                    }]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            });

            // 구분별 합계 통계 테이블 (정보화사업 / 경상사업 / 전산업무비 / 합계)
            docDefinition.content.push({
                table: {
                    widths: ['20%', '10%', '23%', '23%', '24%'],
                    body: [
                        // 헤더 행
                        [
                            { text: '구분',       style: 'label' },
                            { text: '건수',       style: 'label' },
                            { text: '총 예산',    style: 'label' },
                            { text: '자본예산',   style: 'label' },
                            { text: '일반관리비', style: 'label' }
                        ],
                        // 정보화사업 행
                        ...(regularProjects.length > 0 ? [[
                            { text: '정보화사업', bold: true, color: colors.primary },
                            { text: `${regularProjects.length}건`, alignment: 'center' as const },
                            { text: fmtAmt(regTotalBg),  alignment: 'right' as const },
                            { text: fmtAmt(regAssetBg),  alignment: 'right' as const },
                            { text: fmtAmt(regCostBg),   alignment: 'right' as const }
                        ]] : []),
                        // 경상사업 행
                        ...(ordinaryProjects.length > 0 ? [[
                            { text: '경상사업', bold: true, color: '#92400e' },
                            { text: `${ordinaryProjects.length}건`, alignment: 'center' as const },
                            { text: fmtAmt(ordTotalBg),  alignment: 'right' as const },
                            { text: fmtAmt(ordAssetBg),  alignment: 'right' as const },
                            { text: fmtAmt(ordCostBg),   alignment: 'right' as const }
                        ]] : []),
                        // 전산업무비 행
                        ...(costs.length > 0 ? [[
                            { text: '전산업무비', bold: true, color: '#065f46' },
                            { text: `${costs.length}건`, alignment: 'center' as const },
                            { text: fmtAmt(costTotalBg), alignment: 'right' as const },
                            { text: fmtAmt(costAssetBg), alignment: 'right' as const },
                            { text: fmtAmt(costCostBg),  alignment: 'right' as const }
                        ]] : []),
                        // 합계 행
                        [
                            { text: '합계', bold: true, fillColor: colors.headerBg, color: colors.primary },
                            { text: `${totalCount}건`, alignment: 'center' as const, bold: true, fillColor: colors.headerBg },
                            { text: fmtAmt(grandTotalBg), alignment: 'right' as const, bold: true, fillColor: colors.headerBg },
                            { text: fmtAmt(grandAssetBg), alignment: 'right' as const, bold: true, fillColor: colors.headerBg },
                            { text: fmtAmt(grandCostBg),  alignment: 'right' as const, bold: true, fillColor: colors.headerBg }
                        ]
                    ]
                },
                layout: tableLayout,
                margin: [0, 0, 0, 15]
            });

            // 사업/계약별 예산 현황 소제목
            docDefinition.content.push({
                text:     '사업/계약별 예산 현황',
                fontSize: 11,
                bold:     true,
                color:    colors.primary,
                margin:   [0, 0, 0, 6]
            });

            // 사업/계약별 예산 목록 테이블 (정보화사업 → 경상사업 → 전산업무비 구분)
            let rowNum = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allItemRows: any[][] = [];

            // 정보화사업 섹션
            if (regularProjects.length > 0) {
                allItemRows.push([
                    { text: '정보화사업', colSpan: 5, bold: true, color: colors.primary, fillColor: colors.headerBg, alignment: 'left' as const, margin: [4, 2, 0, 2] },
                    {}, {}, {}, {}
                ]);
                regularProjects.forEach(p => {
                    rowNum++;
                    allItemRows.push([
                        { text: String(rowNum), alignment: 'center' },
                        { text: cellVal(p.prjNm) },
                        { text: fmtAmt(p.prjBg   || 0), alignment: 'right' },
                        { text: fmtAmt(p.assetBg || 0), alignment: 'right' },
                        { text: fmtAmt(p.costBg  || 0), alignment: 'right' }
                    ]);
                });
            }

            // 경상사업 섹션
            if (ordinaryProjects.length > 0) {
                allItemRows.push([
                    { text: '경상사업', colSpan: 5, bold: true, color: '#92400e', fillColor: colors.headerBgOrd, alignment: 'left' as const, margin: [4, 2, 0, 2] },
                    {}, {}, {}, {}
                ]);
                ordinaryProjects.forEach(p => {
                    rowNum++;
                    allItemRows.push([
                        { text: String(rowNum), alignment: 'center' },
                        { text: cellVal(p.prjNm) },
                        { text: fmtAmt(p.prjBg   || 0), alignment: 'right' },
                        { text: fmtAmt(p.assetBg || 0), alignment: 'right' },
                        { text: fmtAmt(p.costBg  || 0), alignment: 'right' }
                    ]);
                });
            }

            // 전산업무비 섹션
            if (costs.length > 0) {
                allItemRows.push([
                    { text: '전산업무비', colSpan: 5, bold: true, color: '#065f46', fillColor: colors.headerBgCost, alignment: 'left' as const, margin: [4, 2, 0, 2] },
                    {}, {}, {}, {}
                ]);
                costs.forEach(c => {
                    rowNum++;
                    allItemRows.push([
                        { text: String(rowNum), alignment: 'center' },
                        { text: cellVal(c.cttNm) },
                        { text: fmtAmt(c.itMngcBg || 0), alignment: 'right' },
                        { text: fmtAmt(c.assetBg  || 0), alignment: 'right' },
                        { text: fmtAmt((c.itMngcBg || 0) - (c.assetBg || 0)), alignment: 'right' }
                    ]);
                });
            }

            docDefinition.content.push({
                table: {
                    widths: ['10%', '*', '20%', '17%', '17%'],
                    body: [
                        // 헤더 행
                        [
                            { text: '순번',        style: 'label' },
                            { text: '사업명/계약명', style: 'label' },
                            { text: '총 예산',     style: 'label' },
                            { text: '자본예산',    style: 'label' },
                            { text: '일반관리비',  style: 'label' }
                        ],
                        ...allItemRows
                    ]
                },
                layout: tableLayout
            });

            // ====================================================================
            // 1. 정보화사업 섹션 (1건 이상인 경우만)
            // ====================================================================

            if (projects.length > 0) {
                /** 경상사업 테이블 레이아웃 (앰버 색상) */
                const tableLayoutOrd = {
                    hLineWidth:  (_i: number) => 1,
                    vLineWidth:  (_i: number) => 1,
                    hLineColor:  (_i: number) => colors.borderOrd,
                    vLineColor:  (_i: number) => colors.borderOrd,
                    paddingTop:    (_i: number) => 8,
                    paddingBottom: (_i: number) => 8,
                    paddingLeft:   (_i: number) => 6,
                    paddingRight:  (_i: number) => 6
                };

                projects.forEach((project, index) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const isOrdinary = (project as any).ornYn === 'Y';

                    // 총괄표 이후이므로 항상 페이지 나누기
                    docDefinition.content.push({ text: '', pageBreak: 'before' });

                    // 헤더 (제목 + 결재선)
                    docDefinition.content.push(buildHeaderSection());

                    // 프로젝트 타이틀 바 (정보화사업: 블루, 경상사업: 앰버)
                    const titlePrefix = isOrdinary ? '[경상사업]' : '[정보화사업]';
                    docDefinition.content.push({
                        table: {
                            widths: ['*'],
                            body: [[{
                                text:      `${titlePrefix} ${index + 1}. ${project.prjNm}`,
                                fontSize:  14,
                                bold:      true,
                                color:     'white',
                                fillColor: isOrdinary ? colors.accentOrd : colors.accent,
                                border:    [false, false, false, false],
                                margin:    [10, 5, 10, 5]
                            }]]
                        },
                        layout: 'noBorders',
                        margin: [0, 0, 0, 10]
                    });

                    if (isOrdinary) {
                        // ── 경상사업 상세 테이블 (간소화) ──
                        const ordLabel = 'labelOrd';
                        docDefinition.content.push({
                            table: {
                                widths: ['15%', '35%', '15%', '35%'],
                                body: [
                                    [
                                        { text: '사업명',   style: ordLabel },
                                        { text: cellVal(project.prjNm), colSpan: 3, bold: true, color: '#92400e' },
                                        {}, {}
                                    ],
                                    [
                                        { text: '관리번호', style: ordLabel }, { text: cellVal(project.prjMngNo) },
                                        { text: '상태',     style: ordLabel }, { text: cellVal(project.prjSts) }
                                    ],
                                    [
                                        { text: '사업연도', style: ordLabel }, { text: cellVal(project.bgYy) },
                                        { text: '소요예산', style: ordLabel },
                                        { text: project.prjBg ? project.prjBg.toLocaleString() + ' 원' : '', bold: true, alignment: 'right' }
                                    ],
                                    [
                                        { text: '현황(Situation)',  style: ordLabel, fillColor: colors.headerBgOrd },
                                        { text: htmlToText(project.saf),    colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '필요성(Needs)',    style: ordLabel, fillColor: colors.headerBgOrd },
                                        { text: htmlToText(project.ncs),    colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '사업내용(Des)',    style: ordLabel, fillColor: colors.headerBgOrd },
                                        { text: htmlToText(project.prjDes), colSpan: 3 }, {}, {}
                                    ]
                                ]
                            },
                            layout: tableLayoutOrd
                        });
                    } else {
                        // ── 정보화사업 상세 테이블 (전체 필드) ──
                        docDefinition.content.push({
                            table: {
                                widths: ['15%', '35%', '15%', '35%'],
                                body: [
                                    [
                                        { text: '사업명',   style: 'label' },
                                        { text: cellVal(project.prjNm), colSpan: 3, bold: true, color: colors.primary },
                                        {}, {}
                                    ],
                                    [
                                        { text: '관리번호', style: 'label' }, { text: cellVal(project.prjMngNo) },
                                        { text: '사업유형', style: 'label' }, { text: cellVal(project.prjTp) }
                                    ],
                                    [
                                        { text: '상태',     style: 'label' }, { text: cellVal(project.prjSts) },
                                        { text: '보고상태', style: 'label' }, { text: cellVal(project.rprSts) }
                                    ],
                                    [
                                        { text: '사업연도', style: 'label' }, { text: cellVal(project.bgYy) },
                                        { text: '소요예산', style: 'label' },
                                        { text: project.prjBg ? project.prjBg.toLocaleString() + ' 원' : '', bold: true, alignment: 'right' }
                                    ],
                                    [
                                        { text: '시작일', style: 'label' }, { text: cellVal(project.sttDt) },
                                        { text: '종료일', style: 'label' }, { text: cellVal(project.endDt) }
                                    ],
                                    [
                                        { text: '주관부문', style: 'label' }, { text: cellVal(project.svnHdq) },
                                        { text: '주관부서', style: 'label' }, { text: cellVal(project.svnDpm) }
                                    ],
                                    [
                                        { text: '현업담당자', style: 'label' }, { text: cellVal(project.svnDpmCgpr) },
                                        { text: '현업팀장',   style: 'label' }, { text: cellVal(project.svnDpmTlr) }
                                    ],
                                    [
                                        { text: 'IT담당부서', style: 'label' }, { text: cellVal(project.itDpm) },
                                        { text: 'IT담당자',   style: 'label' },
                                        { text: `${cellVal(project.itDpmCgpr)} / ${cellVal(project.itDpmTlr)} (팀장)` }
                                    ],
                                    [
                                        { text: '주요사용자', style: 'label' }, { text: cellVal(project.mnUsr) },
                                        { text: '업무구분',   style: 'label' }, { text: cellVal(project.bzDtt) }
                                    ],
                                    [
                                        { text: '기술유형', style: 'label' }, { text: cellVal(project.tchnTp) },
                                        { text: '전결권',   style: 'label' }, { text: cellVal(project.edrt) }
                                    ],
                                    [
                                        { text: '중복여부', style: 'label' }, { text: cellVal(project.dplYn) },
                                        { text: '의무완료', style: 'label' }, { text: cellVal(project.lblFsgTlm) }
                                    ],
                                    [
                                        { text: '현황(Situation)',    style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.saf),        colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '필요성(Needs)',      style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.ncs),        colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '사업내용(Des)',      style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.prjDes),     colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '사업범위(Scope)',    style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.prjRng),     colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '기대효과(Effect)',   style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.xptEff),     colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '추진경과',           style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.pulPsg),     colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '문제점',             style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.plm),        colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '향후계획',           style: 'label', fillColor: colors.headerBg },
                                        { text: htmlToText(project.hrfPln),     colSpan: 3 }, {}, {}
                                    ],
                                    [
                                        { text: '추진가능성',         style: 'label', fillColor: colors.headerBg },
                                        { text: project.prjPulPtt != null ? String(project.prjPulPtt) : '-',  colSpan: 3 }, {}, {}
                                    ]
                                ]
                            },
                            layout: tableLayout
                        });
                    }
                });
            }

            // ====================================================================
            // 2. 전산업무비 섹션 (1건 이상인 경우만)
            // ====================================================================

            if (costs.length > 0) {
                costs.forEach((cost, index) => {

                    // 이전 내용(총괄표 또는 마지막 정보화사업)과 구분하기 위해 페이지 나누기
                    docDefinition.content.push({ text: '', pageBreak: 'before' });

                    // 헤더 (제목 + 결재선)
                    docDefinition.content.push(buildHeaderSection());

                    // 전산업무비 타이틀 바 (에메랄드 색 배경 + 흰색 텍스트)
                    docDefinition.content.push({
                        table: {
                            widths: ['*'],
                            body: [[{
                                text:      `[전산업무비] ${projects.length + index + 1}. ${cost.cttNm}`,
                                fontSize:  14,
                                bold:      true,
                                color:     'white',
                                fillColor: colors.accentCost,
                                border:    [false, false, false, false],
                                margin:    [10, 5, 10, 5]
                            }]]
                        },
                        layout: 'noBorders',
                        margin: [0, 0, 0, 10]
                    });

                    // 전산업무비 상세 정보 테이블 (4열 레이아웃: 15% | 35% | 15% | 35%)
                    docDefinition.content.push({
                        table: {
                            widths: ['15%', '35%', '15%', '35%'],
                            body: [
                                // 계약명 (전체 행 병합)
                                [
                                    { text: '계약명',   style: 'labelCost' },
                                    { text: cellVal(cost.cttNm), colSpan: 3, bold: true, color: '#065f46' },
                                    {}, {}
                                ],
                                // 비목명 / 계약구분
                                [
                                    { text: '비목코드',    style: 'labelCost' }, { text: cellVal(cost.ioeC) },
                                    { text: '계약구분',  style: 'labelCost' }, { text: cellVal(cost.pulDtt) }
                                ],
                                // 계약상대처 / 결재현황
                                [
                                    { text: '계약상대처', style: 'labelCost' }, { text: cellVal(cost.cttOpp) },
                                    { text: '결재현황',   style: 'labelCost' }, { text: cellVal(cost.apfSts) }
                                ],
                                // 전산업무비(총예산) / 자본예산
                                [
                                    { text: '전산업무비', style: 'labelCost' },
                                    { text: cost.itMngcBg ? cost.itMngcBg.toLocaleString() + ' 원' : '', bold: true, alignment: 'right' },
                                    { text: '자본예산',   style: 'labelCost' },
                                    { text: cost.assetBg  ? cost.assetBg.toLocaleString()  + ' 원' : '', bold: true, alignment: 'right' }
                                ],
                                // 추진담당자 / 추진부서
                                [
                                    { text: '담당자', style: 'labelCost' }, { text: cellVal(cost.cgprNm) },
                                    { text: '담당부서',   style: 'labelCost' }, { text: cellVal(cost.biceDpmNm) }
                                ],
                                // 지급주기 / 지급예정월
                                [
                                    { text: '지급주기',   style: 'labelCost' }, { text: cellVal(cost.dfrCle) },
                                    { text: '지급예정월', style: 'labelCost' }, { text: cellVal(typeof cost.fstDfrDt === 'string' ? cost.fstDfrDt : String(cost.fstDfrDt)) }
                                ],
                                // 통화 / 환율
                                [
                                    { text: '통화',     style: 'labelCost' }, { text: cellVal(cost.cur) },
                                    { text: '환율',     style: 'labelCost' }, { text: cost.xcr ? `${cost.xcr.toLocaleString()} (기준일: ${cellVal(cost.xcrBseDt)})` : '-' }
                                ],
                                // 정보보호여부 (3열 병합)
                                [
                                    { text: '정보보호여부', style: 'labelCost', fillColor: colors.headerBgCost },
                                    { text: cellVal(cost.infPrtYn), colSpan: 3 }, {}, {}
                                ],
                                // 증감사유 (3열 병합)
                                [
                                    { text: '증감사유', style: 'labelCost', fillColor: colors.headerBgCost },
                                    { text: cellVal(cost.indRsn), colSpan: 3 }, {}, {}
                                ]
                            ]
                        },
                        layout: tableLayoutCost
                    });
                });
            }

            // ====================================================================
            // 3. PDF 생성 및 Blob URL 반환
            // ====================================================================

            // pdfmake 싱글턴에 VFS/폰트 동기화
            /* pdfmake 0.3.x API: addVirtualFileSystem / addFonts */
            // @ts-expect-error pdfmake 0.3.x 전용 API로 @types/pdfmake에 미정의
            pdfMake.addVirtualFileSystem(currentVfs);
            // @ts-expect-error pdfmake 0.3.x 전용 API로 @types/pdfmake에 미정의
            pdfMake.addFonts(currentFonts);

            const pdfGenerator = pdfMake.createPdf(docDefinition);

            /**
             * [getBlob — pdfmake 0.3.x]
             * 0.3.x에서 getBlob()은 Promise를 반환합니다.
             * @types/pdfmake는 콜백 시그니처만 정의하므로 타입 단언 필요
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const blob = await (pdfGenerator as any).getBlob();
            const url = URL.createObjectURL(blob as Blob);
            return url;
        } catch (error) {
            console.error('Error in generateReport:', error);
            throw error;
        }
    };

    return {
        generateReport
    };
};
