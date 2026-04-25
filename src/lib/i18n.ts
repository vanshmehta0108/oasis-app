// English and Hindi translations for Sift app
type TranslationKey = keyof typeof EN;

export const EN = {
  // Navigation
  home: "Home",
  search: "Search",
  scan: "Scan",
  add: "Add",
  profile: "Profile",

  // Product Detail
  harmful_substances: "Harmful substances",
  beneficial_ingredients: "Beneficial ingredients",
  ingredient_analysis: "Ingredient Analysis",
  warnings: "Warnings",
  overall: "Overall",
  score: "Score",

  // Safety levels
  safe: "Safe",
  caution: "Caution",
  warning: "Warning",
  danger: "Danger",

  // Grade levels
  grade_a: "Safe",
  grade_b: "Mostly Safe",
  grade_c: "Concerning",
  grade_d: "Unsafe",
  grade_e: "Dangerous",

  // Categories
  food: "Food",
  beverages: "Beverages",
  snacks: "Snacks",
  baby: "Baby",
  skincare: "Skincare",
  household: "Household",

  // Buttons
  share: "Share",
  bookmark: "Bookmark",
  compare: "Compare",
  back: "Back",
  add_to_compare: "Add to compare",

  // Language
  english: "English",
  hindi: "Hindi",

  // Messages
  loading: "Loading...",
  no_results: "No results found",
  scan_product: "Scan a product",
  add_custom_product: "Add custom product",
};

export const HI = {
  // Navigation
  home: "होम",
  search: "खोज",
  scan: "स्कैन करें",
  add: "जोड़ें",
  profile: "प्रोफ़ाइल",

  // Product Detail
  harmful_substances: "हानिकारक पदार्थ",
  beneficial_ingredients: "लाभकारी सामग्री",
  ingredient_analysis: "सामग्री विश्लेषण",
  warnings: "चेतावनियाँ",
  overall: "कुल",
  score: "स्कोर",

  // Safety levels
  safe: "सुरक्षित",
  caution: "सावधानी",
  warning: "चेतावनी",
  danger: "खतरनाक",

  // Grade levels
  grade_a: "सुरक्षित",
  grade_b: "ज्यादातर सुरक्षित",
  grade_c: "चिंताजनक",
  grade_d: "असुरक्षित",
  grade_e: "बेहद खतरनाक",

  // Categories
  food: "खाद्य",
  beverages: "पेय",
  snacks: "स्नैक्स",
  baby: "बेबी",
  skincare: "त्वचा देखभाल",
  household: "घरेलू",

  // Buttons
  share: "साझा करें",
  bookmark: "बुकमार्क करें",
  compare: "तुलना करें",
  back: "वापस",
  add_to_compare: "तुलना में जोड़ें",

  // Language
  english: "English",
  hindi: "हिंदी",

  // Messages
  loading: "लोड हो रहा है...",
  no_results: "कोई परिणाम नहीं मिला",
  scan_product: "किसी उत्पाद को स्कैन करें",
  add_custom_product: "कस्टम उत्पाद जोड़ें",
};

export const TRANSLATIONS = {
  en: EN,
  hi: HI,
};

export type Language = keyof typeof TRANSLATIONS;

export function t(key: TranslationKey, lang: Language = "en"): string {
  return TRANSLATIONS[lang][key] || TRANSLATIONS.en[key];
}

export function isValidLanguage(lang: unknown): lang is Language {
  return lang === "en" || lang === "hi";
}
