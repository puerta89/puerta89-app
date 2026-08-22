import { supabaseServidor } from "@/lib/supabase/server";

export type BancoDelMapa = {
  banco_id: string;
  numero: number;
  pos_x: number;
  pos_y: number;
  ticket_id: string | null;
  ticket_estado: "abierto" | "por_cobrar" | null;
  abierto_en: string | null;
  personas: number | null;
  mesero: string | null;
};

export type ZonaDelMapa = {
  id: string;
  nombre: string;
  bancos: BancoDelMapa[];
};

type Renglon = BancoDelMapa & {
  zona_id: string;
  zona_nombre: string;
  zona_orden: number;
};

/** Trae el mapa de la barra ya agrupado por zona. */
export async function traerMapa(sucursalId: string): Promise<ZonaDelMapa[]> {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("mapa_barra", {
    p_sucursal: sucursalId,
  });

  if (error) throw new Error(`No se pudo leer el mapa: ${error.message}`);

  const zonas = new Map<string, ZonaDelMapa>();

  for (const r of (data ?? []) as Renglon[]) {
    if (!zonas.has(r.zona_id)) {
      zonas.set(r.zona_id, { id: r.zona_id, nombre: r.zona_nombre, bancos: [] });
    }
    zonas.get(r.zona_id)!.bancos.push({
      banco_id: r.banco_id,
      numero: r.numero,
      pos_x: Number(r.pos_x),
      pos_y: Number(r.pos_y),
      ticket_id: r.ticket_id,
      ticket_estado: r.ticket_estado,
      abierto_en: r.abierto_en,
      personas: r.personas,
      mesero: r.mesero,
    });
  }

  return [...zonas.values()];
}
