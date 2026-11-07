// =====================================================================
// LEGACY HARDCODED MENU CATALOG
// Preserved for archive, reference, and offline development fallback
// =====================================================================

export interface DishItem {
  id: string;
  name: string;
  category: "hemat" | "protein" | "rendah-kalori" | "bebas-santan" | "lambung";
  merchantName: string;
  district: string;
  distanceKm: number;
  rating: number;
  soldCount: string;
  basePrice: number;
  discountedPrice: number;
  imageUrl: string;
  healthyTags: string[];
  macros: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    sodiumMg: number;
  };
  cookingNotes: string;
  hygieneBadges: string[];
}

export const MENU_CATALOG: DishItem[] = [
  {
    "id": "DISH-01",
    "name": "Paket Nasi Merah Dada Ayam Bakar & Sayur Bayam",
    "category": "protein",
    "merchantName": "Warteg Berkah Mandiri",
    "district": "Kuningan",
    "distanceKm": 0.8,
    "rating": 4.9,
    "soldCount": "1.8rb+",
    "basePrice": 32000,
    "discountedPrice": 25600,
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    "healthyTags": [
      "Minyak Baru",
      "Sayur Bening",
      "Bebas Santan"
    ],
    "macros": {
      "kcal": 410,
      "proteinG": 36,
      "carbsG": 42,
      "fatG": 8,
      "sodiumMg": 580
    },
    "cookingNotes": "Nasi merah setengah porsi, sambal dipisah, tanpa kuah santan",
    "hygieneBadges": [
      "Minyak Baru Terverifikasi",
      "Dapur Higienis"
    ]
  },
  {
    "id": "DISH-02",
    "name": "Paket Double Protein: Dada Ayam + Orek Tempe Basah",
    "category": "protein",
    "merchantName": "Warteg Berkah Mandiri",
    "district": "Kuningan",
    "distanceKm": 0.8,
    "rating": 4.8,
    "soldCount": "1.2rb+",
    "basePrice": 35000,
    "discountedPrice": 28000,
    "imageUrl": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "healthyTags": [
      "Tinggi Protein",
      "Rendah Gula",
      "Minyak Baru"
    ],
    "macros": {
      "kcal": 480,
      "proteinG": 44,
      "carbsG": 46,
      "fatG": 10,
      "sodiumMg": 640
    },
    "cookingNotes": "Orek tempe tidak manis, ayam tanpa kulit, sayur capcay kuah bening",
    "hygieneBadges": [
      "Minyak Baru Terverifikasi"
    ]
  },
  {
    "id": "DISH-03",
    "name": "Soto Ayam Suwir Kuah Bening + Telur Rebus",
    "category": "bebas-santan",
    "merchantName": "Soto Kudus Menara",
    "district": "SCBD",
    "distanceKm": 1.1,
    "rating": 4.9,
    "soldCount": "2.4rb+",
    "basePrice": 28000,
    "discountedPrice": 22000,
    "imageUrl": "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&q=80",
    "healthyTags": [
      "Bebas Santan",
      "Kaldu Alami",
      "Tinggi Protein"
    ],
    "macros": {
      "kcal": 310,
      "proteinG": 28,
      "carbsG": 28,
      "fatG": 7,
      "sodiumMg": 520
    },
    "cookingNotes": "Tanpa koya, tauge diperbanyak, sambal dipisah, garam sedikit",
    "hygieneBadges": [
      "Kaldu Rebusan Segar",
      "Tanpa MSG Tambahan"
    ]
  },
  {
    "id": "DISH-04",
    "name": "Gado-Gado Siram Sehat Bumbu Kacang Pisah",
    "category": "hemat",
    "merchantName": "Gado-Gado Ibu Marni",
    "district": "Palmerah",
    "distanceKm": 1.4,
    "rating": 4.7,
    "soldCount": "950+",
    "basePrice": 23000,
    "discountedPrice": 18500,
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "healthyTags": [
      "Serat Tinggi",
      "Sayur Segar",
      "Budget Hemat"
    ],
    "macros": {
      "kcal": 330,
      "proteinG": 16,
      "carbsG": 40,
      "fatG": 9,
      "sodiumMg": 480
    },
    "cookingNotes": "Bumbu kacang dipisah separuh, kerupuk diganti emping sedikit",
    "hygieneBadges": [
      "Sayur Cuci Bersih",
      "Minyak Baru"
    ]
  },
  {
    "id": "DISH-05",
    "name": "Pecel Sayur Madiun Serat Tinggi + Tahu Tempe Kukus",
    "category": "lambung",
    "merchantName": "Pecel Sayur Bu Sri",
    "district": "Kuningan",
    "distanceKm": 0.9,
    "rating": 4.8,
    "soldCount": "1.5rb+",
    "basePrice": 22000,
    "discountedPrice": 18000,
    "imageUrl": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    "healthyTags": [
      "Serat Tinggi",
      "Ramah Lambung",
      "Tanpa Santan"
    ],
    "macros": {
      "kcal": 280,
      "proteinG": 18,
      "carbsG": 38,
      "fatG": 7,
      "sodiumMg": 420
    },
    "cookingNotes": "Bumbu pecel dikurangi separuh, sayuran dikukus matang, tidak pedas",
    "hygieneBadges": [
      "Sayur Rebus Higienis"
    ]
  },
  {
    "id": "DISH-06",
    "name": "Paket Ikan Nila Bakar Bumbu Kunyit + Lalapan Segar",
    "category": "protein",
    "merchantName": "Pondok Ikan Bakar Bahari",
    "district": "Menteng",
    "distanceKm": 2.1,
    "rating": 4.9,
    "soldCount": "820+",
    "basePrice": 36000,
    "discountedPrice": 29500,
    "imageUrl": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "healthyTags": [
      "Omega-3",
      "Tinggi Protein",
      "Bakar Tanpa Arang"
    ],
    "macros": {
      "kcal": 390,
      "proteinG": 34,
      "carbsG": 32,
      "fatG": 9,
      "sodiumMg": 510
    },
    "cookingNotes": "Olesan kecap tipis, lalapan dicuci matang, sambal dabu-dabu pisah",
    "hygieneBadges": [
      "Ikan Segar Harian"
    ]
  },
  {
    "id": "DISH-07",
    "name": "Paket Sayur Asem Segar + Ikan Asin Tipis + Tahu",
    "category": "hemat",
    "merchantName": "Warteg Kharisma Sehat",
    "district": "Senayan",
    "distanceKm": 1.2,
    "rating": 4.7,
    "soldCount": "1.1rb+",
    "basePrice": 20000,
    "discountedPrice": 16500,
    "imageUrl": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&q=80",
    "healthyTags": [
      "Budget Hemat",
      "Kuah Bening",
      "Bebas Santan"
    ],
    "macros": {
      "kcal": 270,
      "proteinG": 14,
      "carbsG": 36,
      "fatG": 6,
      "sodiumMg": 490
    },
    "cookingNotes": "Sayur asem tidak terlalu asam, nasi putih setengah, tahu kukus",
    "hygieneBadges": [
      "Minyak Baru Terverifikasi"
    ]
  },
  {
    "id": "DISH-08",
    "name": "Sup Ayam Bening Jahe Hangat + Wortel & Kentang",
    "category": "lambung",
    "merchantName": "Dapur Sup Sehat Bu Haji",
    "district": "SCBD",
    "distanceKm": 0.7,
    "rating": 4.9,
    "soldCount": "2.1rb+",
    "basePrice": 30000,
    "discountedPrice": 24000,
    "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "healthyTags": [
      "Ramah Lambung",
      "Anti Inflamasi",
      "Kaldu Murni"
    ],
    "macros": {
      "kcal": 250,
      "proteinG": 30,
      "carbsG": 22,
      "fatG": 5,
      "sodiumMg": 460
    },
    "cookingNotes": "Ekstra jahe geprek, tanpa merica tajam, ayam suwir tanpa kulit",
    "hygieneBadges": [
      "Kaldu Ayam Kampung"
    ]
  },
  {
    "id": "DISH-09",
    "name": "Paket Warteg Hemat: Orek Tempe Basah + Tumis Kangkung",
    "category": "hemat",
    "merchantName": "Warteg Berkah Mandiri",
    "district": "Kuningan",
    "distanceKm": 0.8,
    "rating": 4.8,
    "soldCount": "3.5rb+",
    "basePrice": 18000,
    "discountedPrice": 14500,
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "healthyTags": [
      "Budget Hemat",
      "Kaya Zat Besi",
      "Minyak Baru"
    ],
    "macros": {
      "kcal": 290,
      "proteinG": 15,
      "carbsG": 38,
      "fatG": 7,
      "sodiumMg": 450
    },
    "cookingNotes": "Kangkung ditumis minyak sedikit, garam sedikit, nasi 1 centong",
    "hygieneBadges": [
      "Minyak Baru Terverifikasi"
    ]
  },
  {
    "id": "DISH-10",
    "name": "Pepes Tahu Kemangi Kukus Daun Pisang",
    "category": "rendah-kalori",
    "merchantName": "Dapur Sunda Laras",
    "district": "Palmerah",
    "distanceKm": 1.5,
    "rating": 4.7,
    "soldCount": "640+",
    "basePrice": 16000,
    "discountedPrice": 13000,
    "imageUrl": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    "healthyTags": [
      "Rendah Kalori",
      "Kukus Alami",
      "Bebas Minyak"
    ],
    "macros": {
      "kcal": 180,
      "proteinG": 14,
      "carbsG": 14,
      "fatG": 5,
      "sodiumMg": 310
    },
    "cookingNotes": "Kukus matang daun pisang, bumbu kunyit kemangi wangi, tanpa cabe rawit utuh",
    "hygieneBadges": [
      "100% Non Minyak Goreng"
    ]
  },
  {
    "id": "DISH-11",
    "name": "Pepes Ikan Mas Duri Lunak Bumbu Kuning",
    "category": "protein",
    "merchantName": "Dapur Sunda Laras",
    "district": "Palmerah",
    "distanceKm": 1.5,
    "rating": 4.8,
    "soldCount": "780+",
    "basePrice": 33000,
    "discountedPrice": 27000,
    "imageUrl": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "healthyTags": [
      "Tinggi Kalsium",
      "Tinggi Protein",
      "Kukus Alami"
    ],
    "macros": {
      "kcal": 320,
      "proteinG": 32,
      "carbsG": 18,
      "fatG": 8,
      "sodiumMg": 470
    },
    "cookingNotes": "Kukus presto duri lunak, kemangi segar, bumbu kunyit hangat",
    "hygieneBadges": [
      "Ikan Segar Bersih"
    ]
  },
  {
    "id": "DISH-12",
    "name": "Paket Nasi Merah Tongkol Suwir Rendah Minyak",
    "category": "protein",
    "merchantName": "Warteg Lestari Sehat",
    "district": "Sudirman",
    "distanceKm": 1.0,
    "rating": 4.8,
    "soldCount": "1.3rb+",
    "basePrice": 26000,
    "discountedPrice": 21000,
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    "healthyTags": [
      "Tinggi Protein",
      "Nasi Merah",
      "Bebas Santan"
    ],
    "macros": {
      "kcal": 380,
      "proteinG": 29,
      "carbsG": 40,
      "fatG": 7,
      "sodiumMg": 510
    },
    "cookingNotes": "Tongkol disangrai bukan digoreng kering, tumis buncis bening",
    "hygieneBadges": [
      "Minyak Baru"
    ]
  },
  {
    "id": "DISH-13",
    "name": "Sup Bening Bayam Jagung Manis + Telur Dadar Jamur",
    "category": "hemat",
    "merchantName": "Warteg Sejahtera",
    "district": "SCBD",
    "distanceKm": 0.6,
    "rating": 4.8,
    "soldCount": "1.7rb+",
    "basePrice": 21000,
    "discountedPrice": 17000,
    "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "healthyTags": [
      "Budget Hemat",
      "Kuah Bening",
      "Sayur Bayam"
    ],
    "macros": {
      "kcal": 260,
      "proteinG": 18,
      "carbsG": 24,
      "fatG": 7,
      "sodiumMg": 420
    },
    "cookingNotes": "Bayam baru dimasak, telur dadar jamur tiram minyak sedikit",
    "hygieneBadges": [
      "Sayur Segar"
    ]
  },
  {
    "id": "DISH-14",
    "name": "Capcay Kuah Segar Sayur Campur + Dada Ayam Suwir",
    "category": "rendah-kalori",
    "merchantName": "Resto Sehat Kencana",
    "district": "Kuningan",
    "distanceKm": 1.3,
    "rating": 4.9,
    "soldCount": "1.9rb+",
    "basePrice": 29000,
    "discountedPrice": 23500,
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "healthyTags": [
      "Rendah Kalori",
      "Kaya Serat",
      "Tanpa Maizena Kental"
    ],
    "macros": {
      "kcal": 290,
      "proteinG": 26,
      "carbsG": 26,
      "fatG": 6,
      "sodiumMg": 480
    },
    "cookingNotes": "Kuah bening encer tanpa maizena pekat, wortel, brokoli, kembang kol renyah",
    "hygieneBadges": [
      "Sayur Organik Mitra"
    ]
  },
  {
    "id": "DISH-15",
    "name": "Nasi Tim Ayam Jamur Merang Hangat Lembut",
    "category": "lambung",
    "merchantName": "Dapur Nasi Tim Sehat",
    "district": "Menteng",
    "distanceKm": 1.8,
    "rating": 4.8,
    "soldCount": "910+",
    "basePrice": 30000,
    "discountedPrice": 24000,
    "imageUrl": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "healthyTags": [
      "Ramah Lambung",
      "Tekstur Lembut",
      "Kaldu Hangat"
    ],
    "macros": {
      "kcal": 340,
      "proteinG": 22,
      "carbsG": 44,
      "fatG": 6,
      "sodiumMg": 460
    },
    "cookingNotes": "Nasi tim lembut ramah maag, jamur merang segar, kaldu ayam jahe terpisah",
    "hygieneBadges": [
      "Kukus Bersih"
    ]
  },
  {
    "id": "DISH-16",
    "name": "Rawon Daging Bening Surabaya Tanpa Lemak",
    "category": "bebas-santan",
    "merchantName": "Rawon Bening Cak Tris",
    "district": "Senayan",
    "distanceKm": 1.6,
    "rating": 4.9,
    "soldCount": "1.4rb+",
    "basePrice": 40000,
    "discountedPrice": 33000,
    "imageUrl": "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&q=80",
    "healthyTags": [
      "Kluwek Alami",
      "Bebas Santan",
      "Daging Pilihan"
    ],
    "macros": {
      "kcal": 360,
      "proteinG": 35,
      "carbsG": 26,
      "fatG": 9,
      "sodiumMg": 560
    },
    "cookingNotes": "Daging sapi gandik tanpa lemak, kuah kluwek bening, tauge pendek segar",
    "hygieneBadges": [
      "Daging Halal Terverifikasi"
    ]
  },
  {
    "id": "DISH-17",
    "name": "Asem-Asem Daging Sapi Kuah Bening Belimbing Wuluh",
    "category": "bebas-santan",
    "merchantName": "Warung Jawa Segar",
    "district": "Palmerah",
    "distanceKm": 1.7,
    "rating": 4.7,
    "soldCount": "720+",
    "basePrice": 38000,
    "discountedPrice": 31000,
    "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "healthyTags": [
      "Bebas Santan",
      "Segar Alami",
      "Tinggi Zat Besi"
    ],
    "macros": {
      "kcal": 330,
      "proteinG": 32,
      "carbsG": 24,
      "fatG": 8,
      "sodiumMg": 520
    },
    "cookingNotes": "Belimbing wuluh segar, kuah bening kaldu murni, buncis segar",
    "hygieneBadges": [
      "Kaldu Segar"
    ]
  },
  {
    "id": "DISH-18",
    "name": "Garang Asem Ayam Kampung Bening Daun Pisang",
    "category": "bebas-santan",
    "merchantName": "Dapur Kudus Asli",
    "district": "SCBD",
    "distanceKm": 1.0,
    "rating": 4.9,
    "soldCount": "1.6rb+",
    "basePrice": 35000,
    "discountedPrice": 28500,
    "imageUrl": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "healthyTags": [
      "Tanpa Santan",
      "Ayam Kampung",
      "Kukus Tradisional"
    ],
    "macros": {
      "kcal": 310,
      "proteinG": 30,
      "carbsG": 18,
      "fatG": 7,
      "sodiumMg": 490
    },
    "cookingNotes": "Tanpa santan, kuah belimbing wuluh dan tomat hijau, cabe utuh tidak digerus",
    "hygieneBadges": [
      "Ayam Kampung Pilihan"
    ]
  },
  {
    "id": "DISH-19",
    "name": "Bubur Ayam Kampung Kaldu Bening Tanpa Merica",
    "category": "lambung",
    "merchantName": "Bubur Sehat Barito",
    "district": "Senayan",
    "distanceKm": 1.3,
    "rating": 4.8,
    "soldCount": "2.8rb+",
    "basePrice": 24000,
    "discountedPrice": 19000,
    "imageUrl": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&q=80",
    "healthyTags": [
      "Ramah Lambung",
      "Tekstur Halus",
      "Ayam Suwir"
    ],
    "macros": {
      "kcal": 280,
      "proteinG": 19,
      "carbsG": 42,
      "fatG": 5,
      "sodiumMg": 380
    },
    "cookingNotes": "Tanpa lada bubuk, tanpa cakwe berminyak, kaldu kuning dipisah, seledri segar",
    "hygieneBadges": [
      "Kaldu Rebus Murni"
    ]
  },
  {
    "id": "DISH-20",
    "name": "Sup Jagung Manis Telur Puyuh Lembut Ramah Maag",
    "category": "lambung",
    "merchantName": "Dapur Mama Sehat",
    "district": "Kuningan",
    "distanceKm": 0.9,
    "rating": 4.8,
    "soldCount": "1.1rb+",
    "basePrice": 25000,
    "discountedPrice": 20000,
    "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "healthyTags": [
      "Ramah Lambung",
      "Mudah Cerna",
      "Kaldu Bening"
    ],
    "macros": {
      "kcal": 240,
      "proteinG": 15,
      "carbsG": 30,
      "fatG": 6,
      "sodiumMg": 390
    },
    "cookingNotes": "Jagung manis dipipil halus, telur puyuh rebus matang, kaldu ayam hangat tanpa pedas",
    "hygieneBadges": [
      "Bahan Non-Alergen"
    ]
  },
  {
    "id": "DISH-21",
    "name": "Sayur Labu Siam Bening Kuah Temu Kunci",
    "category": "lambung",
    "merchantName": "Warteg Sejahtera",
    "district": "SCBD",
    "distanceKm": 0.6,
    "rating": 4.7,
    "soldCount": "890+",
    "basePrice": 17000,
    "discountedPrice": 14000,
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "healthyTags": [
      "Ramah Lambung",
      "Rendah Asam",
      "Budget Hemat"
    ],
    "macros": {
      "kcal": 150,
      "proteinG": 8,
      "carbsG": 20,
      "fatG": 3,
      "sodiumMg": 320
    },
    "cookingNotes": "Labu siam empuk dipotong korek, temu kunci segar harum, kuah jernih",
    "hygieneBadges": [
      "Sayur Segar Harian"
    ]
  },
  {
    "id": "DISH-22",
    "name": "Sup Wortel Kentang Bakso Ikan Tenggiri Asli",
    "category": "rendah-kalori",
    "merchantName": "Dapur Bakso Ikan Sehat",
    "district": "Menteng",
    "distanceKm": 1.4,
    "rating": 4.9,
    "soldCount": "1.3rb+",
    "basePrice": 28000,
    "discountedPrice": 22500,
    "imageUrl": "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&q=80",
    "healthyTags": [
      "Rendah Lemak",
      "Tenggiri Asli",
      "Bebas Boraks"
    ],
    "macros": {
      "kcal": 260,
      "proteinG": 24,
      "carbsG": 24,
      "fatG": 4,
      "sodiumMg": 490
    },
    "cookingNotes": "Bakso ikan rebus tanpa minyak, kuah kaldu ikan bening segar, seledri dan daun bawang",
    "hygieneBadges": [
      "Ikan Tenggiri Segar",
      "Tanpa Pengawet"
    ]
  },
  {
    "id": "DISH-23",
    "name": "Salad Segar Nusantara Saus Wijen Sangrai",
    "category": "rendah-kalori",
    "merchantName": "FitBite Greens",
    "district": "SCBD",
    "distanceKm": 0.5,
    "rating": 4.9,
    "soldCount": "2.2rb+",
    "basePrice": 32000,
    "discountedPrice": 26000,
    "imageUrl": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    "healthyTags": [
      "Rendah Kalori",
      "Kaya Antioksidan",
      "Fresh Cut"
    ],
    "macros": {
      "kcal": 210,
      "proteinG": 12,
      "carbsG": 22,
      "fatG": 6,
      "sodiumMg": 290
    },
    "cookingNotes": "Selada romaine, tomat ceri, timun jepang, dressing wijen sangrai dipisah",
    "hygieneBadges": [
      "Hydroponic Washed",
      "Food Grade Packaging"
    ]
  },
  {
    "id": "DISH-24",
    "name": "Poke Bowl Lokal Tempe Bacem Edamame Nasi Merah",
    "category": "protein",
    "merchantName": "FitBite Greens",
    "district": "SCBD",
    "distanceKm": 0.5,
    "rating": 4.8,
    "soldCount": "1.7rb+",
    "basePrice": 36000,
    "discountedPrice": 29000,
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    "healthyTags": [
      "Tinggi Protein",
      "Plant-Based",
      "Glukosa Stabil"
    ],
    "macros": {
      "kcal": 350,
      "proteinG": 26,
      "carbsG": 44,
      "fatG": 8,
      "sodiumMg": 410
    },
    "cookingNotes": "Tempe bacem panggang, edamame kukus, telur rebus setengah matang, shoyu rendah sodium",
    "hygieneBadges": [
      "Superfood Lokal"
    ]
  },
  {
    "id": "DISH-25",
    "name": "Ayam Panggang Klaten Bumbu Rempah Tanpa Santan",
    "category": "protein",
    "merchantName": "Ayam Panggang Bu Citro",
    "district": "Kuningan",
    "distanceKm": 1.2,
    "rating": 4.8,
    "soldCount": "1.0rb+",
    "basePrice": 34000,
    "discountedPrice": 27500,
    "imageUrl": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "healthyTags": [
      "Tinggi Protein",
      "Bakar Alami",
      "Bebas Santan"
    ],
    "macros": {
      "kcal": 340,
      "proteinG": 35,
      "carbsG": 20,
      "fatG": 8,
      "sodiumMg": 490
    },
    "cookingNotes": "Ungkep air kelapa murni tanpa santan kental, panggang kering harum",
    "hygieneBadges": [
      "Bumbu Rempah Segar"
    ]
  },
  {
    "id": "DISH-26",
    "name": "Ikan Kembung Bakar Kunyit + Sambal Dabu-Dabu",
    "category": "protein",
    "merchantName": "Dapur Ikan Laut Segar",
    "district": "Palmerah",
    "distanceKm": 1.6,
    "rating": 4.8,
    "soldCount": "870+",
    "basePrice": 30000,
    "discountedPrice": 24000,
    "imageUrl": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "healthyTags": [
      "Tinggi Omega-3",
      "Tinggi Protein",
      "Rendah Lemak Jenuh"
    ],
    "macros": {
      "kcal": 310,
      "proteinG": 30,
      "carbsG": 14,
      "fatG": 7,
      "sodiumMg": 450
    },
    "cookingNotes": "Kembung banjar segar, bakar tanpa arang gosong, sambal dabu-dabu segar jeruk nipis",
    "hygieneBadges": [
      "Ikan Tangkapan Segar"
    ]
  },
  {
    "id": "DISH-27",
    "name": "Tumis Buncis Jagung Manis + Tahu Sutra Organik",
    "category": "hemat",
    "merchantName": "Warteg Sehat Organik",
    "district": "Sudirman",
    "distanceKm": 1.1,
    "rating": 4.7,
    "soldCount": "1.2rb+",
    "basePrice": 19000,
    "discountedPrice": 15500,
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "healthyTags": [
      "Budget Hemat",
      "Kaya Serat",
      "Minyak Baru"
    ],
    "macros": {
      "kcal": 200,
      "proteinG": 12,
      "carbsG": 26,
      "fatG": 4,
      "sodiumMg": 340
    },
    "cookingNotes": "Buncis renyah matang, tahu sutra kukus lembut, tumis bawang putih harum",
    "hygieneBadges": [
      "Minyak Baru Terverifikasi"
    ]
  },
  {
    "id": "DISH-28",
    "name": "Sup Jamur Tiram Kaldu Jamur Gurih Alami",
    "category": "rendah-kalori",
    "merchantName": "Dapur Vegan Sehat",
    "district": "Menteng",
    "distanceKm": 1.5,
    "rating": 4.8,
    "soldCount": "620+",
    "basePrice": 22000,
    "discountedPrice": 18000,
    "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "healthyTags": [
      "Rendah Kalori",
      "Bebas Kolesterol",
      "Kaldu Sayur"
    ],
    "macros": {
      "kcal": 160,
      "proteinG": 10,
      "carbsG": 20,
      "fatG": 3,
      "sodiumMg": 310
    },
    "cookingNotes": "Jamur tiram & kuping segar, kaldu sayur bening wangi seledri, tanpa bumbu instan",
    "hygieneBadges": [
      "Jamur Organik Lokal"
    ]
  },
  {
    "id": "DISH-29",
    "name": "Paket Ikan Gurame Asam Manis Kukus Kuah Segar",
    "category": "bebas-santan",
    "merchantName": "Pondok Gurame Sehat",
    "district": "Senayan",
    "distanceKm": 1.7,
    "rating": 4.9,
    "soldCount": "890+",
    "basePrice": 42000,
    "discountedPrice": 34500,
    "imageUrl": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "healthyTags": [
      "Kukus Sehat",
      "Bebas Santan",
      "Ikan Air Tawar Segar"
    ],
    "macros": {
      "kcal": 330,
      "proteinG": 33,
      "carbsG": 28,
      "fatG": 6,
      "sodiumMg": 510
    },
    "cookingNotes": "Ikan gurame dikukus bukan digoreng tepung, saus tomat nanas segar alami",
    "hygieneBadges": [
      "Ikan Hidup Segar"
    ]
  },
  {
    "id": "DISH-30",
    "name": "Sayur Lodeh Kuah Susu Kedelai Rendah Lemak",
    "category": "bebas-santan",
    "merchantName": "Warteg Lestari Sehat",
    "district": "Sudirman",
    "distanceKm": 1.0,
    "rating": 4.7,
    "soldCount": "1.1rb+",
    "basePrice": 21000,
    "discountedPrice": 17500,
    "imageUrl": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&q=80",
    "healthyTags": [
      "Pengganti Santan",
      "Rendah Lemak Jenuh",
      "Kaya Serat"
    ],
    "macros": {
      "kcal": 220,
      "proteinG": 14,
      "carbsG": 28,
      "fatG": 5,
      "sodiumMg": 390
    },
    "cookingNotes": "Kuah gurih dari susu kedelai tanpa gula, terong labu siam kacang panjang empuk",
    "hygieneBadges": [
      "Inovasi Sehat Terverifikasi"
    ]
  },
  {
    "id": "DISH-31",
    "name": "Tahu Tempe Bacem Kukus Rendah Gula Aren",
    "category": "hemat",
    "merchantName": "Dapur Jogja Bening",
    "district": "Kuningan",
    "distanceKm": 0.9,
    "rating": 4.8,
    "soldCount": "1.6rb+",
    "basePrice": 15000,
    "discountedPrice": 12500,
    "imageUrl": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "healthyTags": [
      "Budget Hemat",
      "Kukus Alami",
      "Rendah Glikemik"
    ],
    "macros": {
      "kcal": 190,
      "proteinG": 16,
      "carbsG": 20,
      "fatG": 5,
      "sodiumMg": 310
    },
    "cookingNotes": "Bacem dikukus air kelapa tanpa goreng ulang, manis gurih ketumbar alami",
    "hygieneBadges": [
      "Kedelai Non-GMO"
    ]
  },
  {
    "id": "DISH-32",
    "name": "Sup Daging Sapi Kacang Merah (Brenebon Bening)",
    "category": "protein",
    "merchantName": "Dapur Manado Sehat",
    "district": "SCBD",
    "distanceKm": 1.1,
    "rating": 4.9,
    "soldCount": "1.3rb+",
    "basePrice": 39000,
    "discountedPrice": 32000,
    "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "healthyTags": [
      "Tinggi Protein",
      "Tinggi Zat Besi",
      "Tanpa Lemak"
    ],
    "macros": {
      "kcal": 340,
      "proteinG": 31,
      "carbsG": 32,
      "fatG": 7,
      "sodiumMg": 520
    },
    "cookingNotes": "Daging sapi tanpa lemak dipresto empuk, kacang merah empuk, pala cengkeh wangi",
    "hygieneBadges": [
      "Daging Sapi Segar Pilihan"
    ]
  }
];
