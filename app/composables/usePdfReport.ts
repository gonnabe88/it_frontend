/**
 * ============================================================================
 * [usePdfReport] PDF 보고서 생성 Composable
 * ============================================================================
 * pdfmake 라이브러리를 사용하여 프로젝트 예산편성 신청서를 PDF로 생성합니다.
 * 한글 출력을 위해 NanumGothic 폰트를 동적으로 로드하여 적용합니다.
 *
 * [생성되는 PDF 구조]
 *  - 헤더 영역: 문서 제목(예산편성 신청) + 결재선 테이블 (기안자/팀장/부서장)
 *  - 프로젝트 타이틀 바: 순번 + 프로젝트명 (파란색 배경)
 *  - 프로젝트 상세 테이블: 기본 정보 + HTML 서술 필드 (현황/필요성/사업내용 등)
 *  - 페이지 푸터: 현재 페이지 / 전체 페이지 수
 *  - 다수 프로젝트 처리: 프로젝트별 페이지 나누기(pageBreak) 적용
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
import nanumGothic from '@/assets/fonts/NanumGothic-Regular.ttf?url';
import nanumGothicBold from '@/assets/fonts/NanumGothic-Bold.ttf?url';
import nanumGothicExtraBold from '@/assets/fonts/NanumGothic-ExtraBold.ttf?url';

/**
 * 모듈 수준 폰트 캐시
 * composable이 여러 번 호출되어도 폰트를 중복 로드하지 않도록 합니다.
 * HMR(Hot Module Replacement) 시에는 모듈이 재실행되어 캐시가 초기화됩니다.
 */
let cachedVfs: any = null;   // pdfmake VFS(Virtual File System): 폰트 파일 base64 저장소
let cachedFonts: any = null; // pdfmake 폰트 설정 객체 (fontName → 파일 매핑)

/**
 * pdfmake 기본값(Roboto VFS + 폰트 설정) 초기화
 * 최초 1회만 실행되며, 이후에는 캐시를 재사용합니다.
 */
const initDefaults = () => {
    // 이미 초기화된 경우 스킵
    if (cachedVfs && cachedFonts) return;

    // pdfmake/vfs_fonts에서 Roboto VFS를 가져옴 (패키지 버전별 구조 차이 대응)
    // @ts-ignore
    const defaultVfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ? pdfFonts.pdfMake.vfs : (pdfFonts.vfs ? pdfFonts.vfs : {});

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
interface ApprovalLine {
    drafter:  { name: string; rank: string; date: string; id: string }; // 기안자
    teamLead: { name: string; rank: string; date: string; id: string }; // 팀장
    deptHead: { name: string; rank: string; date: string; id: string }; // 부서장
}

/**
 * PDF 보고서 생성 Composable 함수
 *
 * @returns PDF 생성 관련 함수 객체
 *   - generateReport: 프로젝트 배열과 결재선을 받아 PDF Blob URL을 반환
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
            console.log('Using cached font (local state):', fontName);
            return fontName;
        }

        try {
            console.log('Start loading fonts...');
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

            console.log('Fonts registered in local cache.');
            return fontName;
        } catch (e) {
            // 폰트 로드 실패 시 기본 Roboto로 폴백
            console.error('Korean font loading failed, falling back to Roboto', e);
            return 'Roboto';
        }
    };

    /**
     * 프로젝트 예산편성 신청서 PDF 생성
     *
     * [PDF 레이아웃 구성]
     *  1. 헤더 영역: "예산편성 신청" 제목 + 결재선(기안자/팀장/부서장) 테이블
     *  2. 프로젝트 타이틀 바: 파란색 배경의 프로젝트명
     *  3. 프로젝트 상세 정보 테이블: 4열 그리드 (레이블 | 값 | 레이블 | 값)
     *  4. 서술 필드: 현황/필요성/사업내용/범위/기대효과/추진사유 등 (HTML → 일반 텍스트 변환)
     *  5. 페이지 푸터: 페이지 번호
     *
     * @param projects     - PDF에 포함할 프로젝트 상세 정보 배열
     * @param approvalLine - 결재선 정보 (기안자, 팀장, 부서장)
     * @returns PDF Blob URL (window.URL.createObjectURL 결과, `<iframe src="">` 또는 다운로드에 사용)
     * @throws PDF 생성 중 오류 발생 시 에러를 throw
     *
     * @example
     * const { generateReport } = usePdfReport();
     * const pdfUrl = await generateReport(selectedProjects, {
     *   drafter:  { name: '홍길동', rank: '대리', date: '2026-01-01', id: 'E001' },
     *   teamLead: { name: '김팀장', rank: '팀장', date: '',           id: 'E002' },
     *   deptHead: { name: '이부장', rank: '부장', date: '',           id: 'E003' }
     * });
     * // pdfUrl을 <a href={pdfUrl} download> 또는 <iframe src={pdfUrl}>에 사용
     */
    const generateReport = async (projects: ProjectDetail[], approvalLine: ApprovalLine) => {
        try {
            console.log('generateReport START');

            // 한글 폰트 로드 (캐시 활용)
            const font = await loadKoreanFont();
            console.log('Font loaded:', font);

            // 로컬 캐시 참조 (VFS와 폰트 설정이 항상 쌍을 이루도록 보장)
            const currentVfs   = cachedVfs;
            const currentFonts = cachedFonts;

            // PDF 디자인 색상 상수 (Blue/Indigo 테마)
            const colors = {
                primary:  '#1e3a8a', // 다크 블루 (텍스트/헤더)
                accent:   '#2563eb', // 블루 600 (강조색, 타이틀 배경)
                headerBg: '#eff6ff', // 블루 50 (테이블 헤더 배경)
                border:   '#bfdbfe', // 블루 200 (테이블 경계선)
                textGray: '#4b5563'  // 그레이 600 (보조 텍스트)
            };

            // pdfmake 문서 정의 객체 초기화
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

            // 프로젝트별 콘텐츠 생성
            projects.forEach((project, index) => {

                // 두 번째 프로젝트부터 페이지 나누기 삽입
                if (index > 0) {
                    docDefinition.content.push({ text: '', pageBreak: 'before' });
                }

                // ====================================================================
                // 1. 헤더 영역: 문서 제목 + 결재선 테이블
                // ====================================================================

                /**
                 * 결재선 테이블 (기안자 / 팀장 / 부서장)
                 * 각 열에 직위, 이름, 결재일자를 표시합니다.
                 * 결재자가 미지정된 경우 회색 텍스트로 표시합니다.
                 */
                const approvalTable = {
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
                            // 결재일자 행
                            [
                                { text: approvalLine.drafter.date,  fontSize: 8, alignment: 'center', color: colors.textGray },
                                { text: approvalLine.teamLead.date, fontSize: 8, alignment: 'center', color: colors.textGray },
                                { text: approvalLine.deptHead.date, fontSize: 8, alignment: 'center', color: colors.textGray }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: (i:number) => 1,
                        vLineWidth: (i:number) => 1,
                        hLineColor: colors.border,
                        vLineColor: colors.border,
                        // 이름 행(index 1)의 세로 패딩을 늘려 가운데 정렬 효과
                        paddingTop:    (i:number, node:any) => i === 1 ? 12 : 4,
                        paddingBottom: (i:number, node:any) => i === 1 ? 12 : 4
                    }
                };

                // 2단 컬럼: 왼쪽(문서 제목/번호) + 오른쪽(결재선 테이블)
                const headerSection = {
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
                            stack: [approvalTable]
                        }
                    ],
                    margin: [0, 0, 0, 20]
                };

                docDefinition.content.push(headerSection);

                // ====================================================================
                // 2. 프로젝트 타이틀 바 (파란색 배경 + 흰색 텍스트)
                // ====================================================================
                docDefinition.content.push({
                    table: {
                        widths: ['*'],
                        body: [
                            [{
                                text:      `${index + 1}. ${project.prjNm}`,
                                fontSize:  14,
                                bold:      true,
                                color:     'white',
                                fillColor: colors.accent,
                                border:    [false, false, false, false],
                                margin:    [10, 5, 10, 5]
                            }]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 10]
                });

                // ====================================================================
                // 3. 프로젝트 상세 정보 테이블 (4열 레이아웃: 15% | 35% | 15% | 35%)
                // ====================================================================

                /**
                 * null/undefined 값을 빈 문자열로 변환하는 헬퍼
                 * @param val - 변환할 값
                 * @returns 문자열 또는 빈 문자열
                 */
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

                // 기본 정보 + 서술 필드를 포함한 메인 테이블
                docDefinition.content.push({
                    table: {
                        widths: ['15%', '35%', '15%', '35%'],
                        body: [
                            // 기본 정보 행들 (2열 병합 또는 4열 독립)
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
                                { text: '예산년도', style: 'label' }, { text: cellVal(project.bgYy) },
                                { text: '소요예산', style: 'label' },
                                // 예산 금액은 통화 형식으로 표시 (오른쪽 정렬)
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
                                // IT담당자와 팀장을 슬래시(/)로 구분하여 한 셀에 표시
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
                            // HTML 서술 필드 (colSpan: 3으로 오른쪽 3열 병합)
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
                                { text: '추진사유',           style: 'label', fillColor: colors.headerBg },
                                { text: htmlToText(project.pulRsn),     colSpan: 3 }, {}, {}
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
                                { text: htmlToText(project.prjPulPtt),  colSpan: 3 }, {}, {}
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth:  (i: number) => 1,
                        vLineWidth:  (i: number) => 1,
                        hLineColor:  (i: number) => colors.border,
                        vLineColor:  (i: number) => colors.border,
                        paddingTop:    (i: number) => 8,
                        paddingBottom: (i: number) => 8,
                        paddingLeft:   (i: number) => 6,
                        paddingRight:  (i: number) => 6
                    }
                });
            });

            // ====================================================================
            // 4. PDF 생성 및 Blob URL 반환
            // ====================================================================

            /**
             * pdfmake 싱글턴 인스턴스 획득
             * 브라우저 환경에서 window.pdfMake가 존재하면 우선 사용합니다.
             */
            const targetPdfMake = (window as any).pdfMake || pdfMake;

            /**
             * VFS(Virtual File System) 동기화
             * pdfmake 싱글턴에 최신 캐시(폰트 base64 데이터)를 적용합니다.
             * addVirtualFileSystem 메서드 → vfs 직접 할당 순서로 폴백합니다.
             */
            if (targetPdfMake.addVirtualFileSystem) {
                targetPdfMake.addVirtualFileSystem(currentVfs);
                console.log('Called targetPdfMake.addVirtualFileSystem with VFS keys:', Object.keys(currentVfs));
            } else if (targetPdfMake.vfs) {
                // 구버전 또는 메서드 미제공 환경 폴백: 직접 병합
                Object.assign(targetPdfMake.vfs, currentVfs);
            } else {
                console.warn('Could not find addVirtualFileSystem or vfs property on pdfMake instance');
                targetPdfMake.vfs = currentVfs;
            }

            /**
             * 폰트 설정 동기화
             * addFonts 메서드 → fonts 객체 직접 병합 순서로 폴백합니다.
             */
            if (targetPdfMake.addFonts) {
                console.log('Adding fonts via addFonts');
                targetPdfMake.addFonts(currentFonts);
            } else {
                Object.assign(targetPdfMake.fonts, currentFonts);
            }

            console.log('Generating PDF. Target Fonts:', Object.keys(targetPdfMake.fonts));

            // PDF 생성기(Generator) 생성
            const pdfGenerator = targetPdfMake.createPdf(docDefinition, {});
            console.log('PDF Generator created:', pdfGenerator, 'Type:', typeof pdfGenerator);

            /**
             * PDF 데이터를 스트림으로 수집하여 Blob URL 생성
             * pdfDocumentPromise: pdfmake 내부 PDFDocument 객체 (이벤트 기반 스트림)
             *  - 'data' 이벤트: PDF 청크 데이터 수신
             *  - 'end'  이벤트: 생성 완료, 전체 청크를 합쳐 Blob 생성
             *  - 'error' 이벤트: 생성 오류 처리
             */
            return new Promise<string>(async (resolve, reject) => {
                try {
                    console.log('Accessing pdfDocumentPromise...');

                    // PDFDocument 객체 대기 (비동기 초기화)
                    const pdfDoc = await (pdfGenerator as any).pdfDocumentPromise;
                    console.log('PDF Document ready:', pdfDoc);

                    // 청크 수집 배열
                    const chunks: Uint8Array[] = [];

                    // 데이터 청크 수신 이벤트
                    pdfDoc.on('data', (chunk: any) => {
                        console.log('Received chunk, length:', chunk.length);
                        chunks.push(new Uint8Array(chunk));
                    });

                    // PDF 생성 완료 이벤트
                    pdfDoc.on('end', () => {
                        console.log('PDF generation complete, total chunks:', chunks.length);

                        // 모든 청크를 하나의 Uint8Array로 결합
                        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                        const buffer = new Uint8Array(totalLength);
                        let offset = 0;
                        for (const chunk of chunks) {
                            buffer.set(chunk, offset);
                            offset += chunk.length;
                        }

                        console.log('Buffer created, total length:', buffer.length);
                        // Blob 및 Object URL 생성 (메모리에 PDF 데이터 보관)
                        const blob = new Blob([buffer], { type: 'application/pdf' });
                        const url  = URL.createObjectURL(blob);
                        console.log('✓ Blob URL created:', url);
                        resolve(url);
                    });

                    // PDF 생성 오류 이벤트
                    pdfDoc.on('error', (error: any) => {
                        console.error('PDFDocument error:', error);
                        reject(error);
                    });

                    // PDF 스트림 생성 시작 (end 이벤트 트리거)
                    pdfDoc.end();

                } catch (error) {
                    console.error('Error using pdfDocumentPromise:', error);
                    reject(error);
                }
            });
        } catch (error) {
            console.error('Error in generateReport:', error);
            throw error;
        }
    };

    return {
        generateReport
    };
};
