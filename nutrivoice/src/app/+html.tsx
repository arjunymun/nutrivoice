import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML shell for web (static export). Adds PWA wiring so iPhone/Android
 * users can install NutriVoice from the browser: Safari → Share → Add to Home
 * Screen.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>NutriVoice — talk to track calories</title>
        <meta name="description" content="Voice-first calorie tracker. Say what you ate, it logs the macros. Web, iOS and Android, one synced account." />
        <meta name="theme-color" content="#0B0D10" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NutriVoice" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#0B0D10}' }} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator && location.hostname!=='localhost'){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
