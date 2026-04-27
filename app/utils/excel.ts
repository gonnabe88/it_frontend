/**
 * ============================================================================
 * [utils/excel.ts] 공통 Excel(xlsx) 다운로드 유틸리티
 * ============================================================================
 * 일괄다운로드 기능에서 사용하는 공통 함수입니다.
 * 생성되는 Excel 파일의 헤더 행(1행)은 StyledDataTable의 헤더 스타일과 일치하도록
 *   - 배경: Tailwind blue-900 (#1E3A8A)
 *   - 폰트: Malgun Gothic, 흰색(#FFFFFF), 볼드, 11pt
 *   - 정렬: 가운데(horizontal/vertical)
 *   - 테두리: 흰색 얇은 선
 * 을 적용합니다.
 *
 * [포함 함수]
 *  - applyHeaderStyle : 특정 ExcelJS Worksheet의 헤더(1행)에 공통 스타일 적용
 *  - downloadWorkbook : 완성된 Workbook을 브라우저에서 파일로 다운로드
 *  - exportRowsToExcel: 객체 배열(Record<string, any>[])을 바로 xlsx로 내보내는 편의 함수
 * ============================================================================
 */
import type { Workbook, Worksheet } from 'exceljs';

/** Tailwind blue-900 (#1E3A8A) — StyledDataTable 헤더 배경 */
const HEADER_BG_ARGB = 'FF1E3A8A';
const HEADER_FG_ARGB = 'FFFFFFFF';

/**
 * 지정한 Worksheet의 1행(헤더)에 공통 스타일을 적용합니다.
 * 이미 헤더 셀이 채워져 있어야 합니다(예: `ws.columns = [...]` 또는 `ws.addRow([...])` 이후 호출).
 */
export const applyHeaderStyle = (ws: Worksheet): void => {
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: HEADER_BG_ARGB },
        };
        cell.font = {
            name: 'Malgun Gothic',
            color: { argb: HEADER_FG_ARGB },
            bold: true,
            size: 11,
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: HEADER_FG_ARGB } },
            bottom: { style: 'thin', color: { argb: HEADER_FG_ARGB } },
            left: { style: 'thin', color: { argb: HEADER_FG_ARGB } },
            right: { style: 'thin', color: { argb: HEADER_FG_ARGB } },
        };
    });
    headerRow.commit();
};

/**
 * 완성된 ExcelJS Workbook을 브라우저에서 파일로 다운로드합니다.
 * @param wb       ExcelJS Workbook 인스턴스
 * @param fileName 저장 파일명 (확장자 .xlsx 포함 권장)
 */
export const downloadWorkbook = async (wb: Workbook, fileName: string): Promise<void> => {
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * 객체 배열을 xlsx 파일로 내보내는 편의 함수.
 * 1행에 헤더(객체 키)를 추가하고 자동으로 공통 헤더 스타일을 적용합니다.
 *
 * @param rows       데이터 행 배열 (각 row는 `{ 컬럼명: 값 }` 형식)
 * @param sheetName  워크시트 이름
 * @param fileName   저장 파일명
 * @param headerKeys (선택) 헤더 순서 강제 지정. 미지정 시 rows[0]의 키 순서 사용.
 */
export const exportRowsToExcel = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: Record<string, any>[],
    sheetName: string,
    fileName: string,
    headerKeys?: string[],
): Promise<void> => {
    /* ExcelJS는 용량이 크므로 동적 import로 초기 번들 크기를 줄입니다. */
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    if (rows.length > 0) {
        const keys = headerKeys ?? Object.keys(rows[0]!);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ws as any).columns = keys.map(k => ({ header: k, key: k }));
        rows.forEach(row => ws.addRow(row));
        applyHeaderStyle(ws);
    }

    await downloadWorkbook(wb, fileName);
};
