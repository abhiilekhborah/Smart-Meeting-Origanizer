export async function qrPng(url: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(url, {type:'image/png',width:512,margin:4,errorCorrectionLevel:'M',color:{dark:'#10152fff',light:'#ffffffff'}});
}
