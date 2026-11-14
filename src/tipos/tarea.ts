export type Prioridad = 1 | 2 | 3;

export type CamposTarea = {
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad;
  vence_en: string | null;
  completada: boolean;
};

export type TareaGuardada = CamposTarea & {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Tarea = TareaGuardada & {
  id: string;
};

export type DocumentoTarea = {
  id: string;
  datos: unknown;
};

export type ResultadoListaTareas = {
  items: Tarea[];
  servidor_ahora: string;
};
