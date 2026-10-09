import * as React from 'react'
import { MonitorSmartphone } from 'lucide-react'
import logo from '@/assets/logo.png'

/** Sayfa tarayıcıda (geliştirme sunucusu adresi) açılırsa: uygulama yalnızca masaüstü penceresinde çalışır */
export function NotDesktop(): React.JSX.Element {
  return (
    <div className="app-ambient flex h-full items-center justify-center p-6">
      <div className="surface w-full max-w-[460px] p-8 text-center">
        <img src={logo} alt="" className="mx-auto size-14 rounded-2xl" draggable={false} />
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Control Center masaüstünde çalışır</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Bu sekme yalnızca geliştirme sunucusunun adresi. Veritabanı, giriş, bildirimler ve tepsi yalnızca uygulama penceresinde var.
        </p>
        <div className="mt-5 flex items-start gap-3 rounded-xl border bg-card/60 p-4 text-left text-[13px]">
          <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <code className="font-semibold">npm run dev</code> ile açılan <b>Control Center</b> penceresini kullan (görev çubuğuna bak). Bu sekmeyi kapatabilirsin.
          </div>
        </div>
      </div>
    </div>
  )
}
