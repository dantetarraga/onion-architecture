interface FacebookAuthResponse {
  accessToken: string;
  userID: string;
  expiresIn: number;
}

interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse: FacebookAuthResponse | null;
}

interface FacebookSdk {
  init(options: {
    appId: string;
    version: string;
    cookie?: boolean;
    xfbml?: boolean;
  }): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope: string },
  ): void;
}

interface Window {
  FB?: FacebookSdk;
  fbAsyncInit?: () => void;
}
