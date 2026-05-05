/**
 * HWPX 패키지 고정 XML 조각입니다.
 * Hangul 실제 출력 포맷과 맞춰야 해서 문자열 상수를 별도 파일로 분리했습니다.
 */

import type { ResolvedImage } from './hwpx-images';

/** 공통 xmlns 선언 (정상/변경 파일과 동일) */
export const COMMON_XMLNS =
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

// 주의: "tagetApplication"은 Hangul 실제 출력 포맷 (오타가 아니라 속성명 자체가 이 형태)
export const VERSION_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>` +
    `<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" ` +
    `tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" ` +
    `os="1" xmlVersion="1.2" application="Hancom Office Hangul" appVersion="11, 0, 0, 2129 WIN32LEWindows_8"/>`;

export const SETTINGS_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">` +
    `<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>` +
    `</ha:HWPApplicationSetting>`;

// container.xml — Hangul 실제 출력본 sample.hwpx와 동일하게 3개 rootfile 유지.
export const CONTAINER_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>` +
    `<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">` +
    `<ocf:rootfiles>` +
    `<ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>` +
    `<ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/>` +
    `<ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/>` +
    `</ocf:rootfiles>` +
    `</ocf:container>`;

// META-INF/manifest.xml — sample.hwpx는 빈 매니페스트 사용
export const MANIFEST_XML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>` +
    `<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;

export const CONTAINER_RDF =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description>` +
    `<rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description>` +
    `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section0.xml"/></rdf:Description>` +
    `<rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description>` +
    `<rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description>` +
    `</rdf:RDF>`;

/** Contents/content.hpf 생성 */
export const buildContentHpf = (title: string = '요구사항 정의서', images: ResolvedImage[] = []): string => {
    const mimeOf = (ext: string): string => {
        const e = ext.toLowerCase();
        if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
        if (e === 'gif')  return 'image/gif';
        if (e === 'bmp')  return 'image/bmp';
        if (e === 'webp') return 'image/webp';
        return 'image/png';
    };

    const imageItems = images.map(img =>
        `<opf:item id="image${img.binId}" href="BinData/image${img.binId}.${img.ext}" media-type="${mimeOf(img.ext)}" isEmbeded="1"/>`
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>` +
    `<opf:package ${COMMON_XMLNS} version="" unique-identifier="" id="">` +
    `<opf:metadata>` +
    `<opf:title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;')}</opf:title>` +
    `<opf:language>ko</opf:language>` +
    `</opf:metadata>` +
    `<opf:manifest>` +
    `<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>` +
    imageItems +
    `<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>` +
    `<opf:item id="settings" href="settings.xml" media-type="application/xml"/>` +
    `</opf:manifest>` +
    `<opf:spine>` +
    `<opf:itemref idref="header" linear="yes"/>` +
    `<opf:itemref idref="section0" linear="no"/>` +
    `</opf:spine>` +
    `</opf:package>`;
};
