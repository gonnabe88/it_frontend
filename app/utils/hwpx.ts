/** [utils/hwpx.ts] 실제 HWPX 출력본 기준 HTML → HWPX 변환 유틸리티입니다. */

import JSZip from 'jszip';
import { collectImages, resolveImages } from './hwpx-images';
import {
    COMMON_XMLNS,
    CONTAINER_RDF,
    CONTAINER_XML,
    MANIFEST_XML,
    SETTINGS_XML,
    VERSION_XML,
    buildContentHpf
} from './hwpx-package-xml';
import type { HwpxImageFetch as HwpxImageFetchType, PendingImage, ResolvedImage } from './hwpx-images';

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────

/**
 * charPr ID 매핑 (모든 글자 맑은 고딕 = font id=0)
 * 0~5: 구조/헤더용. 6~9: 본문 인라인 서식용 (14pt 기반).
 */
const CHAR_PR = {
    COMPAT:    0,   // 10pt (바탕글 스타일 기본값)
    NORMAL:    1,   // 14pt                → 본문
    SEC:       2,   // 15pt                → secPr 제어 단락
    TITLE:     3,   // 18pt + bold         → Title 표 가운데 셀
    BOLD:      4,   // 15pt + bold         → H2/H3 텍스트, 표 헤더 셀
    SYM:       5,   // 15pt                → H2/H3 기호, Title 양/우측 셀
    B_BODY:    6,   // 14pt + bold         → 본문 인라인 굵게
    I_BODY:    7,   // 14pt + italic       → 본문 인라인 기울임
    U_BODY:    8,   // 14pt + underline    → 본문 인라인 밑줄
    S_BODY:    9,   // 14pt + strike       → 본문 인라인 취소선
} as const;
type CharPrId = (typeof CHAR_PR)[keyof typeof CHAR_PR];

/**
 * sample.hwpx 기준 paraPr ID 매핑
 * (모두 줄간격 160%)
 */
const PARA_PR = {
    BASE:   0,   // JUSTIFY, 여백 없음         → 표 데이터 셀
    CENTER: 1,   // CENTER,  여백 없음         → Title 표 셀 / 표 헤더 셀
    NORMAL: 2,   // JUSTIFY, 여백 없음         → secPr + 본문 단락
    H2:     3,   // JUSTIFY, next=1000         → H2 단락
    H3:     4,   // JUSTIFY, next=600          → H3 단락
    LIST:   5,   // JUSTIFY, indent=-6910      → 번호/글머리 목록
} as const;
type ParaPrId = (typeof PARA_PR)[keyof typeof PARA_PR];

/**
 * HTML 블록 태그 → (paraPrId, charPrId, prefix, prefixCharPrId) 매핑
 * H2/H3의 기호(□, ㅇ)는 별도 run에 SYM(regular)로 표기하고
 * 실제 텍스트는 BOLD로 표기하여 sample.hwpx와 동일한 형태로 출력합니다.
 */
const TAG_MAP: Record<string, {
    para: ParaPrId;
    char: CharPrId;
    prefix?: string;
    prefixChar?: CharPrId;
}> = {
    p:  { para: PARA_PR.NORMAL, char: CHAR_PR.NORMAL },
    h1: { para: PARA_PR.H2,     char: CHAR_PR.BOLD, prefix: '□ ',  prefixChar: CHAR_PR.SYM },
    h2: { para: PARA_PR.H2,     char: CHAR_PR.BOLD, prefix: '□ ',  prefixChar: CHAR_PR.SYM },
    h3: { para: PARA_PR.H3,     char: CHAR_PR.BOLD, prefix: ' ㅇ ', prefixChar: CHAR_PR.SYM },
    h4: { para: PARA_PR.H3,     char: CHAR_PR.BOLD, prefix: ' ㅇ ', prefixChar: CHAR_PR.SYM },
    h5: { para: PARA_PR.H3,     char: CHAR_PR.BOLD },
    h6: { para: PARA_PR.H3,     char: CHAR_PR.BOLD },
};

// 표 관련 상수 (변경 파일 기준)
const TABLE_WIDTH  = 48190;  // 전체 표 너비 (HWPUNIT) — 좌우 여백 20mm 기준 본문폭
const ROW_HEIGHT   = 1848;   // 행 높이 (HWPUNIT)
const CELL_BF_TH   = 4;      // th 셀 borderFillIDRef (파란 배경)
const CELL_BF_TD   = 3;      // td 셀 borderFillIDRef (흰 배경 실선)

// 모든 <hp:p>의 필수 자식 — linesegarray.
// Hangul은 단락 구조 검증 시 이 요소 존재를 필요로 하므로 반드시 출력하되,
// 모든 수치 속성을 0으로 두고 flags=0으로 지정하여
// "이 lineseg는 확정된 레이아웃 정보가 아니므로 Hangul이 재계산하라"는 의미로 사용합니다.
//
// ⚠ 이전에 horzsize=42520, flags=393216 으로 설정하면 Hangul이 이를 "이 단락 전체 텍스트는
//    textpos=0부터 이 한 줄에 모두 들어간다"로 해석하여 긴 문장이 한 줄로만 표시되는 버그가 있었음.
const DEFAULT_LINESEG =
    `<hp:linesegarray>` +
    `<hp:lineseg textpos="0" vertpos="0" vertsize="0" textheight="0" baseline="0" spacing="0" horzpos="0" horzsize="0" flags="0"/>` +
    `</hp:linesegarray>`;

// ─────────────────────────────────────────────────────────────────────────────
// 문서 노드 타입
// ─────────────────────────────────────────────────────────────────────────────

interface TextRun {
    text: string;
    charPrId: CharPrId | number;
    /**
     * 이미지 run일 경우 설정. 설정 시 <hp:pic>이 생성되고 text는 무시됨.
     *  - binId  : header의 binDataList에서 부여된 ID (1부터 시작)
     *  - width  : HWPUNIT (1 HWPUNIT ≈ 1/7200 inch)
     *  - height : HWPUNIT
     */
    image?: { binId: number; width: number; height: number };
    /** 인라인 글자색 (예: "#FF0000"). 설정 시 동적 charPr ID가 발급됨. */
    color?: string;
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
    /** 셀 테두리/배경 오버라이드 — 지정 시 isHeader 기본값 무시 */
    borderFillId?: number;
    /** 셀 내부 단락 스타일 오버라이드 */
    paraPrId?: ParaPrId;
}

interface TableNode {
    type: 'table';
    rows: CellData[][];
    /** 각 열의 너비 배열 (HWPUNIT). 미지정 시 균등 분배 */
    cellWidths?: number[];
    /** 각 행의 높이 (HWPUNIT). 미지정 시 ROW_HEIGHT 사용 */
    rowHeight?: number;
}

type DocNode = ParagraphNode | TableNode;

// ─────────────────────────────────────────────────────────────────────────────
// XML 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

const escXml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// ─────────────────────────────────────────────────────────────────────────────
// Contents/header.xml 생성 (변경 파일 구조 기반)
// ─────────────────────────────────────────────────────────────────────────────

const makeCharPr = (
    id: number,
    height: number,
    fontIdx: number,
    borderFillId: number,
    opts: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; textColor?: string } = {},
): string => {
    const f = String(fontIdx);
    const textColor = opts.textColor ?? '#000000';
    return (
        `<hh:charPr id="${id}" height="${height}" textColor="${textColor}" shadeColor="none" ` +
        `useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${borderFillId}">` +
        `<hh:fontRef hangul="${f}" latin="${f}" hanja="${f}" japanese="${f}" other="${f}" symbol="${f}" user="${f}"/>` +
        `<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>` +
        `<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>` +
        `<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>` +
        `<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>` +
        (opts.bold      ? `<hh:bold/>`      : '') +
        (opts.italic    ? `<hh:italic/>`    : '') +
        (opts.underline ? `<hh:underline type="SOLID" shape="SOLID" color="#000000"/>` : '') +
        (opts.strike    ? `<hh:strikeout type="SOLID" shape="SOLID" color="#000000"/>` : '') +
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

// sample.hwpx와 동일하게 font id=0 = 맑은 고딕을 기본 폰트로 사용 (모든 charPr가 이를 참조)
const makeFontface = (lang: string): string =>
    `<hh:fontface lang="${lang}" fontCnt="1">` +
    `<hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0">` +
    `<hh:typeInfo familyType="FCAT_GOTHIC" weight="5" proportion="3" contrast="2" strokeVariation="0" armStyle="0" letterform="2" midline="0" xHeight="4"/>` +
    `</hh:font>` +
    `</hh:fontface>`;

/**
 * header.xml 생성
 * 참고: 이미지 BinData 등록은 header.xml의 binDataList가 아닌
 *       content.hpf의 <opf:manifest><opf:item>에 이루어짐 (sample.hwpx 기준)
 */
const buildHeaderXml = (_images: ResolvedImage[] = [], extraCharPrXml = '', extraCharPrCount = 0): string => {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
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
    // charProperties (10 고정 + 동적 색상 charPr)
    `<hh:charProperties itemCnt="${10 + extraCharPrCount}">` +
    makeCharPr(CHAR_PR.COMPAT, 1000, 0, 1)                            +  // 10pt
    makeCharPr(CHAR_PR.NORMAL, 1400, 0, 2)                            +  // 14pt 본문
    makeCharPr(CHAR_PR.SEC,    1500, 0, 2)                            +  // 15pt secPr
    makeCharPr(CHAR_PR.TITLE,  1800, 0, 2, { bold: true })            +  // 18pt B Title
    makeCharPr(CHAR_PR.BOLD,   1500, 0, 2, { bold: true })            +  // 15pt B 헤더
    makeCharPr(CHAR_PR.SYM,    1500, 0, 2)                            +  // 15pt 기호
    makeCharPr(CHAR_PR.B_BODY, 1400, 0, 2, { bold: true })            +  // 14pt B 본문 굵게
    makeCharPr(CHAR_PR.I_BODY, 1400, 0, 2, { italic: true })          +  // 14pt I 본문 기울임
    makeCharPr(CHAR_PR.U_BODY, 1400, 0, 2, { underline: true })       +  // 14pt U 본문 밑줄
    makeCharPr(CHAR_PR.S_BODY, 1400, 0, 2, { strike: true })          +  // 14pt S 본문 취소선
    extraCharPrXml +
    `</hh:charProperties>` +
    // tabProperties
    `<hh:tabProperties itemCnt="1">` +
    `<hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/>` +
    `</hh:tabProperties>` +
    // paraProperties (6개) — 본문 및 목록은 한국어 자연 줄바꿈(BREAK_WORD)
    `<hh:paraProperties itemCnt="6">` +
    makeParaPr(PARA_PR.BASE,   { lineSpacing: 160, borderFillId: 1, breakNonLatin: 'BREAK_WORD' }) +
    makeParaPr(PARA_PR.CENTER, { align: 'CENTER', lineSpacing: 160, borderFillId: 2, breakNonLatin: 'BREAK_WORD' }) +
    makeParaPr(PARA_PR.NORMAL, { lineSpacing: 160, breakNonLatin: 'BREAK_WORD' })                 +
    makeParaPr(PARA_PR.H2,     { lineSpacing: 160, nextMargin: 1000, breakNonLatin: 'BREAK_WORD' }) +
    makeParaPr(PARA_PR.H3,     { lineSpacing: 160, prevMargin: 1500, nextMargin: 600, breakNonLatin: 'BREAK_WORD' }) +
    makeParaPr(PARA_PR.LIST,   { lineSpacing: 160, indent: -6910, breakNonLatin: 'BREAK_WORD' })  +
    `</hh:paraProperties>` +
    // styles
    `<hh:styles itemCnt="1">` +
    `<hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="${PARA_PR.BASE}" charPrIDRef="${CHAR_PR.COMPAT}" nextStyleIDRef="0" langID="1042" lockForm="0"/>` +
    `</hh:styles>` +
    `</hh:refList>` +
    // sample.hwpx와 동일하게 빈 layoutCompatibility와 "trackchageConfig" 형태 유지
    // (Hangul 실제 출력 포맷이므로 소위 "오타"도 그대로 둬야 함)
    `<hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>` +
    `<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption>` +
    `<hh:trackchageConfig flags="56"/>` +
    `</hh:head>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML → DocNode 변환
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS 색상 값을 HWP가 요구하는 #RRGGBB 형식으로 변환합니다.
 * - #rgb       → #RRGGBB
 * - #rrggbb    → #RRGGBB (대문자)
 * - rgb(r,g,b) → #RRGGBB
 * 변환할 수 없는 형식이면 그대로 반환합니다.
 */
const cssColorToHex = (css: string): string => {
    const s = css.trim();
    const hex = s.match(/^#([0-9a-f]{3,6})$/i);
    if (hex) {
        const h = hex[1]!;
        if (h.length === 3) {
            return '#' + h[0]!.repeat(2) + h[1]!.repeat(2) + h[2]!.repeat(2);
        }
        return '#' + h.toUpperCase();
    }
    const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
        const toHex2 = (n: string) => Number.parseInt(n, 10).toString(16).padStart(2, '0').toUpperCase();
        return '#' + toHex2(rgb[1]!) + toHex2(rgb[2]!) + toHex2(rgb[3]!);
    }
    return s;
};

/**
 * 인라인 요소에서 TextRun 배열 추출
 * strong/b → 굵게, em/i → 기울임, u → 밑줄, s/strike/del → 취소선
 * img → 이미지 run (imgMap에서 binId/크기 조회)
 */
const extractRuns = (
    node: Node,
    inheritedCharPr: CharPrId,
    imgMap: Map<string, PendingImage>,
): TextRun[] => {
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

    // 이미지 처리 — <img src="..."> 를 만나면 imgMap에서 바이너리 ID/크기를 가져와 이미지 run으로 삽입
    if (tag === 'img') {
        const src = (el as HTMLImageElement).getAttribute('src') || '';
        const imgInfo = imgMap.get(src);
        if (imgInfo) {
            runs.push({
                text: '',
                charPrId: inheritedCharPr,
                image: { binId: imgInfo.binId, width: imgInfo.width, height: imgInfo.height },
            });
        }
        return runs;
    }

    // 인라인 서식 전환 (본문 문맥에서만 적용)
    const isBodyContext = inheritedCharPr === CHAR_PR.NORMAL;
    if (tag === 'strong' || tag === 'b') {
        charPr = isBodyContext ? CHAR_PR.B_BODY : CHAR_PR.BOLD;
    } else if (tag === 'em' || tag === 'i') {
        if (isBodyContext) charPr = CHAR_PR.I_BODY;
    } else if (tag === 'u' || tag === 'ins') {
        if (isBodyContext) charPr = CHAR_PR.U_BODY;
    } else if (tag === 's' || tag === 'strike' || tag === 'del') {
        if (isBodyContext) charPr = CHAR_PR.S_BODY;
    } else if (tag === 'br') {
        return runs;
    }

    // style="color: ..." 파싱 — 현재 엘리먼트에 인라인 글자색이 있으면 하위 run에 전파
    const styleAttr  = el.getAttribute('style') ?? '';
    const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const inheritedColor: string | undefined = (el as unknown as { _inheritedColor?: string })._inheritedColor;
    const resolvedColor = colorMatch
        ? cssColorToHex(colorMatch[1]!.trim())
        : inheritedColor;

    const childRuns: TextRun[] = [];
    for (const child of Array.from(el.childNodes)) {
        // 색상 정보를 자식 엘리먼트에 임시 프로퍼티로 전달 (DOM 조작 없이 클로저 대신 활용)
        if (resolvedColor && child.nodeType === Node.ELEMENT_NODE) {
            (child as unknown as { _inheritedColor?: string })._inheritedColor = resolvedColor;
        }
        childRuns.push(...extractRuns(child, charPr, imgMap));
    }

    // 색상이 있으면 모든 자식 run에 color 설정 (아직 없는 것만)
    if (resolvedColor) {
        for (const r of childRuns) {
            if (!r.color) r.color = resolvedColor;
        }
    }
    runs.push(...childRuns);
    return runs;
};

/**
 * HTML 문자열을 DocNode 배열로 변환합니다.
 * 표는 TableNode, 나머지는 ParagraphNode로 변환합니다.
 * imgMap: HTML src URL → PendingImage(binId/width/height) 매핑
 */
const htmlToDocNodes = (html: string, imgMap: Map<string, PendingImage> = new Map()): DocNode[] => {
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
            const runs = extractRuns(el, mapping.char, imgMap);
            // 헤더 기호(□/ㅇ)는 텍스트와 다른 charPr(SYM, regular)로 분리하여
            // sample.hwpx와 동일하게 "기호 run + 텍스트 run" 구조로 만듭니다.
            if (mapping.prefix) {
                runs.unshift({
                    text: mapping.prefix,
                    charPrId: mapping.prefixChar ?? mapping.char,
                });
            }
            nodes.push({
                type: 'para',
                paraPrId: mapping.para,
                charPrId: mapping.char,
                runs: runs.length ? runs : [{ text: '', charPrId: mapping.char }],
            });

        } else if (tag === 'ol' || tag === 'ul') {
            // 목록 — sample.hwpx와 동일하게 2칸 들여쓰기 후 번호(또는 bullet) 삽입
            let idx = 0;
            for (const li of Array.from(el.children)) {
                if (li.tagName.toLowerCase() !== 'li') continue;
                idx++;
                const prefix = tag === 'ol' ? `  ${idx}. ` : '  • ';
                const runs   = extractRuns(li, CHAR_PR.NORMAL, imgMap);
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
                    const runs     = extractRuns(cell, charPr, imgMap);
                    cells.push({ isHeader, runs: runs.length ? runs : [{ text: '', charPrId: charPr }] });
                }
                if (cells.length > 0) tableRows.push(cells);
            }
            if (tableRows.length > 0) nodes.push({ type: 'table', rows: tableRows });

        } else if (tag === 'img') {
            // Block-level <img> — Tiptap의 NodeView 이미지는 <p> 바깥에 배치되므로
            // 단독 단락으로 감싸 <hp:pic>가 본문 흐름에 삽입되도록 한다.
            const src = (el as HTMLImageElement).getAttribute('src') || '';
            const imgInfo = imgMap.get(src);
            if (imgInfo) {
                nodes.push({
                    type: 'para',
                    paraPrId: PARA_PR.NORMAL,
                    charPrId: CHAR_PR.NORMAL,
                    runs: [{
                        text: '',
                        charPrId: CHAR_PR.NORMAL,
                        image: {
                            binId: imgInfo.binId,
                            width: imgInfo.width,
                            height: imgInfo.height,
                        },
                    }],
                });
            }

        } else if (tag === 'blockquote' || tag === 'div' || tag === 'figure') {
            // 래퍼 요소 — 자식 요소를 재귀 처리
            // (data-node-view-wrapper 등 Tiptap 내부 래핑도 이 경로로 처리됨)
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
 * 이미지 run XML 생성 (hp:pic 삽입)
 * treatAsChar=1: 글자처럼 인라인 배치 → 본문 흐름에서 정확한 위치 보장
 */
const buildPicRunXml = (
    charPrId: number,
    img: { binId: number; width: number; height: number },
): string => {
    const { binId, width: W, height: H } = img;
    // Hangul 실제 출력 포맷을 따라 큰 정수 id/instid를 사용
    const picId  = Math.floor(Math.random() * 0x7FFFFFFF);
    const instId = Math.floor(Math.random() * 0x7FFFFFFF);
    // binaryItemIDRef는 content.hpf manifest의 item id와 일치해야 함 (문자열 "image{N}")
    const binRef = `image${binId}`;
    return (
        `<hp:run charPrIDRef="${charPrId}">` +
        // 속성: sample.hwpx 기준 — href, groupLevel, instid 포함. flip/fix/fixsize/pageBreak/repeatHeader 제외.
        `<hp:pic id="${picId}" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" ` +
        `lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${instId}" reverse="0">` +
        // 1) ShapeObject 기본 자식 (순서 주의)
        `<hp:offset x="0" y="0"/>` +
        `<hp:orgSz width="${W}" height="${H}"/>` +
        `<hp:curSz width="0" height="0"/>` +
        `<hp:flip horizontal="0" vertical="0"/>` +
        `<hp:rotationInfo angle="0" centerX="${Math.floor(W/2)}" centerY="${Math.floor(H/2)}" rotateimage="1"/>` +
        `<hp:renderingInfo>` +
        `<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
        `<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
        `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
        `</hp:renderingInfo>` +
        // 2) Picture 고유 자식
        `<hp:imgRect>` +
        `<hc:pt0 x="0" y="0"/><hc:pt1 x="${W}" y="0"/><hc:pt2 x="${W}" y="${H}"/><hc:pt3 x="0" y="${H}"/>` +
        `</hp:imgRect>` +
        `<hp:imgClip left="0" right="${W}" top="0" bottom="${H}"/>` +
        `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
        // hc:img — 네임스페이스 주의! (hp가 아닌 hc)
        `<hc:img binaryItemIDRef="${binRef}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
        `<hp:effects/>` +
        // 3) 크기/위치/여백 — 이 순서가 sample.hwpx와 일치
        `<hp:sz width="${W}" widthRelTo="ABSOLUTE" height="${H}" heightRelTo="ABSOLUTE" protect="0"/>` +
        `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" ` +
        `vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="CENTER" vertOffset="0" horzOffset="0"/>` +
        `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
        `</hp:pic>` +
        `</hp:run>`
    );
};

/** 단일 run을 XML로 — 이미지인 경우 hp:pic, 아니면 hp:t */
const runToXml = (run: TextRun): string => {
    if (run.image) return buildPicRunXml(run.charPrId, run.image);
    const tEl = run.text === ''
        ? `<hp:t/>`
        : `<hp:t xml:space="preserve">${escXml(run.text)}</hp:t>`;
    return `<hp:run charPrIDRef="${run.charPrId}">${tEl}</hp:run>`;
};

/**
 * 단락 XML 생성
 * sample.hwpx와 동일하게 각 <hp:p>에 <hp:linesegarray>를 포함시킵니다.
 */
const buildParaXml = (para: ParagraphNode, id: number): string => {
    const runsXml = para.runs.map(runToXml).join('');
    return (
        `<hp:p id="${id}" paraPrIDRef="${para.paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        runsXml +
        DEFAULT_LINESEG +
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
    // 열 너비 — 명시된 cellWidths 사용, 없으면 균등 분배
    const widths: number[] = table.cellWidths && table.cellWidths.length === colCnt
        ? table.cellWidths
        : (() => {
            const w = Math.floor(TABLE_WIDTH / colCnt);
            return Array.from({ length: colCnt }, (_, i) =>
                i === colCnt - 1 ? TABLE_WIDTH - w * (colCnt - 1) : w
            );
        })();
    const tableWidth = widths.reduce((a, b) => a + b, 0);
    const rowH    = table.rowHeight ?? ROW_HEIGHT;
    const totalH  = rowCnt * rowH;
    const tblId   = Math.floor(Math.random() * 0x7FFFFFFF);

    const rowsXml = table.rows.map((row, r) => {
        const cellsXml = row.map((cell, c) => {
            const cellWidth  = widths[c] ?? widths[widths.length - 1]!;
            // cell.borderFillId/paraPrId이 지정되면 isHeader 기본값보다 우선
            const bfId       = cell.borderFillId ?? (cell.isHeader ? CELL_BF_TH : CELL_BF_TD);
            const paraPrId   = cell.paraPrId     ?? (cell.isHeader ? PARA_PR.CENTER : PARA_PR.BASE);
            const charPrId   = cell.isHeader ? CHAR_PR.BOLD   : CHAR_PR.NORMAL;
            const runs       = cell.runs.length ? cell.runs : [{ text: '', charPrId }];

            const runsXml = runs.map(runToXml).join('');

            return (
                `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bfId}">` +
                `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" ` +
                `linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
                `<hp:p id="0" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
                runsXml +
                DEFAULT_LINESEG +
                `</hp:p>` +
                `</hp:subList>` +
                `<hp:cellAddr colAddr="${c}" rowAddr="${r}"/>` +
                `<hp:cellSpan colSpan="1" rowSpan="1"/>` +
                `<hp:cellSz width="${cellWidth}" height="${rowH}"/>` +
                `<hp:cellMargin left="510" right="510" top="141" bottom="141"/>` +
                `</hp:tc>`
            );
        }).join('');

        return `<hp:tr>${cellsXml}</hp:tr>`;
    }).join('');

    // <hp:tbl>...</hp:tbl> 엘리먼트만 반환 — 단락/run 래퍼는 호출측에서 결정
    const tblInner =
        `<hp:tbl id="${tblId}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" ` +
        `lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" ` +
        `rowCnt="${rowCnt}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">` +
        `<hp:sz width="${tableWidth}" widthRelTo="ABSOLUTE" height="${totalH}" heightRelTo="ABSOLUTE" protect="0"/>` +
        `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" ` +
        `vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="CENTER" vertOffset="0" horzOffset="0"/>` +
        `<hp:outMargin left="283" right="283" top="283" bottom="283"/>` +
        `<hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
        rowsXml +
        `</hp:tbl>`;

    // 표는 단락 내 그림 객체로 삽입 (treatAsChar=0, 페이지 경계에서 분리 가능)
    return (
        `<hp:p id="${paraId}" paraPrIDRef="${PARA_PR.NORMAL}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${CHAR_PR.NORMAL}">` +
        tblInner +
        `</hp:run>` +
        DEFAULT_LINESEG +
        `</hp:p>`
    );
};

/** 표 엘리먼트만 추출 (다른 run 내부에 임베드할 때 사용) */
const buildTblElementOnly = (table: TableNode): string => {
    const full = buildTableXml(table, 0);
    // <hp:tbl ...>...</hp:tbl> 부분만 추출
    const start = full.indexOf('<hp:tbl');
    const end   = full.indexOf('</hp:tbl>') + '</hp:tbl>'.length;
    return full.substring(start, end);
};

/**
 * section0.xml 생성
 * - 첫 번째 단락(id=0)에 secPr 내장
 * - 이후 각 DocNode를 순서대로 변환 (id=1부터)
 */
const buildSectionXml = (nodes: DocNode[], headerTable?: TableNode): string => {
    // secPr 제어 단락 — sample.hwpx 구조 기준
    //   <hp:p>
    //     <hp:run charPrIDRef="SEC">                        ← 첫 run: secPr + ctrl/colPr
    //       <hp:secPr>...</hp:secPr>
    //       <hp:ctrl><hp:colPr .../></hp:ctrl>
    //     </hp:run>
    //     <hp:run charPrIDRef="TITLE"> <hp:tbl .../> </hp:run>  ← 두 번째 run: Title 표 임베드
    //     <hp:linesegarray>...</hp:linesegarray>
    //   </hp:p>
    // → Title 표를 secPr 단락과 같은 <hp:p>에 넣어 상단의 시각적 빈 줄(secPr 단락 하나 분량) 제거
    const secPrRun =
        `<hp:run charPrIDRef="${CHAR_PR.SEC}">` +
        `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">` +
        `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>` +
        `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>` +
        `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>` +
        `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
        `<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">` +
        `<hp:margin header="2268" footer="2268" gutter="0" left="5669" right="5669" top="4252" bottom="4252"/>` +
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
        `<hp:ctrl>` +
        `<hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/>` +
        `</hp:ctrl>` +
        `</hp:run>`;

    // Title 표 run — secPr 단락에 같이 임베드 (sample.hwpx 패턴)
    const titleTableRun = headerTable
        ? `<hp:run charPrIDRef="${CHAR_PR.TITLE}">${buildTblElementOnly(headerTable)}</hp:run>`
        : '';

    const secPrPara =
        `<hp:p id="0" paraPrIDRef="${headerTable ? PARA_PR.CENTER : PARA_PR.NORMAL}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        secPrRun +
        titleTableRun +
        DEFAULT_LINESEG +
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
// 공개 API
// ─────────────────────────────────────────────────────────────────────────────

/** Title 표 옵션 — 각 셀 텍스트를 호출자가 커스터마이즈할 수 있도록 공개 */
export interface HwpxTitleOptions {
    /** 좌측 셀 (부서명 등). 기본값: '{부서명}' (placeholder) */
    left?: string;
    /** 중앙 셀 (문서 제목). 필수 */
    center: string;
    /** 우측 셀 (연월 등). 기본값: 현재 YY.MM (예: '26.04') */
    right?: string;
}

/**
 * 문서 최상단의 Title 표를 생성합니다 (3셀 1행).
 * 배경 없음(bf=3 = 실선 테두리만) + 가운데 정렬(paraPr=CENTER) + 높이 11mm.
 * 너비 비율 1:4:1 (좁은-넓은-좁은).
 */
const buildTitleTableNode = (opts: HwpxTitleOptions): TableNode => {
    const sideW = Math.floor(TABLE_WIDTH / 6);
    const midW  = TABLE_WIDTH - sideW * 2;
    // 11mm → HWPUNIT: 11 * 7200 / 25.4 ≈ 3118
    const TITLE_ROW_HEIGHT = 3118;
    return {
        type: 'table',
        cellWidths: [sideW, midW, sideW],
        rowHeight: TITLE_ROW_HEIGHT,
        rows: [[
            {
                isHeader: false,
                borderFillId: CELL_BF_TD,   // 실선 테두리, 배경 없음
                paraPrId: PARA_PR.CENTER,
                runs: [{ text: opts.left ?? '{부서명}', charPrId: CHAR_PR.SYM }],
            },
            {
                isHeader: false,
                borderFillId: CELL_BF_TD,
                paraPrId: PARA_PR.CENTER,
                runs: [{ text: opts.center, charPrId: CHAR_PR.TITLE }],
            },
            {
                isHeader: false,
                borderFillId: CELL_BF_TD,
                paraPrId: PARA_PR.CENTER,
                runs: [{ text: opts.right ?? defaultYearMonth(), charPrId: CHAR_PR.SYM }],
            },
        ]],
    };
};

/** 현재 연월을 "YY.MM" 형식으로 반환 (예: 2026-04 → "26.04") */
const defaultYearMonth = (): string => {
    const d = new Date();
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yy}.${mm}`;
};

/** htmlToHwpxBlob 옵션 */
export interface HwpxBlobOptions {
    /**
     * 이미지 fetch 콜백 — 지정 시 cross-origin/인증 요청을 호출자가 처리.
     * 지정하지 않으면 기본 fetch()를 사용합니다 (credentials: 'include').
     */
    imageFetch?: HwpxImageFetchType;
}

/**
 * HTML 문자열을 HWPX Blob으로 변환합니다.
 * 문서마다 다른 제목(reqNm)을 반영하려면 2번째 인자로 실제 문서 제목을 넘기세요.
 *
 * @param html  - Tiptap HTML 문자열 (p, h1~h6, ul/ol, table 지원)
 * @param title - 문서 상단 Title 표의 중앙 셀 제목 (또는 HwpxTitleOptions)
 * @param opts  - 추가 옵션 (imageFetch 등)
 * @returns HWPX Blob (application/hwp+zip)
 */
export const htmlToHwpxBlob = async (
    html: string,
    title: string | HwpxTitleOptions = '요구사항 정의서',
    opts: HwpxBlobOptions = {},
): Promise<Blob> => {
    // Title 옵션 정규화
    const titleOpts: HwpxTitleOptions = typeof title === 'string'
        ? { center: title || '요구사항 정의서' }
        : { ...title, center: title.center || '요구사항 정의서' };

    // 1) HTML에서 <img> 수집 → binId 부여 → fetch (콜백 우선 사용)
    const { map: imgMap } = collectImages(html);
    const resolvedImgs = await resolveImages(Array.from(imgMap.values()), opts.imageFetch);

    // 2) 실제 픽셀 크기로 imgMap의 width/height 업데이트 — 원본 비율과 크기 그대로 표시
    //    (naturalWidth/Height가 있으면 px→HWPUNIT 변환해 적용, 없으면 기존 기본값 유지)
    const px2hu = 75; // 1px = 75 HWPUNIT (96 dpi 기준)
    const sizeByBinId = new Map<number, { w: number; h: number }>();
    for (const r of resolvedImgs) {
        if (r.naturalWidth > 0 && r.naturalHeight > 0) {
            sizeByBinId.set(r.binId, {
                w: r.naturalWidth * px2hu,
                h: r.naturalHeight * px2hu,
            });
        }
    }
    for (const [, info] of imgMap.entries()) {
        const sz = sizeByBinId.get(info.binId);
        if (sz) {
            // 이미지가 문서 본문 가로폭(TABLE_WIDTH)을 초과하면 비율 유지하며 축소
            const maxW = TABLE_WIDTH;
            if (sz.w > maxW) {
                info.width  = maxW;
                info.height = Math.round(sz.h * (maxW / sz.w));
            } else {
                info.width  = sz.w;
                info.height = sz.h;
            }
        }
    }

    // 실패한 이미지는 imgMap에서 제거하여 run 생성 시 이미지 placeholder를 만들지 않음
    const successIds = new Set(resolvedImgs.map(r => r.binId));
    for (const [src, info] of imgMap.entries()) {
        if (!successIds.has(info.binId)) imgMap.delete(src);
    }

    // 2) 본문 노드 추출 (imgMap을 넘겨 img 태그 → 이미지 run으로 변환)
    //    리딩 빈 단락 제거 → Title 표와 본문 사이 의미없는 공백 방지
    const bodyNodes = htmlToDocNodes(html, imgMap);
    while (bodyNodes.length > 0) {
        const first = bodyNodes[0];
        if (first && first.type === 'para'
            && first.runs.every(r => !r.image && (!r.text || !r.text.trim()))) {
            bodyNodes.shift();
        } else {
            break;
        }
    }
    // Title 표 아래에 한 줄 빈 단락을 추가 (제목과 본문 시각적 구분)
    bodyNodes.unshift({
        type: 'para',
        paraPrId: PARA_PR.NORMAL,
        charPrId: CHAR_PR.NORMAL,
        runs: [{ text: '', charPrId: CHAR_PR.NORMAL }],
    });

    // Title 표는 별도로 넘겨 secPr 단락 내부에 임베드 (최상단 빈 줄 제거 목적)
    const titleTable = buildTitleTableNode(titleOpts);
    const nodes: DocNode[] = bodyNodes;

    // 3-a) 색상 charPr 동적 발급 — 모든 run을 순회해 (baseCharPrId, color) 조합마다 ID 할당
    // 기존 고정 charPr가 ID 0~9를 사용하므로 동적 ID는 10부터 시작
    const colorRegistry = new Map<string, number>(); // key: "baseId:color" → dynamicId
    let nextColorId = 10;

    const collectColors = (run: TextRun) => {
        if (!run.color) return;
        const key = `${run.charPrId}:${run.color}`;
        if (!colorRegistry.has(key)) colorRegistry.set(key, nextColorId++);
    };
    const walkNodes = (ns: DocNode[]) => {
        for (const n of ns) {
            if (n.type === 'para') n.runs.forEach(collectColors);
            else if (n.type === 'table') n.rows.forEach(row => row.forEach(cell => cell.runs.forEach(collectColors)));
        }
    };
    walkNodes(nodes);

    // 동적 charPr XML 생성: 각 base charPr의 속성을 복製하고 textColor만 교체
    // base charPr 속성 조회 테이블 (id → height, opts)
    const BASE_CHAR_PR_OPTS: Record<number, { height: number; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }> = {
        [CHAR_PR.COMPAT]: { height: 1000 },
        [CHAR_PR.NORMAL]: { height: 1400 },
        [CHAR_PR.SEC]:    { height: 1500 },
        [CHAR_PR.TITLE]:  { height: 1800, bold: true },
        [CHAR_PR.BOLD]:   { height: 1500, bold: true },
        [CHAR_PR.SYM]:    { height: 1500 },
        [CHAR_PR.B_BODY]: { height: 1400, bold: true },
        [CHAR_PR.I_BODY]: { height: 1400, italic: true },
        [CHAR_PR.U_BODY]: { height: 1400, underline: true },
        [CHAR_PR.S_BODY]: { height: 1400, strike: true },
    };
    let extraCharPrXml = '';
    for (const [key, dynId] of colorRegistry.entries()) {
        const colonIdx = key.indexOf(':');
        const baseId   = Number(key.slice(0, colonIdx));
        const color    = key.slice(colonIdx + 1);
        const base     = BASE_CHAR_PR_OPTS[baseId] ?? { height: 1400 };
        extraCharPrXml += makeCharPr(dynId, base.height, 0, 2, { ...base, textColor: color });
    }

    // 색상 run의 charPrId를 동적 ID로 인플레이스 교체
    const resolveColors = (run: TextRun) => {
        if (!run.color) return;
        const key   = `${run.charPrId}:${run.color}`;
        const dynId = colorRegistry.get(key);
        if (dynId !== undefined) run.charPrId = dynId;
    };
    const resolveNodes = (ns: DocNode[]) => {
        for (const n of ns) {
            if (n.type === 'para') n.runs.forEach(resolveColors);
            else if (n.type === 'table') n.rows.forEach(row => row.forEach(cell => cell.runs.forEach(resolveColors)));
        }
    };
    resolveNodes(nodes);

    const zip = new JSZip();

    zip.file('mimetype',               'application/hwp+zip', { compression: 'STORE' });
    zip.file('version.xml',            VERSION_XML);
    zip.file('Contents/header.xml',    buildHeaderXml(resolvedImgs, extraCharPrXml, colorRegistry.size));
    zip.file('Contents/section0.xml',  buildSectionXml(nodes, titleTable));

    // 3) 이미지 바이너리를 BinData/imageN.ext 로 추가
    for (const img of resolvedImgs) {
        zip.file(`BinData/image${img.binId}.${img.ext}`, img.data);
    }

    // PrvText.txt: Title 표 + body 순서로 미리보기 생성
    const allForPreview: DocNode[] = [titleTable, ...nodes];
    const plainText = allForPreview.map(node => {
        if (node.type === 'para')  return node.runs.map(r => r.image ? '[이미지]' : r.text).join('');
        if (node.type === 'table') return node.rows.map(row => row.map(c => `<${c.runs.map(r => r.text).join('')}>`).join('')).join('\n');
        return '';
    }).join('\n');
    zip.file('Preview/PrvText.txt',    plainText);

    zip.file('settings.xml',           SETTINGS_XML);
    zip.file('META-INF/container.rdf', CONTAINER_RDF);
    zip.file('Contents/content.hpf',   buildContentHpf(titleOpts.center, resolvedImgs));
    zip.file('META-INF/container.xml', CONTAINER_XML);
    zip.file('META-INF/manifest.xml',  MANIFEST_XML);

    return await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/hwp+zip',
        compression: 'DEFLATE',
    });
};
