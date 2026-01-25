
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts'; // Need this for Roboto
import type { ProjectDetail } from '~/composables/useProjects';
import nanumGothic from '@/assets/fonts/NanumGothic-Regular.ttf?url';
import nanumGothicBold from '@/assets/fonts/NanumGothic-Bold.ttf?url';
import nanumGothicExtraBold from '@/assets/fonts/NanumGothic-ExtraBold.ttf?url';

// Module-level cache to persist across composable calls but reload on HMR
let cachedVfs: any = null;
let cachedFonts: any = null;

// Initialize defaults from pdfmake/vfs_fonts if available
const initDefaults = () => {
    if (cachedVfs && cachedFonts) return;

    // Base VFS with Roboto
    // @ts-ignore
    const defaultVfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ? pdfFonts.pdfMake.vfs : (pdfFonts.vfs ? pdfFonts.vfs : {});
    
    cachedVfs = { ...defaultVfs };
    
    cachedFonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        }
    };
};

// Define Interface for Approval Line
interface ApprovalLine {
    drafter: { name: string; rank: string; date: string; id: string };
    teamLead: { name: string; rank: string; date: string; id: string };
    deptHead: { name: string; rank: string; date: string; id: string };
}

export const usePdfReport = () => {
    
    // Ensure defaults are initialized
    initDefaults();

    // Font Configuration
    const loadKoreanFont = async () => {
        const fontName = 'NanumGothic';
        const vfsKeyRegular = 'NanumGothic-Regular.ttf';
        const vfsKeyBold = 'NanumGothic-Bold.ttf';
        const vfsKeyExtraBold = 'NanumGothic-ExtraBold.ttf';

        // Check if already loaded in our local cache
        if (cachedVfs[vfsKeyRegular] && cachedVfs[vfsKeyBold] && cachedFonts[fontName]) {
            console.log('Using cached font (local state):', fontName);
            return fontName;
        }

        try {
            console.log('Start loading fonts...');
            const [regRes, boldRes, extraRes] = await Promise.all([
                fetch(nanumGothic),
                fetch(nanumGothicBold),
                fetch(nanumGothicExtraBold)
            ]);

            if (!regRes.ok) throw new Error(`Failed to load Regular: ${regRes.statusText}`);
            // If bold fails, we might warn but continue with regular? Let's strict for now.
            if (!boldRes.ok) throw new Error(`Failed to load Bold: ${boldRes.statusText}`);
            if (!extraRes.ok) throw new Error(`Failed to load ExtraBold: ${extraRes.statusText}`);
            
            const [regBuf, boldBuf, extraBuf] = await Promise.all([
                regRes.arrayBuffer(),
                boldRes.arrayBuffer(),
                extraRes.arrayBuffer()
            ]);

            const toBase64 = (buffer: ArrayBuffer) => {
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return window.btoa(binary);
            };

            // Update local VFS cache
            cachedVfs[vfsKeyRegular] = toBase64(regBuf);
            cachedVfs[vfsKeyBold] = toBase64(boldBuf);
            cachedVfs[vfsKeyExtraBold] = toBase64(extraBuf);

            // Update local Fonts cache
            // Mapping ExtraBold to bolditalics just to make it accessible if needed via bold+italics style, 
            // OR we could create a separate font family 'NanumGothicExtraBold' if user explicitly asks for it.
            // For now, mapping Bold to bold.
            cachedFonts[fontName] = {
                normal: vfsKeyRegular, 
                bold: vfsKeyBold,
                italics: vfsKeyRegular, // Fallback
                bolditalics: vfsKeyExtraBold // Use ExtraBold for Bold+Italics slot as a hack to access it? Or just standard.
                                           // User asked to "use" it. Usually implies accessibility.
                                           // Let's use ExtraBold for the 'bold' style of 'header' class maybe?
                                           // Standard mapping:
            };
            
            // Also register ExtraBold as a separate family if they want explicit extra bold
            cachedFonts['NanumGothicExtraBold'] = {
                normal: vfsKeyExtraBold,
                bold: vfsKeyExtraBold,
                italics: vfsKeyExtraBold,
                bolditalics: vfsKeyExtraBold
            };

            console.log('Fonts registered in local cache.');
            return fontName;
        } catch (e) {
            console.error('Korean font loading failed, falling back to Roboto', e);
            return 'Roboto';
        }
    };

    const generateReport = async (projects: ProjectDetail[], approvalLine: ApprovalLine) => {
        try {
            console.log('generateReport START');
            const font = await loadKoreanFont();
            console.log('Font loaded:', font);
            
            // Use our local caches which we know correspond to each other
            const currentVfs = cachedVfs;
            const currentFonts = cachedFonts;

            // Design Constants (Blue/Indigo Theme)
            const colors = {
                primary: '#1e3a8a',    // Dark Blue (Text/Header)
                accent: '#2563eb',     // Blue 600 (Highlights)
                headerBg: '#eff6ff',   // Blue 50 (Table Headers)
                border: '#bfdbfe',     // Blue 200 (Lines)
                textGray: '#4b5563'    // Gray 600
            };

            const docDefinition: any = {
                content: [],
                defaultStyle: {
                    font: font,
                    fontSize: 10,
                    color: '#1f2937' // Gray 800 default text
                },
                styles: {
                    header: { 
                        fontSize: 22, 
                        bold: true, 
                        alignment: 'left', 
                        margin: [0, 0, 0, 5], 
                        font: 'NanumGothic',
                        color: colors.primary 
                    }, 
                    // Using NanumGothic (which has Bold mapped). 
                    label: { 
                        bold: true, 
                        fillColor: colors.headerBg, 
                        color: colors.primary,
                        alignment: 'center',
                        valign: 'middle' 
                    }, 
                    tableText: { margin: [2, 2, 2, 2] },
                    titleBox: { margin: [0, 10, 0, 10] },
                    approvalBox: { margin: [0, 0, 0, 20] }
                },
                pageMargins: [40, 40, 40, 40],
                footer: function(currentPage: number, pageCount: number) { 
                    return { 
                        text: currentPage.toString() + ' / ' + pageCount, 
                        alignment: 'center',
                        fontSize: 9,
                        color: colors.textGray,
                        margin: [0, 10, 0, 0]
                    }; 
                }
            };

            projects.forEach((project, index) => {
            // Page Break for 2nd project onwards
            if (index > 0) {
                docDefinition.content.push({ text: '', pageBreak: 'before' });
            }

            // 1. Header Area (Title + Approval Line)
            
            const approvalTable = {
                table: {
                    widths: [60, 60, 60],
                    body: [
                        [
                            { text: '기안자', style: 'label' },
                            { text: '팀장', style: 'label' },
                            { text: '부서장', style: 'label' }
                        ],
                        [
                            { 
                                stack: [
                                    { text: approvalLine.drafter.name, alignment: 'center', margin: [0, 0, 0, 2] },
                                    { text: approvalLine.drafter.rank, fontSize: 8, alignment: 'center', color: colors.textGray }
                                ],
                                height: 50
                            },
                             { 
                                stack: [
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
                        [
                             { text: approvalLine.drafter.date, fontSize: 8, alignment: 'center', color: colors.textGray },
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
                    // 두 번째 행(name/rank)의 패딩을 조정하여 세로 가운데 정렬
                    paddingTop: (i:number, node:any) => {
                        return i === 1 ? 12 : 4; // 두 번째 행만 위쪽 패딩 증가
                    },
                    paddingBottom: (i:number, node:any) => {
                        return i === 1 ? 12 : 4; // 두 번째 행만 아래쪽 패딩 증가
                    }
                }
            };

            const headerSection = {
                columns: [
                    {
                        width: '*',
                        stack: [
                            { text: '예산편성 신청', style: 'header' },
                            { text: '문서번호: (자동생성)', color: colors.textGray, fontSize: 9 },
                            { text: '보존연한: 5년', color: colors.textGray, fontSize: 9 }
                        ]
                    },
                    {
                        width: 'auto',
                        stack: [
                            approvalTable
                        ]
                    }
                ],
                margin: [0, 0, 0, 20]
            };

            docDefinition.content.push(headerSection);

            // 2. Project Title Bar
            docDefinition.content.push({
                table: {
                    widths: ['*'],
                    body: [
                        [{ 
                            text: `${index + 1}. ${project.prjNm}`, 
                            fontSize: 14, 
                            bold: true, 
                            color: 'white',
                            fillColor: colors.accent,
                            border: [false, false, false, false], 
                            margin: [10, 5, 10, 5] 
                        }]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            });

            // 3. Main Content Table
            
            const cellVal = (val: any) => val ? String(val) : '';
            const htmlToText = (html: string) => {
                if(!html) return '';
                let text = html;
                // Convert block tags to newlines
                text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
                // Convert breaks
                text = text.replace(/<br\s*\/?>/gi, '\n');
                // Strip all tags
                text = text.replace(/<[^>]+>/g, ''); 
                // Restore entities (basic)
                text = text.replace(/&nbsp;/g, ' ');
                text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                // Trim multiple newlines if desired? Maybe single trim
                return text.trim();
            };

            docDefinition.content.push({
                table: {
                    widths: ['15%', '35%', '15%', '35%'],
                    body: [
                        // Row 1
                        [
                            { text: '사업명', style: 'label' }, 
                            { text: cellVal(project.prjNm), colSpan: 3, bold: true, color: colors.primary }, 
                            {}, {} 
                        ],
                        // Row 2
                        [
                            { text: '관리번호', style: 'label' }, { text: cellVal(project.prjMngNo) },
                            { text: '사업유형', style: 'label' }, { text: cellVal(project.prjTp) }
                        ],
                        // Row 3
                        [
                             { text: '상태', style: 'label' }, { text: cellVal(project.prjSts) },
                             { text: '보고상태', style: 'label' }, { text: cellVal(project.rprSts) }
                        ],
                        // Row 4
                        [
                             { text: '예산년도', style: 'label' }, { text: cellVal(project.bgYy) },
                             { text: '소요예산', style: 'label' }, { text: project.prjBg ? project.prjBg.toLocaleString() + ' 원' : '', bold: true, alignment: 'right' }
                        ],
                        // Row 5
                         [
                             { text: '시작일', style: 'label' }, { text: cellVal(project.sttDt) },
                             { text: '종료일', style: 'label' }, { text: cellVal(project.endDt) }
                        ],
                        // Row 6
                         [
                             { text: '주관부문', style: 'label' }, { text: cellVal(project.svnHdq) },
                             { text: '주관부서', style: 'label' }, { text: cellVal(project.svnDpm) }
                        ],
                         // Row 7
                         [
                             { text: '현업담당자', style: 'label' }, { text: cellVal(project.svnDpmCgpr) },
                             { text: '현업팀장', style: 'label' }, { text: cellVal(project.svnDpmTlr) }
                        ],
                         // Row 8
                         [
                             { text: 'IT담당부서', style: 'label' }, { text: cellVal(project.itDpm) },
                             { text: 'IT담당자', style: 'label' }, { text: `${cellVal(project.itDpmCgpr)} / ${cellVal(project.itDpmTlr)} (팀장)` }
                        ],
                        // Row 9
                         [
                             { text: '주요사용자', style: 'label' }, { text: cellVal(project.mnUsr) },
                             { text: '업무구분', style: 'label' }, { text: cellVal(project.bzDtt) }
                        ],
                        // Row 10
                         [
                             { text: '기술유형', style: 'label' }, { text: cellVal(project.tchnTp) },
                             { text: '전결권', style: 'label' }, { text: cellVal(project.edrt) }
                        ],
                        // Row 11
                         [
                             { text: '중복여부', style: 'label' }, { text: cellVal(project.dplYn) },
                             { text: '의무완료', style: 'label' }, { text: cellVal(project.lblFsgTlm) }
                        ],
                        // Long Texts
                        [
                             { text: '현황(Situation)', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.saf), colSpan: 3 }
                             , {}, {}
                        ],
                         [
                             { text: '필요성(Needs)', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.ncs), colSpan: 3 }
                             , {}, {}
                        ],
                         [
                             { text: '사업내용(Des)', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.prjDes), colSpan: 3 }
                             , {}, {}
                        ],
                         [
                             { text: '사업범위(Scope)', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.prjRng), colSpan: 3 }
                             , {}, {}
                        ],
                         [
                             { text: '기대효과(Effect)', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.xptEff), colSpan: 3 }
                             , {}, {}
                        ],
                         [
                             { text: '추진사유', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.pulRsn), colSpan: 3 }
                             , {}, {}
                        ],
                        [
                             { text: '추진경과', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.pulPsg), colSpan: 3 }
                             , {}, {}
                        ],
                        [
                             { text: '문제점', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.plm), colSpan: 3 }
                             , {}, {}
                        ],
                        [
                             { text: '향후계획', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.hrfPln), colSpan: 3 }
                             , {}, {}
                        ],
                         [
                             { text: '추진가능성', style: 'label', fillColor: colors.headerBg }, 
                             { text: htmlToText(project.prjPulPtt), colSpan: 3 }
                             , {}, {}
                        ]
                    ]
                },
                layout: {
                    // Custom layout for better spacing
                    hLineWidth: (i: number) => 1,
                    vLineWidth: (i: number) => 1,
                    hLineColor: (i: number) => colors.border,
                    vLineColor: (i: number) => colors.border,
                    paddingTop: (i: number) => 8,
                    paddingBottom: (i: number) => 8,
                    paddingLeft: (i: number) => 6,
                    paddingRight: (i: number) => 6
                }
            });
        });

        // 4. Generate
        
        // 4. Generate
        
        // Final attempt to sync state to the instance we are about to use
        const targetPdfMake = (window as any).pdfMake || pdfMake;

        // Use addVirtualFileSystem method which writes to the singleton fs used by Printer
        if (targetPdfMake.addVirtualFileSystem) {
            targetPdfMake.addVirtualFileSystem(currentVfs);
            console.log('Called targetPdfMake.addVirtualFileSystem with VFS keys:', Object.keys(currentVfs));
        } else if (targetPdfMake.vfs) {
            // Fallback for older versions or if method missing: Assign/Merge
            Object.assign(targetPdfMake.vfs, currentVfs);
        } else {
            console.warn('Could not find addVirtualFileSystem or vfs property on pdfMake instance');
            // Try explicit assignment just in case
            targetPdfMake.vfs = currentVfs;
        }

        // Ensure Fonts has the config
        // addFonts is also a method
        if (targetPdfMake.addFonts) {
             console.log('Adding fonts via addFonts');
             targetPdfMake.addFonts(currentFonts);
        } else {
             Object.assign(targetPdfMake.fonts, currentFonts);
        }

        console.log('Generating PDF. Target Fonts:', Object.keys(targetPdfMake.fonts));

        // Use standard signature: createPdf(docDefinition, options)
        const pdfGenerator = targetPdfMake.createPdf(docDefinition, {});
        console.log('PDF Generator created:', pdfGenerator, 'Type:', typeof pdfGenerator);
        
        // Access the internal pdfDocumentPromise and generate PDF buffer directly
        return new Promise<string>(async (resolve, reject) => {
            try {
                console.log('Accessing pdfDocumentPromise...');
                
                // Wait for the PDF document to be created
                const pdfDoc = await (pdfGenerator as any).pdfDocumentPromise;
                console.log('PDF Document ready:', pdfDoc);
                
                // Capture PDF data using event listeners
                const chunks: Uint8Array[] = [];
                
                pdfDoc.on('data', (chunk: any) => {
                    console.log('Received chunk, length:', chunk.length);
                    chunks.push(new Uint8Array(chunk));
                });
                
                pdfDoc.on('end', () => {
                    console.log('PDF generation complete, total chunks:', chunks.length);
                    
                    // Combine all chunks into a single buffer
                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const buffer = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        buffer.set(chunk, offset);
                        offset += chunk.length;
                    }
                    
                    console.log('Buffer created, total length:', buffer.length);
                    const blob = new Blob([buffer], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    console.log('✓ Blob URL created:', url);
                    resolve(url);
                });
                
                pdfDoc.on('error', (error: any) => {
                    console.error('PDFDocument error:', error);
                    reject(error);
                });
                
                // Trigger PDF generation
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
