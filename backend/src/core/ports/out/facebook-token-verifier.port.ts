export interface FacebookIdentity {
  email: string;
  fullName: string;
  facebookUserId: string;
}

export interface FacebookTokenVerifierPort {
  verify(accessToken: string): Promise<FacebookIdentity>;
}
