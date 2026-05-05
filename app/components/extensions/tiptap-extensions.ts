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

import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader } from '@tiptap/extension-table';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TableMap } from '@tiptap/pm/tables';
import ResizableImageNodeViewComponent from '../ResizableImageNodeView.vue';
import ExcalidrawNodeViewComponent from '../ExcalidrawNodeView.vue';

export {
    AttachmentExtension,
    BlockMathExtension,
    CustomHeading,
    FontSize,
    InlineMathExtension,
    createAttachmentSuggestion,
    injectColwidthsFromColgroup,
    normalizeColwidths,
} from './tiptap-content-extensions';
export type { AttachmentItem } from './tiptap-content-extensions';

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            /** 재편집을 위한 Excalidraw 장면 JSON 문자열 (인메모리, HTML에 직렬화 안 됨) */
            sceneData: { default: null },
            /** 업로드된 scene 파일의 flMngNo */
            attachmentId: { default: null }
        };
    },

    parseHTML() {
        return [
            {
                // 신규 형식: data-attachment-id만 있는 figure
                tag: 'figure[data-type="excalidraw"][data-attachment-id]',
                getAttrs: (element) => {
                    const el = element as HTMLElement;
                    return {
                        attachmentId: el.dataset.attachmentId || null,
                        svgContent: '',
                        sceneData: null
                    };
                }
            },
            {
                // 구형식: data-scene이 있는 figure (하위 호환)
                tag: 'figure[data-type="excalidraw"]',
                getAttrs: (element) => {
                    const el = element as HTMLElement;
                    const img = el.querySelector('img');
                    return extractExcalidrawAttrs(el, img);
                }
            },
            {
                // 백엔드 sanitizer에 의해 figure가 잘리고 img만 남은 경우 (구형식 하위 호환)
                tag: 'img[src^="data:image/svg+xml"]',
                getAttrs: (element) => {
                    const img = element as HTMLImageElement;
                    const attrs = extractExcalidrawAttrs(null, img);
                    if (attrs.sceneData) return attrs;
                    return false;
                }
            }
        ];
    },

    renderHTML({ node }) {
        // 신규 형식: attachmentId가 있으면 HTML에 ID만 기록 (sceneData 인라인 저장 안 함)
        if (node.attrs.attachmentId) {
            return [
                'figure',
                {
                    'data-type': 'excalidraw',
                    'data-attachment-id': node.attrs.attachmentId,
                    style: 'margin: 1rem 0;'
                }
            ];
        }

        // 구형식 폴백: attachmentId 없는 경우 (레거시 노드 또는 업로드 전)
        const encodedScene = node.attrs.sceneData
            ? btoa(encodeURIComponent(node.attrs.sceneData))
            : '';

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return VueNodeViewRenderer(ExcalidrawNodeViewComponent as any);
    }
});

/**
 * ── RowResizing Plugin ──
 * 모든 표 셀(td, th) 하단에 리사이즈 핸들을 추가하고, 
 * 드래그를 통해 해당 행의 모든 셀의 높이를 조절합니다.
 */
const RowResizingPluginKey = new PluginKey('row-resizing');

export const RowResizingPlugin = () => {
    let dragging: {
        tablePos: number;
        startRow: number;
        endRow: number;
        startY: number;
        startHeight: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cellNodes: { pos: number; node: any }[];
    } | null = null;

    return new Plugin({
        key: RowResizingPluginKey,
        state: {
            init() { return DecorationSet.empty; },
            apply(tr, _set) {
                const decorations: Decoration[] = [];
                tr.doc.descendants((node, pos) => {
                    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                        decorations.push(
                            Decoration.widget(pos + node.nodeSize - 1, () => {
                                const handle = document.createElement('div');
                                handle.className = 'row-resize-handle';
                                return handle;
                            }, { side: -1 })
                        );
                    }
                });
                return DecorationSet.create(tr.doc, decorations);
            }
        },
        props: {
            decorations(state) { return this.getState(state); },
            handleDOMEvents: {
                /**
                 * 드래그 중 ProseMirror의 내부 mousemove 처리(텍스트 선택 등)를 차단합니다.
                 * 이를 통해 ProseMirror가 상태 업데이트를 발생시켜 TD의 인라인 스타일을
                 * 덮어쓰는 것을 방지합니다. (열 너비 리사이징은 <col> 요소를 사용하여
                 * ProseMirror와 충돌이 없지만, 행 높이는 <td> 요소에 직접 적용하므로 필수)
                 */
                mousemove(_view, _event) {
                    if (dragging) return true; // ProseMirror 내부 처리 차단
                    return false;
                },
                mouseup(_view, _event) {
                    if (dragging) return true; // ProseMirror 내부 처리 차단
                    return false;
                },
                mousedown(view, event) {
                    const target = event.target as HTMLElement;
                    if (!target.classList.contains('row-resize-handle')) return false;

                    event.preventDefault();
                    event.stopPropagation();

                    // ── DOM 탐색: event.target에서 순수 DOM으로 셀/행/테이블 찾기 ──
                    // ProseMirror의 view.nodeDOM() 대신 순수 DOM 탐색을 사용하여
                    // ProseMirror의 DOM 추적과 완전히 분리합니다.
                    const cellDOM = target.closest('td, th') as HTMLElement;
                    if (!cellDOM) return false;
                    const trDOM = cellDOM.closest('tr') as HTMLTableRowElement;
                    if (!trDOM) return false;
                    const tableDOM = cellDOM.closest('table') as HTMLTableElement;
                    if (!tableDOM) return false;

                    // ProseMirror 위치 정보 (mouseup 시 트랜잭션에 필요)
                    const pos = view.posAtDOM(cellDOM, 0);
                    const $pos = view.state.doc.resolve(pos);

                    let cellNode = null, cellPos = -1;
                    for (let d = $pos.depth; d > 0; d--) {
                        if ($pos.node(d).type.name === 'tableCell' || $pos.node(d).type.name === 'tableHeader') {
                            cellNode = $pos.node(d); cellPos = $pos.before(d); break;
                        }
                    }
                    if (!cellNode || cellPos === -1) return false;

                    let tableNode = null, tablePos = -1;
                    for (let d = $pos.depth; d > 0; d--) {
                        if ($pos.node(d).type.name === 'table') {
                            tableNode = $pos.node(d); tablePos = $pos.before(d); break;
                        }
                    }
                    if (!tableNode || tablePos === -1) return false;

                    const map = TableMap.get(tableNode);
                    const tableContentStart = tablePos + 1;
                    const rect = map.findCell(cellPos - tableContentStart);

                    // mouseup 시 트랜잭션을 위한 ProseMirror 노드 정보 수집
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cellNodes: { pos: number; node: any }[] = [];
                    const _m = map.map, _w = map.width;
                    for (let r = rect.top; r < rect.bottom; r++) {
                        for (let c = 0; c < _w; c++) {
                            const cp = _m[r * _w + c];
                            if (cp == null) continue;
                            const cNode = tableNode.nodeAt(cp);
                            if (cNode) {
                                const absolutePos = tableContentStart + cp;
                                if (!cellNodes.find(n => n.pos === absolutePos)) {
                                    cellNodes.push({ pos: absolutePos, node: cNode });
                                }
                            }
                        }
                    }

                    // ── 실시간 피드백: 순수 DOM 참조 캐싱 ──
                    const startHeight = cellDOM.offsetHeight;
                    // 같은 행의 모든 td/th DOM 참조 (순수 DOM 탐색)
                    const cachedCellDOMs = Array.from(trDOM.querySelectorAll<HTMLElement>('td, th'));

                    // 동적 <style> 태그를 사용하여 ProseMirror의 인라인 스타일 덮어쓰기를 방지
                    const resizeStyleId = 'row-resize-active-style';
                    let styleEl = document.getElementById(resizeStyleId) as HTMLStyleElement | null;
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = resizeStyleId;
                        document.head.appendChild(styleEl);
                    }

                    dragging = { tablePos, startRow: rect.top, endRow: rect.bottom, startY: event.clientY, startHeight, cellNodes };
                    document.body.classList.add('is-resizing-row');
                    // 리사이징 중인 행을 CSS로 타겟팅하기 위한 식별자 추가
                    trDOM.setAttribute('data-row-resizing', 'true');

                    // ── 드래그 가이드 라인 생성 ──
                    // position: fixed로 뷰포트 기준 위치를 사용하여 스크롤·overflow 영향을 받지 않습니다.
                    const tableRect = tableDOM.getBoundingClientRect();
                    const lineEl = document.createElement('div');
                    lineEl.style.cssText = [
                        'position: fixed',
                        `left: ${tableRect.left}px`,
                        `width: ${tableRect.width}px`,
                        `top: ${event.clientY}px`,
                        'height: 2px',
                        'background-color: #6366f1',
                        'z-index: 9999',
                        'pointer-events: none',
                        'opacity: 0.8',
                    ].join('; ');
                    document.body.appendChild(lineEl);

                    const onMouseMove = (moveEvent: MouseEvent) => {
                        if (!dragging) return;
                        const diff = moveEvent.clientY - dragging.startY;
                        const newHeight = Math.max(25, dragging.startHeight + diff);
                        const heightPx = `${newHeight}px`;

                        // 가이드 라인을 마우스 Y 위치에 맞춰 이동
                        lineEl.style.top = `${moveEvent.clientY}px`;

                        // 직접 DOM 스타일 설정 (PM 재조정이 없는 경우 즉각 반영)
                        trDOM.style.height = heightPx;
                        for (const el of cachedCellDOMs) {
                            el.style.height = heightPx;
                        }

                        // !important CSS 규칙으로 ProseMirror DOM 재조정 시 인라인 스타일 덮어쓰기 차단
                        // ProseMirror가 td의 inline style을 재설정해도 !important 규칙이 시각적 높이를 유지합니다.
                        if (styleEl) {
                            styleEl.textContent = `
                                body.is-resizing-row tr[data-row-resizing] > td,
                                body.is-resizing-row tr[data-row-resizing] > th {
                                    height: ${heightPx} !important;
                                    min-height: ${heightPx} !important;
                                    transition: none !important;
                                }
                            `;
                        }
                    };

                    const onMouseUp = (upEvent: MouseEvent) => {
                        document.body.classList.remove('is-resizing-row');

                        // 가이드 라인 제거
                        lineEl.remove();

                        if (dragging) {
                            const finalDiff = upEvent.clientY - dragging.startY;
                            const finalHeight = Math.max(25, dragging.startHeight + finalDiff);

                            // ProseMirror 트랜잭션으로 최종 높이를 모델에 영구 반영
                            const tr = view.state.tr;
                            dragging.cellNodes.forEach(({ pos: cPos, node: cNode }) => {
                                tr.setNodeMarkup(cPos, null, { ...cNode.attrs, minHeight: `${finalHeight}px` });
                            });
                            view.dispatch(tr.setMeta('addToHistory', true));
                        }

                        // dispatch 완료 후 동적 스타일·data 속성 제거 (PM 재렌더링이 인라인 스타일을 확정한 뒤 안전하게 제거)
                        trDOM.removeAttribute('data-row-resizing');
                        if (styleEl && styleEl.parentNode) {
                            styleEl.parentNode.removeChild(styleEl);
                        }

                        dragging = null;
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                    };

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                    return true;
                }
            }
        }
    });
};

// AdjacentColumnResizingPlugin removed as per user request to simplify.

// ── CustomTable ──
// 표 전체 너비(width) + 레이아웃(tableLayout) 속성 영구 저장 지원
export const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            /**
             * 표 전체 너비 (예: "450px", "100%")
             * Tiptap의 NodeView가 스타일 변화를 즉시 감지할 수 있도록 
             * 이 속성에서 table-layout 스타일까지 함께 병합하여 렌더링합니다.
             */
            width: {
                default: null,
                parseHTML: (element) => element.style.width || null,
            },
            /**
             * 테이블 정렬 ('left' | 'center' | 'right')
             */
            align: {
                default: 'left',
                parseHTML: (element) => {
                    const attr = element.getAttribute('data-align');
                    if (attr) return attr;

                    // data 속성이 없는 경우 style 분석 (중앙: auto/auto, 우측: auto/0)
                    const ml = element.style.marginLeft;
                    const mr = element.style.marginRight;
                    if (ml === 'auto' && mr === 'auto') return 'center';
                    if (ml === 'auto' && (mr === '0' || mr === '0px')) return 'right';
                    return 'left';
                },
            }
        };
    },

    renderHTML({ node, HTMLAttributes }) {
        const { width, align } = node.attrs;
        const styles: string[] = [];
        
        // 1. 너비 및 레이아웃 스타일
        if (width) styles.push(`width: ${width}`);
        styles.push('table-layout: fixed');

        // 2. 정렬 마진 스타일 (휴대성/보존성을 위해 직접 인라인 스타일로 출력)
        if (align === 'center') {
            styles.push('margin-left: auto', 'margin-right: auto');
        } else if (align === 'right') {
            styles.push('margin-left: auto', 'margin-right: 0');
        } else {
            styles.push('margin-left: 0', 'margin-right: auto');
        }

        // HTMLAttributes에서 개별 속성 렌더링 결과(class 등)를 보존하되, 
        // 우리가 직접 생성한 style과 data- 속성으로 덮어씁니다.
        const finalStyles = styles.join('; ');

        return [
            'div',
            { class: 'tableWrapper' },
            [
                'table',
                mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                    'data-table-layout': 'fixed',
                    'data-align': align,
                    style: finalStyles || null
                }),
                ['tbody', 0]
            ]
        ];
    },

    addProseMirrorPlugins() {
        return [
            RowResizingPlugin(),
            ...(this.parent?.() || []),
        ];
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
             * 값: 'solid' | 'dashed' | 'dotted' | 'double' | null(없음)
             */
            borderStyle: {
                default: null,
                parseHTML: (element) => element.style.borderStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderStyle) return {};
                    return { style: `border-style: ${attributes.borderStyle}` };
                }
            },
            /**
             * 테두리 두께 (FR-06-2 개선)
             * 값: '1px', '2px' 등
             */
            borderWidth: {
                default: null,
                parseHTML: (element) => element.style.borderWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderWidth) return {};
                    return { style: `border-width: ${attributes.borderWidth}` };
                }
            },
            /**
             * 테두리 색상 (FR-06-2 개선)
             * 값: Hex 코드 (예: '#000000')
             */
            borderColor: {
                default: null,
                parseHTML: (element) => element.style.borderColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderColor) return {};
                    return { style: `border-color: ${attributes.borderColor}` };
                }
            },
            /* ── 개별 방향 테두리 (상/하/좌/우) ── */
            borderTopStyle: {
                default: null,
                parseHTML: (element) => element.style.borderTopStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderTopStyle) return {};
                    return { style: `border-top-style: ${attributes.borderTopStyle}` };
                }
            },
            borderTopWidth: {
                default: null,
                parseHTML: (element) => element.style.borderTopWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderTopWidth) return {};
                    return { style: `border-top-width: ${attributes.borderTopWidth}` };
                }
            },
            borderTopColor: {
                default: null,
                parseHTML: (element) => element.style.borderTopColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderTopColor) return {};
                    return { style: `border-top-color: ${attributes.borderTopColor}` };
                }
            },
            borderRightStyle: {
                default: null,
                parseHTML: (element) => element.style.borderRightStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderRightStyle) return {};
                    return { style: `border-right-style: ${attributes.borderRightStyle}` };
                }
            },
            borderRightWidth: {
                default: null,
                parseHTML: (element) => element.style.borderRightWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderRightWidth) return {};
                    return { style: `border-right-width: ${attributes.borderRightWidth}` };
                }
            },
            borderRightColor: {
                default: null,
                parseHTML: (element) => element.style.borderRightColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderRightColor) return {};
                    return { style: `border-right-color: ${attributes.borderRightColor}` };
                }
            },
            borderBottomStyle: {
                default: null,
                parseHTML: (element) => element.style.borderBottomStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderBottomStyle) return {};
                    return { style: `border-bottom-style: ${attributes.borderBottomStyle}` };
                }
            },
            borderBottomWidth: {
                default: null,
                parseHTML: (element) => element.style.borderBottomWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderBottomWidth) return {};
                    return { style: `border-bottom-width: ${attributes.borderBottomWidth}` };
                }
            },
            borderBottomColor: {
                default: null,
                parseHTML: (element) => element.style.borderBottomColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderBottomColor) return {};
                    return { style: `border-bottom-color: ${attributes.borderBottomColor}` };
                }
            },
            borderLeftStyle: {
                default: null,
                parseHTML: (element) => element.style.borderLeftStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderLeftStyle) return {};
                    return { style: `border-left-style: ${attributes.borderLeftStyle}` };
                }
            },
            borderLeftWidth: {
                default: null,
                parseHTML: (element) => element.style.borderLeftWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderLeftWidth) return {};
                    return { style: `border-left-width: ${attributes.borderLeftWidth}` };
                }
            },
            borderLeftColor: {
                default: null,
                parseHTML: (element) => element.style.borderLeftColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderLeftColor) return {};
                    return { style: `border-left-color: ${attributes.borderLeftColor}` };
                }
            },
            /**
             * 셀 최소 높이 (FR-06-5)
             * 값: CSS 길이 문자열 (예: '60px') or null
             * 표 셀에서는 'height'가 실질적인 최소 높이 역할을 하므로 height로 렌더링합니다.
             */
            minHeight: {
                default: null,
                parseHTML: (element) => element.style.height || element.style.minHeight || null,
                renderHTML: (attributes) => {
                    if (!attributes.minHeight) return {};
                    return { style: `height: ${attributes.minHeight}` };
                }
            },
            /**
             * 셀 수직 정렬
             * 값: 'top' | 'middle' | 'bottom' | null(기본값)
             */
            verticalAlign: {
                default: null,
                parseHTML: (element) => element.style.verticalAlign || null,
                renderHTML: (attributes) => {
                    if (!attributes.verticalAlign) return {};
                    return { style: `vertical-align: ${attributes.verticalAlign}` };
                }
            },
            /**
             * 열 너비 (부모 TableCell 속성 오버라이드)
             * TipTap은 colwidth 값을 <colgroup><col> 요소로만 DOM에 반영하므로
             * getHTML() 출력에는 CSS width가 포함되지 않습니다.
             * v-html(DOMPurify) 환경에서는 비표준 colwidth 속성이 제거되어 너비가 손실됩니다.
             * → renderHTML에서 style="width: Xpx"를 함께 출력하여 v-html 조회 시에도 너비 유지.
             */
            colwidth: {
                default: null,
                parseHTML: (element) => {
                    // 1순위: TipTap 표준 colwidth 속성
                    const colwidthAttr = element.getAttribute('colwidth');
                    if (colwidthAttr) {
                        const widths = colwidthAttr.split(',').map(Number).filter((w: number) => w > 0);
                        if (widths.length) return widths;
                    }
                    // 2순위: DOMPurify가 colwidth를 제거한 경우 style.width에서 복원
                    const styleWidth = Number.parseInt(element.style.width, 10);
                    if (styleWidth > 0) return [styleWidth];
                    return null;
                },
                renderHTML: (attributes) => {
                    if (!Array.isArray(attributes.colwidth) || !attributes.colwidth.length) return {};
                    const totalWidth = (attributes.colwidth as number[]).reduce((s: number, w: number) => s + (w || 0), 0);
                    // colwidth 속성(TipTap 내부용) + style width(v-html/브라우저 렌더링용) 동시 출력
                    return totalWidth > 0
                        ? { colwidth: (attributes.colwidth as number[]).join(','), style: `width: ${totalWidth}px` }
                        : { colwidth: (attributes.colwidth as number[]).join(',') };
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
                parseHTML: (element) => element.style.borderStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderStyle) return {};
                    return { style: `border-style: ${attributes.borderStyle}` };
                }
            },
            /** 테두리 두께 (FR-06-2 개선) */
            borderWidth: {
                default: null,
                parseHTML: (element) => element.style.borderWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderWidth) return {};
                    return { style: `border-width: ${attributes.borderWidth}` };
                }
            },
            /** 테두리 색상 (FR-06-2 개선) */
            borderColor: {
                default: null,
                parseHTML: (element) => element.style.borderColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderColor) return {};
                    return { style: `border-color: ${attributes.borderColor}` };
                }
            },
            /* ── 개별 방향 테두리 (상/하/좌/우) ── */
            borderTopStyle: {
                default: null,
                parseHTML: (element) => element.style.borderTopStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderTopStyle) return {};
                    return { style: `border-top-style: ${attributes.borderTopStyle}` };
                }
            },
            borderTopWidth: {
                default: null,
                parseHTML: (element) => element.style.borderTopWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderTopWidth) return {};
                    return { style: `border-top-width: ${attributes.borderTopWidth}` };
                }
            },
            borderTopColor: {
                default: null,
                parseHTML: (element) => element.style.borderTopColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderTopColor) return {};
                    return { style: `border-top-color: ${attributes.borderTopColor}` };
                }
            },
            borderRightStyle: {
                default: null,
                parseHTML: (element) => element.style.borderRightStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderRightStyle) return {};
                    return { style: `border-right-style: ${attributes.borderRightStyle}` };
                }
            },
            borderRightWidth: {
                default: null,
                parseHTML: (element) => element.style.borderRightWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderRightWidth) return {};
                    return { style: `border-right-width: ${attributes.borderRightWidth}` };
                }
            },
            borderRightColor: {
                default: null,
                parseHTML: (element) => element.style.borderRightColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderRightColor) return {};
                    return { style: `border-right-color: ${attributes.borderRightColor}` };
                }
            },
            borderBottomStyle: {
                default: null,
                parseHTML: (element) => element.style.borderBottomStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderBottomStyle) return {};
                    return { style: `border-bottom-style: ${attributes.borderBottomStyle}` };
                }
            },
            borderBottomWidth: {
                default: null,
                parseHTML: (element) => element.style.borderBottomWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderBottomWidth) return {};
                    return { style: `border-bottom-width: ${attributes.borderBottomWidth}` };
                }
            },
            borderBottomColor: {
                default: null,
                parseHTML: (element) => element.style.borderBottomColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderBottomColor) return {};
                    return { style: `border-bottom-color: ${attributes.borderBottomColor}` };
                }
            },
            borderLeftStyle: {
                default: null,
                parseHTML: (element) => element.style.borderLeftStyle || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderLeftStyle) return {};
                    return { style: `border-left-style: ${attributes.borderLeftStyle}` };
                }
            },
            borderLeftWidth: {
                default: null,
                parseHTML: (element) => element.style.borderLeftWidth || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderLeftWidth) return {};
                    return { style: `border-left-width: ${attributes.borderLeftWidth}` };
                }
            },
            borderLeftColor: {
                default: null,
                parseHTML: (element) => element.style.borderLeftColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.borderLeftColor) return {};
                    return { style: `border-left-color: ${attributes.borderLeftColor}` };
                }
            },
            /** 셀 최소 높이 (FR-06-5) */
            minHeight: {
                default: null,
                parseHTML: (element) => element.style.height || element.style.minHeight || null,
                renderHTML: (attributes) => {
                    if (!attributes.minHeight) return {};
                    return { style: `height: ${attributes.minHeight}` };
                }
            },
            /** 셀 수직 정렬 ('top' | 'middle' | 'bottom' | null) */
            verticalAlign: {
                default: null,
                parseHTML: (element) => element.style.verticalAlign || null,
                renderHTML: (attributes) => {
                    if (!attributes.verticalAlign) return {};
                    return { style: `vertical-align: ${attributes.verticalAlign}` };
                }
            },
            /** 열 너비 (CustomTableCell과 동일한 오버라이드 — v-html 조회 환경 대응) */
            colwidth: {
                default: null,
                parseHTML: (element) => {
                    const colwidthAttr = element.getAttribute('colwidth');
                    if (colwidthAttr) {
                        const widths = colwidthAttr.split(',').map(Number).filter((w: number) => w > 0);
                        if (widths.length) return widths;
                    }
                    const styleWidth = Number.parseInt(element.style.width, 10);
                    if (styleWidth > 0) return [styleWidth];
                    return null;
                },
                renderHTML: (attributes) => {
                    if (!Array.isArray(attributes.colwidth) || !attributes.colwidth.length) return {};
                    const totalWidth = (attributes.colwidth as number[]).reduce((s: number, w: number) => s + (w || 0), 0);
                    return totalWidth > 0
                        ? { colwidth: (attributes.colwidth as number[]).join(','), style: `width: ${totalWidth}px` }
                        : { colwidth: (attributes.colwidth as number[]).join(',') };
                }
            }
        };
    }
});
