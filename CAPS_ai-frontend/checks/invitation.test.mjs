import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationUrl,isLocalInvitation } from '../src/app/services/invitation.ts';
import QRCode from 'qrcode';
test('invitation uses public code rather than numeric ID or private tokens',()=>assert.equal(invitationUrl('abc-defg-hij','','http://localhost:4200'),'http://localhost:4200/join/abc-defg-hij'));
test('configured HTTPS and LAN bases override localhost',()=>{
 assert.equal(invitationUrl('abc-defg-hij','https://meet.example.test/','http://localhost:4200'),'https://meet.example.test/join/abc-defg-hij');
 assert.equal(invitationUrl('abc-defg-hij','http://192.168.1.20:4200','http://localhost:4200'),'http://192.168.1.20:4200/join/abc-defg-hij');
});
test('invitation configuration rejects credentials and unsafe protocols',()=>{
 for(const base of ['javascript:alert(1)','https://user:secret@example.test','https://example.test?token=secret','https://example.test#token'])assert.throws(()=>invitationUrl('abc-defg-hij',base,'http://localhost:4200'));
});
test('localhost warning differs from reachable LAN/deployed origins',()=>{
 assert.ok(isLocalInvitation('http://localhost:4200/join/abc-defg-hij'));assert.ok(isLocalInvitation('http://127.0.0.1:4200/join/abc-defg-hij'));assert.ok(!isLocalInvitation('http://192.168.1.20:4200/join/abc-defg-hij'));
});
test('QR library produces a valid symbol and PNG for the exact invitation URL',async()=>{
 const url=invitationUrl('abc-defg-hij','https://meet.example.test','http://localhost:4200');
 const symbol=QRCode.create(url,{errorCorrectionLevel:'M'});assert.ok(symbol.modules.size>=21);
 const png=await QRCode.toBuffer(url,{type:'png',width:512,margin:4,errorCorrectionLevel:'M'});assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>500);
});
