/**
 * ============================================================================
 * [utils/hwpx.ts] HTML → HWPX (한글 문서) 변환 유틸리티
 * ============================================================================
 * 실제 HWP가 생성한 HWPX 파일(변경.hwpx)을 직접 분석하여 동일한 구조를 구현합니다.
 *
 * [서식 기준: 변경.hwpx]
 *  - 폰트: 맑은 고딕 (font id=1)
 *  - 본문: 10pt, 줄간격 180%, 단락 전후 400
 *  - bold: <hh:bold/> 빈 요소 방식
 *  - 태그명: charProperties / paraProperties / styles / tabProperties
 *  - secPr 단락: paraPrIDRef=2, charPrIDRef=2 (15pt 맑은 고딕)
 *  - 추가 요소: tabProperties, compatibleDocument, docOption, trackchageConfig
 *  - style 속성: langID (langIDRef 아님)
 *
 * [charPr 매핑 (변경 파일 기준)]
 *  id=0: 한컴바탕 10pt (기존 호환, borderFillIDRef=1)
 *  id=1: 맑은 고딕 10pt         → 일반 본문 / 표 데이터 셀
 *  id=2: 맑은 고딕 15pt         → secPr 제어 단락
 *  id=3: 맑은 고딕 15pt + bold  → H1
 *  id=4: 맑은 고딕 10pt + bold  → H2~H4, inline bold, 표 헤더 셀
 *  id=5: 맑은 고딕 12pt         → H3
 *
 * [paraPr 매핑 (변경 파일 기준)]
 *  id=0: 기본 160%, 간격 없음        → 표 데이터 셀
 *  id=1: 가운데 160%                 → 표 헤더 셀
 *  id=2: 양쪽 180%, prev/next=400   → secPr + 일반 단락
 *  id=3: 양쪽 180%, indent=-5642    → (예비)
 *  id=4: 양쪽 180%, prev=1000       → 제목 단락
 *  id=5: 양쪽 180%, indent=-6138    → 목록 단락
 *
 * [표 구조 (변경 파일 기준)]
 *  - 표는 <hp:p><hp:run><hp:tbl>...</hp:tbl></hp:run></hp:p> (인라인 객체)
 *  - th 셀: borderFillIDRef=4(파란 배경) + paraPrIDRef=1(가운데) + charPrIDRef=4(bold)
 *  - td 셀: borderFillIDRef=3(흰 배경)  + paraPrIDRef=0(기본)   + charPrIDRef=1(본문)
 *  - 전체 표 너비: 41954 HWPUNIT (A4 텍스트 영역 - outMargin)
 *  - 행 높이: 1848 HWPUNIT (고정)
 * ============================================================================
 */

import JSZip from 'jszip';

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────

/** 변경 파일 기준 charPr ID */
const CHAR_PR = {
    COMPAT:  0,   // 한컴바탕 10pt (기존 호환)
    NORMAL:  1,   // 맑은 고딕 10pt
    SEC:     2,   // 맑은 고딕 15pt (secPr 단락용)
    H1:      3,   // 맑은 고딕 15pt + bold
    BOLD:    4,   // 맑은 고딕 10pt + bold  (H2~H4, inline bold, 표 헤더)
    H3:      5,   // 맑은 고딕 12pt
} as const;
type CharPrId = (typeof CHAR_PR)[keyof typeof CHAR_PR];

/** 변경 파일 기준 paraPr ID */
const PARA_PR = {
    BASE:   0,   // 기본 160%             (표 데이터 셀)
    CENTER: 1,   // 가운데 160%           (표 헤더 셀)
    NORMAL: 2,   // 양쪽 180%, 전후 400  (secPr + 일반 단락)
    INDENT: 3,   // 양쪽 180%, indent=-5642
    HEAD:   4,   // 양쪽 180%, prev=1000  (제목)
    LIST:   5,   // 양쪽 180%, indent=-6138 (목록)
} as const;
type ParaPrId = (typeof PARA_PR)[keyof typeof PARA_PR];

/** HTML 블록 태그 → (paraPrId, charPrId, prefix) 매핑 */
const TAG_MAP: Record<string, { para: ParaPrId; char: CharPrId; prefix?: string }> = {
    p:  { para: PARA_PR.NORMAL, char: CHAR_PR.NORMAL },
    h1: { para: PARA_PR.HEAD,   char: CHAR_PR.H1                   },
    h2: { para: PARA_PR.HEAD,   char: CHAR_PR.H1                   },
    h3: { para: PARA_PR.HEAD,   char: CHAR_PR.H3,   prefix: '□ ' },  // 12pt, □ 수식어
    h4: { para: PARA_PR.HEAD,   char: CHAR_PR.BOLD,  prefix: 'ㅇ ' },  // 10pt bold, ㅇ 수식어
    h5: { para: PARA_PR.HEAD,   char: CHAR_PR.BOLD  },
    h6: { para: PARA_PR.HEAD,   char: CHAR_PR.BOLD  },
};

// 표 관련 상수 (변경 파일 기준)
const TABLE_WIDTH  = 41954;  // 전체 표 너비 (HWPUNIT)
const ROW_HEIGHT   = 1848;   // 행 높이 (HWPUNIT)
const CELL_BF_TH   = 4;      // th 셀 borderFillIDRef (파란 배경)
const CELL_BF_TD   = 3;      // td 셀 borderFillIDRef (흰 배경 실선)

// ─────────────────────────────────────────────────────────────────────────────
// 문서 노드 타입
// ─────────────────────────────────────────────────────────────────────────────

interface TextRun {
    text: string;
    charPrId: CharPrId;
}

interface ParagraphNode {
    type: 'para';
    paraPrId: ParaPrId;
    charPrId: CharPrId;
    runs: TextRun[];
}

interface CellData {
    isHeader: boolean;   // th 태그 여부
    runs: TextRun[];
}

interface TableNode {
    type: 'table';
    rows: CellData[][];
}

type DocNode = ParagraphNode | TableNode;

// ─────────────────────────────────────────────────────────────────────────────
// XML 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

const escXml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** 공통 xmlns 선언 (정상/변경 파일과 동일) */
const COMMON_XMLNS =
    'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" ' +
    'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" ' +
    'xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" ' +
    'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" ' +
    'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" ' +
    'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" ' +
    'xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" ' +
    'xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" ' +
    'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:opf="http://www.idpf.org/2007/opf/" ' +
    'xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" ' +
    'xmlns:epub="http://www.idpf.org/2007/ops" ' +
    'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';

// ─────────────────────────────────────────────────────────────────────────────
// Contents/header.xml 생성 (변경 파일 구조 기반)
// ─────────────────────────────────────────────────────────────────────────────

const makeCharPr = (
    id: number,
    height: number,
    fontIdx: number,
    borderFillId: number,
    opts: { bold?: boolean; italic?: boolean; underline?: boolean } = {},
): string => {
    const f = String(fontIdx);
    return (
        `<hh:charPr id="${id}" height="${height}" textColor="#000000" shadeColor="none" ` +
        `useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${borderFillId}">` +
        `<hh:fontRef hangul="${f}" latin="${f}" hanja="${f}" japanese="${f}" other="${f}" symbol="${f}" user="${f}"/>` +
        `<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>` +
        `<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>` +
        `<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>` +
        `<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>` +
        (opts.bold      ? `<hh:bold/>`      : '') +
        (opts.italic    ? `<hh:italic/>`    : '') +
        (opts.underline ? `<hh:underline/>` : '') +
        `</hh:charPr>`
    );
};

const makeParaPr = (
    id: number,
    opts: {
        align?: 'JUSTIFY' | 'CENTER';
        lineSpacing?: number;
        prevMargin?: number;
        nextMargin?: number;
        indent?: number;
        borderFillId?: number;
        breakNonLatin?: 'KEEP_WORD' | 'BREAK_WORD';
    } = {},
): string => {
    const {
        align         = 'JUSTIFY',
        lineSpacing   = 180,
        prevMargin    = 0,
        nextMargin    = 0,
        indent        = 0,
        borderFillId  = 2,
        breakNonLatin = 'KEEP_WORD',
    } = opts;
    return (
        `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">` +
        `<hh:align horizontal="${align}" vertical="BASELINE"/>` +
        `<hh:heading type="NONE" idRef="0" level="0"/>` +
        `<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="${breakNonLatin}" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>` +
        `<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>` +
        `<hh:margin>` +
        `<hc:intent value="${indent}" unit="HWPUNIT"/>` +
        `<hc:left value="0" unit="HWPUNIT"/>` +
        `<hc:right value="0" unit="HWPUNIT"/>` +
        `<hc:prev value="${prevMargin}" unit="HWPUNIT"/>` +
        `<hc:next value="${nextMargin}" unit="HWPUNIT"/>` +
        `</hh:margin>` +
        `<hh:lineSpacing type="PERCENT" value="${lineSpacing}" unit="HWPUNIT"/>` +
        `<hh:border borderFillIDRef="${borderFillId}" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>` +
        `</hh:paraPr>`
    );
};

const makeFontface = (lang: string): string =>
    `<hh:fontface lang="${lang}" fontCnt="2">` +
    `<hh:font id="0" face="한컴바탕" type="TTF" isEmbedded="0">` +
    `<hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="0" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>` +
    `</hh:font>` +
    `<hh:font id="1" face="맑은 고딕" type="TTF" isEmbedded="0">` +
    `<hh:typeInfo familyType="FCAT_GOTHIC" weight="5" proportion="3" contrast="2" strokeVariation="0" armStyle="0" letterform="2" midline="0" xHeight="4"/>` +
    `</hh:font>` +
    `</hh:fontface>`;

const buildHeaderXml = (): string =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<hh:head ${COMMON_XMLNS} version="1.2" secCnt="1">` +
    `<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>` +
    `<hh:refList>` +
    `<hh:fontfaces itemCnt="7">` +
    ['HANGUL','LATIN','HANJA','JAPANESE','OTHER','SYMBOL','USER'].map(makeFontface).join('') +
    `</hh:fontfaces>` +
    // borderFills: 4개 (변경 파일 기준)
    `<hh:borderFills itemCnt="4">` +
    // id=1: 기본 (채우기 없음)
    `<hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>` +
    `</hh:borderFill>` +
    // id=2: fillBrush (투명, 맑은 고딕 charPr 기본)
    `<hh:borderFill id="2" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>` +
    `<hc:fillBrush><hc:winBrush faceColor="none" hatchColor="#000000" alpha="0"/></hc:fillBrush>` +
    `</hh:borderFill>` +
    // id=3: 실선 테두리 (표 td 셀, 표 전체 테두리)
    `<hh:borderFill id="3" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:rightBorder type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hh:topBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:bottomBorder type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>` +
    `</hh:borderFill>` +
    // id=4: 실선 테두리 + 파란 배경 (표 th 셀)
    `<hh:borderFill id="4" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:rightBorder type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hh:topBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:bottomBorder type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>` +
    `<hc:fillBrush><hc:winBrush faceColor="#DFE6F7" hatchColor="#999999" alpha="0"/></hc:fillBrush>` +
    `</hh:borderFill>` +
    `</hh:borderFills>` +
    // charProperties (6개)
    `<hh:charProperties itemCnt="6">` +
    makeCharPr(CHAR_PR.COMPAT, 1000, 0, 1)               +
    makeCharPr(CHAR_PR.NORMAL, 1000, 1, 2)               +
    makeCharPr(CHAR_PR.SEC,    1500, 1, 2)               +
    makeCharPr(CHAR_PR.H1,     1500, 1, 2, { bold: true }) +
    makeCharPr(CHAR_PR.BOLD,   1000, 1, 2, { bold: true }) +
    makeCharPr(CHAR_PR.H3,     1200, 1, 2)               +
    `</hh:charProperties>` +
    // tabProperties
    `<hh:tabProperties itemCnt="1">` +
    `<hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/>` +
    `</hh:tabProperties>` +
    // paraProperties (6개)
    `<hh:paraProperties itemCnt="6">` +
    makeParaPr(PARA_PR.BASE,   { lineSpacing: 160, borderFillId: 1 })                            +
    makeParaPr(PARA_PR.CENTER, { align: 'CENTER', lineSpacing: 160, borderFillId: 2, breakNonLatin: 'BREAK_WORD' }) +
    makeParaPr(PARA_PR.NORMAL, { prevMargin: 400, nextMargin: 400 })                             +
    makeParaPr(PARA_PR.INDENT, { indent: -5642, prevMargin: 400, nextMargin: 400 })              +
    makeParaPr(PARA_PR.HEAD,   { prevMargin: 1000, nextMargin: 400 })                            +
    makeParaPr(PARA_PR.LIST,   { indent: -6138, prevMargin: 400, nextMargin: 400 })              +
    `</hh:paraProperties>` +
    // styles
    `<hh:styles itemCnt="1">` +
    `<hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="${PARA_PR.BASE}" charPrIDRef="${CHAR_PR.COMPAT}" nextStyleIDRef="0" langID="1042" lockForm="0"/>` +
    `</hh:styles>` +
    `</hh:refList>` +
    `<hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>` +
    `<hh:docOption><hh:linkinfo path="" pageInherit="1" footnoteInherit="0"/></hh:docOption>` +
    `<hh:trackchageConfig flags="56"/>` +
    `</hh:head>`;

// ─────────────────────────────────────────────────────────────────────────────
// HTML → DocNode 변환
// ─────────────────────────────────────────────────────────────────────────────

/** 인라인 요소에서 TextRun 배열 추출 */
const extractRuns = (node: Node, inheritedCharPr: CharPrId): TextRun[] => {
    const runs: TextRun[] = [];

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) runs.push({ text, charPrId: inheritedCharPr });
        return runs;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return runs;

    const el  = node as Element;
    const tag = el.tagName.toLowerCase();
    let charPr = inheritedCharPr;

    if (tag === 'strong' || tag === 'b') {
        charPr = CHAR_PR.BOLD;
    } else if (tag === 'br') {
        return runs;
    }
    // em, u, s 등은 별도 charPr 없이 현재 상속값 유지

    for (const child of Array.from(el.childNodes)) {
        runs.push(...extractRuns(child, charPr));
    }
    return runs;
};

/**
 * HTML 문자열을 DocNode 배열로 변환합니다.
 * 표는 TableNode, 나머지는 ParagraphNode로 변환합니다.
 */
const htmlToDocNodes = (html: string): DocNode[] => {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const root   = doc.querySelector('div')!;
    const nodes: DocNode[] = [];

    const addEmptyPara = (paraPrId: ParaPrId, charPrId: CharPrId) =>
        nodes.push({ type: 'para', paraPrId, charPrId, runs: [{ text: '', charPrId }] });

    const processNode = (el: Element): void => {
        const tag = el.tagName?.toLowerCase();
        if (!tag) return;

        const mapping = TAG_MAP[tag];

        if (mapping) {
            // 일반 단락 (p, h1~h6)
            if (tag === 'p') {
                const isBreakOnly = el.childNodes.length === 1
                    && (el.childNodes[0] as Element)?.tagName?.toLowerCase() === 'br';
                if (isBreakOnly) { addEmptyPara(PARA_PR.NORMAL, CHAR_PR.NORMAL); return; }
            }
            const runs = extractRuns(el, mapping.char);
            // h2(□), h3(ㅇ) 수식어를 runs 맨 앞에 삽입
            if (mapping.prefix) runs.unshift({ text: mapping.prefix, charPrId: mapping.char });
            nodes.push({
                type: 'para',
                paraPrId: mapping.para,
                charPrId: mapping.char,
                runs: runs.length ? runs : [{ text: '', charPrId: mapping.char }],
            });

        } else if (tag === 'ol' || tag === 'ul') {
            // 목록
            let idx = 0;
            for (const li of Array.from(el.children)) {
                if (li.tagName.toLowerCase() !== 'li') continue;
                idx++;
                const prefix = tag === 'ol' ? `${idx}. ` : '• ';
                const runs   = extractRuns(li, CHAR_PR.NORMAL);
                runs.unshift({ text: prefix, charPrId: CHAR_PR.NORMAL });
                nodes.push({ type: 'para', paraPrId: PARA_PR.LIST, charPrId: CHAR_PR.NORMAL, runs });
                // 중첩 목록
                for (const child of Array.from(li.children)) {
                    const ct = child.tagName.toLowerCase();
                    if (ct === 'ol' || ct === 'ul') processNode(child);
                }
            }

        } else if (tag === 'table') {
            // 표 → TableNode
            const tableRows: CellData[][] = [];
            for (const tr of Array.from(el.querySelectorAll('tr'))) {
                const cells: CellData[] = [];
                for (const cell of Array.from(tr.querySelectorAll('th, td'))) {
                    const isHeader = cell.tagName.toLowerCase() === 'th';
                    const charPr   = isHeader ? CHAR_PR.BOLD : CHAR_PR.NORMAL;
                    const runs     = extractRuns(cell, charPr);
                    cells.push({ isHeader, runs: runs.length ? runs : [{ text: '', charPrId: charPr }] });
                }
                if (cells.length > 0) tableRows.push(cells);
            }
            if (tableRows.length > 0) nodes.push({ type: 'table', rows: tableRows });

        } else if (tag === 'blockquote' || tag === 'div' || tag === 'figure') {
            for (const child of Array.from(el.children)) processNode(child);
        }
    };

    for (const child of Array.from(root.children)) processNode(child);
    if (nodes.length === 0) addEmptyPara(PARA_PR.NORMAL, CHAR_PR.NORMAL);
    return nodes;
};

// ─────────────────────────────────────────────────────────────────────────────
// Contents/section0.xml 생성
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 단락 XML 생성
 */
const buildParaXml = (para: ParagraphNode, id: number): string => {
    const runsXml = para.runs.map(run =>
        `<hp:run charPrIDRef="${run.charPrId}">` +
        `<hp:t xml:space="preserve">${escXml(run.text)}</hp:t>` +
        `</hp:run>`
    ).join('');
    return (
        `<hp:p id="${id}" paraPrIDRef="${para.paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        runsXml +
        `</hp:p>`
    );
};

/**
 * 표 XML 생성 (변경 파일 구조 기반)
 *
 * 구조: <hp:p><hp:run><hp:tbl>...</hp:tbl></hp:run></hp:p>
 * - th 셀: borderFillIDRef=4(파란 배경), paraPrIDRef=1(가운데), charPrIDRef=4(bold)
 * - td 셀: borderFillIDRef=3(흰 배경),   paraPrIDRef=0(기본),   charPrIDRef=1(본문)
 * - 열 너비: 균등 분배 (TABLE_WIDTH / colCnt)
 */
const buildTableXml = (table: TableNode, paraId: number): string => {
    const rowCnt  = table.rows.length;
    const colCnt  = Math.max(...table.rows.map(r => r.length), 1);
    const colW    = Math.floor(TABLE_WIDTH / colCnt);
    const lastColW = TABLE_WIDTH - colW * (colCnt - 1);  // 나머지 너비를 마지막 열에 추가
    const totalH  = rowCnt * ROW_HEIGHT;
    const tblId   = Math.floor(Math.random() * 0x7FFFFFFF);

    const rowsXml = table.rows.map((row, r) => {
        const cellsXml = row.map((cell, c) => {
            const isLastCol  = c === colCnt - 1;
            const cellWidth  = isLastCol ? lastColW : colW;
            const bfId       = cell.isHeader ? CELL_BF_TH : CELL_BF_TD;
            const paraPrId   = cell.isHeader ? PARA_PR.CENTER : PARA_PR.BASE;
            const charPrId   = cell.isHeader ? CHAR_PR.BOLD   : CHAR_PR.NORMAL;
            const runs       = cell.runs.length ? cell.runs : [{ text: '', charPrId }];

            const runsXml = runs.map(run =>
                `<hp:run charPrIDRef="${run.charPrId}">` +
                `<hp:t xml:space="preserve">${escXml(run.text)}</hp:t>` +
                `</hp:run>`
            ).join('');

            return (
                `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bfId}">` +
                `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" ` +
                `linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
                `<hp:p id="0" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
                runsXml +
                `</hp:p>` +
                `</hp:subList>` +
                `<hp:cellAddr colAddr="${c}" rowAddr="${r}"/>` +
                `<hp:cellSpan colSpan="1" rowSpan="1"/>` +
                `<hp:cellSz width="${cellWidth}" height="${ROW_HEIGHT}"/>` +
                `<hp:cellMargin left="510" right="510" top="141" bottom="141"/>` +
                `</hp:tc>`
            );
        }).join('');

        return `<hp:tr>${cellsXml}</hp:tr>`;
    }).join('');

    // 표는 단락 내 인라인 객체로 삽입 (변경 파일과 동일한 구조)
    return (
        `<hp:p id="${paraId}" paraPrIDRef="${PARA_PR.NORMAL}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${CHAR_PR.H1}">` +
        `<hp:tbl id="${tblId}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" ` +
        `lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" ` +
        `rowCnt="${rowCnt}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">` +
        `<hp:sz width="${TABLE_WIDTH}" widthRelTo="ABSOLUTE" height="${totalH}" heightRelTo="ABSOLUTE" protect="0"/>` +
        `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" ` +
        `vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
        `<hp:outMargin left="283" right="283" top="283" bottom="283"/>` +
        `<hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
        rowsXml +
        `</hp:tbl>` +
        `</hp:run>` +
        `</hp:p>`
    );
};

/**
 * section0.xml 생성
 * - 첫 번째 단락(id=0)에 secPr 내장
 * - 이후 각 DocNode를 순서대로 변환 (id=1부터)
 */
const buildSectionXml = (nodes: DocNode[]): string => {
    // secPr 제어 단락 (변경 파일 기준: paraPrIDRef=2, charPrIDRef=2)
    const secPrPara =
        `<hp:p id="0" paraPrIDRef="${PARA_PR.NORMAL}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${CHAR_PR.SEC}">` +
        `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">` +
        `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>` +
        `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>` +
        `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>` +
        `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
        `<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">` +
        `<hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>` +
        `</hp:pagePr>` +
        `<hp:footNotePr>` +
        `<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>` +
        `<hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>` +
        `<hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>` +
        `<hp:numbering type="CONTINUOUS" newNum="1"/>` +
        `<hp:placement place="EACH_COLUMN" beneathText="0"/>` +
        `</hp:footNotePr>` +
        `<hp:endNotePr>` +
        `<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>` +
        `<hp:noteLine length="-4" type="SOLID" width="0.12 mm" color="#000000"/>` +
        `<hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>` +
        `<hp:numbering type="CONTINUOUS" newNum="1"/>` +
        `<hp:placement place="END_OF_DOCUMENT" beneathText="0"/>` +
        `</hp:endNotePr>` +
        `<hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER">` +
        `<hp:offset left="0" right="0" top="0" bottom="0"/>` +
        `</hp:pageBorderFill>` +
        `</hp:secPr>` +
        `</hp:run>` +
        `</hp:p>`;

    // 내용 노드 변환 (id=1부터)
    const contentXml = nodes.map((node, idx) => {
        const id = idx + 1;
        if (node.type === 'para')  return buildParaXml(node, id);
        if (node.type === 'table') return buildTableXml(node, id);
        return '';
    }).join('');

    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<hs:sec ${COMMON_XMLNS}>${secPrPara}${contentXml}</hs:sec>`
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 보조 파일들
// ─────────────────────────────────────────────────────────────────────────────

const buildContentHpf = (): string =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<opf:package ${COMMON_XMLNS} version="" unique-identifier="" id="">` +
    `<opf:metadata><opf:title/><opf:language>ko</opf:language></opf:metadata>` +
    `<opf:manifest>` +
    `<opf:item id="header"   href="Contents/header.xml"   media-type="application/xml"/>` +
    `<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>` +
    `<opf:item id="settings" href="settings.xml"          media-type="application/xml"/>` +
    `</opf:manifest>` +
    `<opf:spine>` +
    `<opf:itemref idref="header"   linear="yes"/>` +
    `<opf:itemref idref="section0" linear="yes"/>` +
    `</opf:spine>` +
    `</opf:package>`;

const VERSION_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" ` +
    `tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" ` +
    `os="1" xmlVersion="1.2" application="Hancom Office Hangul" appVersion="11, 0, 0, 2129 WIN32LEWindows_8"/>`;

const SETTINGS_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">` +
    `<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>` +
    `</ha:HWPApplicationSetting>`;

const CONTAINER_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">` +
    `<ocf:rootfiles>` +
    `<ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>` +
    `<ocf:rootfile full-path="Preview/PrvText.txt"  media-type="text/plain"/>` +
    `<ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/>` +
    `</ocf:rootfiles>` +
    `</ocf:container>`;

const MANIFEST_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;

const CONTAINER_RDF =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description>` +
    `<rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description>` +
    `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section0.xml"/></rdf:Description>` +
    `<rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description>` +
    `<rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description>` +
    `</rdf:RDF>`;

// ─────────────────────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HTML 문자열을 HWPX Blob으로 변환합니다.
 *
 * @param html - Tiptap HTML 문자열 (p, h1~h6, ul/ol, table 지원)
 * @returns HWPX Blob (application/hwp+zip)
 */
export const htmlToHwpxBlob = async (html: string): Promise<Blob> => {
    const nodes = htmlToDocNodes(html);
    const zip   = new JSZip();

    zip.file('mimetype',               'application/hwp+zip', { compression: 'STORE' });
    zip.file('version.xml',            VERSION_XML);
    zip.file('Contents/header.xml',    buildHeaderXml());
    zip.file('Contents/section0.xml',  buildSectionXml(nodes));

    // PrvText.txt: 표는 셀 텍스트를 탭으로 구분하여 미리보기
    const plainText = nodes.map(node => {
        if (node.type === 'para')  return node.runs.map(r => r.text).join('');
        if (node.type === 'table') return node.rows.map(row => row.map(c => c.runs.map(r => r.text).join('')).join('\t')).join('\n');
        return '';
    }).join('\n');
    zip.file('Preview/PrvText.txt',    plainText);

    zip.file('settings.xml',           SETTINGS_XML);
    zip.file('META-INF/container.rdf', CONTAINER_RDF);
    zip.file('Contents/content.hpf',   buildContentHpf());
    zip.file('META-INF/container.xml', CONTAINER_XML);
    zip.file('META-INF/manifest.xml',  MANIFEST_XML);

    return await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/hwp+zip',
        compression: 'DEFLATE',
    });
};
