import assert from 'node:assert/strict';
import test from 'node:test';
import {postgres} from '../src/lib/server/database.ts';

test('database rejects an invalid configured CA before opening a connection',()=>{
 const previous=process.env.DATABASE_SSL_CA_BASE64;
 process.env.DATABASE_SSL_CA_BASE64=Buffer.from('not a certificate').toString('base64');
 try{assert.throws(()=>postgres('postgresql://localhost/test'),/base64-encoded PEM certificate/);}
 finally{if(previous===undefined)delete process.env.DATABASE_SSL_CA_BASE64;else process.env.DATABASE_SSL_CA_BASE64=previous;}
});

test('database accepts a PEM CA and keeps verification enabled',async()=>{
 const previous=process.env.DATABASE_SSL_CA_BASE64;
 process.env.DATABASE_SSL_CA_BASE64=Buffer.from('-----BEGIN CERTIFICATE-----\ntest-only\n-----END CERTIFICATE-----').toString('base64');
 try{const db=postgres('postgresql://localhost/test');await db.close();}
 finally{if(previous===undefined)delete process.env.DATABASE_SSL_CA_BASE64;else process.env.DATABASE_SSL_CA_BASE64=previous;}
});
