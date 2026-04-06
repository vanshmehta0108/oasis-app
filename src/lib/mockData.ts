export interface IngredientAnalysis {
  name: string;
  risk: "safe" | "caution" | "warning" | "danger";
  explanation: string;
}

export interface ProductAnalysis {
  summary: string;
  ingredients: IngredientAnalysis[];
  warnings: string[];
  healthier_alternative: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  safety_score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  image_url: string;
  analysis: ProductAnalysis;
}

export const products: Product[] = [
  {
    id: "maggi-noodles",
    barcode: "8901058811704",
    name: "Maggi 2-Minute Noodles Masala",
    brand: "Nestle",
    category: "Food",
    ingredients: [
      "Wheat Flour (Maida)",
      "Palm Oil",
      "Salt",
      "Wheat Gluten",
      "Acidifying Agent (508)",
      "Thickener (412)",
      "Humectant (451i)",
      "Hydrolysed Groundnut Protein",
      "Dehydrated Onion",
      "Sugar",
      "Flavor Enhancer (635)",
      "Garlic Powder",
      "Turmeric",
      "Chilli Powder",
      "Coriander Powder",
      "MSG (E621)",
    ],
    safety_score: 32,
    grade: "D",
    image_url: "/products/maggi.png",
    analysis: {
      summary:
        "This product contains refined flour (maida), palm oil, MSG, and multiple artificial additives. Regular consumption is not recommended.",
      ingredients: [
        { name: "Wheat Flour (Maida)", risk: "warning", explanation: "Refined flour stripped of nutrients, causes blood sugar spikes and has no fiber content." },
        { name: "Palm Oil", risk: "danger", explanation: "High in saturated fats, linked to cardiovascular disease. Also raises environmental concerns." },
        { name: "MSG (E621)", risk: "caution", explanation: "Monosodium glutamate can cause headaches and allergic reactions in sensitive individuals." },
        { name: "Salt", risk: "warning", explanation: "Contains 1.6g sodium per serving — 80% of daily recommended intake in one pack." },
        { name: "Flavor Enhancer (635)", risk: "caution", explanation: "Disodium ribonucleotides — generally safe but may trigger gout in susceptible people." },
        { name: "Turmeric", risk: "safe", explanation: "Natural spice with anti-inflammatory properties." },
        { name: "Humectant (451i)", risk: "warning", explanation: "Triphosphate — excessive phosphate intake linked to kidney problems." },
      ],
      warnings: [
        "Very high sodium content — dangerous for people with high blood pressure",
        "Contains MSG — avoid if you are MSG-sensitive",
        "Made with refined flour — not suitable for diabetics",
        "Contains palm oil — linked to heart disease",
      ],
      healthier_alternative: "Try whole wheat noodles from Saffola Oodles or make homemade atta noodles.",
    },
  },
  {
    id: "parle-g",
    barcode: "8901200120011",
    name: "Parle-G Gold Biscuits",
    brand: "Parle",
    category: "Snacks",
    ingredients: [
      "Wheat Flour (Maida)",
      "Sugar",
      "Edible Vegetable Oil (Palm)",
      "Invert Syrup",
      "Milk Solids",
      "Raising Agents (503ii, 500ii)",
      "Salt",
      "Emulsifiers (322, 472e)",
      "Dough Conditioner (223)",
    ],
    safety_score: 42,
    grade: "D",
    image_url: "/products/parleg.png",
    analysis: {
      summary:
        "High in sugar and refined flour with palm oil. A very common snack but nutritionally poor.",
      ingredients: [
        { name: "Sugar", risk: "warning", explanation: "Second ingredient — very high sugar content per serving. Contributes to diabetes and obesity." },
        { name: "Wheat Flour (Maida)", risk: "warning", explanation: "Refined flour with minimal nutritional value." },
        { name: "Palm Oil", risk: "danger", explanation: "High saturated fat content linked to cardiovascular issues." },
        { name: "Invert Syrup", risk: "caution", explanation: "Another form of sugar, adding to the total sugar load." },
        { name: "Milk Solids", risk: "safe", explanation: "Provides small amounts of calcium and protein." },
        { name: "Dough Conditioner (223)", risk: "caution", explanation: "Sodium metabisulphite — may cause allergic reactions in asthma patients." },
      ],
      warnings: [
        "Very high sugar content — not suitable for diabetics",
        "Contains sodium metabisulphite — avoid if asthmatic",
      ],
      healthier_alternative: "Try Ragi or Oats cookies from brands like Nourish or Early Foods.",
    },
  },
  {
    id: "amul-butter",
    barcode: "8901262011518",
    name: "Amul Pasteurised Butter",
    brand: "Amul",
    category: "Food",
    ingredients: [
      "Pasteurised Cream",
      "Common Salt",
      "Permitted Natural Colour (Annatto)",
    ],
    safety_score: 72,
    grade: "B",
    image_url: "/products/amul-butter.png",
    analysis: {
      summary:
        "Simple, clean ingredient list. High in saturated fat but no artificial additives. Use in moderation.",
      ingredients: [
        { name: "Pasteurised Cream", risk: "safe", explanation: "Natural dairy ingredient. High in saturated fat but minimally processed." },
        { name: "Common Salt", risk: "caution", explanation: "Adds sodium — keep overall daily salt intake in check." },
        { name: "Annatto (Natural Colour)", risk: "safe", explanation: "Plant-based natural colorant, generally recognized as safe." },
      ],
      warnings: [
        "High in saturated fat — use in moderation if you have heart conditions",
      ],
      healthier_alternative: "Consider ghee (clarified butter) which has a better fatty acid profile, or use olive oil for cooking.",
    },
  },
  {
    id: "haldirams-bhujia",
    barcode: "8904004400668",
    name: "Haldiram's Bhujia Sev",
    brand: "Haldiram's",
    category: "Snacks",
    ingredients: [
      "Besan (Gram Flour)",
      "Edible Vegetable Oil (Palmolein)",
      "Moth Bean Flour",
      "Salt",
      "Spices & Condiments",
      "Black Pepper",
      "Asafoetida",
      "Citric Acid (E330)",
      "Antioxidant (E319 TBHQ)",
    ],
    safety_score: 48,
    grade: "C",
    image_url: "/products/bhujia.png",
    analysis: {
      summary:
        "Deep-fried snack with TBHQ preservative. High in fat and sodium. Occasional consumption is fine.",
      ingredients: [
        { name: "Besan (Gram Flour)", risk: "safe", explanation: "Good source of plant protein and fiber." },
        { name: "Palmolein Oil", risk: "warning", explanation: "Refined palm oil fraction — high in saturated fats." },
        { name: "TBHQ (E319)", risk: "danger", explanation: "Synthetic antioxidant — studies suggest possible links to behavioral issues and immune system effects at high doses." },
        { name: "Citric Acid", risk: "safe", explanation: "Natural preservative found in citrus fruits." },
        { name: "Asafoetida", risk: "safe", explanation: "Traditional Indian spice with digestive benefits." },
      ],
      warnings: [
        "Contains TBHQ — a controversial synthetic preservative",
        "High fat content from deep frying",
      ],
      healthier_alternative: "Try roasted makhana (fox nuts) or baked namkeen alternatives.",
    },
  },
  {
    id: "dabur-honey",
    barcode: "8901207000064",
    name: "Dabur Honey",
    brand: "Dabur",
    category: "Food",
    ingredients: ["Honey"],
    safety_score: 65,
    grade: "B",
    image_url: "/products/dabur-honey.png",
    analysis: {
      summary:
        "Single ingredient product, but lab tests have previously found adulteration concerns in some commercial honeys. Still better than sugar.",
      ingredients: [
        { name: "Honey", risk: "caution", explanation: "Natural sweetener with antioxidants, but commercial honey may be ultra-filtered or blended with sugar syrup. CSE investigations have raised adulteration concerns." },
      ],
      warnings: [
        "Not suitable for children under 1 year",
        "High glycemic index — diabetics should use sparingly",
        "Some commercial honey brands have faced adulteration allegations",
      ],
      healthier_alternative: "Source raw, unprocessed honey from local beekeepers or certified organic brands.",
    },
  },
  {
    id: "bournvita",
    barcode: "8901233010116",
    name: "Cadbury Bournvita Health Drink",
    brand: "Cadbury",
    category: "Beverages",
    ingredients: [
      "Sugar",
      "Cocoa Solids",
      "Malt Extract",
      "Milk Solids",
      "Liquid Glucose",
      "Emulsifiers (E322, E476)",
      "Raising Agent (E500ii)",
      "Vitamins",
      "Minerals",
      "Salt",
      "Caramel Colour (E150d)",
    ],
    safety_score: 38,
    grade: "D",
    image_url: "/products/bournvita.png",
    analysis: {
      summary:
        "Marketed as a health drink but sugar is the first ingredient. Contains caramel colour which is controversial.",
      ingredients: [
        { name: "Sugar", risk: "danger", explanation: "First ingredient — a single serving has ~15g of added sugar, which is 60% of a child's recommended daily limit." },
        { name: "Liquid Glucose", risk: "warning", explanation: "Another form of sugar, compounding the total sugar load." },
        { name: "Caramel Colour (E150d)", risk: "caution", explanation: "Class IV caramel colour may contain 4-MEI, a compound studied for carcinogenic potential." },
        { name: "Cocoa Solids", risk: "safe", explanation: "Contains antioxidants and flavonoids." },
        { name: "Vitamins & Minerals", risk: "safe", explanation: "Added fortification provides some nutritional value." },
      ],
      warnings: [
        "Extremely high sugar content — misleading 'health drink' marketing",
        "Not recommended for diabetic children",
        "Contains controversial caramel colour E150d",
      ],
      healthier_alternative: "Try natural cocoa powder mixed with warm milk and a small amount of jaggery.",
    },
  },
  {
    id: "kurkure-masala",
    barcode: "8901491100717",
    name: "Kurkure Masala Munch",
    brand: "PepsiCo",
    category: "Snacks",
    ingredients: [
      "Rice Meal",
      "Edible Vegetable Oil (Palmolein)",
      "Corn Meal",
      "Gram Meal",
      "Spices & Condiments",
      "Salt",
      "Sugar",
      "Tartaric Acid (E334)",
      "Flavor Enhancers (E627, E631)",
      "Citric Acid",
      "Onion Powder",
    ],
    safety_score: 35,
    grade: "D",
    image_url: "/products/kurkure.png",
    analysis: {
      summary:
        "Deep-fried processed snack with flavor enhancers and high sodium. Nutritionally empty calories.",
      ingredients: [
        { name: "Palmolein Oil", risk: "warning", explanation: "High saturated fat palm oil used for deep frying." },
        { name: "Flavor Enhancers (E627, E631)", risk: "caution", explanation: "Disodium guanylate and inosinate — can trigger gout and are often paired with MSG." },
        { name: "Salt", risk: "warning", explanation: "High sodium content per serving." },
        { name: "Rice Meal", risk: "safe", explanation: "Simple carbohydrate base." },
        { name: "Gram Meal", risk: "safe", explanation: "Provides some protein." },
      ],
      warnings: [
        "High in sodium and saturated fat",
        "Contains flavor enhancers that may cause issues for gout patients",
      ],
      healthier_alternative: "Try roasted chana, makhana, or baked vegetable chips.",
    },
  },
  {
    id: "good-day-cashew",
    barcode: "8901063010116",
    name: "Good Day Cashew Cookies",
    brand: "Britannia",
    category: "Snacks",
    ingredients: [
      "Wheat Flour (Maida)",
      "Sugar",
      "Edible Vegetable Fat (Palm)",
      "Cashew Nuts (5.5%)",
      "Invert Syrup",
      "Milk Solids",
      "Raising Agents (500ii, 503ii)",
      "Emulsifier (322)",
      "Iodised Salt",
      "Dough Conditioner (223)",
      "Artificial Flavouring Substances",
    ],
    safety_score: 40,
    grade: "C",
    image_url: "/products/goodday.png",
    analysis: {
      summary:
        "High sugar and refined flour cookie with palm fat. The cashew content is only 5.5% despite the branding.",
      ingredients: [
        { name: "Sugar", risk: "warning", explanation: "Second ingredient — high sugar content per serving." },
        { name: "Wheat Flour (Maida)", risk: "warning", explanation: "Refined flour with no fiber." },
        { name: "Palm Fat", risk: "danger", explanation: "Edible vegetable fat from palm — very high in saturated fats." },
        { name: "Cashew Nuts", risk: "safe", explanation: "Healthy fat source, but only 5.5% of the product." },
        { name: "Artificial Flavouring", risk: "caution", explanation: "Synthetic flavours — specific compounds not disclosed." },
      ],
      warnings: [
        "High sugar and fat content",
        "Only 5.5% actual cashew despite marketing",
        "Contains artificial flavours",
      ],
      healthier_alternative: "Try homemade atta-jaggery cookies or brands like Nourish Organics.",
    },
  },
  {
    id: "paper-boat-aam-panna",
    barcode: "8906045780015",
    name: "Paper Boat Aam Panna",
    brand: "Paper Boat",
    category: "Beverages",
    ingredients: [
      "Water",
      "Sugar",
      "Raw Mango Pulp (8%)",
      "Cumin Powder",
      "Black Salt",
      "Mint Extract",
      "Citric Acid",
      "Acidity Regulator (E331)",
      "Permitted Natural Colour",
    ],
    safety_score: 52,
    grade: "C",
    image_url: "/products/paperboat.png",
    analysis: {
      summary:
        "Marketed with nostalgia but is essentially sugar water with 8% mango pulp. High sugar content.",
      ingredients: [
        { name: "Sugar", risk: "warning", explanation: "Second ingredient — roughly 28g sugar per pack, equivalent to 7 teaspoons." },
        { name: "Raw Mango Pulp", risk: "safe", explanation: "Natural fruit pulp, but only 8% of the product." },
        { name: "Cumin Powder", risk: "safe", explanation: "Traditional spice with digestive benefits." },
        { name: "Black Salt", risk: "safe", explanation: "Adds characteristic flavour, contains trace minerals." },
        { name: "Citric Acid", risk: "safe", explanation: "Natural acidity regulator." },
      ],
      warnings: [
        "Very high sugar content — 28g per pack",
        "Only 8% actual fruit content",
      ],
      healthier_alternative: "Make fresh aam panna at home with raw mango, cumin, and a small amount of jaggery.",
    },
  },
  {
    id: "himalaya-face-wash",
    barcode: "8901138825447",
    name: "Himalaya Purifying Neem Face Wash",
    brand: "Himalaya",
    category: "Skincare",
    ingredients: [
      "Water",
      "Cocamidopropyl Betaine",
      "Neem (Azadirachta Indica) Extract",
      "Turmeric (Curcuma Longa) Extract",
      "Sodium Laureth Sulfate",
      "Glycerin",
      "Phenoxyethanol",
      "Fragrance",
      "Disodium EDTA",
      "Citric Acid",
      "Sodium Benzoate",
    ],
    safety_score: 62,
    grade: "B",
    image_url: "/products/himalaya.png",
    analysis: {
      summary:
        "Contains beneficial neem and turmeric but also has SLS and synthetic fragrance. Decent for a mass-market face wash.",
      ingredients: [
        { name: "Neem Extract", risk: "safe", explanation: "Antibacterial and anti-inflammatory natural ingredient." },
        { name: "Turmeric Extract", risk: "safe", explanation: "Natural antiseptic with skin-brightening properties." },
        { name: "Sodium Laureth Sulfate", risk: "caution", explanation: "Cleansing agent that can strip natural oils and irritate sensitive skin." },
        { name: "Phenoxyethanol", risk: "caution", explanation: "Preservative — generally safe at low concentrations but can irritate eczema-prone skin." },
        { name: "Fragrance", risk: "warning", explanation: "Undisclosed blend of chemicals — can contain allergens and irritants." },
      ],
      warnings: [
        "Contains undisclosed fragrance compounds",
        "SLS may irritate sensitive or dry skin",
      ],
      healthier_alternative: "Try Plum Green Tea face wash or a simple besan-turmeric paste at home.",
    },
  },
  {
    id: "mamaearth-sunscreen",
    barcode: "8906116280133",
    name: "Mamaearth Ultra Light Indian Sunscreen SPF 50",
    brand: "Mamaearth",
    category: "Skincare",
    ingredients: [
      "Water",
      "Ethylhexyl Methoxycinnamate",
      "Butyl Methoxydibenzoylmethane",
      "Aloe Vera Extract",
      "Carrot Seed Oil",
      "Turmeric Extract",
      "Glycerin",
      "Dimethicone",
      "Phenoxyethanol",
      "Fragrance",
    ],
    safety_score: 55,
    grade: "C",
    image_url: "/products/mamaearth.png",
    analysis: {
      summary:
        "Chemical sunscreen with some natural ingredients. The UV filters used are effective but have some controversy around hormonal disruption.",
      ingredients: [
        { name: "Ethylhexyl Methoxycinnamate", risk: "warning", explanation: "Chemical UV filter (Octinoxate) — some studies link it to hormonal disruption and coral reef damage." },
        { name: "Butyl Methoxydibenzoylmethane", risk: "caution", explanation: "Avobenzone — effective UVA filter but can degrade in sunlight and may irritate sensitive skin." },
        { name: "Aloe Vera Extract", risk: "safe", explanation: "Soothing and hydrating natural ingredient." },
        { name: "Turmeric Extract", risk: "safe", explanation: "Antioxidant and anti-inflammatory." },
        { name: "Fragrance", risk: "warning", explanation: "Undisclosed fragrance blend — potential allergens." },
      ],
      warnings: [
        "Contains chemical UV filters with hormonal disruption concerns",
        "Undisclosed fragrance ingredients",
        "'Natural' marketing may be misleading",
      ],
      healthier_alternative: "Try mineral sunscreens with zinc oxide like Re'equil or Minimalist SPF 50.",
    },
  },
  {
    id: "nestle-cerelac",
    barcode: "8901058851809",
    name: "Nestle Cerelac Baby Cereal Wheat",
    brand: "Nestle",
    category: "Baby",
    ingredients: [
      "Wheat Flour",
      "Sugar",
      "Skimmed Milk Powder",
      "Edible Vegetable Oil (Palmolein)",
      "Wheat Gluten",
      "Vitamins & Minerals",
      "Emulsifier (E471)",
      "Acidity Regulator (E524)",
      "Antioxidant (E304, E307)",
      "Natural Flavour",
    ],
    safety_score: 45,
    grade: "C",
    image_url: "/products/cerelac.png",
    analysis: {
      summary:
        "Baby food with sugar as the second ingredient. WHO advises no added sugar in baby food. Contains palm oil.",
      ingredients: [
        { name: "Sugar", risk: "danger", explanation: "Second ingredient in a baby food — WHO recommends zero added sugar for children under 2. Contains ~3g sugar per serving." },
        { name: "Wheat Flour", risk: "safe", explanation: "Good carbohydrate source for babies over 6 months." },
        { name: "Palmolein Oil", risk: "warning", explanation: "Palm oil in baby food may reduce calcium and fat absorption." },
        { name: "Vitamins & Minerals", risk: "safe", explanation: "Essential fortification for infant development." },
        { name: "Emulsifier (E471)", risk: "caution", explanation: "Mono and diglycerides — generally safe but processed additive in baby food raises questions." },
      ],
      warnings: [
        "Contains added sugar — against WHO recommendations for baby food",
        "Palm oil may reduce nutrient absorption in infants",
        "Consider homemade alternatives for better nutrition",
      ],
      healthier_alternative: "Make fresh ragi porridge, dal-rice khichdi, or mashed banana at home for your baby.",
    },
  },
  {
    id: "tata-salt",
    barcode: "8901725181321",
    name: "Tata Salt Iodised",
    brand: "Tata",
    category: "Food",
    ingredients: [
      "Iodised Salt",
      "Potassium Iodate",
      "Anti-Caking Agent (E536)",
    ],
    safety_score: 78,
    grade: "B",
    image_url: "/products/tatasalt.png",
    analysis: {
      summary:
        "Clean, simple product. Iodisation is essential for thyroid health in India. Anti-caking agent is the only additive.",
      ingredients: [
        { name: "Iodised Salt", risk: "safe", explanation: "Essential mineral. Iodisation prevents goitre and thyroid disorders, which are common in India." },
        { name: "Anti-Caking Agent (E536)", risk: "caution", explanation: "Potassium ferrocyanide — approved and safe in small amounts, but the name sounds worse than it is." },
      ],
      warnings: [
        "Use in moderation — WHO recommends less than 5g salt per day",
      ],
      healthier_alternative: "Consider Himalayan pink salt or sea salt for additional trace minerals, but ensure iodine intake from other sources.",
    },
  },
  {
    id: "mdh-chana-masala",
    barcode: "8902519003471",
    name: "MDH Chana Masala",
    brand: "MDH",
    category: "Food",
    ingredients: [
      "Coriander",
      "Red Chilli",
      "Salt",
      "Cumin",
      "Turmeric",
      "Black Pepper",
      "Dried Ginger",
      "Pomegranate Seed Powder",
      "Dried Fenugreek Leaves",
      "Bay Leaf",
      "Nutmeg",
      "Cardamom",
      "Cinnamon",
      "Clove",
      "Asafoetida",
    ],
    safety_score: 85,
    grade: "A",
    image_url: "/products/mdh.png",
    analysis: {
      summary:
        "Excellent ingredient list — all natural spices with no artificial additives. A clean product.",
      ingredients: [
        { name: "Coriander", risk: "safe", explanation: "Natural spice with antioxidant properties." },
        { name: "Turmeric", risk: "safe", explanation: "Anti-inflammatory compound curcumin. One of the healthiest spices." },
        { name: "Red Chilli", risk: "safe", explanation: "Contains capsaicin with metabolic benefits." },
        { name: "Pomegranate Seed Powder", risk: "safe", explanation: "Rich in antioxidants and adds tangy flavour." },
        { name: "Salt", risk: "caution", explanation: "Added salt — account for this in overall meal seasoning." },
      ],
      warnings: [
        "Some MDH products have faced import bans due to ethylene oxide contamination — check batch quality",
      ],
      healthier_alternative: "Buy whole spices and grind at home for maximum freshness and potency.",
    },
  },
  {
    id: "real-fruit-juice",
    barcode: "8901030400100",
    name: "Real Fruit Power Mixed Fruit Juice",
    brand: "Dabur",
    category: "Beverages",
    ingredients: [
      "Water",
      "Mixed Fruit Concentrate (Apple, Grape, Mango, Banana, Pineapple)",
      "Sugar",
      "Citric Acid",
      "Acidity Regulator (E331iii)",
      "Antioxidant (E300)",
      "Permitted Natural Colour",
      "Permitted Natural Flavour",
    ],
    safety_score: 44,
    grade: "C",
    image_url: "/products/real-juice.png",
    analysis: {
      summary:
        "Fruit 'juice' that is mostly water and sugar with fruit concentrate. Far less healthy than eating actual fruit.",
      ingredients: [
        { name: "Sugar", risk: "warning", explanation: "Added sugar on top of natural fruit sugars. About 24g total sugar per glass." },
        { name: "Mixed Fruit Concentrate", risk: "caution", explanation: "Reconstituted juice loses most fiber and many vitamins found in fresh fruit." },
        { name: "Citric Acid", risk: "safe", explanation: "Natural preservative and flavour enhancer." },
        { name: "Ascorbic Acid (E300)", risk: "safe", explanation: "Vitamin C — beneficial antioxidant." },
      ],
      warnings: [
        "Very high sugar content — 24g per 200ml serving",
        "'100% fruit juice' claim is misleading as it uses concentrate plus added sugar",
        "Not suitable for diabetics",
      ],
      healthier_alternative: "Eat whole fruits instead, or make fresh juice at home without added sugar.",
    },
  },
  {
    id: "dove-shampoo",
    barcode: "8901030593345",
    name: "Dove Intense Repair Shampoo",
    brand: "Dove",
    category: "Skincare",
    ingredients: [
      "Water",
      "Sodium Laureth Sulfate",
      "Cocamidopropyl Betaine",
      "Glycol Distearate",
      "Dimethicone",
      "Sodium Chloride",
      "Parfum/Fragrance",
      "Carbomer",
      "Guar Hydroxypropyltrimonium Chloride",
      "DMDM Hydantoin",
      "Citric Acid",
      "TEA-Dodecylbenzenesulfonate",
      "Methylchloroisothiazolinone",
      "Methylisothiazolinone",
    ],
    safety_score: 38,
    grade: "D",
    image_url: "/products/dove.png",
    analysis: {
      summary:
        "Contains DMDM Hydantoin (formaldehyde releaser) and isothiazolinone preservatives — both are significant concerns.",
      ingredients: [
        { name: "DMDM Hydantoin", risk: "danger", explanation: "Formaldehyde-releasing preservative linked to hair loss, scalp irritation, and potential carcinogenic effects." },
        { name: "Methylisothiazolinone", risk: "danger", explanation: "Potent allergen and irritant. Banned in leave-on products in the EU but still used in rinse-off products." },
        { name: "Sodium Laureth Sulfate", risk: "caution", explanation: "Harsh surfactant that can strip hair and scalp of natural moisture." },
        { name: "Dimethicone", risk: "caution", explanation: "Silicone that creates the illusion of smooth hair but causes build-up over time." },
        { name: "Fragrance", risk: "warning", explanation: "Undisclosed fragrance blend with potential allergens." },
      ],
      warnings: [
        "Contains DMDM Hydantoin — a formaldehyde releaser",
        "Methylisothiazolinone is a strong skin sensitizer",
        "Has been subject to class-action lawsuits in the US over hair loss claims",
      ],
      healthier_alternative: "Try WOW, Plum, or Maui Moisture shampoos which avoid formaldehyde releasers.",
    },
  },
  {
    id: "dettol-handwash",
    barcode: "8901396355014",
    name: "Dettol Skincare Liquid Handwash",
    brand: "Dettol",
    category: "Household",
    ingredients: [
      "Water",
      "Sodium Laureth Sulfate",
      "Cocamidopropyl Betaine",
      "Glycerin",
      "Sodium Chloride",
      "Chloroxylenol (PCMX)",
      "Parfum",
      "Citric Acid",
      "Sodium Benzoate",
      "Methylchloroisothiazolinone",
      "Methylisothiazolinone",
      "CI 17200",
      "CI 15510",
    ],
    safety_score: 56,
    grade: "C",
    image_url: "/products/dettol.png",
    analysis: {
      summary:
        "Effective antibacterial handwash but contains isothiazolinone preservatives that are strong allergens.",
      ingredients: [
        { name: "Chloroxylenol (PCMX)", risk: "caution", explanation: "Active antibacterial ingredient. Effective but some studies question whether antibacterial soaps are better than regular soap." },
        { name: "Methylisothiazolinone", risk: "danger", explanation: "Strong contact allergen — European Scientific Committee recommends avoiding it in rinse-off products too." },
        { name: "Glycerin", risk: "safe", explanation: "Moisturizing agent that helps prevent dryness from washing." },
        { name: "Sodium Benzoate", risk: "safe", explanation: "Common preservative, safe at approved levels." },
      ],
      warnings: [
        "Contains methylisothiazolinone — a strong allergen",
        "Antibacterial soaps may not be more effective than regular soap and water",
      ],
      healthier_alternative: "Plain soap and water is equally effective. Try Khadi Natural or Rustic Art handwash.",
    },
  },
  {
    id: "eno-fruit-salt",
    barcode: "8901023007415",
    name: "Eno Fruit Salt Regular",
    brand: "GSK",
    category: "Food",
    ingredients: [
      "Sodium Bicarbonate (2.32g)",
      "Citric Acid Anhydrous (2.18g)",
      "Sodium Carbonate Anhydrous (0.50g)",
    ],
    safety_score: 70,
    grade: "B",
    image_url: "/products/eno.png",
    analysis: {
      summary:
        "Simple antacid with just 3 ingredients. Effective for acidity but very high in sodium. Don't use regularly.",
      ingredients: [
        { name: "Sodium Bicarbonate", risk: "caution", explanation: "Effective antacid but very high sodium — each dose has ~760mg sodium." },
        { name: "Citric Acid", risk: "safe", explanation: "Natural acid that creates the fizzing reaction." },
        { name: "Sodium Carbonate", risk: "caution", explanation: "Alkalizing agent. Safe for occasional use but excessive intake can cause alkalosis." },
      ],
      warnings: [
        "Very high sodium content — avoid if you have high blood pressure",
        "Should not be used regularly — masks underlying digestive issues",
        "Consult a doctor if you need antacids frequently",
      ],
      healthier_alternative: "Try jeera water, ajwain water, or buttermilk for natural acidity relief.",
    },
  },
  {
    id: "britannia-bread",
    barcode: "8901063060111",
    name: "Britannia Whole Wheat Bread",
    brand: "Britannia",
    category: "Food",
    ingredients: [
      "Whole Wheat Flour (55%)",
      "Water",
      "Sugar",
      "Yeast",
      "Edible Vegetable Oil (Palm)",
      "Iodised Salt",
      "Wheat Gluten",
      "Soy Flour",
      "Emulsifiers (E472e, E481)",
      "Preservative (E282)",
      "Flour Treatment Agent (E300)",
      "Enzyme",
    ],
    safety_score: 58,
    grade: "C",
    image_url: "/products/britannia-bread.png",
    analysis: {
      summary:
        "Better than white bread with 55% whole wheat, but still contains palm oil, sugar, and calcium propionate preservative.",
      ingredients: [
        { name: "Whole Wheat Flour (55%)", risk: "safe", explanation: "Good source of fiber and nutrients. Better than refined flour." },
        { name: "Sugar", risk: "caution", explanation: "Added sugar in bread is unnecessary but common in Indian brands." },
        { name: "Palm Oil", risk: "warning", explanation: "High saturated fat content." },
        { name: "Calcium Propionate (E282)", risk: "caution", explanation: "Preservative to prevent mold. Some studies suggest it may affect children's behavior and cause irritability." },
        { name: "Emulsifiers (E472e, E481)", risk: "caution", explanation: "Dough conditioners — some research links emulsifiers to gut inflammation." },
      ],
      warnings: [
        "Contains palm oil and added sugar",
        "Calcium propionate may affect sensitive individuals",
        "Only 55% whole wheat — rest is refined",
      ],
      healthier_alternative: "Try local bakery whole grain sourdough bread or make chapatis at home.",
    },
  },
  {
    id: "patanjali-atta",
    barcode: "8904109450024",
    name: "Patanjali Whole Wheat Atta",
    brand: "Patanjali",
    category: "Food",
    ingredients: ["Whole Wheat (100%)"],
    safety_score: 92,
    grade: "A",
    image_url: "/products/patanjali-atta.png",
    analysis: {
      summary:
        "Single ingredient, minimally processed whole grain. One of the cleanest products you can buy.",
      ingredients: [
        { name: "Whole Wheat", risk: "safe", explanation: "100% whole grain — retains bran, germ, and endosperm. Rich in fiber, B vitamins, and minerals." },
      ],
      warnings: [
        "Not suitable for people with celiac disease or wheat allergy",
      ],
      healthier_alternative: "Consider organic whole wheat atta or try multigrain atta with ragi, jowar, and bajra.",
    },
  },

  // ── 5 New Products ──────────────────────────────────────────────────────────

  {
    id: "lays-magic-masala",
    barcode: "8901491101134",
    name: "Lay's Magic Masala",
    brand: "PepsiCo",
    category: "Snacks",
    ingredients: [
      "Potato",
      "Edible Vegetable Oil (Palmolein, Rice Bran Oil)",
      "Seasoning (Sugar, Salt, Spices, Onion Powder, Citric Acid, Chilli Powder, Tomato Powder, Garlic Powder, Anticaking Agent (551), Flavour Enhancers (E627, E631), Acidity Regulator (E330))",
      "Iodised Salt",
    ],
    safety_score: 34,
    grade: "D",
    image_url: "/products/lays.png",
    analysis: {
      summary:
        "Deep-fried potato chips with flavor enhancers and high sodium. One of the most consumed junk foods in India. Nutritionally empty.",
      ingredients: [
        { name: "Palmolein Oil", risk: "warning", explanation: "High in saturated fats from palm oil, used for deep frying at high temperatures." },
        { name: "Flavor Enhancers (E627, E631)", risk: "caution", explanation: "Disodium guanylate and inosinate — commonly paired with MSG. Can trigger gout." },
        { name: "Salt", risk: "warning", explanation: "Very high sodium — one 52g pack contains ~0.6g sodium, 12% of daily limit." },
        { name: "Potato", risk: "safe", explanation: "Base ingredient, but nutrients are destroyed during deep frying." },
        { name: "Anticaking Agent (551)", risk: "safe", explanation: "Silicon dioxide — generally recognized as safe." },
      ],
      warnings: [
        "Very high sodium and fat content per serving",
        "Fried at high temperatures — may contain acrylamide",
        "Contains flavor enhancers linked to gout flare-ups",
      ],
      healthier_alternative: "Try baked potato chips from Too Yumm, or roasted makhana with chaat masala.",
    },
  },
  {
    id: "tropicana-mixed-fruit",
    barcode: "8901396511137",
    name: "Tropicana Mixed Fruit Juice",
    brand: "PepsiCo",
    category: "Beverages",
    ingredients: [
      "Water",
      "Mixed Fruit Juice from Concentrate (Apple, Mango, Grape, Guava, Banana, Papaya) (min 10%)",
      "Sugar",
      "Citric Acid (E330)",
      "Acidity Regulator (E331iii)",
      "Antioxidant (E300)",
      "Stabilizer (E440)",
      "Permitted Natural Colour and Flavour",
    ],
    safety_score: 40,
    grade: "C",
    image_url: "/products/tropicana.png",
    analysis: {
      summary:
        "Marketed as a healthy juice but contains only 10% fruit with added sugar. One glass has more sugar than a can of cola.",
      ingredients: [
        { name: "Sugar", risk: "danger", explanation: "Added sugar on top of fruit sugars. Total ~26g sugar per 200ml — exceeds WHO daily free sugar recommendation in one glass." },
        { name: "Mixed Fruit Concentrate (10%)", risk: "caution", explanation: "Only 10% actual fruit. Reconstituted concentrate has far less nutrition than fresh fruit." },
        { name: "Stabilizer (E440)", risk: "safe", explanation: "Pectin — naturally derived from fruit, used as thickener." },
        { name: "Ascorbic Acid (E300)", risk: "safe", explanation: "Vitamin C added as antioxidant." },
        { name: "Citric Acid", risk: "safe", explanation: "Natural acidity regulator." },
      ],
      warnings: [
        "26g sugar per 200ml — exceeds WHO daily limit in a single glass",
        "Only 10% actual fruit content despite 'fruit juice' labeling",
        "Not suitable for diabetics or weight-conscious consumers",
      ],
      healthier_alternative: "Blend fresh seasonal fruits at home. Try nimbu pani or coconut water for a packaged option.",
    },
  },
  {
    id: "johnsons-baby-powder",
    barcode: "8901012110010",
    name: "Johnson's Baby Powder",
    brand: "Johnson & Johnson",
    category: "Baby",
    ingredients: [
      "Talc",
      "Fragrance",
    ],
    safety_score: 28,
    grade: "D",
    image_url: "/products/johnsons.png",
    analysis: {
      summary:
        "Contains talc, which has been the subject of thousands of lawsuits globally over potential asbestos contamination and cancer links. J&J discontinued talc-based baby powder in North America but continues selling it in India.",
      ingredients: [
        { name: "Talc", risk: "danger", explanation: "Linked to ovarian cancer and mesothelioma in multiple studies. J&J has paid billions in settlements. Natural talc deposits can contain asbestos." },
        { name: "Fragrance", risk: "warning", explanation: "Undisclosed fragrance blend applied directly to baby's skin — potential allergens and endocrine disruptors." },
      ],
      warnings: [
        "Talc has been linked to cancer in thousands of lawsuits globally",
        "J&J discontinued talc-based powder in US/Canada but still sells it in India",
        "Undisclosed fragrance on baby's sensitive skin is concerning",
        "WHO's IARC classifies talc containing asbestos as carcinogenic",
      ],
      healthier_alternative: "Use cornstarch-based baby powder from Mamaearth or The Moms Co, or skip powder entirely — pediatricians say it's unnecessary.",
    },
  },
  {
    id: "surf-excel",
    barcode: "8901030572111",
    name: "Surf Excel Easy Wash Detergent Powder",
    brand: "Hindustan Unilever",
    category: "Household",
    ingredients: [
      "Linear Alkyl Benzene Sulphonate (LAS)",
      "Sodium Tripolyphosphate",
      "Sodium Carbonate",
      "Sodium Sulphate",
      "Carboxymethyl Cellulose",
      "Sodium Perborate",
      "Enzymes",
      "Optical Brighteners",
      "Perfume",
      "Water",
    ],
    safety_score: 50,
    grade: "C",
    image_url: "/products/surfexcel.png",
    analysis: {
      summary:
        "Effective detergent but contains phosphates (environmental concern) and optical brighteners that remain on fabric and contact skin.",
      ingredients: [
        { name: "LAS (Linear Alkyl Benzene Sulphonate)", risk: "caution", explanation: "Primary cleaning surfactant. Can cause skin irritation with direct contact. Biodegradable but harsh." },
        { name: "Sodium Tripolyphosphate", risk: "warning", explanation: "Phosphate builder — excellent for cleaning but causes water eutrophication. Banned in detergents in many countries." },
        { name: "Optical Brighteners", risk: "caution", explanation: "UV-reactive chemicals that stay on fabric and transfer to skin. Can cause photoallergic reactions." },
        { name: "Sodium Perborate", risk: "warning", explanation: "Bleaching agent that releases boron. Environmental toxin and skin irritant." },
        { name: "Enzymes", risk: "safe", explanation: "Biological cleaning agents. Effective and eco-friendly." },
      ],
      warnings: [
        "Contains phosphates — harmful to waterways and lakes",
        "Optical brighteners remain on clothes and contact skin",
        "Keep away from children — ingestion is dangerous",
        "Wear gloves during handwashing to avoid skin irritation",
      ],
      healthier_alternative: "Try Beco or The Better Home eco-friendly detergent sheets, or soap nut (reetha) for traditional washing.",
    },
  },
  {
    id: "colgate-strong-teeth",
    barcode: "8901314010117",
    name: "Colgate Strong Teeth Toothpaste",
    brand: "Colgate",
    category: "Household",
    ingredients: [
      "Calcium Carbonate",
      "Water",
      "Sorbitol",
      "Sodium Lauryl Sulfate",
      "Sodium Monofluorophosphate (0.76%)",
      "Cellulose Gum",
      "Flavour",
      "Sodium Silicate",
      "Sodium Saccharin",
      "Titanium Dioxide (CI 77891)",
    ],
    safety_score: 60,
    grade: "B",
    image_url: "/products/colgate.png",
    analysis: {
      summary:
        "India's most popular toothpaste. Contains fluoride (essential for dental health) but also SLS and titanium dioxide. Functional product with some concerns.",
      ingredients: [
        { name: "Sodium Monofluorophosphate", risk: "safe", explanation: "Fluoride source at 0.76% — proven to prevent cavities. FSSAI and dental associations recommend fluoride toothpaste." },
        { name: "Sodium Lauryl Sulfate (SLS)", risk: "caution", explanation: "Foaming agent that can cause mouth ulcers (canker sores) in sensitive individuals." },
        { name: "Titanium Dioxide (CI 77891)", risk: "warning", explanation: "Whitening agent banned in food in the EU since 2022. Used here as a colorant in toothpaste — exposure is lower but still debated." },
        { name: "Sodium Saccharin", risk: "caution", explanation: "Artificial sweetener for taste. Safe at low doses but was previously listed as a possible carcinogen (delisted in 2000)." },
        { name: "Calcium Carbonate", risk: "safe", explanation: "Mild abrasive for cleaning teeth. Natural and safe." },
      ],
      warnings: [
        "SLS may trigger canker sores in susceptible individuals",
        "Contains titanium dioxide — banned in EU food products",
        "Do not swallow — fluoride in excess can cause fluorosis",
      ],
      healthier_alternative: "Try Sensodyne (SLS-free) or Himalaya Complete Care for a more natural option with fewer additives.",
    },
  },
];

export const categories = [
  { name: "Food", icon: "🍚", count: 8 },
  { name: "Beverages", icon: "🥤", count: 4 },
  { name: "Snacks", icon: "🍿", count: 5 },
  { name: "Skincare", icon: "✨", count: 3 },
  { name: "Baby", icon: "👶", count: 2 },
  { name: "Household", icon: "🏠", count: 3 },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductByBarcode(barcode: string): Product | undefined {
  return products.find((p) => p.barcode === barcode);
}

export function searchProducts(query: string, category?: string): Product[] {
  let filtered = products;

  if (category && category !== "All") {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (query) {
    const lower = query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.brand.toLowerCase().includes(lower) ||
        p.category.toLowerCase().includes(lower)
    );
  }

  return filtered;
}

export function getTrendingProducts(): Product[] {
  return products.slice(0, 6);
}

export function getWorstRated(): Product[] {
  return [...products].sort((a, b) => a.safety_score - b.safety_score).slice(0, 5);
}
