/**
 * Rebuilds a Cloudflare-generated WebP from image chunks only. In particular,
 * it removes EXIF, XMP, ICC and unrecognised extension chunks (including
 * content-credential payloads). Cloudflare's Images binding currently has no
 * `metadata: none` option, so output needs this explicit second safety step.
 */
const IMAGE_CHUNKS=new Set(['VP8 ','VP8L','VP8X','ALPH']);
const METADATA_AND_ANIMATION_FLAGS=0x2e; // ICC, EXIF, XMP and animation.
function chunkType(data:Buffer,offset:number) { return data.subarray(offset,offset+4).toString('ascii'); }
function length(data:Buffer,offset:number) { return data.readUInt32LE(offset); }

export function stripWebpMetadata(input:Buffer):Buffer {
 if(input.length<20||input.subarray(0,4).toString('ascii')!=='RIFF'||input.subarray(8,12).toString('ascii')!=='WEBP') throw Error('Invalid WebP.');
 const kept:Buffer[]=[];let offset=12;let hasPixels=false;
 while(offset<input.length) {
  if(offset+8>input.length) throw Error('Invalid WebP chunk.');
  const type=chunkType(input,offset),size=length(input,offset+4),bodyStart=offset+8,bodyEnd=bodyStart+size,paddedEnd=bodyEnd+(size%2);
  if(bodyEnd>input.length||paddedEnd>input.length) throw Error('Invalid WebP chunk length.');
  if(IMAGE_CHUNKS.has(type)) {
   const body=Buffer.from(input.subarray(bodyStart,bodyEnd));
   if(type==='VP8X') {
    if(body.length!==10) throw Error('Invalid WebP header.');
    body[0]&=~METADATA_AND_ANIMATION_FLAGS;
   }
   const header=Buffer.alloc(8);header.write(type,0,'ascii');header.writeUInt32LE(body.length,4);
   kept.push(header,body);if(body.length%2) kept.push(Buffer.alloc(1));
   if(type==='VP8 '||type==='VP8L') hasPixels=true;
  }
  offset=paddedEnd;
 }
 if(offset!==input.length||!hasPixels) throw Error('WebP image payload missing.');
 const payload=Buffer.concat([Buffer.from('WEBP'),...kept]);
 const result=Buffer.alloc(8);result.write('RIFF',0,'ascii');result.writeUInt32LE(payload.length,4);
 return Buffer.concat([result,payload]);
}
