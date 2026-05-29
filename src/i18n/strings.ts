// Strings centralizados. Idioma único: español. Si en el futuro se reactivan
// múltiples idiomas, agregar tablas paralelas y reintroducir la lógica de
// selección en I18nProvider.

export const es = {
  signIn_subtitle: "Tu álbum de cromos en la nube.",
  signIn_googleCta: "Continuar con Google",
  signIn_appleCta: "Continuar con Apple",
  signIn_terms: "Al continuar aceptas los términos y la política de privacidad.",
  signIn_terms_prefix: "Al continuar aceptas los ",
  signIn_terms_termsLabel: "términos",
  signIn_terms_middle: " y la ",
  signIn_terms_privacyLabel: "política de privacidad",
  signIn_terms_suffix: ".",

  username_title: "Elige tu username",
  username_subtitle: "Así te encuentran tus amigos para intercambiar.",
  username_label: "@username",
  username_hint_invalid: "3-20 caracteres, solo a-z, 0-9 y _",
  username_hint_taken: "Ese username ya está tomado",
  username_hint_valid: "Disponible ✓",
  username_hint_checking: "Verificando…",
  username_continue: "Continuar",
  username_save_error_title: "No se pudo guardar",

  location_title: "¿Dónde estás?",
  location_subtitle: "Para que personas de tu ciudad puedan proponerte intercambios.",
  location_country: "País",
  location_city: "Ciudad",
  location_city_placeholder: "Armenia",
  location_discoverable_title: "Que me encuentren para intercambiar",
  location_discoverable_subtitle:
    "Personas de tu ciudad podrán enviarte solicitudes. Lo apagas cuando quieras desde Perfil.",
  location_continue: "Continuar",
  location_save_error_title: "No se pudo guardar",

  onb1_title: "Bienvenido a tu álbum",
  onb1_body:
    "Lleva el control de todas las láminas de tu álbum: las que ya pegaste, las que te faltan y las repetidas. Todo se sincroniza entre tus dispositivos.",
  onb1_cta: "Siguiente",
  onb2_title: "Marca rápido",
  onb2_body:
    "Toca una lámina para marcarla como pegada. Si tocas de nuevo, queda como repetida. Mantén presionado para restar. Las cuentas se actualizan solas.",
  onb2_cta: "Siguiente",
  onb3_title: "Intercambia con amigos",
  onb3_body:
    "Encuentra personas de tu ciudad en «Cerca de mí» o agrega amigos por código. La app te dice exactamente qué láminas puedes intercambiar con cada uno.",
  onb3_cta: "Empezar",
  onb_step: "Paso"
} as const;

export type StringKey = keyof typeof es;
