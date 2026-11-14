export type Usuario = {
  id: string;
  email: string;
};

export type Sesion = {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: Usuario;
};

export type SesionRenovada = {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
};

export type Credenciales = {
  email: string;
  password: string;
};

export type DatosRefresh = {
  refreshToken: string;
};
