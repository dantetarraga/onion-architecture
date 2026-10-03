const SDK_URL = 'https://connect.facebook.net/es_LA/sdk.js';
const SDK_SCRIPT_ID = 'facebook-jssdk';
const DEFAULT_GRAPH_VERSION = 'v21.0';

const appId = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;
const version =
  (import.meta.env.VITE_FACEBOOK_GRAPH_VERSION as string | undefined) ?? DEFAULT_GRAPH_VERSION;

let sdkPromise: Promise<FacebookSdk> | null = null;

function loadSdk(): Promise<FacebookSdk> {
  if (!appId) {
    return Promise.reject(
      new Error('VITE_FACEBOOK_APP_ID no configurado: el login con Facebook no esta disponible.'),
    );
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error('No se pudo inicializar el SDK de Facebook.'));
        return;
      }
      window.FB.init({ appId, version, cookie: false, xfbml: false });
      resolve(window.FB);
    };

    if (document.getElementById(SDK_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.src = SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('No se pudo cargar el SDK de Facebook.'));
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export async function signInWithFacebook(): Promise<string> {
  const FB = await loadSdk();

  return new Promise<string>((resolve, reject) => {
    FB.login(
      (response) => {
        if (response.status === 'connected' && response.authResponse) {
          resolve(response.authResponse.accessToken);
          return;
        }
        reject(new Error('Inicio de sesion con Facebook cancelado.'));
      },
      { scope: 'public_profile,email' },
    );
  });
}
