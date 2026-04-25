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

  // Home page
  hero_title: "Know what's really in your food",
  hero_subtitle: "Scan any Indian product barcode for instant AI safety analysis and ingredient breakdown",
  scan_a_product: "Scan a Product",
  products_analyzed: "Products Analyzed",
  flagged_unsafe: "Flagged Unsafe",
  total_scans: "Total Scans",
  trending_scans: "Trending Scans",
  see_all: "See all",
  worst_rated: "Worst Rated This Week",
  browse_by_category: "Browse by Category",
  recently_added: "Recently Added",
  start_scanning: "Start Scanning",
  start_scanning_desc: "Scan your first product barcode to build your safety database",
  sign_in: "Sign In",
  items: "items",

  // Product page
  not_in_db: "Not in our database",
  scan_label_prompt: "Photograph the ingredient label and our AI will score it instantly",
  analysing_label: "Analysing label…",
  scan_ingredient_label: "Scan Ingredient Label",
  scan_different: "Scan a different product",
  not_scored: "Not scored",
  tap_to_analyze: "Tap to\nanalyze",
  healthier_alt: "Healthier Alternative",
  shop_now: "Shop Now",
  nutrition_facts: "Nutrition Facts",
  more_details: "More details",
  barcode: "Barcode",
  category: "Category",
  top_rated: "Top-rated",
  how_scoring_works: "How scoring works",
  report_issue: "Report an issue",
  personalise_warnings: "Personalise your warnings",
  retry_analysis: "Retry Analysis",
  analyse_ingredients: "Analyse Ingredients",
  scoring_ingredients: "Scoring each ingredient…",
  ingredient_data_unavailable: "Ingredient data unavailable",
  point_camera: "Point your camera at the ingredient list",
  warnings_for_you: "Warnings for You",
  checking_profile: "Checking against your health profile…",
  view_comparison: "View comparison",
  remove_from_compare: "In compare — tap to remove",
  removed_from_compare: "Removed from compare",
  added_to_compare: "Added to compare",
  compare_full: "Compare is full — remove one first",
  saved: "Saved",
  removed_from_saved: "Removed from saved",

  // Search page
  search_empty_state: "Search for any product or brand to see its safety analysis",
  try_searching: "Try Searching",
  no_products_in_category: "No products in this category yet",
  scan_to_add: "Scan a product to add the first one to this category",
  try_different: "Try a different search term, or scan the product barcode",
  result: "result",
  results: "results",
  product: "product",
  products: "products",
  scan_instead: "Scan Instead",

  // Profile page
  sign_in_to_sift: "Sign in to Sift",
  sign_in_desc: "Save your scan history and health profile across devices",
  create_account: "Create Account",
  already_account: "Already have an account? Sign in",
  no_account: "No account? Create one",
  reset_password: "Reset Password",
  send_reset: "Send Reset Link",
  password_reset_sent: "Password reset link sent — check your email",
  password_placeholder: "Password (min. 6 characters)",
  check_email_confirm: "Check your email to confirm your account, then sign in",
  sign_in_google: "Sign in with Google",
  opening_google: "Opening Google…",
  health_conditions: "Health Conditions",
  allergies: "Allergies",
  language_setting: "Language",
  saved_products: "Saved Products",
  scan_history: "Scan History",
  sign_out: "Sign out",
  signed_out: "Signed out",
  upgrade_pro: "Upgrade to Sift Pro",
  upgrade_desc: "Unlimited scans, photo analysis, personalized alerts, and family sharing",
  checked: "Checked",
  safe_picks: "Safe Picks",
  personalise_alerts: "Personalise your safety alerts",
  migration_required: "Database migration required",
  migration_desc: "Run docs/cloud-migration.sql in your Supabase dashboard to enable cloud sync.",
  no_saved: "No saved products yet",
  no_history: "No scan history yet",

  // Compare page
  compare_title: "Compare",
  clear_all: "Clear all",
  compare_subtitle: "Side-by-side safety comparison",
  nothing_to_compare: "Nothing to compare yet",
  nothing_to_compare_desc: "Open any product and tap \"Add to compare\" to stack it against others",
  browse_products: "Browse products",
  best_pick: "Best pick",
  add_another_product: "Add another product",

  // Scan page
  product_not_found: "Product Not Found",
  looking_up: "Looking Up Product...",
  analysing: "Analysing Ingredients...",
  photo_prompt: "Photograph the ingredient label and our AI will score it instantly",
  scan_again: "Scan Again",
  photograph_label: "Photograph Label",

  // Add product page
  add_product_title: "Add Product",
  auto_fill: "Auto-fill from Label Photo",
  product_name: "Product Name",
  brand: "Brand",
  barcode_label: "Barcode",
  category_label: "Category",
  ingredients_label: "Ingredients",
  ingredients_placeholder: "Type ingredient(s), comma-separated",
  add_submit: "Add Product & Analyze",
  submitted_review: "Submitted for review",
  submitted_desc: "Thanks for contributing! Our team will review and publish your submission.",
  scan_another: "Scan another",

  // Scoring page
  scoring_title: "How we score",
  scoring_in_paragraph: "In one paragraph",
  scoring_score_bands: "Score bands",
  scoring_inputs: "What goes in",
  scoring_penalties: "Penalties",
  scoring_bonuses: "Bonuses",
  scoring_personalization: "Personalization",
  scoring_limitations: "What the score doesn't include",
  scoring_sources: "Sources",
  scoring_disagree: "Disagree with a score?",
  scoring_contact: "Contact us",

  // Onboarding
  next: "Next",
  welcome_to_sift: "Welcome to Sift",
  onboarding_subtitle: "India's AI-powered ingredient scanner",
  get_started: "Get Started",
  health_question: "What matters to you?",
  health_question_desc: "Select any health conditions for personalised warnings",
  allergies_question: "Any allergies?",
  allergies_question_desc: "We'll flag products containing these ingredients",
  all_set: "You're all set!",
  all_set_desc: "Sift will warn you about ingredients that affect your health",
  start_scanning_btn: "Start Scanning",
  skip: "Skip",

  // Health conditions
  condition_diabetic: "Diabetic",
  condition_pregnant: "Pregnant",
  condition_lactose: "Lactose Intolerant",
  condition_gluten: "Gluten Sensitive",
  condition_heart: "Heart Condition",
  condition_bp: "High BP",
  condition_thyroid: "Thyroid",
  condition_pcod: "PCOD / PCOS",

  // Allergens
  allergen_nuts: "Nuts",
  allergen_dairy: "Dairy",
  allergen_soy: "Soy",
  allergen_gluten: "Gluten",
  allergen_shellfish: "Shellfish",
  allergen_eggs: "Eggs",

  // Scoring page content
  scoring_para: "Each product gets a 0–100 safety score based on its ingredient list. Harmful additives, excessive sugar, and unhealthy fats pull the score down; whole-food ingredients and beneficial compounds push it up. Your personal health profile (diabetes, allergies, etc.) adjusts the score for you specifically.",
  score_band_safe: "Safe — minimal concerns",
  score_band_mostly_safe: "Mostly safe — minor concerns",
  score_band_concerning: "Concerning — some harmful ingredients",
  score_band_unsafe: "Unsafe — multiple harmful ingredients",
  score_band_dangerous: "Dangerous — avoid",
  scoring_inputs_desc: "Ingredients are matched against our database of ~3,000 additives, preservatives, and compounds. Each gets a risk level (safe / caution / warning / danger) based on published food safety research.",
  scoring_penalties_desc: "High sugar content, trans fats, excessive sodium, known carcinogens (like certain artificial dyes), and banned-in-India additives all subtract points.",
  scoring_bonuses_desc: "Whole food ingredients, natural preservatives, dietary fibre, and functional compounds (like turmeric, probiotics) add points.",
  scoring_personalization_desc: "If you've set health conditions or allergies, ingredients that specifically affect you are flagged and weighted more heavily in your score.",
  scoring_limitations_desc: "The score reflects ingredient safety, not overall healthiness. Portion size, cooking method, and bioavailability aren't factored in. Always read the label.",
  scoring_disagree_desc: "Tap 'Report an issue' on any product page. Our team reviews all reports within 48 hours.",
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

  // Home page
  hero_title: "जानें आपके खाने में क्या है",
  hero_subtitle: "किसी भी भारतीय उत्पाद का बारकोड स्कैन करें और तुरंत AI सुरक्षा विश्लेषण पाएं",
  scan_a_product: "उत्पाद स्कैन करें",
  products_analyzed: "विश्लेषित उत्पाद",
  flagged_unsafe: "असुरक्षित चिह्नित",
  total_scans: "कुल स्कैन",
  trending_scans: "ट्रेंडिंग स्कैन",
  see_all: "सब देखें",
  worst_rated: "इस हफ्ते सबसे खराब",
  browse_by_category: "श्रेणी के अनुसार देखें",
  recently_added: "हाल में जोड़े गए",
  start_scanning: "स्कैन करना शुरू करें",
  start_scanning_desc: "अपनी सुरक्षा डेटाबेस बनाने के लिए पहले उत्पाद का बारकोड स्कैन करें",
  sign_in: "साइन इन",
  items: "आइटम",

  // Product page
  not_in_db: "हमारे डेटाबेस में नहीं है",
  scan_label_prompt: "सामग्री लेबल की फोटो लें और हमारा AI तुरंत स्कोर करेगा",
  analysing_label: "लेबल का विश्लेषण हो रहा है…",
  scan_ingredient_label: "सामग्री लेबल स्कैन करें",
  scan_different: "कोई अलग उत्पाद स्कैन करें",
  not_scored: "स्कोर नहीं किया",
  tap_to_analyze: "विश्लेषण के\nलिए टैप करें",
  healthier_alt: "स्वस्थ विकल्प",
  shop_now: "अभी खरीदें",
  nutrition_facts: "पोषण तथ्य",
  more_details: "अधिक जानकारी",
  barcode: "बारकोड",
  category: "श्रेणी",
  top_rated: "टॉप रेटेड",
  how_scoring_works: "स्कोरिंग कैसे काम करती है",
  report_issue: "समस्या रिपोर्ट करें",
  personalise_warnings: "चेतावनियाँ व्यक्तिगत करें",
  retry_analysis: "फिर से विश्लेषण करें",
  analyse_ingredients: "सामग्री विश्लेषण करें",
  scoring_ingredients: "प्रत्येक सामग्री का स्कोर हो रहा है…",
  ingredient_data_unavailable: "सामग्री डेटा उपलब्ध नहीं",
  point_camera: "सामग्री सूची पर कैमरा लगाएं",
  warnings_for_you: "आपके लिए चेतावनियाँ",
  checking_profile: "आपकी स्वास्थ्य प्रोफ़ाइल से जाँच हो रही है…",
  view_comparison: "तुलना देखें",
  remove_from_compare: "तुलना में है — हटाने के लिए टैप करें",
  removed_from_compare: "तुलना से हटाया गया",
  added_to_compare: "तुलना में जोड़ा गया",
  compare_full: "तुलना भरी है — पहले एक हटाएं",
  saved: "सहेजा गया",
  removed_from_saved: "सहेजे से हटाया गया",

  // Search page
  search_empty_state: "किसी भी उत्पाद या ब्रांड को खोजें और सुरक्षा विश्लेषण देखें",
  try_searching: "खोजने का प्रयास करें",
  no_products_in_category: "इस श्रेणी में अभी कोई उत्पाद नहीं",
  scan_to_add: "इस श्रेणी में पहला उत्पाद जोड़ने के लिए स्कैन करें",
  try_different: "कोई अलग खोज शब्द आज़माएं, या उत्पाद बारकोड स्कैन करें",
  result: "परिणाम",
  results: "परिणाम",
  product: "उत्पाद",
  products: "उत्पाद",
  scan_instead: "स्कैन करें",

  // Profile page
  sign_in_to_sift: "Sift में साइन इन करें",
  sign_in_desc: "अपने स्कैन इतिहास और स्वास्थ्य प्रोफ़ाइल को सभी डिवाइस पर सहेजें",
  create_account: "खाता बनाएं",
  already_account: "पहले से खाता है? साइन इन करें",
  no_account: "खाता नहीं है? बनाएं",
  reset_password: "पासवर्ड रीसेट करें",
  send_reset: "रीसेट लिंक भेजें",
  password_reset_sent: "पासवर्ड रीसेट लिंक भेजा गया — अपना ईमेल देखें",
  password_placeholder: "पासवर्ड (कम से कम 6 अक्षर)",
  check_email_confirm: "अपना खाता पुष्टि करने के लिए ईमेल देखें, फिर साइन इन करें",
  sign_in_google: "Google से साइन इन करें",
  opening_google: "Google खुल रहा है…",
  health_conditions: "स्वास्थ्य स्थितियाँ",
  allergies: "एलर्जी",
  language_setting: "भाषा",
  saved_products: "सहेजे गए उत्पाद",
  scan_history: "स्कैन इतिहास",
  sign_out: "साइन आउट",
  signed_out: "साइन आउट हो गए",
  upgrade_pro: "Sift Pro में अपग्रेड करें",
  upgrade_desc: "असीमित स्कैन, फोटो विश्लेषण, व्यक्तिगत अलर्ट और परिवार शेयरिंग",
  checked: "जाँचे गए",
  safe_picks: "सुरक्षित चुनाव",
  personalise_alerts: "अपनी सुरक्षा अलर्ट व्यक्तिगत करें",
  migration_required: "डेटाबेस माइग्रेशन आवश्यक है",
  migration_desc: "क्लाउड सिंक सक्षम करने के लिए अपने Supabase डैशबोर्ड में docs/cloud-migration.sql चलाएं।",
  no_saved: "अभी कोई सहेजा उत्पाद नहीं",
  no_history: "अभी कोई स्कैन इतिहास नहीं",

  // Compare page
  compare_title: "तुलना",
  clear_all: "सब साफ करें",
  compare_subtitle: "आमने-सामने सुरक्षा तुलना",
  nothing_to_compare: "तुलना के लिए कुछ नहीं",
  nothing_to_compare_desc: "किसी भी उत्पाद को खोलें और \"तुलना में जोड़ें\" टैप करें",
  browse_products: "उत्पाद देखें",
  best_pick: "सर्वश्रेष्ठ चुनाव",
  add_another_product: "और उत्पाद जोड़ें",

  // Scan page
  product_not_found: "उत्पाद नहीं मिला",
  looking_up: "उत्पाद खोज रहे हैं...",
  analysing: "सामग्री का विश्लेषण हो रहा है...",
  photo_prompt: "सामग्री लेबल की फोटो लें और हमारा AI तुरंत स्कोर करेगा",
  scan_again: "फिर से स्कैन करें",
  photograph_label: "लेबल की फोटो लें",

  // Add product page
  add_product_title: "उत्पाद जोड़ें",
  auto_fill: "लेबल फोटो से स्वतः भरें",
  product_name: "उत्पाद का नाम",
  brand: "ब्रांड",
  barcode_label: "बारकोड",
  category_label: "श्रेणी",
  ingredients_label: "सामग्री",
  ingredients_placeholder: "सामग्री लिखें, अल्पविराम से अलग करें",
  add_submit: "उत्पाद जोड़ें और विश्लेषण करें",
  submitted_review: "समीक्षा के लिए सबमिट किया गया",
  submitted_desc: "योगदान के लिए धन्यवाद! हमारी टीम आपके सबमिशन की समीक्षा करेगी।",
  scan_another: "और स्कैन करें",

  // Scoring page
  scoring_title: "हम कैसे स्कोर करते हैं",
  scoring_in_paragraph: "एक पैराग्राफ में",
  scoring_score_bands: "स्कोर बैंड",
  scoring_inputs: "क्या शामिल होता है",
  scoring_penalties: "दंड",
  scoring_bonuses: "बोनस",
  scoring_personalization: "व्यक्तिगतकरण",
  scoring_limitations: "स्कोर में क्या शामिल नहीं है",
  scoring_sources: "स्रोत",
  scoring_disagree: "स्कोर से असहमत हैं?",
  scoring_contact: "हमसे संपर्क करें",

  // Onboarding
  next: "अगला",
  welcome_to_sift: "Sift में आपका स्वागत है",
  onboarding_subtitle: "भारत का AI-संचालित सामग्री स्कैनर",
  get_started: "शुरू करें",
  health_question: "आपके लिए क्या महत्वपूर्ण है?",
  health_question_desc: "व्यक्तिगत चेतावनियों के लिए अपनी स्वास्थ्य स्थितियाँ चुनें",
  allergies_question: "कोई एलर्जी है?",
  allergies_question_desc: "हम इन सामग्रियों वाले उत्पादों को चिह्नित करेंगे",
  all_set: "आप तैयार हैं!",
  all_set_desc: "Sift आपको उन सामग्रियों के बारे में चेतावनी देगा जो आपके स्वास्थ्य को प्रभावित करती हैं",
  start_scanning_btn: "स्कैन करना शुरू करें",
  skip: "छोड़ें",

  // Health conditions
  condition_diabetic: "मधुमेह",
  condition_pregnant: "गर्भवती",
  condition_lactose: "लैक्टोज असहिष्णु",
  condition_gluten: "ग्लूटेन संवेदनशील",
  condition_heart: "हृदय रोग",
  condition_bp: "उच्च रक्तचाप",
  condition_thyroid: "थायरॉइड",
  condition_pcod: "PCOD / PCOS",

  // Allergens
  allergen_nuts: "नट्स",
  allergen_dairy: "डेयरी",
  allergen_soy: "सोया",
  allergen_gluten: "ग्लूटेन",
  allergen_shellfish: "शेलफिश",
  allergen_eggs: "अंडे",

  // Scoring page content
  scoring_para: "प्रत्येक उत्पाद को उसकी सामग्री सूची के आधार पर 0-100 सुरक्षा स्कोर मिलता है। हानिकारक एडिटिव्स, अत्यधिक चीनी और अस्वस्थ वसा स्कोर घटाते हैं; संपूर्ण खाद्य सामग्री और लाभकारी यौगिक इसे बढ़ाते हैं। आपकी व्यक्तिगत स्वास्थ्य प्रोफ़ाइल स्कोर को आपके लिए समायोजित करती है।",
  score_band_safe: "सुरक्षित — न्यूनतम चिंताएं",
  score_band_mostly_safe: "ज्यादातर सुरक्षित — मामूली चिंताएं",
  score_band_concerning: "चिंताजनक — कुछ हानिकारक सामग्री",
  score_band_unsafe: "असुरक्षित — कई हानिकारक सामग्री",
  score_band_dangerous: "बेहद खतरनाक — बचें",
  scoring_inputs_desc: "सामग्रियों का मिलान ~3,000 एडिटिव्स, परिरक्षकों और यौगिकों के हमारे डेटाबेस से किया जाता है।",
  scoring_penalties_desc: "अधिक चीनी, ट्रांस वसा, अत्यधिक नमक, ज्ञात कार्सिनोजेन और भारत में प्रतिबंधित एडिटिव्स अंक घटाते हैं।",
  scoring_bonuses_desc: "संपूर्ण खाद्य सामग्री, प्राकृतिक परिरक्षक, आहार फाइबर और कार्यात्मक यौगिक (जैसे हल्दी, प्रोबायोटिक्स) अंक जोड़ते हैं।",
  scoring_personalization_desc: "यदि आपने स्वास्थ्य स्थितियाँ या एलर्जी सेट की है, तो आपको विशेष रूप से प्रभावित करने वाली सामग्रियों को आपके स्कोर में अधिक महत्व दिया जाता है।",
  scoring_limitations_desc: "स्कोर सामग्री सुरक्षा को दर्शाता है, समग्र स्वास्थ्यप्रदता को नहीं। हमेशा लेबल पढ़ें।",
  scoring_disagree_desc: "किसी भी उत्पाद पृष्ठ पर 'समस्या रिपोर्ट करें' टैप करें। हमारी टीम 48 घंटों के भीतर सभी रिपोर्टों की समीक्षा करती है।",
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
