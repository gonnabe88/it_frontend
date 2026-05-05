/**
 * ============================================================================
 * [utils/hwpx-images.ts] HWPX 이미지 수집 및 해석 유틸리티
 * ============================================================================
 * Tiptap HTML에 포함된 이미지 태그를 수집하고, data URL/원격 URL/SVG를
 * HWPX binData에 넣을 수 있는 바이너리 이미지로 변환합니다.
 * ============================================================================
 */

export interface PendingImage {
    src: string;
    binId: number;
    width: number;
    height: number;
}

export interface ResolvedImage extends PendingImage {
    data: Uint8Array;
    ext: string;
    naturalWidth: number;
    naturalHeight: number;
}

/** 이미지 fetch 콜백 타입 — 호출자가 인증/쿠키를 자동 처리하는 fetcher 주입 가능 */
export type HwpxImageFetch = (src: string) => Promise<ArrayBuffer | null>;

/**
 * HTML 내 모든 <img src="..."> 태그를 수집하여 PendingImage 목록과 src→PendingImage 매핑을 만듭니다.
 * width/height 속성이 있으면 px 단위로 해석하고, 없으면 기본값(12000×9000 HWPUNIT ≈ 4.2×3.2cm)을 사용합니다.
 */
export const collectImages = (html: string): { list: PendingImage[]; map: Map<string, PendingImage> } => {
    const list: PendingImage[] = [];
    const map = new Map<string, PendingImage>();
    if (typeof DOMParser === 'undefined') return { list, map };

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
    let nextId = 1;
    for (const el of imgs) {
        const src = el.getAttribute('src');
        if (!src || map.has(src)) continue;
        const px2hu = 75;
        const wAttr = Number.parseInt(el.getAttribute('width') || '0', 10);
        const hAttr = Number.parseInt(el.getAttribute('height') || '0', 10);
        const width  = wAttr > 0 ? wAttr * px2hu : 12000;
        const height = hAttr > 0 ? hAttr * px2hu : 9000;
        const info: PendingImage = { src, binId: nextId++, width, height };
        list.push(info);
        map.set(src, info);
    }
    return { list, map };
};

/** MIME 타입 또는 URL 확장자로부터 이미지 확장자 추출 */
const detectExt = (mime: string, url: string): string => {
    const mt = mime.toLowerCase();
    if (mt.includes('png'))  return 'png';
    if (mt.includes('jpeg') || mt.includes('jpg')) return 'jpg';
    if (mt.includes('gif'))  return 'gif';
    if (mt.includes('bmp'))  return 'bmp';
    if (mt.includes('webp')) return 'webp';
    const urlExt = url.match(/\.(png|jpe?g|gif|bmp|webp)(\?|$)/i)?.[1];
    return (urlExt || 'png').toLowerCase().replace('jpeg', 'jpg');
};

/**
 * PNG IHDR 청크에서 (width, height)를 읽어옵니다.
 * PNG 구조: 8-byte signature + 4-byte IHDR length + "IHDR" + 4-byte width + 4-byte height
 */
const parsePngDims = (data: Uint8Array): { w: number; h: number } | null => {
    if (data.length < 24) return null;
    if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47) return null;
    if (data[12] !== 0x49 || data[13] !== 0x48 || data[14] !== 0x44 || data[15] !== 0x52) return null;
    const w = (data[16]! << 24) | (data[17]! << 16) | (data[18]! << 8) | data[19]!;
    const h = (data[20]! << 24) | (data[21]! << 16) | (data[22]! << 8) | data[23]!;
    return { w, h };
};

/** JPEG SOF 마커에서 (width, height)를 읽어옵니다. */
const parseJpegDims = (data: Uint8Array): { w: number; h: number } | null => {
    if (data.length < 4 || data[0] !== 0xFF || data[1] !== 0xD8) return null;
    let i = 2;
    while (i < data.length - 8) {
        if (data[i] !== 0xFF) { i++; continue; }
        const marker = data[i + 1]!;
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3 ||
            marker === 0xC5 || marker === 0xC6 || marker === 0xC7 ||
            marker === 0xC9 || marker === 0xCA || marker === 0xCB ||
            marker === 0xCD || marker === 0xCE || marker === 0xCF) {
            const h = (data[i + 5]! << 8) | data[i + 6]!;
            const w = (data[i + 7]! << 8) | data[i + 8]!;
            return { w, h };
        }
        const segLen = (data[i + 2]! << 8) | data[i + 3]!;
        i += 2 + segLen;
    }
    return null;
};

/** 브라우저 Image API로 자연 크기 조회 (PNG/JPEG 파싱이 실패한 경우 fallback) */
const imageDimsViaBrowser = (data: Uint8Array, mime: string): Promise<{ w: number; h: number } | null> =>
    new Promise(resolve => {
        try {
            const blob = new Blob([data as BlobPart], { type: mime || 'image/png' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                resolve({ w: img.naturalWidth, h: img.naturalHeight });
                URL.revokeObjectURL(url);
            };
            img.onerror = () => {
                resolve(null);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } catch {
            resolve(null);
        }
    });

/** 바이너리 데이터가 SVG인지 판별 (Excalidraw가 SVG로 저장됨) */
const isSvgData = (data: Uint8Array): boolean => {
    if (data.length < 5) return false;
    const head = new TextDecoder('utf-8', { fatal: false })
        .decode(data.slice(0, Math.min(data.length, 256)))
        .trim()
        .toLowerCase();
    return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
};

/**
 * SVG 바이너리를 PNG로 래스터화합니다.
 * Hangul은 SVG를 렌더링하지 못하므로 Excalidraw 같은 SVG 이미지는 PNG로 변환해 임베드합니다.
 */
const svgToPngData = (data: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number } | null> =>
    new Promise(resolve => {
        try {
            const blob = new Blob([data as BlobPart], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = async () => {
                try {
                    const W = img.naturalWidth  || 800;
                    const H = img.naturalHeight || 600;
                    const canvas = document.createElement('canvas');
                    canvas.width  = W;
                    canvas.height = H;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(null); URL.revokeObjectURL(url); return; }
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, W, H);
                    ctx.drawImage(img, 0, 0, W, H);
                    URL.revokeObjectURL(url);
                    canvas.toBlob(async (pngBlob) => {
                        if (!pngBlob) { resolve(null); return; }
                        const buf = await pngBlob.arrayBuffer();
                        resolve({ data: new Uint8Array(buf), width: W, height: H });
                    }, 'image/png');
                } catch {
                    resolve(null);
                    URL.revokeObjectURL(url);
                }
            };
            img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
            img.src = url;
        } catch {
            resolve(null);
        }
    });

/**
 * 이미지를 fetch하여 ResolvedImage 배열로 변환합니다.
 * data: URL은 인라인 디코딩, 나머지는 imageFetch(주입 시) 또는 fetch() 기본값을 사용합니다.
 */
export const resolveImages = async (
    pending: PendingImage[],
    imageFetch?: HwpxImageFetch,
): Promise<ResolvedImage[]> => {
    const results: ResolvedImage[] = [];
    for (const p of pending) {
        try {
            let data: Uint8Array;
            let mime = '';
            if (p.src.startsWith('data:')) {
                const match = p.src.match(/^data:([^,]*),(.*)$/);
                if (!match) continue;
                const header = match[1] || '';
                mime = header.split(';')[0] || '';
                const payload = match[2] || '';
                const isBase64 = /(?:^|;)base64(?:;|$)/i.test(header);
                const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                data = bytes;
            } else if (imageFetch) {
                const buf = await imageFetch(p.src);
                if (!buf) continue;
                data = new Uint8Array(buf);
            } else {
                const res = await fetch(p.src, { credentials: 'include' });
                if (!res.ok) continue;
                mime = res.headers.get('content-type') || '';
                data = new Uint8Array(await res.arrayBuffer());
            }
            let ext = detectExt(mime, p.src);

            if (isSvgData(data)) {
                const png = await svgToPngData(data);
                if (png) {
                    data = png.data;
                    ext = 'png';
                    mime = 'image/png';
                    results.push({
                        ...p,
                        data,
                        ext,
                        naturalWidth:  png.width,
                        naturalHeight: png.height,
                    });
                    continue;
                }
                continue;
            }

            let dims: { w: number; h: number } | null = null;
            if (ext === 'png') dims = parsePngDims(data);
            else if (ext === 'jpg') dims = parseJpegDims(data);
            if (!dims) dims = await imageDimsViaBrowser(data, mime);

            results.push({
                ...p,
                data,
                ext,
                naturalWidth:  dims?.w || 0,
                naturalHeight: dims?.h || 0,
            });
        } catch {
            // 개별 이미지 실패는 무시하고 나머지 이미지를 계속 처리합니다.
        }
    }
    return results;
};
