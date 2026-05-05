/**
 * [tests/unit/utils/hwpx.test.ts]
 * htmlToHwpxBlob의 테이블 병합(colspan/rowspan) 및 열 너비 처리 검증
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { htmlToHwpxBlob } from '../../../app/utils/hwpx';

/** HTML 표 문자열 → HWPX section0.xml 텍스트 */
async function getTableXml(tableHtml: string): Promise<string> {
    const blob = await htmlToHwpxBlob(tableHtml, 'test');
    const buf  = await (blob as Blob).arrayBuffer();
    const zip  = await JSZip.loadAsync(buf);
    return zip.file('Contents/section0.xml')!.async('text');
}

describe('hwpx 테이블 변환', () => {
    describe('단순 표 (병합 없음)', () => {
        it('2열 표: colCnt=2, 모든 셀 colSpan=1 rowSpan=1', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><th>A</th><th>B</th></tr>
                    <tr><td>1</td><td>2</td></tr>
                </table>`);
            expect(xml).toContain('colCnt="2"');
            for (const m of [...xml.matchAll(/colSpan="(\d+)" rowSpan="(\d+)"/g)]) {
                expect(m[1]).toBe('1');
                expect(m[2]).toBe('1');
            }
        });
    });

    describe('colspan 병합', () => {
        it('colspan=2 헤더: colCnt=2, colSpan="2" 출력', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><th colspan="2">헤더</th></tr>
                    <tr><td>A</td><td>B</td></tr>
                </table>`);
            expect(xml).toContain('colCnt="2"');
            expect(xml).toContain('colSpan="2" rowSpan="1"');
        });

        it('colspan=2 셀 너비 = 단일 셀 * 2 (=48190)', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><th colspan="2">헤더</th></tr>
                    <tr><td>A</td><td>B</td></tr>
                </table>`);
            // TABLE_WIDTH=48190, 2열 균등 → 각 24095 → colspan=2 → 24095+24095=48190
            // <hp:cellSz width="48190" ...> 가 존재해야 함
            expect(xml).toMatch(/cellSz width="48190"/);
        });

        it('중간 열 colspan=2: 뒤 셀의 colAddr가 3', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><td>A</td><td colspan="2">B+C</td><td>D</td></tr>
                    <tr><td>1</td><td>2</td><td>3</td><td>4</td></tr>
                </table>`);
            expect(xml).toContain('colCnt="4"');
            expect(xml).toContain('colAddr="1" rowAddr="0"');
            expect(xml).toContain('colSpan="2" rowSpan="1"');
            // D 셀은 colAddr=3
            expect(xml).toContain('colAddr="3" rowAddr="0"');
        });
    });

    describe('rowspan 병합', () => {
        it('rowspan=2: rowSpan="2" 출력, 2행 tc 1개만 존재', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><td rowspan="2">A</td><td>B</td></tr>
                    <tr><td>C</td></tr>
                </table>`);
            expect(xml).toContain('rowSpan="2"');
            // 마지막 <hp:tr> 블록 = 내용 표의 2번째 행 (C 셀만 포함)
            // (section0.xml에는 Title 표의 tr도 있어 split 인덱스가 아닌 정규식으로 추출)
            const allTrs = [...xml.matchAll(/<hp:tr>([\s\S]*?)<\/hp:tr>/g)];
            const lastTr = allTrs.at(-1)?.[1] ?? '';
            expect(lastTr.match(/<hp:tc /g)?.length).toBe(1);
        });

        it('rowspan=2 셀 height = ROW_HEIGHT * 2 = 3696', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><td rowspan="2">A</td><td>B</td></tr>
                    <tr><td>C</td></tr>
                </table>`);
            // ROW_HEIGHT=1848 × 2=3696
            expect(xml).toMatch(/cellSz width="\d+" height="3696"/);
        });
    });

    describe('열 너비 비율', () => {
        it('colgroup col style="width" → 비율 반영 (1:3 → 12047 + 36143 = 48190)', async () => {
            const xml = await getTableXml(`
                <table>
                    <colgroup>
                        <col style="width: 100px">
                        <col style="width: 300px">
                    </colgroup>
                    <tr><td>A</td><td>B</td></tr>
                </table>`);
            // TABLE_WIDTH=48190, 비율 1:3 → floor(48190/4)=12047, 나머지=36143
            expect(xml).toContain('colCnt="2"');
            expect(xml).toMatch(/cellSz width="12047"/);
            expect(xml).toMatch(/cellSz width="36143"/);
        });

        it('col data-colwidth (Tiptap) → 비율 반영', async () => {
            const xml = await getTableXml(`
                <table>
                    <colgroup>
                        <col data-colwidth="200">
                        <col data-colwidth="200">
                        <col data-colwidth="200">
                    </colgroup>
                    <tr><td>A</td><td>B</td><td>C</td></tr>
                </table>`);
            // 균등 → 각 16063, 마지막 16064
            expect(xml).toContain('colCnt="3"');
            // 콘텐츠 표만 추출 (마지막 <hp:tbl> 블록)
            const lastTbl = [...xml.matchAll(/<hp:tbl[\s\S]*?<\/hp:tbl>/g)].at(-1)?.[0] ?? '';
            const widths  = [...lastTbl.matchAll(/cellSz width="(\d+)"/g)].map(m => Number(m[1]));
            expect(widths.reduce((a, b) => a + b, 0)).toBe(48190);
        });

        it('첫 행 셀 style="width" 폴백 → 비율 반영 (1:1:2)', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr>
                        <td style="width: 50px">A</td>
                        <td style="width: 50px">B</td>
                        <td style="width: 100px">C</td>
                    </tr>
                </table>`);
            expect(xml).toContain('colCnt="3"');
            // 비율 1:1:2 → 12047 : 12047 : 24096
            expect(xml).toMatch(/cellSz width="12047"/);
            expect(xml).toMatch(/cellSz width="24096"/);
        });

        it('너비 미지정 시 균등 분배 유지', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr><td>A</td><td>B</td><td>C</td><td>D</td></tr>
                </table>`);
            // 4열 균등: 콘텐츠 표(마지막 hp:tbl)만 합산 → 48190
            const lastTbl = [...xml.matchAll(/<hp:tbl[\s\S]*?<\/hp:tbl>/g)].at(-1)?.[0] ?? '';
            const widths  = [...lastTbl.matchAll(/cellSz width="(\d+)"/g)].map(m => Number(m[1]));
            expect(widths.reduce((a, b) => a + b, 0)).toBe(48190);
        });
    });

    describe('복합 병합 (colspan + rowspan)', () => {
        it('4열 3행 복합 표: colCnt=4, rowCnt=3, A셀 colSpan=2 rowSpan=2', async () => {
            const xml = await getTableXml(`
                <table>
                    <tr>
                        <th colspan="2" rowspan="2">A</th>
                        <th>B</th><th>C</th>
                    </tr>
                    <tr><td>D</td><td>E</td></tr>
                    <tr><td>1</td><td>2</td><td>3</td><td>4</td></tr>
                </table>`);
            expect(xml).toContain('colCnt="4"');
            expect(xml).toContain('rowCnt="3"');
            expect(xml).toContain('colSpan="2" rowSpan="2"');
        });
    });
});
