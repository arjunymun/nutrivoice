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
        <style
          dangerouslySetInnerHTML={{
            __html:
              "body{background-color:#0B0D10}" +
              "#boot-splash{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#0B0D10;transition:opacity .35s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
              "#boot-splash.bs-hide{opacity:0;pointer-events:none}" +
              "#boot-splash .bs-mark{font-size:26px;font-weight:800;letter-spacing:-.02em;color:#F2F5F9}" +
              "#boot-splash .bs-mark b{color:#C8F135;font-weight:800}" +
              "#boot-splash .bs-spin{width:30px;height:30px;border-radius:50%;border:3px solid #242C37;border-top-color:#C8F135;animation:bs-rot .8s linear infinite}" +
              "@keyframes bs-rot{to{transform:rotate(360deg)}}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              // Remove the instant boot splash once the app signals readiness (called
              // from the root layout). Fallback timeout guarantees it never traps the user.
              "window.__hideBoot=function(){var e=document.getElementById('boot-splash');if(e){e.classList.add('bs-hide');setTimeout(function(){if(e&&e.parentNode)e.parentNode.removeChild(e)},400)}};" +
              "setTimeout(function(){if(window.__hideBoot)window.__hideBoot()},12000);" +
              "if('serviceWorker' in navigator && location.hostname!=='localhost'){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}",
          }}
        />
      </head>
      <body>
        {/* Instant, JS-free brand splash so the first paint is never a black void
            while the JS bundle downloads and Inter fonts load. Removed on app mount. */}
        <div
          id="boot-splash"
          dangerouslySetInnerHTML={{
            __html: '<div class="bs-mark">Nutri<b>Voice</b></div><div class="bs-spin"></div>',
          }}
        />
        {children}
      </body>
    </html>
  );
}
