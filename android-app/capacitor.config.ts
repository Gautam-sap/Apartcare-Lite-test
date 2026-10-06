// @ts-nocheck
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig={appId:'com.gkmasolutions.apartcarelite',appName:'ApartCare Lite',webDir:'www',server:{url:process.env.APARTCARE_WEB_URL||'https://YOUR-APARTCARE-DOMAIN.example',cleartext:false},android:{allowMixedContent:false}};
export default config;
