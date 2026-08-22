import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "p89_sesion";
const DURACION_HORAS = 14; // cubre un turno completo con margen

export type Sesion = {
  empleadoId: string;
  nombre: string;
  rol: "dueno" | "gerente" | "mesero";
  sucursalId: string;
  sucursalNombre: string;
  sucursalColor: string;
  puedeCambiarSucursal: boolean;
  expira: number;
};

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Falta SESSION_SECRET en .env.local");
  return s;
}

function firmar(datos: string) {
  return createHmac("sha256", secreto()).update(datos).digest("base64url");
}

/** Compara sin filtrar información por el tiempo que tarda. */
function firmaValida(datos: string, firma: string) {
  const esperada = Buffer.from(firmar(datos));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}

export async function abrirSesion(datos: Omit<Sesion, "expira">) {
  const sesion: Sesion = {
    ...datos,
    expira: Date.now() + DURACION_HORAS * 60 * 60 * 1000,
  };
  const cuerpo = Buffer.from(JSON.stringify(sesion)).toString("base64url");
  const galleta = await cookies();

  galleta.set(COOKIE, `${cuerpo}.${firmar(cuerpo)}`, {
    httpOnly: true, // el navegador no la puede leer con JavaScript
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_HORAS * 60 * 60,
  });
}

export async function leerSesion(): Promise<Sesion | null> {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;

  const [cuerpo, firma] = valor.split(".");
  if (!cuerpo || !firma || !firmaValida(cuerpo, firma)) return null;

  try {
    const sesion: Sesion = JSON.parse(
      Buffer.from(cuerpo, "base64url").toString(),
    );
    if (sesion.expira < Date.now()) return null;
    return sesion;
  } catch {
    return null;
  }
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}
