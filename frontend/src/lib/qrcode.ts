import QRCode from 'qrcode';

export function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    margin: 1,
    width: 320,
    color: { dark: '#17181a', light: '#fbfaf6' },
  });
}
