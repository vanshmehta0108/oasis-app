// English and Hindi translations for Sift app.
//
// Voice rules (keep these in mind when editing strings):
//   • Direct, calm, confident. Never preachy.
//   • Decisions, not descriptions. Use verbs: "Skip", "Pick", "Watch".
//   • Short sentences. One idea per line.
//   • Never use "unhealthy" or "bad". Use "Skip", "worth a closer look", "not great".
//   • Never blame the user. Errors say what *we* couldn't do, not what they did wrong.
//   • Hindi is Hinglish-friendly — conversational, not formal Sanskrit.
type TranslationKey = keyof typeof EN;

export const EN = {
  // Navigation
  home: "Home",
  search: "Search",
  scan: "Scan",
  add: "Add",
  profile: "You",

  // Product Detail
  harmful_substances: "Worth a closer look",
  beneficial_ingredients: "The good stuff",
  ingredient_analysis: "What's inside",
  warnings: "Heads up",
  overall: "Verdict",
  score: "Score",

  // Safety levels
  safe: "Clean",
  caution: "Watch it",
  warning: "Concerning",
  danger: "Skip it",

  // Grade levels
  grade_a: "Clean",
  grade_b: "Mostly fine",
  grade_c: "Eat occasionally",
  grade_d: "Skip if you can",
  grade_e: "Avoid",

  // Categories
  food: "Food",
  beverages: "Beverages",
  snacks: "Snacks",
  baby: "Baby",
  skincare: "Skincare",
  household: "Household",

  // Buttons
  share: "Share",
  bookmark: "Save",
  compare: "Compare",
  back: "Back",
  add_to_compare: "Add to compare",

  // Language
  english: "English",
  hindi: "Hindi",

  // Messages
  loading: "One moment…",
  no_results: "Nothing here yet",
  scan_product: "Scan a product",
  add_custom_product: "Add it yourself",

  // Home page
  hero_title: "Know what's really in your food",
  hero_subtitle: "Scan any Indian packet. Get an honest verdict in seconds.",
  scan_a_product: "Scan a product",
  products_analyzed: "Products checked",
  flagged_unsafe: "Flagged",
  total_scans: "Total scans",
  trending_scans: "Scanning today",
  see_all: "See all",
  worst_rated: "We'd skip these",
  browse_by_category: "Browse",
  recently_added: "Just added",
  start_scanning: "Start with one scan",
  start_scanning_desc: "Point your camera at any packet. We'll do the rest.",
  sign_in: "Sign in",
  items: "items",

  // Greetings — used on home hero
  greeting_morning: "Good morning",
  greeting_afternoon: "Good afternoon",
  greeting_evening: "Good evening",
  greeting_night: "Up late?",
  hero_prompt: "What's in your kitchen today?",

  // Editorial — home
  this_week_on_sift: "This week on Sift",

  // Product page
  not_in_db: "We haven't seen this one yet",
  scan_label_prompt: "Snap the ingredient list on the back. We'll score it in seconds.",
  analysing_label: "Reading the label…",
  scan_ingredient_label: "Scan the label",
  scan_different: "Try a different product",
  not_scored: "Score this one",
  tap_to_analyze: "Tap to\nscore",
  healthier_alt: "A better pick",
  shop_now: "Shop now",
  nutrition_facts: "Nutrition",
  more_details: "More details",
  barcode: "Barcode",
  category: "Category",
  top_rated: "Cleaner picks",
  how_scoring_works: "How we score",
  report_issue: "Something wrong?",
  personalise_warnings: "Make this yours",
  retry_analysis: "Try again",
  analyse_ingredients: "Score the ingredients",
  scoring_ingredients: "Scoring each ingredient…",
  ingredient_data_unavailable: "We need a clearer label",
  point_camera: "Point your camera at the ingredient list on the back of the pack.",
  warnings_for_you: "For you, specifically",
  checking_profile: "Checking against your profile…",
  personalize_failed: "Personalized check unavailable",
  personalize_rate_limit: "Personalization is busy — try again in a moment",
  personalize_fallback_note: "Showing the general verdict for now.",

  // Add product (community submission)
  add_product_back: "Back",
  add_product_title: "Add Product",
  add_product_extracting: "Extracting from photo…",
  add_product_autofill: "Auto-fill from Label Photo",
  add_product_extract_failed: "Couldn't read that photo. Add ingredients manually.",
  add_product_extract_image_failed: "Image extraction failed. Try again or add manually.",
  add_product_name_required: "Product name is required",
  add_product_ingredients_required: "Add at least one ingredient",
  add_product_network_error: "Network error. Check your connection.",
  add_product_submitted_title: "Submitted for review",
  add_product_submitted_body: "Thanks for contributing. A moderator will check the ingredients and add it to the public catalog shortly.",

  // Categories (used in /add picker)
  category_food: "Food",
  category_beverage: "Beverage",
  category_snack: "Snack",
  category_dairy: "Dairy",
  category_skincare: "Skincare",
  category_baby_food: "Baby food",
  category_household: "Household",

  // Sign out + cloud sync
  signout_confirm: "Sign out? You'll lose access to your synced history on this device until you sign back in.",
  cloud_sync_disabled: "Cloud sync isn't set up — your data stays on this device.",

  // Search errors
  search_timed_out: "Search timed out — try a shorter or more specific term",
  search_off_unavailable: "Couldn't reach the open product database — showing local results only",

  // Generic error
  error_something_wrong: "Something went wrong",
  error_try_again: "Try again",
  error_generic_body: "We hit an unexpected snag. The Sift team has been notified.",

  // Privacy + delete data
  privacy_link: "Privacy",
  delete_my_data: "Delete my data",
  delete_my_data_confirm: "This will permanently delete your account, your health profile, scan history, bookmarks, and compare list. This cannot be undone. Type DELETE to confirm.",
  delete_my_data_typed_wrong: "Please type DELETE exactly to confirm.",
  delete_my_data_success: "Account deleted. We're sorry to see you go.",
  delete_my_data_failed: "Couldn't delete your account — please email privacy@sift-india.app.",
  view_comparison: "See comparison",
  remove_from_compare: "In compare — tap to remove",
  removed_from_compare: "Removed from compare",
  added_to_compare: "Added to compare",
  compare_full: "Compare is full — remove one first",
  saved: "Saved",
  removed_from_saved: "Removed",

  // Verdict copy — replaces the bland "Overall: Safe" line
  verdict_clean: "We'd buy it",
  verdict_clean_sub: "Clean ingredients. No real concerns.",
  verdict_mostly: "Mostly fine",
  verdict_mostly_sub: "A couple of ingredients are worth a closer look.",
  verdict_occasional: "Eat occasionally",
  verdict_occasional_sub: "Not your daily — fine for a treat.",
  verdict_skip: "We'd skip it",
  verdict_skip_sub: "Several ingredients we'd rather not eat.",
  verdict_avoid: "Put it back",
  verdict_avoid_sub: "Loaded with stuff we don't recommend.",

  // Search page
  search_empty_state: "Search any product or brand. We'll show you what's inside.",
  try_searching: "Try searching",
  no_products_in_category: "Nothing in this aisle yet",
  scan_to_add: "Scan one to start the list.",
  try_different: "Try another spelling, or scan the barcode.",
  result: "result",
  results: "results",
  product: "product",
  products: "products",
  scan_instead: "Scan instead",

  // Profile page
  sign_in_to_sift: "Sign in to Sift",
  sign_in_desc: "Keep your scans, saves, and profile across devices.",
  create_account: "Create account",
  already_account: "Already have one? Sign in",
  no_account: "New here? Create an account",
  reset_password: "Reset password",
  send_reset: "Send reset link",
  password_reset_sent: "Reset link sent — check your email.",
  password_placeholder: "Password (min. 6 characters)",
  check_email_confirm: "Check your email to confirm, then sign in.",
  sign_in_google: "Continue with Google",
  opening_google: "Opening Google…",
  health_conditions: "Health conditions",
  allergies: "Allergies",
  language_setting: "Language",
  saved_products: "Saved",
  scan_history: "History",
  sign_out: "Sign out",
  signed_out: "Signed out",
  upgrade_pro: "Try Sift Pro",
  upgrade_desc: "Unlimited scans, photo analysis, family sharing.",
  checked: "Checked",
  safe_picks: "Clean picks",
  personalise_alerts: "Make alerts personal",
  migration_required: "Database migration required",
  migration_desc: "Run docs/cloud-migration.sql in your Supabase dashboard to enable cloud sync.",
  no_saved: "Nothing saved yet",
  no_history: "No scans yet",

  // Compare page
  compare_title: "Compare",
  clear_all: "Clear",
  compare_subtitle: "Side by side. Honest call.",
  nothing_to_compare: "Nothing to compare yet",
  nothing_to_compare_desc: "Open any product and tap \"Add to compare\" to stack it up.",
  browse_products: "Browse products",
  best_pick: "Our pick",
  add_another_product: "Add another",
  compare_section_score: "Score",
  compare_section_ingredient_safety: "Ingredient breakdown",
  compare_section_warnings: "Heads up",
  compare_section_nutrition: "Nutrition (per 100g)",
  compare_section_summary: "What we think",
  compare_winner_default: "Cleanest pick of the lot.",
  compare_winner_lead: "Cleanest pick — ",
  compare_reason_safer: "{n} points cleaner than the next",
  compare_reason_no_danger: "no flagged ingredients",
  compare_reason_fewest: "fewest risky ingredients",
  compare_reason_fewer_warnings: "fewer heads-up notes",
  compare_no_warnings: "All clear",
  compare_no_personal: "Nothing for you",
  compare_no_data: "No data yet",
  compare_not_analyzed: "Not scored yet — open it to score.",
  compare_view_full: "Open product",
  compare_best_label: "Best",
  compare_best_nutrient: "best",
  compare_more_warnings: "+{n} more",
  compare_personalise_hint: "Add your conditions and allergies in {profile} to see warnings tailored to you.",
  // Nutrition labels
  nutrition_calories: "Calories",
  nutrition_sugar: "Sugar",
  nutrition_sodium: "Sodium",
  nutrition_fat: "Fat",
  nutrition_protein: "Protein",

  // Scan page
  product_not_found: "We don't have this one yet",
  looking_up: "Looking it up…",
  analysing: "Reading the ingredients…",
  photo_prompt: "Snap the ingredient label and we'll score it in seconds.",
  scan_again: "Scan again",
  photograph_label: "Snap the label",

  // Add product page (legacy keys — kept for unrelated callers)
  auto_fill: "Fill from a label photo",
  product_name: "Product name",
  brand: "Brand",
  barcode_label: "Barcode",
  category_label: "Category",
  ingredients_label: "Ingredients",
  ingredients_placeholder: "Type ingredients, comma-separated",
  add_submit: "Add and score",
  submitted_review: "Sent for review",
  submitted_desc: "Thanks — we'll take a look and publish if it checks out.",
  scan_another: "Scan another",

  // Scoring page
  scoring_title: "How we score",
  scoring_in_paragraph: "The one-minute version",
  scoring_score_bands: "Score bands",
  scoring_inputs: "What goes in",
  scoring_penalties: "What pulls the score down",
  scoring_bonuses: "What pushes it up",
  scoring_personalization: "Made for you",
  scoring_limitations: "What the score doesn't include",
  scoring_sources: "Sources",
  scoring_disagree: "Think we got it wrong?",
  scoring_contact: "Tell us",

  // Onboarding
  next: "Next",
  welcome_to_sift: "Welcome to Sift",
  onboarding_subtitle: "An honest second opinion on every Indian packet.",
  get_started: "Let's go",
  health_question: "Anything we should know?",
  health_question_desc: "Pick what applies. We'll tailor your warnings.",
  allergies_question: "Any allergies?",
  allergies_question_desc: "We'll flag products that contain these.",
  all_set: "You're all set",
  all_set_desc: "Sift will warn you about ingredients that affect you specifically.",
  start_scanning_btn: "Start scanning",
  skip: "Skip",

  // Health conditions
  condition_diabetic: "Diabetic",
  condition_pregnant: "Pregnant",
  condition_lactose: "Lactose intolerant",
  condition_gluten: "Gluten sensitive",
  condition_heart: "Heart condition",
  condition_bp: "High BP",
  condition_thyroid: "Thyroid",
  condition_pcod: "PCOD / PCOS",
  condition_kidney: "Kidney disease",

  // Allergens
  allergen_nuts: "Nuts",
  allergen_dairy: "Dairy",
  allergen_soy: "Soy",
  allergen_gluten: "Gluten",
  allergen_shellfish: "Shellfish",
  allergen_eggs: "Eggs",

  // Scoring page content
  scoring_para: "Every product gets a 0–100 score based on its ingredients. Harmful additives, excess sugar, and questionable fats pull it down. Whole foods and beneficial compounds push it up. If you've set health conditions or allergies, the score adjusts for you specifically.",
  score_band_safe: "Clean — no real concerns",
  score_band_mostly_safe: "Mostly clean — minor flags",
  score_band_concerning: "Eat occasionally — a few concerns",
  score_band_unsafe: "Skip if you can — multiple flags",
  score_band_dangerous: "Avoid — we'd put it back",
  scoring_inputs_desc: "Ingredients are matched against our database of ~3,000 additives, preservatives, and compounds. Each gets a risk level (clean / watch / concerning / skip) based on published food safety research.",
  scoring_penalties_desc: "High sugar, trans fats, excess sodium, known carcinogens (like certain artificial dyes), and additives banned in India all subtract points.",
  scoring_bonuses_desc: "Whole foods, natural preservatives, fibre, and functional compounds (turmeric, probiotics) add points.",
  scoring_personalization_desc: "Set your conditions or allergies in Profile and ingredients that affect you are weighted more heavily in your score.",
  scoring_limitations_desc: "The score reflects ingredient safety — not portion size or how much you eat. Always read the label.",
  scoring_disagree_desc: "Tap 'Something wrong?' on any product page. We review every report within 48 hours.",
};

export const HI = {
  // Navigation
  home: "होम",
  search: "खोज",
  scan: "स्कैन",
  add: "जोड़ें",
  profile: "आप",

  // Product Detail
  harmful_substances: "ध्यान देने वाली बातें",
  beneficial_ingredients: "अच्छी चीज़ें",
  ingredient_analysis: "इसमें क्या है",
  warnings: "ज़रूरी बात",
  overall: "हमारी राय",
  score: "स्कोर",

  // Safety levels
  safe: "साफ़",
  caution: "ध्यान दें",
  warning: "चिंताजनक",
  danger: "छोड़ दें",

  // Grade levels
  grade_a: "साफ़",
  grade_b: "ज़्यादातर ठीक",
  grade_c: "कभी-कभी ठीक",
  grade_d: "हो सके तो छोड़ें",
  grade_e: "बचें",

  // Categories
  food: "खाद्य",
  beverages: "पेय",
  snacks: "स्नैक्स",
  baby: "बेबी",
  skincare: "स्किनकेयर",
  household: "घरेलू",

  // Buttons
  share: "शेयर",
  bookmark: "सेव",
  compare: "तुलना",
  back: "वापस",
  add_to_compare: "तुलना में जोड़ें",

  // Language
  english: "English",
  hindi: "हिंदी",

  // Messages
  loading: "एक पल…",
  no_results: "अभी यहाँ कुछ नहीं",
  scan_product: "उत्पाद स्कैन करें",
  add_custom_product: "खुद जोड़ें",

  // Home page
  hero_title: "जानें आपके खाने में क्या है",
  hero_subtitle: "किसी भी भारतीय पैकेट को स्कैन करें। सेकंडों में ईमानदार राय।",
  scan_a_product: "स्कैन करें",
  products_analyzed: "जाँचे गए उत्पाद",
  flagged_unsafe: "फ़्लैग्ड",
  total_scans: "कुल स्कैन",
  trending_scans: "आज स्कैन हो रहा है",
  see_all: "सब देखें",
  worst_rated: "ये हम छोड़ देंगे",
  browse_by_category: "ब्राउज़ करें",
  recently_added: "अभी जोड़े गए",
  start_scanning: "एक स्कैन से शुरू करें",
  start_scanning_desc: "कैमरा किसी भी पैकेट पर लगाएं। बाक़ी हम संभालेंगे।",
  sign_in: "साइन इन",
  items: "आइटम",

  // Greetings
  greeting_morning: "सुप्रभात",
  greeting_afternoon: "नमस्ते",
  greeting_evening: "शुभ संध्या",
  greeting_night: "अभी तक जागे हैं?",
  hero_prompt: "आज किचन में क्या है?",

  // Editorial
  this_week_on_sift: "इस हफ़्ते Sift पर",

  // Product page
  not_in_db: "ये अभी हमारे पास नहीं है",
  scan_label_prompt: "पीछे की सामग्री लिस्ट की फ़ोटो लें। हम सेकंडों में स्कोर करेंगे।",
  analysing_label: "लेबल पढ़ रहे हैं…",
  scan_ingredient_label: "लेबल स्कैन करें",
  scan_different: "कोई और उत्पाद",
  not_scored: "अभी स्कोर नहीं",
  tap_to_analyze: "स्कोर के\nलिए टैप करें",
  healthier_alt: "बेहतर विकल्प",
  shop_now: "अभी खरीदें",
  nutrition_facts: "पोषण",
  more_details: "और जानकारी",
  barcode: "बारकोड",
  category: "श्रेणी",
  top_rated: "बेहतर विकल्प",
  how_scoring_works: "हम कैसे स्कोर करते हैं",
  report_issue: "कुछ ग़लत है?",
  personalise_warnings: "अपने हिसाब से",
  retry_analysis: "फिर से करें",
  analyse_ingredients: "सामग्री स्कोर करें",
  scoring_ingredients: "हर सामग्री स्कोर हो रही है…",
  ingredient_data_unavailable: "साफ़ लेबल चाहिए",
  point_camera: "कैमरा पैकेट के पीछे की सामग्री लिस्ट पर लगाएं।",
  warnings_for_you: "आपके लिए ख़ास",
  checking_profile: "आपकी प्रोफ़ाइल से जाँच रहे हैं…",
  personalize_failed: "व्यक्तिगत जाँच उपलब्ध नहीं है",
  personalize_rate_limit: "व्यक्तिगतकरण व्यस्त है — थोड़ी देर बाद देखें",
  personalize_fallback_note: "अभी सामान्य निर्णय दिखा रहे हैं।",

  // Add product
  add_product_back: "वापस",
  add_product_title: "प्रोडक्ट जोड़ें",
  add_product_extracting: "फ़ोटो से निकाला जा रहा है…",
  add_product_autofill: "लेबल फ़ोटो से ऑटो-भरें",
  add_product_extract_failed: "फ़ोटो पढ़ नहीं पाए। सामग्री खुद जोड़ें।",
  add_product_extract_image_failed: "फ़ोटो से निकालने में नाकाम। फिर कोशिश करें या खुद जोड़ें।",
  add_product_name_required: "प्रोडक्ट नाम ज़रूरी है",
  add_product_ingredients_required: "कम से कम एक सामग्री जोड़ें",
  add_product_network_error: "नेटवर्क समस्या। कनेक्शन जांचें।",
  add_product_submitted_title: "समीक्षा के लिए भेजा गया",
  add_product_submitted_body: "योगदान के लिए धन्यवाद। एक मॉडरेटर सामग्री जांचकर इसे जल्द ही पब्लिक कैटलॉग में जोड़ देगा।",

  // Categories
  category_food: "भोजन",
  category_beverage: "पेय",
  category_snack: "स्नैक",
  category_dairy: "डेयरी",
  category_skincare: "स्किनकेयर",
  category_baby_food: "बेबी फ़ूड",
  category_household: "घरेलू",

  // Sign out + cloud sync
  signout_confirm: "साइन आउट करें? जब तक वापस साइन इन नहीं करेंगे, इस डिवाइस पर सिंक की हुई हिस्ट्री नहीं दिखेगी।",
  cloud_sync_disabled: "क्लाउड सिंक सेटअप नहीं है — आपका डेटा इसी डिवाइस पर रहेगा।",

  // Search errors
  search_timed_out: "खोज में समय लग गया — छोटा या ज़्यादा सटीक शब्द आज़माएं",
  search_off_unavailable: "ओपन डेटाबेस तक नहीं पहुँच पाए — सिर्फ़ लोकल रिज़ल्ट दिखा रहे हैं",

  // Generic error
  error_something_wrong: "कुछ गड़बड़ हुई",
  error_try_again: "फिर से कोशिश करें",
  error_generic_body: "अनपेक्षित समस्या हुई। Sift टीम को सूचित कर दिया गया है।",

  // Privacy + delete data
  privacy_link: "गोपनीयता",
  delete_my_data: "मेरा डेटा हटाएं",
  delete_my_data_confirm: "इससे आपका अकाउंट, हेल्थ प्रोफ़ाइल, स्कैन हिस्ट्री, बुकमार्क और तुलना लिस्ट हमेशा के लिए हट जाएगी। इसे वापस नहीं लाया जा सकता। पुष्टि के लिए DELETE लिखें।",
  delete_my_data_typed_wrong: "पुष्टि के लिए DELETE सही-सही लिखें।",
  delete_my_data_success: "अकाउंट हटा दिया गया। आपको खोने का दुख है।",
  delete_my_data_failed: "अकाउंट नहीं हट पाया — privacy@sift-india.app पर ईमेल करें।",
  view_comparison: "तुलना देखें",
  remove_from_compare: "तुलना में है — हटाएं",
  removed_from_compare: "तुलना से हटाया",
  added_to_compare: "तुलना में जोड़ा",
  compare_full: "तुलना भरी है — पहले एक हटाएं",
  saved: "सेव हुआ",
  removed_from_saved: "हटाया",

  // Verdict copy
  verdict_clean: "हम ख़रीदेंगे",
  verdict_clean_sub: "साफ़ सामग्री। कोई बड़ी चिंता नहीं।",
  verdict_mostly: "ज़्यादातर ठीक",
  verdict_mostly_sub: "एक-दो सामग्री पर ध्यान देना चाहिए।",
  verdict_occasional: "कभी-कभी ठीक",
  verdict_occasional_sub: "रोज़ाना नहीं — कभी-कभार ठीक है।",
  verdict_skip: "हम छोड़ देंगे",
  verdict_skip_sub: "कई सामग्री हम नहीं खाना चाहेंगे।",
  verdict_avoid: "इसे रहने दें",
  verdict_avoid_sub: "कई ऐसी चीज़ें जो हम सलाह नहीं देते।",

  // Search page
  search_empty_state: "किसी भी उत्पाद या ब्रांड को खोजें। अंदर क्या है, हम बताएंगे।",
  try_searching: "खोज कर देखें",
  no_products_in_category: "इस श्रेणी में अभी कुछ नहीं",
  scan_to_add: "एक स्कैन से शुरू करें।",
  try_different: "कोई और शब्द आज़माएं, या बारकोड स्कैन करें।",
  result: "परिणाम",
  results: "परिणाम",
  product: "उत्पाद",
  products: "उत्पाद",
  scan_instead: "स्कैन करें",

  // Profile page
  sign_in_to_sift: "Sift में साइन इन",
  sign_in_desc: "अपने स्कैन, सेव और प्रोफ़ाइल हर डिवाइस पर रखें।",
  create_account: "खाता बनाएं",
  already_account: "पहले से है? साइन इन करें",
  no_account: "नए हैं? खाता बनाएं",
  reset_password: "पासवर्ड रीसेट",
  send_reset: "रीसेट लिंक भेजें",
  password_reset_sent: "रीसेट लिंक भेजा — ईमेल देखें।",
  password_placeholder: "पासवर्ड (कम से कम 6 अक्षर)",
  check_email_confirm: "ईमेल देखकर पुष्टि करें, फिर साइन इन करें।",
  sign_in_google: "Google से जारी रखें",
  opening_google: "Google खुल रहा है…",
  health_conditions: "स्वास्थ्य स्थितियाँ",
  allergies: "एलर्जी",
  language_setting: "भाषा",
  saved_products: "सेव किए गए",
  scan_history: "इतिहास",
  sign_out: "साइन आउट",
  signed_out: "साइन आउट हो गए",
  upgrade_pro: "Sift Pro आज़माएं",
  upgrade_desc: "असीमित स्कैन, फ़ोटो विश्लेषण, परिवार शेयरिंग।",
  checked: "जाँचे गए",
  safe_picks: "साफ़ चुनाव",
  personalise_alerts: "अपने हिसाब से अलर्ट",
  migration_required: "डेटाबेस माइग्रेशन ज़रूरी",
  migration_desc: "क्लाउड सिंक के लिए Supabase डैशबोर्ड में docs/cloud-migration.sql चलाएं।",
  no_saved: "अभी कुछ सेव नहीं",
  no_history: "अभी कोई स्कैन नहीं",

  // Compare page
  compare_title: "तुलना",
  clear_all: "साफ़ करें",
  compare_subtitle: "आमने-सामने। ईमानदार राय।",
  nothing_to_compare: "तुलना के लिए कुछ नहीं",
  nothing_to_compare_desc: "किसी भी उत्पाद को खोलें और \"तुलना में जोड़ें\" टैप करें।",
  browse_products: "उत्पाद देखें",
  best_pick: "हमारी पसंद",
  add_another_product: "और जोड़ें",
  compare_section_score: "स्कोर",
  compare_section_ingredient_safety: "सामग्री विवरण",
  compare_section_warnings: "ज़रूरी बात",
  compare_section_nutrition: "पोषण (प्रति 100g)",
  compare_section_summary: "हमारी राय",
  compare_winner_default: "सबसे साफ़ चुनाव।",
  compare_winner_lead: "सबसे साफ़ — ",
  compare_reason_safer: "अगले से {n} अंक बेहतर",
  compare_reason_no_danger: "कोई फ़्लैग सामग्री नहीं",
  compare_reason_fewest: "कम ख़राब सामग्री",
  compare_reason_fewer_warnings: "कम चेतावनियाँ",
  compare_no_warnings: "सब ठीक",
  compare_no_personal: "आपके लिए कुछ नहीं",
  compare_no_data: "अभी डेटा नहीं",
  compare_not_analyzed: "अभी स्कोर नहीं — खोलकर स्कोर करें।",
  compare_view_full: "उत्पाद खोलें",
  compare_best_label: "बेहतर",
  compare_best_nutrient: "बेहतर",
  compare_more_warnings: "+{n} और",
  compare_personalise_hint: "{profile} में अपनी स्थितियाँ और एलर्जी जोड़ें — चेतावनियाँ आपके हिसाब से होंगी।",
  nutrition_calories: "कैलोरी",
  nutrition_sugar: "चीनी",
  nutrition_sodium: "नमक",
  nutrition_fat: "वसा",
  nutrition_protein: "प्रोटीन",

  // Scan page
  product_not_found: "ये हमारे पास नहीं है",
  looking_up: "खोज रहे हैं…",
  analysing: "सामग्री पढ़ रहे हैं…",
  photo_prompt: "लेबल की फ़ोटो लें — हम सेकंडों में स्कोर करेंगे।",
  scan_again: "फिर से स्कैन करें",
  photograph_label: "लेबल की फ़ोटो लें",

  // Add product page (legacy keys — kept for unrelated callers)
  auto_fill: "लेबल फ़ोटो से भरें",
  product_name: "उत्पाद का नाम",
  brand: "ब्रांड",
  barcode_label: "बारकोड",
  category_label: "श्रेणी",
  ingredients_label: "सामग्री",
  ingredients_placeholder: "सामग्री लिखें, अल्पविराम से अलग",
  add_submit: "जोड़ें और स्कोर करें",
  submitted_review: "समीक्षा के लिए भेजा",
  submitted_desc: "धन्यवाद — हम जाँच के बाद प्रकाशित करेंगे।",
  scan_another: "और स्कैन करें",

  // Scoring page
  scoring_title: "हम कैसे स्कोर करते हैं",
  scoring_in_paragraph: "एक पैराग्राफ़ में",
  scoring_score_bands: "स्कोर बैंड",
  scoring_inputs: "क्या शामिल है",
  scoring_penalties: "क्या स्कोर घटाता है",
  scoring_bonuses: "क्या स्कोर बढ़ाता है",
  scoring_personalization: "आपके लिए",
  scoring_limitations: "क्या शामिल नहीं",
  scoring_sources: "स्रोत",
  scoring_disagree: "हम ग़लत हैं?",
  scoring_contact: "बताएं",

  // Onboarding
  next: "अगला",
  welcome_to_sift: "Sift में स्वागत है",
  onboarding_subtitle: "हर भारतीय पैकेट पर एक ईमानदार दूसरी राय।",
  get_started: "चलिए",
  health_question: "हमें कुछ बताना चाहेंगे?",
  health_question_desc: "जो लागू हो चुनें। चेतावनियाँ आपके हिसाब से होंगी।",
  allergies_question: "कोई एलर्जी?",
  allergies_question_desc: "ये सामग्री वाले उत्पाद हम फ़्लैग करेंगे।",
  all_set: "तैयार हैं",
  all_set_desc: "Sift उन सामग्रियों के बारे में चेताएगा जो आपको प्रभावित करती हैं।",
  start_scanning_btn: "स्कैन शुरू करें",
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
  condition_kidney: "किडनी रोग",

  // Allergens
  allergen_nuts: "नट्स",
  allergen_dairy: "डेयरी",
  allergen_soy: "सोया",
  allergen_gluten: "ग्लूटेन",
  allergen_shellfish: "शेलफिश",
  allergen_eggs: "अंडे",

  // Scoring page content
  scoring_para: "हर उत्पाद को उसकी सामग्री के आधार पर 0-100 स्कोर मिलता है। हानिकारक एडिटिव्स, ज़्यादा चीनी और ख़राब वसा स्कोर घटाते हैं। साबुत अनाज और लाभकारी यौगिक बढ़ाते हैं। आपकी प्रोफ़ाइल स्कोर को आपके हिसाब से ढालती है।",
  score_band_safe: "साफ़ — कोई बड़ी चिंता नहीं",
  score_band_mostly_safe: "ज़्यादातर साफ़ — छोटे फ़्लैग",
  score_band_concerning: "कभी-कभी ठीक — कुछ चिंताएं",
  score_band_unsafe: "हो सके तो छोड़ें — कई फ़्लैग",
  score_band_dangerous: "बचें — हम भी छोड़ देंगे",
  scoring_inputs_desc: "सामग्रियों का मिलान ~3,000 एडिटिव्स के डेटाबेस से होता है। हर एक को रिस्क लेवल मिलता है।",
  scoring_penalties_desc: "ज़्यादा चीनी, ट्रांस वसा, अधिक नमक, ज्ञात कार्सिनोजेन और भारत में प्रतिबंधित एडिटिव्स अंक घटाते हैं।",
  scoring_bonuses_desc: "साबुत अनाज, प्राकृतिक परिरक्षक, फ़ाइबर और कार्यात्मक यौगिक (हल्दी, प्रोबायोटिक्स) अंक बढ़ाते हैं।",
  scoring_personalization_desc: "प्रोफ़ाइल में स्थितियाँ या एलर्जी सेट करें — स्कोर आपके हिसाब से ढलेगा।",
  scoring_limitations_desc: "स्कोर सामग्री सुरक्षा को दर्शाता है — मात्रा को नहीं। हमेशा लेबल पढ़ें।",
  scoring_disagree_desc: "किसी भी उत्पाद पर 'कुछ ग़लत है?' टैप करें। 48 घंटों में जवाब।",
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
