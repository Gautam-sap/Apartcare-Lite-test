import type { Metadata } from 'next';

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  title: 'ApartCare Lite',
  description: 'Your daily partner in property care. Helping you run your building beautifully.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><style>{`
.mobile-app-page{min-height:100vh;padding:28px;background:radial-gradient(circle at 20% 10%,rgba(37,99,235,.12),transparent 28%),linear-gradient(135deg,#f6f9fc,#eef4fb);color:#173b69;font-family:Inter,Arial,sans-serif;box-sizing:border-box}.mobile-app-hero{width:min(760px,100%);margin:0 auto;text-align:center;padding:34px 24px;border:1px solid #dbe5ef;border-radius:24px;background:rgba(255,255,255,.96);box-shadow:0 20px 60px rgba(23,43,77,.12)}.mobile-app-brand{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:18px}.mobile-app-brand img{width:54px;height:54px;object-fit:contain}.mobile-app-brand b{display:block;font-size:20px}.mobile-app-brand span{display:block;color:#64748b;font-size:12px;margin-top:3px}.mobile-app-icon{width:68px;height:68px;margin:4px auto 14px;display:grid;place-items:center;border-radius:20px;background:#edf4ff;border:1px solid #d4e2f4;font-size:32px}.mobile-app-hero h1{margin:0;font-size:clamp(28px,5vw,42px);line-height:1.1;color:#173b69}.mobile-app-hero p{max-width:620px;margin:16px auto 22px;color:#52677f;line-height:1.65}.mobile-app-download-cta{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:12px;background:linear-gradient(135deg,#2f6fed,#2859c7);color:#fff;text-decoration:none;font-weight:850;box-shadow:0 9px 20px rgba(47,111,237,.22)}.mobile-app-coming{display:flex;flex-direction:column;gap:5px;max-width:560px;margin:0 auto;padding:14px;border:1px solid #d8e5f2;border-radius:12px;background:#f7fbff;color:#315f96}.mobile-app-coming span{font-size:12px;color:#64748b;line-height:1.45}.mobile-app-back{display:block;margin-top:16px;color:#315f96;font-weight:800;text-decoration:none}.mobile-app-features{width:min(980px,100%);margin:18px auto 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.mobile-app-features article{padding:16px;border:1px solid #dbe5ef;border-radius:15px;background:#fff;box-shadow:0 7px 18px rgba(38,56,78,.06)}.mobile-app-features b,.mobile-app-features span{display:block}.mobile-app-features b{color:#173b69;margin-bottom:6px}.mobile-app-features span{color:#64748b;font-size:12px;line-height:1.45}@media(max-width:760px){.mobile-app-page{padding:14px}.mobile-app-hero{padding:25px 17px;border-radius:18px}.mobile-app-features{grid-template-columns:1fr 1fr}}@media(max-width:460px){.mobile-app-features{grid-template-columns:1fr}}
`}</style>{children}</body>
    </html>
  );
}
