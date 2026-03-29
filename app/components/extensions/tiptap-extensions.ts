/**
 * [extensions/tiptap-extensions.ts] Tiptap 커스텀 확장 모음
 * ============================================================
 * TiptapEditor.vue에서 사용하는 모든 커스텀 Tiptap 확장과
 * 관련 유틸리티 함수를 중앙 관리합니다.
 *
 * Design Ref: §2 — Clean Architecture 확장 모듈화
 *
 * [내보내는 확장]
 *   ResizableImage     : 크기/정렬 조정 가능한 이미지
 *   ExcalidrawExtension: 다이어그램 커스텀 노드
 *   CustomTable        : 너비·레이아웃 저장 지원 표 (FR-06-4)
 *   CustomTableCell    : 배경색·정렬·테두리·높이 지원 셀 (FR-06-2,3,5)
 *   CustomTableHeader  : 배경색·정렬·테두리·높이 지원 헤더 셀 (FR-06-2,3,5)
 *   CustomHeading      : id·scroll-margin 지원 제목
 *   FontSize           : 글자 크기 (FR-04, TextStyle 기반 커스텀 마크)
 *   AttachmentExtension: 인라인 첨부파일 노드 + Suggestion 자동완성 (FR-05)
 *
 * [내보내는 유틸리티]
 *   normalizeColwidths       : 표 셀 colwidth 정규화
 *   injectColwidthsFromColgroup: colgroup 너비를 colwidth로 변환
 */

import { Node as TiptapNode, Mark, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import Suggestion from '@tiptap/suggestion';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Heading from '@tiptap/extension-heading';
import type { Editor } from '@tiptap/core';
import ResizableImageNodeViewComponent from '../ResizableImageNodeView.vue';
import ExcalidrawNodeViewComponent from '../ExcalidrawNodeView.vue';
import AttachmentNodeViewComponent from '../AttachmentNodeView.vue';
import InlineMathNodeViewComponent from '../InlineMathNodeView.vue';
import BlockMathNodeViewComponent from '../BlockMathNodeView.vue';

// ── ResizableImage ──
// @tiptap/extension-image를 확장하여 너비(width), 정렬(align) 속성 및 NodeView를 추가합니다.
export const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /**
             * 이미지 너비 (px 단위 숫자)
             * null이면 원본 크기(max-width: 100%) 유지
             */
            width: {
                default: null,
                parseHTML: (el) => {
                    const w = el.getAttribute('width') ?? el.style.width;
                    if (!w) return null;
                    const num = Number.parseInt(w);
                    return Number.isNaN(num) ? null : num;
                },
                renderHTML: (attrs) => {
                    if (!attrs.width) return {};
                    return { width: String(attrs.width), style: `width: ${attrs.width}px; max-width: 100%;` };
                }
            },
            /**
             * 이미지 정렬
             * 'left' | 'center' | 'right'
             */
            align: {
                default: 'left',
                parseHTML: (el) => (el.getAttribute('data-align') as 'left' | 'center' | 'right') ?? 'left',
                renderHTML: (attrs) => ({ 'data-align': attrs.align ?? 'left' })
            }
        };
    },
    addNodeView() {
        // as any: Vue 컴포넌트 props 타입이 NodeViewProps와 완전히 일치하지 않아 발생하는 TS 오류 억제
        return VueNodeViewRenderer(ResizableImageNodeViewComponent as any);
    }
}).configure({ inline: false, allowBase64: true });

// ── Excalidraw 파싱 유틸리티 ──
/** HTML 요소에서 Excalidraw 데이터를 추출하는 함수 */
const extractExcalidrawAttrs = (el: HTMLElement | null, img: HTMLImageElement | null) => {
    let sceneData: string | null = null;
    let svgContent = '';

    // 1. data-scene 속성에서 추출 시도 (가장 빠르고 정상적인 경우)
    const rawDataScene = el?.getAttribute('data-scene');
    if (rawDataScene) {
        try {
            sceneData = decodeURIComponent(atob(rawDataScene));
        } catch {
            sceneData = rawDataScene; // 레거시 비인코딩 데이터
        }
    }

    // 2. img src에서 SVG 및 주석 추출
    if (img?.src?.startsWith('data:image/svg+xml')) {
        try {
            // URL 디코딩하여 원본 SVG 문자열 확보
            svgContent = decodeURIComponent(img.src.replace('data:image/svg+xml;charset=utf-8,', ''));

            // data-scene 속성이 유실된 경우 (백엔드 sanitization 등), SVG 내부 주석에서 추출 시도
            if (!sceneData) {
                const match = svgContent.match(/<!-- excalidraw-scene-data:(.*?) -->/);
                if (match && match[1]) {
                    try {
                        sceneData = decodeURIComponent(atob(match[1]));
                    } catch {
                        sceneData = match[1];
                    }
                }
            }
        } catch { /* 파싱 실패 시 무시 */ }
    }

    // 디버그 (문제 해결 후 제거)
    console.log('[ExcalidrawExt extract] rawDataScene:', rawDataScene?.substring(0, 50), 'sceneData from SVG:', !!sceneData);

    return { sceneData, svgContent };
};

// ── ExcalidrawExtension ──
export const ExcalidrawExtension = TiptapNode.create({
    name: 'excalidraw',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            /** 에디터 내 미리보기용 SVG 문자열 */
            svgContent: { default: '' },
            /** 재편집을 위한 Excalidraw 장면 JSON 문자열 */
            sceneData: { default: null }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure[data-type="excalidraw"]',
                getAttrs: (element) => {
                    const el = element as HTMLElement;
                    const img = el.querySelector('img');
                    return extractExcalidrawAttrs(el, img);
                }
            },
            {
                // 백엔드 sanitizer에 의해 <figure>가 잘리고 <img>만 남은 경우 대비
                tag: 'img[src^="data:image/svg+xml"]',
                getAttrs: (element) => {
                    const img = element as HTMLImageElement;
                    const attrs = extractExcalidrawAttrs(null, img);
                    // excalidraw-scene-data 주석이 확인된 경우에만 excalidraw 노드로 인식
                    if (attrs.sceneData) return attrs;
                    return false;
                }
            }
        ];
    },

    renderHTML({ node }) {
        // sceneData를 Base64로 인코딩
        const encodedScene = node.attrs.sceneData
            ? btoa(encodeURIComponent(node.attrs.sceneData))
            : '';

        // SVG 문자열 끝에 주석 형태로 sceneData 삽입 (백엔드 sanitization 우회)
        let finalSvgContent = node.attrs.svgContent || '';
        if (encodedScene && finalSvgContent.includes('</svg>')) {
            finalSvgContent = finalSvgContent.replace('</svg>', `<!-- excalidraw-scene-data:${encodedScene} --></svg>`);
        }

        return [
            'figure',
            {
                'data-type': 'excalidraw',
                'data-scene': encodedScene,
                style: 'margin: 1rem 0;'
            },
            [
                'img',
                {
                    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvgContent)}`,
                    style: 'max-width: 100%; display: block;',
                    alt: 'Excalidraw 다이어그램'
                }
            ]
        ];
    },

    addNodeView() {
        // as any: Vue 컴포넌트 props 타입이 NodeViewProps와 완전히 일치하지 않아 발생하는 TS 오류 억제
        return VueNodeViewRenderer(ExcalidrawNodeViewComponent as any);
    }
});

// ── CustomTable ──
// 표 전체 너비(width) + 레이아웃(tableLayout) 속성 영구 저장 지원
export const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /**
             * 표 전체 너비 (예: "450px", "100%")
             * renderHTML: style 속성으로 직렬화되어 HTML에 저장됩니다.
             */
            width: {
                default: null,
                parseHTML: (element) => element.style.width || null,
                renderHTML: (attributes) => {
                    if (!attributes.width) return {};
                    return { style: `width: ${attributes.width}` };
                }
            },
            /**
             * 표 레이아웃 방식 (FR-06-4)
             * - 'auto' : 반응형 — 셀 내용에 따라 열 너비 자동 결정
             * - 'fixed': 고정형 — colwidth 기반 고정 너비 유지
             */
            tableLayout: {
                default: 'fixed',
                parseHTML: (element) => element.getAttribute('data-table-layout') || 'fixed',
                renderHTML: (attributes) => {
                    return {
                        'data-table-layout': attributes.tableLayout ?? 'fixed',
                        style: `table-layout: ${attributes.tableLayout ?? 'fixed'}`
                    };
                }
            }
        };
    }
});

// ── CustomTableCell ──
// 셀 배경색(backgroundColor)·정렬(textAlign)·테두리(borderStyle)·높이(minHeight) 속성 추가
export const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /**
             * 셀 배경색 (CSS color 문자열 or null)
             * FR-06-3: 팔레트 16색에서 선택 후 저장
             */
            backgroundColor: {
                default: null,
                parseHTML: (element) => element.style.backgroundColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                }
            },
            /**
             * 셀 텍스트 정렬 (FR-01-2)
             * TextAlign 확장이 tableCell type에 적용되어 style로 직렬화됩니다.
             */
            textAlign: {
                default: null,
                parseHTML: (element) => element.style.textAlign || null,
                renderHTML: (attributes) => {
                    if (!attributes.textAlign) return {};
                    return { style: `text-align: ${attributes.textAlign}` };
                }
            },
            /**
             * 테두리 스타일 (FR-06-2)
             * 값: 'solid' | 'dashed' | 'double' | null(없음)
             * data-border-style 어트리뷰트로 저장 → CSS selector로 스타일 적용
             */
            borderStyle: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-border-style') || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderStyle) return {};
                    return { 'data-border-style': attributes.borderStyle };
                }
            },
            /**
             * 셀 최소 높이 (FR-06-5)
             * 값: CSS 길이 문자열 (예: '60px') or null
             */
            minHeight: {
                default: null,
                parseHTML: (element) => element.style.minHeight || null,
                renderHTML: (attributes) => {
                    if (!attributes.minHeight) return {};
                    return { style: `min-height: ${attributes.minHeight}` };
                }
            }
        };
    }
});

// ── CustomTableHeader ──
// 헤더 셀 배경색·정렬·테두리·높이 속성 추가 (CustomTableCell과 동일 속성 세트)
export const CustomTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /** 헤더 셀 배경색 (FR-06-3) */
            backgroundColor: {
                default: null,
                parseHTML: (element) => element.style.backgroundColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                }
            },
            /** 헤더 셀 텍스트 정렬 (FR-01-2) */
            textAlign: {
                default: null,
                parseHTML: (element) => element.style.textAlign || null,
                renderHTML: (attributes) => {
                    if (!attributes.textAlign) return {};
                    return { style: `text-align: ${attributes.textAlign}` };
                }
            },
            /** 테두리 스타일 (FR-06-2) */
            borderStyle: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-border-style') || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderStyle) return {};
                    return { 'data-border-style': attributes.borderStyle };
                }
            },
            /** 셀 최소 높이 (FR-06-5) */
            minHeight: {
                default: null,
                parseHTML: (element) => element.style.minHeight || null,
                renderHTML: (attributes) => {
                    if (!attributes.minHeight) return {};
                    return { style: `min-height: ${attributes.minHeight}` };
                }
            }
        };
    }
});

// ── CustomHeading ──
// 기본 Heading 확장에 고유 id 생성 및 scroll-margin-top 렌더링 기능 추가
export const CustomHeading = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            id: {
                default: null,
                parseHTML: element => element.getAttribute('id'),
                renderHTML: attributes => {
                    if (!attributes.id) {
                        return {
                            id: `heading-${Math.random().toString(36).substr(2, 9)}`,
                            style: 'scroll-margin-top: 100px;'
                        };
                    }
                    return {
                        id: attributes.id,
                        style: 'scroll-margin-top: 100px;'
                    };
                },
            },
        };
    },
});

// ── normalizeColwidths ──
/**
 * 모든 표 셀에 colwidth를 보장하여 Tiptap이 고정폭(fixedWidth=true) 모드로 동작하게 합니다.
 *
 * [동작 원리]
 * Tiptap의 updateColumns()는 모든 셀에 colwidth가 있을 때만(fixedWidth=true)
 * table.style.width를 명시적 px 값으로 설정합니다.
 * colwidth가 없는 셀이 하나라도 있으면 fixedWidth=false → table.style.width를 비워
 * CSS의 width:100%가 적용되어 표가 컨테이너를 꽉 채우는 '반응형'처럼 보입니다.
 *
 * @param editor - Tiptap 에디터 인스턴스
 */
export function normalizeColwidths(editor: Editor): void {
    if (!editor || editor.isDestroyed) return;
    const view = editor.view;
    const tr = view.state.tr;
    let patched = false;

    view.state.doc.descendants((tableNode, tablePos) => {
        if (tableNode.type.name !== 'table') return;

        try {
            let totalCols = 0;
            let firstRowParsed = false;
            tableNode.forEach((row: any) => {
                if (!firstRowParsed && row.type.name === 'tableRow') {
                    firstRowParsed = true;
                    row.forEach((cell: any) => { totalCols += (cell.attrs.colspan || 1); });
                }
            });
            if (totalCols === 0) return;

            const referenceColWidths: number[] = new Array(totalCols).fill(0);
            let referenceFound = false;
            tableNode.forEach((row: any) => {
                if (referenceFound || row.type.name !== 'tableRow') return;
                const widths: number[] = [];
                let allValid = true;
                row.forEach((cell: any) => {
                    const cw = Array.isArray(cell.attrs.colwidth) && (cell.attrs.colwidth[0] ?? 0) > 0
                        ? cell.attrs.colwidth[0] as number : 0;
                    widths.push(cw);
                    if (cw <= 0) allValid = false;
                });
                if (allValid && widths.length === totalCols) {
                    widths.forEach((w, i) => { referenceColWidths[i] = w; });
                    referenceFound = true;
                }
            });

            let fallbackColWidth = 0;
            if (!referenceFound) {
                const wrapperEl = view.nodeDOM(tablePos) as HTMLElement | null;
                const tableEl = (wrapperEl?.tagName === 'TABLE'
                    ? wrapperEl
                    : wrapperEl?.querySelector('table')) as HTMLTableElement | null;

                const colEls = tableEl?.querySelectorAll('colgroup col');
                if (colEls && colEls.length === totalCols) {
                    const colgroupWidths: number[] = [];
                    let allValid = true;
                    colEls.forEach((col) => {
                        const px = Number.parseInt((col as HTMLElement).style.width, 10);
                        if (px > 0) { colgroupWidths.push(px); }
                        else { allValid = false; }
                    });
                    if (allValid && colgroupWidths.length === totalCols) {
                        colgroupWidths.forEach((w, i) => { referenceColWidths[i] = w; });
                        referenceFound = true;
                    }
                }

                if (!referenceFound) {
                    const tableWidth = tableEl?.offsetWidth || (view.dom as HTMLElement).offsetWidth || 600;
                    fallbackColWidth = Math.floor(tableWidth / totalCols);
                }
            }

            let tablePatched = false;
            tableNode.forEach((row: any, rowOffset: number) => {
                if (row.type.name !== 'tableRow') return;
                let colIdx = 0;
                row.forEach((cell: any, cellOffset: number) => {
                    if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') return;
                    const hasColwidth = Array.isArray(cell.attrs.colwidth)
                        && cell.attrs.colwidth.length > 0
                        && cell.attrs.colwidth.some((w: number) => w > 0);
                    if (!hasColwidth) {
                        const colspan = cell.attrs.colspan || 1;
                        const colWidths: number[] = [];
                        for (let c = 0; c < colspan; c++) {
                            colWidths.push(referenceFound
                                ? (referenceColWidths[colIdx + c] || fallbackColWidth)
                                : fallbackColWidth);
                        }
                        const absPos = tablePos + 1 + rowOffset + 1 + cellOffset;
                        tr.setNodeMarkup(absPos, null, { ...cell.attrs, colwidth: colWidths });
                        tablePatched = true;
                        patched = true;
                    }
                    colIdx += (cell.attrs.colspan || 1);
                });
            });

            if (tablePatched && tableNode.attrs.width) {
                tr.setNodeMarkup(tablePos, null, { ...tableNode.attrs, width: null });
            }
        } catch { /* DOM 접근 실패 시 무시 */ }
    });

    if (patched) {
        view.dispatch(tr.setMeta('addToHistory', false));
    }
}

// ── injectColwidthsFromColgroup ──
/**
 * HTML 문자열 내 <table>의 <colgroup><col style="width:Xpx"> 값을
 * 각 셀의 colwidth 속성으로 주입합니다.
 *
 * [필요 이유]
 * Tiptap은 setContent() 후 updateColumns()를 즉시 실행하여
 * <col style="width:Xpx"> → <col style="min-width:25px"> 로 덮어씁니다.
 * 따라서 setContent 전에 colgroup 너비를 셀 colwidth 속성으로 변환해야
 * ProseMirror 노드에 너비 정보가 보존됩니다.
 *
 * @param html - 처리할 HTML 문자열
 * @returns colwidth 속성이 주입된 HTML 문자열
 */
export function injectColwidthsFromColgroup(html: string): string {
    // colgroup이 없으면 변환 불필요
    if (!html || !html.includes('<colgroup>')) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('table').forEach((table) => {
        const cols = table.querySelectorAll('colgroup col');
        if (!cols.length) return;
        const colWidths: number[] = [];
        cols.forEach((col) => {
            const w = Number.parseInt((col as HTMLElement).style.width, 10);
            colWidths.push(w > 0 ? w : 0);
        });
        if (colWidths.every(w => w === 0)) return;
        table.querySelectorAll('tr').forEach((row) => {
            let colIdx = 0;
            row.querySelectorAll('th, td').forEach((cell) => {
                const colspan = Number.parseInt((cell as HTMLElement).getAttribute('colspan') || '1', 10);
                if (!cell.hasAttribute('colwidth')) {
                    const widths: number[] = [];
                    for (let c = 0; c < colspan; c++) {
                        widths.push(colWidths[colIdx + c] || 0);
                    }
                    if (widths.some(w => w > 0)) {
                        cell.setAttribute('colwidth', widths.join(','));
                    }
                }
                colIdx += colspan;
            });
        });
    });
    return doc.body.innerHTML;
}

// ── FontSize (FR-04) ──
/**
 * 글자 크기 커스텀 마크 확장
 *
 * Tiptap v3에는 공식 FontSize 확장이 없으므로 Mark 기반으로 직접 구현합니다.
 * TextStyle에 의존하지 않고 독립적인 <span style="font-size: Xpx"> 마크로 동작합니다.
 *
 * [사용 방법]
 *   editor.chain().focus().setFontSize('16px').run()  // 크기 적용
 *   editor.chain().focus().unsetFontSize().run()       // 크기 제거
 *
 * [HTML 직렬화]
 *   renderHTML: <span style="font-size: 16px"> ... </span>
 *   parseHTML : element.style.fontSize (인라인 스타일에서 복원)
 */
export const FontSize = Mark.create({
    name: 'fontSize',

    addOptions() {
        return {
            /** HTMLAttributes: 렌더링 시 추가 속성 기본값 */
            HTMLAttributes: {}
        };
    },

    addAttributes() {
        return {
            /**
             * fontSize: CSS font-size 값 (예: '14px', '18px')
             * null이면 브라우저/에디터 기본 크기 사용
             */
            fontSize: {
                default: null,
                parseHTML: (element) => element.style.fontSize || null,
                renderHTML: (attributes) => {
                    if (!attributes.fontSize) return {};
                    return { style: `font-size: ${attributes.fontSize}` };
                }
            }
        };
    },

    parseHTML() {
        return [
            {
                // style에 font-size가 있는 span 요소를 fontSize 마크로 파싱
                tag: 'span',
                getAttrs: (element) => {
                    const fontSize = (element as HTMLElement).style.fontSize;
                    if (!fontSize) return false; // font-size가 없으면 이 마크로 파싱하지 않음
                    return { fontSize };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            /**
             * 선택 영역에 글자 크기를 적용합니다.
             * @param fontSize - CSS font-size 값 (예: '14px')
             */
            setFontSize: (fontSize: string) => ({ commands }) => {
                return commands.setMark(this.name, { fontSize });
            },

            /**
             * 선택 영역의 글자 크기 마크를 제거합니다.
             */
            unsetFontSize: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            }
        };
    }
});

// TypeScript: setFontSize/unsetFontSize 커맨드 타입 확장
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            /** 선택 영역에 글자 크기 적용 */
            setFontSize: (fontSize: string) => ReturnType;
            /** 선택 영역의 글자 크기 제거 */
            unsetFontSize: () => ReturnType;
        };
    }
}

// ── AttachmentExtension ──
// 인라인 첨부파일 커스텀 노드 (FR-05)
// Tiptap Suggestion을 통한 '![' 자동완성 및 AttachmentNodeView로 렌더링됩니다.
//
// [Suggestion 흐름]
//   사용자가 '!' 다음에 '[' 입력 → char='[', allow로 '!' 선행 확인 → 팝업 표시
//   파일 선택 → '![query' 삭제 후 attachment 노드 삽입
//
// [attachmentList 동기화]
//   TiptapEditor.vue에서 watch → editor.storage.attachment.attachmentList 업데이트
//
// [TiptapEditor.vue 사용 예시]
//   AttachmentExtension.configure({ suggestion: createAttachmentSuggestion(attachSuggest) })

/** 첨부파일 아이템 타입 (useFiles.FileRecord의 부분 집합) */
export interface AttachmentItem {
    flMngNo: string;
    flNm: string;
    flSz: number;
}

/**
 * AttachmentSuggestion 설정 팩토리
 * TiptapEditor.vue에서 reactive 상태를 주입하여 팝업을 제어합니다.
 *
 * @param suggestionState - 팝업 UI를 제어하는 Vue reactive 객체 (TiptapEditor.vue에서 제공)
 */
export const createAttachmentSuggestion = (suggestionState: {
    active: boolean;
    items: AttachmentItem[];
    rect: DOMRect | null;
    selectedIndex: number;
    command: ((item: AttachmentItem) => void) | null;
}) => ({
    /**
     * 트리거 문자: '['
     * allow 콜백에서 직전 문자가 '!'인 경우에만 활성화합니다.
     */
    char: '[',

    /**
     * '!' 선행 확인: '![' 패턴에서만 Suggestion을 활성화합니다.
     * Design Ref: §2.2 — AttachmentSuggestion char='!['
     */
    allow: ({ state, range }: any) => {
        const pos = range.from - 1; // '[' 직전 위치 (= '!' 위치)
        if (pos < 0) return false;
        // textBetween(pos, pos+1): pos에 있는 문자 1개를 읽음 → '!' 여부 확인
        // 이전: textBetween(pos-1, pos) — '!' 이전 문자를 읽는 버그
        const charAtPos = state.doc.textBetween(Math.max(0, pos), pos + 1);
        return charAtPos === '!';
    },

    /**
     * 쿼리 기반 파일 목록 필터링
     * editor.storage.attachment.attachmentList는 TiptapEditor.vue의 watch로 동적 업데이트됩니다.
     */
    items: ({ query, editor }: any) => {
        const list: AttachmentItem[] = editor.storage?.attachment?.attachmentList ?? [];
        if (!query) return list.slice(0, 8);
        const q = query.toLowerCase();
        return list.filter(f => f.flNm.toLowerCase().includes(q)).slice(0, 8);
    },

    /**
     * 파일 선택 시 '![query' 전체를 삭제하고 attachment 노드를 삽입합니다.
     * range.from은 '[' 위치이므로 -1 하여 '!' 포함 삭제합니다.
     */
    command: ({ editor, range, props }: any) => {
        editor
            .chain()
            .focus()
            .deleteRange({ from: range.from - 1, to: range.to })
            .insertContentAt(range.from - 1, {
                type: 'attachment',
                attrs: {
                    fileId:   props.flMngNo,
                    fileName: props.flNm,
                    fileSize: props.flSz,
                }
            })
            .run();
    },

    /** 팝업 상태를 Vue reactive 객체에 동기화합니다. */
    render: () => ({
        onStart: (p: any) => {
            suggestionState.active = true;
            suggestionState.items = p.items;
            suggestionState.rect = p.clientRect?.() ?? null;
            suggestionState.selectedIndex = 0;
            suggestionState.command = p.command;
        },
        onUpdate: (p: any) => {
            suggestionState.items = p.items;
            suggestionState.rect = p.clientRect?.() ?? null;
        },
        onKeyDown: ({ event }: any) => {
            if (!suggestionState.active || !suggestionState.items.length) return false;
            if (event.key === 'ArrowDown') {
                suggestionState.selectedIndex =
                    (suggestionState.selectedIndex + 1) % suggestionState.items.length;
                return true;
            }
            if (event.key === 'ArrowUp') {
                suggestionState.selectedIndex =
                    (suggestionState.selectedIndex - 1 + suggestionState.items.length) % suggestionState.items.length;
                return true;
            }
            if (event.key === 'Enter') {
                const item = suggestionState.items[suggestionState.selectedIndex];
                if (item && suggestionState.command) {
                    suggestionState.command(item);
                    return true;
                }
            }
            if (event.key === 'Escape') {
                suggestionState.active = false;
                return true;
            }
            return false;
        },
        onExit: () => {
            suggestionState.active = false;
        },
    }),
});

/** AttachmentExtension: 인라인 첨부파일 노드 */
export const AttachmentExtension = TiptapNode.create({
    name: 'attachment',
    group: 'inline',
    inline: true,
    atom: true,  // 단일 원자 노드 — 커서가 내부로 진입하지 않습니다.

    addStorage() {
        /**
         * attachmentList: TiptapEditor.vue에서 watch를 통해 동적으로 업데이트됩니다.
         * Suggestion items 함수에서 editor.storage.attachment.attachmentList로 접근합니다.
         */
        return {
            attachmentList: [] as AttachmentItem[]
        };
    },

    addOptions() {
        return {
            suggestion: {} as Record<string, any>
        };
    },

    addAttributes() {
        return {
            /** 파일 관리번호 (flMngNo) — 다운로드 URL에 사용 */
            fileId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-file-id') || null,
                renderHTML: (attributes) => {
                    if (!attributes.fileId) return {};
                    return { 'data-file-id': attributes.fileId };
                }
            },
            /** 표시용 파일명 */
            fileName: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-file-name') || '',
                renderHTML: (attributes) => ({
                    'data-file-name': attributes.fileName ?? ''
                })
            },
            /** 파일 크기 (bytes) — 표시용 */
            fileSize: {
                default: null,
                parseHTML: (element) => {
                    const v = element.getAttribute('data-file-size');
                    return v ? Number(v) : null;
                },
                renderHTML: (attributes) => {
                    if (!attributes.fileSize) return {};
                    return { 'data-file-size': String(attributes.fileSize) };
                }
            }
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="attachment"]' }];
    },

    renderHTML({ node }) {
        return ['span', mergeAttributes({
            'data-type':      'attachment',
            'data-file-id':   node.attrs.fileId,
            'data-file-name': node.attrs.fileName,
            'data-file-size': node.attrs.fileSize != null ? String(node.attrs.fileSize) : '',
        })];
    },

    addNodeView() {
        return VueNodeViewRenderer(AttachmentNodeViewComponent as any);
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

// TypeScript: attachment 노드 삽입 커맨드 타입 확장 (필요 시)
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        attachment: {
            /** 커서 위치에 첨부파일 노드를 삽입합니다. */
            insertAttachment: (attrs: { fileId: string; fileName: string; fileSize?: number }) => ReturnType;
        };
    }
}

// ── InlineMathExtension (FR-07) ──
// 인라인 수식 커스텀 노드 ($...$)
// mathlive의 <math-field> Web Component로 렌더링합니다.
//
// [저장 형식]
//   <span data-type="inline-math" data-latex="..."></span>
//
// [NodeView]
//   InlineMathNodeView.vue: 편집 모드 = editable math-field, 조회 모드 = readonly math-field
export const InlineMathExtension = TiptapNode.create({
    name: 'inlineMath',
    group: 'inline',
    inline: true,
    atom: true, // 커서가 내부로 진입하지 않음

    addOptions() {
        return {
            /** HTMLAttributes: 렌더링 시 추가 속성 기본값 */
            HTMLAttributes: {}
        };
    },

    addAttributes() {
        return {
            /**
             * LaTeX 수식 문자열 (예: "E=mc^2")
             * data-latex 어트리뷰트로 HTML에 저장되어 저장-로드 왕복 시 복원됩니다.
             */
            latex: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-latex') || '',
                renderHTML: (attributes) => ({
                    'data-latex': attributes.latex ?? ''
                })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="inline-math"]' }];
    },

    renderHTML({ node }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, {
            'data-type': 'inline-math',
            'data-latex': node.attrs.latex ?? '',
            class: 'math-inline-node',
        })];
    },

    addNodeView() {
        return VueNodeViewRenderer(InlineMathNodeViewComponent as any);
    },

    addCommands() {
        return {
            /**
             * 커서 위치에 인라인 수식 노드를 삽입합니다.
             * @param latex - LaTeX 문자열 (빈 문자열이면 빈 수식 노드)
             */
            insertInlineMath: (latex: string = '') => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: { latex }
                });
            }
        };
    }
});

// ── BlockMathExtension (FR-07) ──
// 블록 수식 커스텀 노드 ($$...$$)
// mathlive의 <math-field> Web Component로 렌더링합니다.
//
// [저장 형식]
//   <div data-type="block-math" data-latex="..."></div>
//
// [NodeView]
//   BlockMathNodeView.vue: 편집 모드 = editable math-field, 조회 모드 = readonly math-field
export const BlockMathExtension = TiptapNode.create({
    name: 'blockMath',
    group: 'block',
    atom: true, // 커서가 내부로 진입하지 않음
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {}
        };
    },

    addAttributes() {
        return {
            /**
             * LaTeX 수식 문자열 (블록 수식용)
             * data-latex 어트리뷰트로 HTML에 저장됩니다.
             */
            latex: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-latex') || '',
                renderHTML: (attributes) => ({
                    'data-latex': attributes.latex ?? ''
                })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="block-math"]' }];
    },

    renderHTML({ node }) {
        return ['div', mergeAttributes(this.options.HTMLAttributes, {
            'data-type': 'block-math',
            'data-latex': node.attrs.latex ?? '',
            class: 'math-block-node',
        })];
    },

    addNodeView() {
        return VueNodeViewRenderer(BlockMathNodeViewComponent as any);
    },

    addCommands() {
        return {
            /**
             * 커서 위치에 블록 수식 노드를 삽입합니다.
             * @param latex - LaTeX 문자열 (빈 문자열이면 빈 수식 노드)
             */
            insertBlockMath: (latex: string = '') => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: { latex }
                });
            }
        };
    }
});

// TypeScript: 수식 노드 삽입 커맨드 타입 확장
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        inlineMath: {
            /** 커서 위치에 인라인 수식 노드를 삽입합니다. */
            insertInlineMath: (latex?: string) => ReturnType;
        };
        blockMath: {
            /** 커서 위치에 블록 수식 노드를 삽입합니다. */
            insertBlockMath: (latex?: string) => ReturnType;
        };
    }
}
