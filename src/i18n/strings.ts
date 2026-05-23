// Strings centralizados. Añadir keys nuevas significa: 1) agregar al tipo,
// 2) escribir el valor en es y en. TS te grita si te olvidás.
//
// Solo cubrimos por ahora las pantallas de (auth) y onboarding intro. El
// resto de la app queda en español hasta que se decida traducir todo.

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
    "Lleva el control de las 994 láminas de tu álbum: las que ya pegaste, las que te faltan y las repetidas. Todo se sincroniza entre tus dispositivos.",
  onb1_cta: "Siguiente",
  onb2_title: "Marca rápido",
  onb2_body:
    "Toca una lámina para marcarla como pegada. Si tocas de nuevo, queda como repetida. Mantén presionado para restar. Las cuentas se actualizan solas.",
  onb2_cta: "Siguiente",
  onb3_title: "Intercambia con amigos",
  onb3_body:
    "Encuentra personas de tu ciudad en «Cerca de mí» o agrega amigos por código. La app te dice exactamente qué láminas puedes intercambiar con cada uno.",
  onb3_cta: "Empezar",
  onb_step: "Paso",

  // Toggle bar
  toggle_lang_es: "ES",
  toggle_lang_en: "EN"
} as const;

export type StringKey = keyof typeof es;

export const en: Record<StringKey, string> = {
  signIn_subtitle: "Your sticker album, in the cloud.",
  signIn_googleCta: "Continue with Google",
  signIn_appleCta: "Continue with Apple",
  signIn_terms: "By continuing you accept the terms and privacy policy.",
  signIn_terms_prefix: "By continuing you accept the ",
  signIn_terms_termsLabel: "terms",
  signIn_terms_middle: " and ",
  signIn_terms_privacyLabel: "privacy policy",
  signIn_terms_suffix: ".",

  username_title: "Choose your username",
  username_subtitle: "So your friends can find you to trade.",
  username_label: "@username",
  username_hint_invalid: "3-20 characters, only a-z, 0-9 and _",
  username_hint_taken: "That username is taken",
  username_hint_valid: "Available ✓",
  username_hint_checking: "Checking…",
  username_continue: "Continue",
  username_save_error_title: "Couldn't save",

  location_title: "Where are you?",
  location_subtitle: "So people in your city can propose trades.",
  location_country: "Country",
  location_city: "City",
  location_city_placeholder: "Armenia",
  location_discoverable_title: "Let others find me for trading",
  location_discoverable_subtitle:
    "People in your city will be able to send you trade requests. You can turn this off anytime in Profile.",
  location_continue: "Continue",
  location_save_error_title: "Couldn't save",

  onb1_title: "Welcome to your album",
  onb1_body:
    "Track all 994 stickers of your album: the ones you've collected, the ones you're missing, and your duplicates. Everything syncs across your devices.",
  onb1_cta: "Next",
  onb2_title: "Tap to mark",
  onb2_body:
    "Tap a sticker to mark it as collected. Tap again and it's a duplicate. Long-press to remove. Counts update automatically.",
  onb2_cta: "Next",
  onb3_title: "Trade with friends",
  onb3_body:
    "Find people in your city via «Nearby», or add friends by code. The app tells you exactly which stickers you can trade with each one.",
  onb3_cta: "Start",
  onb_step: "Step",

  toggle_lang_es: "ES",
  toggle_lang_en: "EN"
};
