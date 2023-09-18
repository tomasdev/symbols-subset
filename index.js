const harfbuzzjs = require('harfbuzzjs');
const path = require('path');
const fs = require('fs');

const FONT_URL = 'https://github.com/google/material-design-icons/raw/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.ttf';
const ICONS = ['alarm_off', 'add'];

async function subsetWithGids(fontBlob, gids) {
    const { instance: { exports: hbsubset } } = await WebAssembly.instantiate(fs.readFileSync(path.join(__dirname, 'node_modules/harfbuzzjs/hb-subset.wasm')));

    const heapu8 = new Uint8Array(hbsubset.memory.buffer);
    const fontBuffer = hbsubset.malloc(fontBlob.byteLength);
    heapu8.set(new Uint8Array(fontBlob), fontBuffer);
    const blob = hbsubset.hb_blob_create(fontBuffer, fontBlob.byteLength, 2/*HB_MEMORY_MODE_WRITABLE*/, 0, 0);
    const face = hbsubset.hb_face_create(blob, 0);
    hbsubset.hb_blob_destroy(blob);

    /* Add your glyph indices here and subset */
    const input = hbsubset.hb_subset_input_create_or_fail();
    // const unicode_set = hbsubset.hb_subset_input_unicode_set(input);
    const gids_set = hbsubset.hb_subset_input_glyph_set(input);
    for (const gid of gids) {
        // hbsubset.hb_set_add(unicode_set, char.codePointAt(0));
        hbsubset.hb_set_add(gids_set, gid);
    }
    const subset = hbsubset.hb_subset_or_fail(face, input);
    hbsubset.hb_subset_input_destroy(input);
    const resultBlob = hbsubset.hb_face_reference_blob(subset);
    const offset = hbsubset.hb_blob_get_data(resultBlob, 0);
    const subsetFontBlob = heapu8.subarray(offset, offset + hbsubset.hb_blob_get_length(resultBlob));
    fs.writeFileSync('test.ttf', subsetFontBlob);
}


async function init(harfbuzz) {
    // Create a list of glyph IDs that correspond to the icons
    // (ligatures) requested and their components (individual characters)
    // Each unique letter and each ligature space separated.
    // For example: "a l r m _ o f d alarm_off add"
    const text = Array.from(new Set(ICONS.join(''))).concat(ICONS).join(' ');

    console.time('fetching font');
    const fontBlob = await (await fetch(FONT_URL)).arrayBuffer();
    console.timeEnd('fetching font');

    const blob = harfbuzz.createBlob(fontBlob);
    const face = harfbuzz.createFace(blob, 0);
    const font = harfbuzz.createFont(face);
    const buffer = harfbuzz.createBuffer();
    buffer.addText(text);
    console.log('text: ', text);
    buffer.guessSegmentProperties();
    JSON.stringify(harfbuzz.shape(font, buffer, ''), null, 2);
    const result = buffer.json(font);
    const gids = Array.from(new Set(result.map(x => x.g).sort((a, b) => a - b)));
    console.log('gids', gids);

    await subsetWithGids(fontBlob, gids);
}

harfbuzzjs.then(harfbuzz => init(harfbuzz));